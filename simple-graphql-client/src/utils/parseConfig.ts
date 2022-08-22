import { DEFAULT_CONFIG, DEFAULT_CONFIG_PATHS, DEFAULT_ENV_NAMES, DEFAULT_ENV_SUBS, RECURSION_WARNING_THREHSOLD, REGEX, SUPPORTED_CONFIG_EXTENSIONS } from "../constants.js"
import { GeneratorConfig, SupportedConfigExtension } from "../types.js"
import fs from 'node:fs'
import path from 'node:path'
import { loadAll } from 'js-yaml'
import { initialize_json_config, initialize_js_config, initialize_ts_config, initialize_yml_config } from "./initializeConfig.js"
import { logger } from "./logger.js"

const check_config_paths = async (config_path: string): Promise<string> => {  
  if (config_path) {
    if (!fs.existsSync(path.join(process.cwd(), config_path))) logger.error(`Error reading config file (${path.join(process.cwd(), config_path)})`)
    return path.join(process.cwd(), config_path)
  }
  else {
    logger.warn("No config path was provided, so looking at root directory for a config with a supported config name and extension")
    // Here means user provided no config path, so look for default config paths to see if config is present
    const config_file_path: string[] = []
    
    await Promise.all(DEFAULT_CONFIG_PATHS.map(default_config_file => {
      if (fs.existsSync(path.join(process.cwd(), default_config_file))) {
        config_file_path.push(default_config_file)
      }
    }))
    
    if (config_file_path.length === 0) logger.error(`No config file was found`)
    if (config_file_path.length > 1) logger.error(`Multiple valid configs were found in root directory (${config_file_path.join(", ")}). Please, specify which one to use by passing it to the -c flag.`)
    
    logger.warn(`Config found (${config_file_path[0]})`)
    return path.join(process.cwd(), config_file_path[0])
  }
}

const check_env_paths = async (env_path: string): Promise<string | null> => {
  if (env_path) {
    if (!fs.existsSync(path.join(process.cwd(), env_path))) logger.error(`Error reading env file (${path.join(process.cwd(), env_path)})`)
    return path.join(process.cwd(), env_path)
  }
  else {
    logger.warn("No env path was provided, so looking at root directory for common env file names")

    // Here means user provided no config path, so look for default config paths to see if config is present
    const env_file_path: string[] = []
    
    await Promise.all(DEFAULT_ENV_NAMES.map(default_env_name => {
      if (fs.existsSync(path.join(process.cwd(), default_env_name))) {
        env_file_path.push(default_env_name)
      }
    }))
    
    if (env_file_path.length === 0) logger.warn(`No env file was found`)
    else if (env_file_path.length > 1) logger.warn(`Multiple env files were found in root directory (${env_file_path.join(", ")}). Please, specify which one to use by passing it to the -e flag`)
    else {
      logger.warn(`Env file found (${env_file_path[0]})`)
      return path.join(process.cwd(), env_file_path[0])
    }
    return null
  }
}

const check_file_extension = async (config_path: string): Promise<SupportedConfigExtension> => {  
  const caps = config_path.match(REGEX.match_file_extension)
  if (!caps) logger.error(`Error reading config file extension (${config_path})`)
  
  const ext = caps![0]
  let ext_found = false

  await Promise.all(Object.keys(SUPPORTED_CONFIG_EXTENSIONS).map(supported_extension => {
    if (ext.toLowerCase() === supported_extension) ext_found = true
  }))

  if (!ext_found) logger.error(`Unsupported file extension (${ext}) found in config file name`)

  return ext.toLowerCase() as SupportedConfigExtension
}
const run_env_sub = async (config_file_path: string, env_path: string) => {
  const envsub = await import('envsub')

  const env_file_path = await check_env_paths(env_path)
  if (!env_file_path) logger.warn( `Environment substitution will be ran without using an env file`)

  const options = {
    all: true, 
    diff: false, 
    envs: !env_file_path ? DEFAULT_ENV_SUBS : [],
    envFiles: env_file_path ? [env_file_path] : [],
    protect: true,
    syntax: "dollar-both" as const,
    system: true 
  }
  
  const { outputContents } = await envsub.default({templateFile: config_file_path, outputFile: "/dev/null", options: options})

  return outputContents
}

const yml_handler = async (config_file_path: string, env_path: string, config: GeneratorConfig) => {
  const data = await run_env_sub(config_file_path, env_path)

  // Here means config is a yml file
  const documents = loadAll(data)

  try {
    await initialize_yml_config(documents, config)
  }
  catch(e) {
    console.log(e)
    // logger.error("Error parsing yml config file")
    logger.error("")
  }
}

const json_handler = async (config_file_path: string, env_path: string, config: GeneratorConfig) => {
  const data = await run_env_sub(config_file_path, env_path)

  try {
    const conf = JSON.parse(data)

    await initialize_json_config(conf, config)
  }
  catch(e) {
    logger.error(`Error reading config file (${config_file_path})`)
  }
}

const js_handler = async (config_file_path: string, config: GeneratorConfig) => {
  try {
    const conf = await import(config_file_path)
    await initialize_js_config(conf, config)
  }
  catch(e) {
    logger.error(`Error reading config file (${config_file_path})`)
  }
}

