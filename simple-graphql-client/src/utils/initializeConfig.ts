import { camel_case_to_snake_case, is_in } from "lfd-utils"
import { CONFIG_NAMES_TO_IGNORE, DEFAULT_CONFIG, GENERATORS, RECURSION_WARNING_THREHSOLD } from "../constants.js"
import { GeneratorConfigs, SGC_Config } from "../sgc-types.js"
import { GeneratorConfig, ScalarOverrideData } from "../types.js"
import { logger } from "./logger.js"

const convert_config_to_snake_case = (config: any, ignore = false) => {
  if (config === undefined || config === null) {
    return config
  }
  else if (typeof config === "object" && !Array.isArray(config)) {
    const new_config: Record<string, any> = {}

    Object.keys(config).map(key => {
      if (Array.isArray(config[key])) {
        new_config[ignore ? key : camel_case_to_snake_case(key)] = convert_config_to_snake_case(config[key], is_in(camel_case_to_snake_case(key), CONFIG_NAMES_TO_IGNORE))
      }
      else if (typeof config[key] === "object") {
        new_config[ignore ? key : camel_case_to_snake_case(key)] = convert_config_to_snake_case(config[key], is_in(camel_case_to_snake_case(key), CONFIG_NAMES_TO_IGNORE))
      }
      else {
        new_config[ignore ? key : camel_case_to_snake_case(key)] = config[key]
      }
    })
    
    return new_config
  }
  else if (Array.isArray(config)) {
    const config_arr: any[] = []

    config.map(conf => {
      if (Array.isArray(conf)) {
        config_arr.push(convert_config_to_snake_case(conf))
      }
      else if (typeof conf === "object") {
        const new_obj: Record<string, any> = {}

        Object.keys(conf).map(key => {
          if (Array.isArray(conf[key])) {
            new_obj[ignore ? key : camel_case_to_snake_case(key)] = convert_config_to_snake_case(conf[key], camel_case_to_snake_case(key) === "scalars")
          }
          else if (typeof conf[key] === "object") {
            new_obj[ignore ? key : camel_case_to_snake_case(key)] = convert_config_to_snake_case(conf[key], camel_case_to_snake_case(key) === "scalars")
          }
          else {
            new_obj[ignore ? key : camel_case_to_snake_case(key)] = conf[key]
          }
        })
        config_arr.push(new_obj)
      }
      else {
        config_arr.push(conf)
      }
    })

    return config_arr
  }

  return config
}