const ts_handler = async (config_file_path: string, config: GeneratorConfig) => {
  try {
    const conf = await import(config_file_path)
    await initialize_ts_config(conf, config)
  }
  catch(e) {
    logger.error(`Error reading config file (${config_file_path})`)
  }
}

const validate_config = async (config: GeneratorConfig) => {
  // Now that we have all data from the config, we must make sure the whole config setup is logically sound
  if (config.client.to_run) {
    if (!config.global.endpoint && !config.global.schema_path) logger.error(`Client generator requires global configs (endpoint) or (schemaPath) to be set`)
    if (config.global.endpoint && config.global.schema_path && !config.schema.use_endpoint) logger.warn(`Config options (endpoint) and (schemaPath) were both provided. Config option (schemaPath) takes precedence, so if file is not found in (schemePath), endpoint will be used instead.`)
    if (!config.global.endpoint && config.global.schema_path && config.schema.use_endpoint) logger.warn(`Config options (useEndpoint) was set tot run, but config option (endpoint) was not set, so config option (schemaPath) will be used for schema gen.`)
    if (config.global.endpoint && config.global.schema_path && config.schema.use_endpoint) logger.warn(`Config options (endpoint) and (schemaPath) were both provided. Config option (schemaPath) takes precedence, but (useEndpoint) was set to true, so endpoint will be used and schemaPath will not be looked at.`)

    if (!config.types.to_run && !config.schema.to_run) {
      logger.warn(`Client generator requires types generator to run, so types generator will be ran with default settings`)
      config.types.to_run = true
    
      if (!config.schema.to_run && config.global.endpoint) {
        logger.warn(`Client generator requires types generator which in turn requires schema generator to run or a schema to be provided, so schema generator will be ran with the provided endpoint`)
        config.schema.to_run = true
        config.types.to_run = true
      }
      if (!config.schema.to_run && config.global.schema_path) {
        logger.warn(`Client generator requires types generator to run and types generator requires schema generator to run or a schema to be provided, so types generator will be ran with the provided schema`)
        config.types.to_run = true
      }
    }

    if (!config.client.output_dir) {
      logger.warn(`Client generator was not provided an outputDir, so client generator will be ran with the default output directory of ${DEFAULT_CONFIG.client.output_dir}`)
      config.client.output_dir = DEFAULT_CONFIG.client.output_dir
    }

    if (config.client.endpoint && !config.client.dev_endpoint) {
      // logger.warn(`The config option, devEndpoint, was not provided, so client generator will be ran with the default dev endpoint of ${DEFAULT_CONFIG.global.dev_endpoint}`)
      config.client.dev_endpoint = DEFAULT_CONFIG.client.dev_endpoint
    }
  }

  if (config.types.to_run) {
    // Here we don't deal with client generator since types generator only depends on schema generator
    if (!config.global.endpoint && !config.global.schema_path) logger.error(`Types generator requires an endpoint or a schema to run`)

    if (!config.schema.to_run && config.global.endpoint) {
      logger.warn(`Types generator requires schema generator to run or a schema to be provided, so schema generator will be ran with the provided endpoint`)
      config.schema.to_run = true
    }
    
    if (!config.types.output_dir) {
      logger.warn(`Types generator was not provided an outputDir, so types generator will be ran with the default output directory of ${DEFAULT_CONFIG.types.output_dir}`)
      config.types.output_dir = DEFAULT_CONFIG.types.output_dir
    }

    if (!config.types.enum_as_type && config.types.enum_type_suffix) {
      logger.warn(`enumTypeSuffix provided when enumAsType is false. enumTypeSuffix only works when enumAsType is true`)
    }

    if (config.types.enum_as_const && config.types.enum_as_type) {
      logger.warn(`Config options (enumAsType) and (enumAsConst) can't both be true. Only set one to true. In this case, enumAsConst takes precendence over enumAsType`)
      config.types.enum_as_type = false
    }
  }

  if (config.schema.to_run) {
    if (!config.schema.output_dir) {
      logger.warn(`Schema generator was not provided an outputDir, so schema generator will be ran with the default output directory of ${DEFAULT_CONFIG.schema.output_dir}`)
      config.schema.output_dir = DEFAULT_CONFIG.schema.output_dir
    }
  }

  if (config.global.object_recursion_limit >= RECURSION_WARNING_THREHSOLD) {
    logger.warn(`Optional config (objectRecursionLimit) was set to (${config.global.object_recursion_limit}). Setting a high number is not recommended`)
  }
}

export const parse_config = async (config_path: string, env_path: string): Promise<GeneratorConfig> => {
  const config: GeneratorConfig = {} as GeneratorConfig

  try {
    const config_file_path = await check_config_paths(config_path)
    const config_file_ext = await check_file_extension(config_file_path)

    if (config_file_ext === ".yml" || config_file_ext === ".yaml") {
      await yml_handler(config_file_path, env_path, config)
    }
    else if (config_file_ext === ".json") {
      // Here we do similar stuff to yml extension handler above
      await json_handler(config_file_path, env_path, config)

    }
    else if (config_file_ext === ".js" || config_file_ext === ".jsx") {
      // Here we are loading a JS file with module.exports
      // Therefore, we weill import that expecting a certain format
      await js_handler(config_file_path, config)
    }
    else if (config_file_ext === ".ts" || config_file_ext === ".tsx") {
      await ts_handler(config_file_path, config)
    }

    await validate_config(config)
  }
  catch (e) {
    logger.error(e)
  }

  return config
}