const initialize_from_user_config = (user_config: any, config: GeneratorConfig) => {
  // Iterate all generatos and if anyone is missing, add an empty object to avoid possible execution/compilation errors
  Object.keys(GENERATORS).map(generator_name => {
    if (!user_config.generator[generator_name]) user_config.generator[generator_name] = {}
  })

  const wasProvided = (to_check: any) => {
    try { return to_check !== undefined && to_check !== null } catch(e) { return null }
  }

  config.global = {
    schema_path: wasProvided(user_config.schema_path) ? user_config.schema_path : DEFAULT_CONFIG.global.schema_path,
    endpoint: wasProvided(user_config.endpoint) ? user_config.endpoint : DEFAULT_CONFIG.global.endpoint,
    dev_endpoint: wasProvided(user_config.dev_endpoint) ? user_config.dev_endpoint : DEFAULT_CONFIG.global.dev_endpoint,
    install_deps: wasProvided(user_config.install_deps) ? user_config.install_deps : DEFAULT_CONFIG.global.install_deps,
    install_types: wasProvided(user_config.install_types) ? user_config.install_types : DEFAULT_CONFIG.global.install_types,
    use_yarn: wasProvided(user_config.use_yarn) ? user_config.use_yarn : DEFAULT_CONFIG.global.use_yarn,
    disable_warnings: wasProvided(user_config.disable_warnings) ? user_config.disable_warnings : DEFAULT_CONFIG.global.disable_warnings,
    use_single_quotes: wasProvided(user_config.use_single_quotes) ? user_config.use_single_quotes : DEFAULT_CONFIG.global.use_single_quotes,
    object_recursion_limit: wasProvided(user_config.object_recursion_limit) ? user_config.object_recursion_limit : DEFAULT_CONFIG.global.object_recursion_limit,
    imports_as_esm: wasProvided(user_config.imports_as_esm) ? user_config.imports_as_esm : DEFAULT_CONFIG.global.imports_as_esm,
    prettier_format: wasProvided(user_config.prettier_format) ? user_config.prettier_format : DEFAULT_CONFIG.global.prettier_format,
    indent_spaces: wasProvided(user_config.indent_spaces) ? user_config.indent_spaces : DEFAULT_CONFIG.global.indent_spaces,
    use_conventions: wasProvided(user_config.use_conventions) ? user_config.use_conventions : DEFAULT_CONFIG.global.use_conventions,
  }
  config.schema = {
    to_run: Object.keys(user_config.generator.schema).length > 0 ? true : false,
    output_dir: wasProvided(user_config.generator.schema.output_dir) ? user_config.generator.schema.output_dir : DEFAULT_CONFIG.schema.output_dir,
    authorization: wasProvided(user_config.generator.schema.authorization) ? user_config.generator.schema.authorization : DEFAULT_CONFIG.schema.authorization,
    wipe_output_dir: wasProvided(user_config.generator.schema.wipe_output_dir) ? user_config.generator.schema.wipe_output_dir : DEFAULT_CONFIG.schema.wipe_output_dir,
    use_endpoint: wasProvided(user_config.generator.schema.use_endpoint) ? user_config.generator.schema.use_endpoint : DEFAULT_CONFIG.schema.use_endpoint,
  }

  let scalars: Map<string, ScalarOverrideData> = new Map()  

  if (user_config.generator.types) {
    if (Object.keys(user_config.generator.types).length > 0) {
      if (wasProvided(user_config.generator.types.scalars)) {
        
        if (Array.isArray(user_config.generator.types.scalars)) {
          user_config.generator.types.scalars.map((scalar_override_obj: any) => {

            const keys = Object.keys(scalar_override_obj)
            if (keys.length !== 1) logger.error(`Invalid object detected in (scalarOverrides)`)
            const scalar_to_override = keys[0]
            const scalar_override: ScalarOverrideData = scalar_override_obj[scalar_to_override]

            if (scalars.get(scalar_to_override)) logger.error(`Multiple scalar overrides were found for scalar (${scalar_to_override})`)

            if (!scalar_override.override) logger.error(`Invalid format for scalar override of scalar (${scalar_to_override})`)

            scalars.set(scalar_to_override, {
              override: scalar_override.override,
              is_default: scalar_override.is_default ? scalar_override.is_default : false,
              from: scalar_override.from,
              import: scalar_override.import
            })
          })
        }
        else if (typeof user_config.generator.types.scalars === "object") {
          Object.keys(user_config.generator.types.scalars).map(scalar_to_override => {
            const scalar_override: ScalarOverrideData = user_config.generator.types.scalars[scalar_to_override]

            if (scalars.get(scalar_to_override)) logger.error(`Multiple scalar overrides were found for scalar (${scalar_to_override})`)

            if (!scalar_override.override) logger.error(`Invalid format for scalar override of scalar (${scalar_to_override})`)

            scalars.set(scalar_to_override, {
              override: scalar_override.override,
              is_default: scalar_override.is_default ? scalar_override.is_default : false,
              from: scalar_override.from,
              import: scalar_override.import
            })
          })

          user_config.generator.types.scalars = scalars
        }
        else {
          logger.error(`Scalar overrides must be an array of scalar overrides or an object of scalar overrides`)
        }
      }
      else scalars = DEFAULT_CONFIG.types.scalars as Map<string, ScalarOverrideData>
    }
  }

  config.types = {
    to_run: Object.keys(user_config.generator.types).length > 0 ? true : false,  
    enum_as_type: wasProvided(user_config.generator.types.enum_as_type) ? user_config.generator.types.enum_as_type : DEFAULT_CONFIG.types.enum_as_type,  
    enum_as_const: wasProvided(user_config.generator.types.enum_as_const) ? user_config.generator.types.enum_as_const : DEFAULT_CONFIG.types.enum_as_const,  
    add_typename_field: wasProvided(user_config.generator.types.add_typename_field) ? user_config.generator.types.add_typename_field : DEFAULT_CONFIG.types.add_typename_field,  
    enum_type_suffix: wasProvided(user_config.generator.types.enum_type_suffix) ? user_config.generator.types.enum_type_suffix : DEFAULT_CONFIG.types.enum_type_suffix,  
    add_null: wasProvided(user_config.generator.types.add_null) ? user_config.generator.types.add_null : DEFAULT_CONFIG.types.add_null,  
    add_undefined: wasProvided(user_config.generator.types.add_undefined) ? user_config.generator.types.add_undefined : DEFAULT_CONFIG.types.add_undefined,  
    scalars: scalars,
    output_dir: wasProvided(user_config.generator.types.output_dir) ? user_config.generator.types.output_dir : DEFAULT_CONFIG.types.output_dir,
    wipe_output_dir: wasProvided(user_config.generator.types.wipe_output_dir) ? user_config.generator.types.wipe_output_dir : DEFAULT_CONFIG.types.wipe_output_dir
  }

  let recursionOverrides: Map<string, number> = new Map()

  if (user_config.generator.client) {
    if (Object.keys(user_config.generator.client).length > 0) {
      // If delay is less than 100, I'll assume you meant seconds instead of milliseconds
      // IT better to do this since a delay of less than 100ms is not really a delay and I can't
      // think of a case where inputting a delay of 100ms is crucial
      if (wasProvided(user_config.generator.client.fetch_delay) ) {
        if (user_config.generator.client.fetch_delay < 100) {
          logger.warn(`Config option (fetchDelay) was given a value of less than 100 ms. I'll assume that you meant to pass (${user_config.generator.client.fetch_delay}) seconds insteand of milliseconds, so delay will be changed to (${user_config.generator.client.fetch_delay * 1000}) milliseconds which equates to (${user_config.generator.client.fetch_delay}) seconds`)
          user_config.generator.client.fetch_delay = user_config.generator.client.fetch_delay * 1000
        }
      }

      if (wasProvided(user_config.generator.client.recursion_overrides)) {
        if (Array.isArray(user_config.generator.client.recursion_overrides)) {
          user_config.generator.client.recursion_overrides.map((recursion_override_obj: any) => {

            const keys = Object.keys(recursion_override_obj)
            if (keys.length !== 1) logger.error(`Invalid object detected in (recursionOverrides)`)
            const type_to_override = keys[0]
            const recursion_override: number = recursion_override_obj[type_to_override]

            if (recursionOverrides.get(type_to_override)) logger.error(`Multiple recursion overrides were found for type (${type_to_override})`)
            if (recursion_override > RECURSION_WARNING_THREHSOLD) logger.warn(`Recursion limit override for (${type_to_override}) was set to a high number, (${recursion_override}). This is not recommended, especially on big project with huge schemas.`)

            recursionOverrides.set(type_to_override, recursion_override)
          })
        }
        else if (typeof user_config.generator.client.recursion_overrides === "object") {
          Object.keys(user_config.generator.client.recursion_overrides).map(type_to_override => {
            const recursion_override: number = user_config.generator.client.recursion_overrides[type_to_override]

            if (recursionOverrides.get(type_to_override)) logger.error(`Multiple recursion overrides were found for type (${type_to_override})`)
            if (recursion_override > RECURSION_WARNING_THREHSOLD) logger.warn(`Recursion limit override for (${type_to_override}) was set to a high number, (${recursion_override}). This is not recommended, especially on big project with huge schemas.`)
            
            recursionOverrides.set(type_to_override, recursion_override)
          })

          user_config.generator.client.recursion_overrides = recursionOverrides
        }
        else {
          logger.error(`Recursion overrides must be an array of recursion overrides or an object of recursion overrides`)
        }
      }
      else recursionOverrides = DEFAULT_CONFIG.client.recursion_overrides as Map<string, number>
    }
  }

  config.client = {
    to_run: Object.keys(user_config.generator.client).length > 0 ? true : false,
    fetch_delay: wasProvided(user_config.generator.client.fetch_delay) ? user_config.generator.client.fetch_delay : DEFAULT_CONFIG.client.fetch_delay,
    loop_fetch_limit: wasProvided(user_config.generator.client.loop_fetch_limit) ? user_config.generator.client.loop_fetch_limit : DEFAULT_CONFIG.client.loop_fetch_limit,
    output_dir: wasProvided(user_config.generator.client.output_dir) ? user_config.generator.client.output_dir : DEFAULT_CONFIG.client.output_dir,
    wipe_output_dir: wasProvided(user_config.generator.client.wipe_output_dir) ? user_config.generator.client.wipe_output_dir : DEFAULT_CONFIG.client.wipe_output_dir,
    dev_endpoint: wasProvided(user_config.generator.client.dev_endpoint) ? user_config.generator.client.dev_endpoint : DEFAULT_CONFIG.client.dev_endpoint,
    endpoint: wasProvided(user_config.generator.client.endpoint) ? user_config.generator.client.endpoint : DEFAULT_CONFIG.client.endpoint,
    recursion_overrides: recursionOverrides,
    gen_hooks: wasProvided(user_config.generator.client.gen_hooks) ? user_config.generator.client.gen_hooks : DEFAULT_CONFIG.client.gen_hooks,
  }
}

export const initialize_yml_config = async (documents: unknown[], config: GeneratorConfig) => {
  const document_number = documents ? documents.length ? documents[0] ? Object.keys(documents[0] as any).length ? documents.length : 0 : 0 : 0 : 0
  if (!document_number) logger.error("Error parsing config file")
  let valid = false

  const user_config: any = {
    generator: {}
  }

  if (document_number === 1) {
    // Make sure yml config is an object and not an array or a singular value
    if (Array.isArray(documents[0])) logger.error(`Config provided seems to be an array of configs, which is invalid. Please make sure the config is an object and not an array at root level.`)
    if (typeof documents[0] !== "object") logger.error(`Config provided seems to not be an object, which is invalid. Please make sure the config is an object at root level.`)


    // Here we have an object of generators or an array of generators in one document
    const doc = convert_config_to_snake_case(documents[0] as Record<string, any>) as any

    // Add global settings to user_config
    Object.keys(doc).map(key => {
      if (key !== "generator") {
        user_config[key] = doc[key]
      }
    })

    // Check generator
    if (!doc.generator) logger.error(`Config option (generator) must be an array of generators or an object of generators`)

    if (Array.isArray(doc.generator)) {
      // Here means that user provided one document with an array of generators
      if (doc.generator.length === 0) logger.error(`Config option (generator) must be an array of one or more generators or an object of one or more generators`)
  
      doc.generator.map((input_generator_obj: any) => {

        const keys = Object.keys(input_generator_obj)
        if (keys.length !== 1) logger.error(`Invalid object detected inside (generator) config`)
        const input_generator_name = keys[0]
        const input_generator = input_generator_obj[input_generator_name]
        if (typeof input_generator !== "object" && typeof input_generator !== "string") logger.error(`Generators must be an object or a string if you want to use default setting for a generator`)

        if (is_in(input_generator_name, GENERATORS)) valid = true
        if (!valid) logger.error(`Invalid generator provided (${input_generator_name})`)
        valid = false //reset

        Object.keys(user_config.generator).map(key => {
          if (input_generator_name === key) logger.error(`Generator (${input_generator_name}) was provided to more than one document.`)
        })

        user_config.generator[input_generator_name] = typeof input_generator === "object" ? input_generator : {}
      })
    }
    else if (typeof doc.generator === "object") {
      // Here means that user provided one document with an object of generator
      if (Object.keys(doc.generator).length === 0) logger.error(`Config option (generator) must be an array of one or more generators or an object of one or more generators`)
          
      Object.keys(doc.generator).map((input_generator_name: any) => {
        const input_generator = doc.generator[input_generator_name]
        if (typeof input_generator !== "object" && typeof input_generator !== "string") logger.error(`Generators must be an object or a string if you want to use default setting for a generator`)

        if (is_in(input_generator_name, GENERATORS)) valid = true
        if (!valid) logger.error(`Invalid generator provided (${input_generator_name})`)
        valid = false //reset

        Object.keys(user_config.generator).map(key => {
          if (input_generator_name === key) logger.error(`Generator (${input_generator_name}) was provided to more than one document.`)
        })

        user_config.generator[input_generator_name] = typeof input_generator === "object" ? input_generator : {}
      })
    }
    else {
      logger.error(`Config option (generator) must be an array of generators or an object of generators`)
    }
  }
  else {
    // Here means user provided multiple documents
    // THe idea here is to iterate every doc and build up the user_config object
    // Up to four documents can exist as of now
    // One for global configs, and one for each generator
    // Global configs can be spread through documents
    // but no global config can be repeated across documents
    // 

    if (documents.length > Object.keys(GENERATORS).length + 1) {
      logger.error(`Config file has too many documents. Only one document per generator and one more for global configs if necessary, so a max of (${documents.length + 1}) documents can be provided in a yml config file.`)
    }

    for (const document of documents) {
      // Make sure yml config is an object and not an array or a singular value
      if (Array.isArray(document)) logger.error(`Config provided seems to be an array of configs, which is invalid. Please make sure the config is an object and not an array at root level.`)
      if (typeof document !== "object") logger.error(`Config provided seems to not be an object, which is invalid. Please make sure the config is an object at root level.`)

      const doc = convert_config_to_snake_case(document as Record<string, any>) as any

      // Add global settings to user_config
      Object.keys(doc).map(key => {
        if (key !== "generator") {
          if (user_config[key] !== undefined) logger.error(`Config option (${key}) is present in multiple documents. Global configs are shared accross documents, so only set a global config once in a document and don't set it again in another document.`)
          user_config[key] = doc[key]
        }
      })

      if (doc.generator) {
        if (Array.isArray(doc.generator)) {
          if (doc.generator.length === 0) logger.error(`Config option (generator) must be an array of one or more generators or an object of one or more generators`)
  
          doc.generator.map((input_generator_obj: any) => {

            const keys = Object.keys(input_generator_obj)
            if (keys.length !== 1) logger.error(`Invalid object detected inside (generator) config`)
            const input_generator_name = keys[0]
            const input_generator = input_generator_obj[input_generator_name]
            if (typeof input_generator !== "object" && typeof input_generator !== "string") logger.error(`Generators must be an object or a string if you want to use default setting for a generator`)

            if (is_in(input_generator_name, GENERATORS)) valid = true
            if (!valid) logger.error(`Invalid generator provided (${input_generator_name})`)
            valid = false //reset

            Object.keys(user_config.generator).map(key => {
              if (input_generator_name === key) logger.error(`Generator (${input_generator_name}) was provided to more than one document.`)
            })    

            user_config.generator[input_generator_name] = typeof input_generator === "object" ? input_generator : {}
          })
        }
        else if (typeof doc.generator === "object") {
          if (Object.keys(doc.generator).length === 0) logger.error(`Config option (generator) must be an array of one or more generators or an object of one or more generators`)
          
          Object.keys(doc.generator).map((input_generator_name: any) => {
            const input_generator = doc.generator[input_generator_name]
            if (typeof input_generator !== "object" && typeof input_generator !== "string") logger.error(`Generators must be an object or a string if you want to use default setting for a generator`)

            if (is_in(input_generator_name, GENERATORS)) valid = true
            if (!valid) logger.error(`Invalid generator provided (${input_generator_name})`)
            valid = false //reset

            Object.keys(user_config.generator).map(key => {
              if (input_generator_name === key) logger.error(`Generator (${input_generator_name}) was provided to more than one document.`)
            })    

            user_config.generator[input_generator_name] = typeof input_generator === "object" ? input_generator : {}
          })
        }
        else {
          logger.error(`Config option (generator) must be an array of generators or an object of generators`)
        }
      }
    }
  }

  // Now that we have user_config setup with all data, we can now initialize the config object
  initialize_from_user_config(user_config, config)
}

export const initialize_json_config = async (conf: Record<string, any>, config: GeneratorConfig) => {
  const json_config = convert_config_to_snake_case(conf)
  let valid = false

  const user_config: any = {}

  Object.keys(json_config).map(key => {
    if (key !== "generator") {
      user_config[key] = json_config[key]
    }
  })

  if (!json_config.generator) logger.error(`Config option (generator) must be an array of generators or an object of generators`)

  if (Array.isArray(json_config.generator)) {
    if (json_config.generator.length === 0) logger.error(`Config option (generator) must be an array of one or more generators or an object of one or more generators`)
  
    json_config.generator.map((input_generator_obj: any) => {

      const keys = Object.keys(input_generator_obj)
      if (keys.length !== 1) logger.error(`Invalid object detected inside (generator) config`)
      const input_generator_name = keys[0]
      const input_generator = input_generator_obj[input_generator_name]
      if (typeof input_generator !== "object" && typeof input_generator !== "string") logger.error(`Generators must be an object or a string if you want to use default setting for a generator`)

      if (is_in(input_generator_name, GENERATORS)) valid = true
      if (!valid) logger.error(`Invalid generator provided (${input_generator_name})`)
      valid = false //reset

      Object.keys(user_config.generator).map(key => {
        if (input_generator_name === key) logger.error(`Generator (${input_generator_name}) was provided to more than one document.`)
      })

      user_config.generator[input_generator_name] = typeof input_generator === "object" ? input_generator : {}
    })
  }
  else if (typeof json_config.generator === "object") {
    if (Object.keys(json_config.generator).length === 0) logger.error(`Config option (generator) must be an array of one or more generators or an object of one or more generators`)
          
    Object.keys(json_config.generator).map((input_generator_name: any) => {
      const input_generator = json_config.generator[input_generator_name]
      if (typeof input_generator !== "object" && typeof input_generator !== "string") logger.error(`Generators must be an object or a string if you want to use default setting for a generator`)

      if (is_in(input_generator_name, GENERATORS)) valid = true
      if (!valid) logger.error(`Invalid generator provided (${input_generator_name})`)
      valid = false //reset

      Object.keys(user_config.generator).map(key => {
        if (input_generator_name === key) logger.error(`Generator (${input_generator_name}) was provided to more than one document.`)
      })

      user_config.generator[input_generator_name] = typeof input_generator === "object" ? input_generator : {}
    })
  }
  else {
    logger.error(`Config option (generator) must be an array of generators or an object of generators`)
  }

  initialize_from_user_config(user_config, config)
}


export const initialize_js_config = async (conf: Record<string, any>, config: GeneratorConfig) => {
  const js_config = convert_config_to_snake_case(conf) as SGC_Config

  const user_config: any = {}

  Object.keys(js_config).map(key => {
    if (key !== "generator") {
      user_config[key] = js_config[key as keyof SGC_Config]
    }
  })

  if (!js_config.generator) logger.error(`No generator were provided in the config file`)

  Object.keys(GENERATORS).map(generator_name => {
    if (js_config.generator![generator_name as keyof GeneratorConfigs] === undefined) user_config.generator[generator_name] = {}
    else user_config.generator[generator_name] = js_config.generator![generator_name as keyof GeneratorConfigs]
  })

  initialize_from_user_config(user_config, config)
}

export const initialize_ts_config = async (conf: Record<string, any>, config: GeneratorConfig) => {
  const ts_config = convert_config_to_snake_case(conf) as SGC_Config

  const user_config: any = {}

  Object.keys(ts_config).map(key => {
    if (key !== "generator") {
      user_config[key] = ts_config[key as keyof SGC_Config]
    }
  })

  if (!ts_config.generator) logger.error(`No generator were provided in the config file`)

  Object.keys(GENERATORS).map(generator_name => {
    if (ts_config.generator![generator_name as keyof GeneratorConfigs] === undefined) user_config.generator[generator_name] = {}
    else user_config.generator[generator_name] = ts_config.generator![generator_name as keyof GeneratorConfigs]
  })

  initialize_from_user_config(user_config, config)
}