import { remove_dir } from 'lfd-utils'
import path from 'path'
import { logger, PACKAGE_FULL_NAME, PACKAGE_NAME } from './constants.js'
import { gen_enums, query_schema, read_schema, create_enum_files, run_parser, gen_import_data, gen_inputs, gen_interfaces, gen_objects, gen_operations, gen_outputs, gen_scalars, gen_unions, create_input_files, create_interfaces_files, create_object_files, create_operation_files, create_outputs_files, create_scalars_files, create_unions_files, create_types_generator_index_file, gen_client_types, gen_client_contants, gen_client_data, gen_clients_functions, create_client_types_files, create_client_constants_files, create_client_data_files, create_client_function_files, create_client_generator_index_file, create_schema_file, gen_client_utils, gen_client_hooks, create_client_utils_files, create_client_hooks_files } from './helpers/index.js'
import { ClientGeneratorExport, GeneratorData, TypesGeneratorExport } from './types.js'
import { parse_config, get_dependencies, install_dependencies } from './utils/index.js'

export const run_generator = async (config_path: string, env_path: string, warnings: boolean) => {
  logger.pkg_name = PACKAGE_NAME
  logger.full_pkg_name = PACKAGE_FULL_NAME
  logger.disable_warnings = !warnings

  logger.info(`Running`)

  const data: GeneratorData = {
    schema_data: undefined as any,
    dependencies: new Map(),
    file_data: new Map()
  }

  const config = await parse_config(config_path, env_path)

  if (config.schema.to_run) {
    logger.info(`Running schema generator`)
    let raw_sdl: string | null = ""
    let found = false

    if (config.schema.use_endpoint) {
      const raw_sdl = await query_schema(config)

      if (!raw_sdl) {
        if (config.global.schema_path) {
          const raw_sdl = await read_schema(config, true)
          if (!raw_sdl) logger.error(`Error querying schema from endpoint at (${config.global.endpoint}) and there was an error reading the schema provided ad schemaPath set to (${config.global.schema_path}).`)
          else {
            if (config.schema.wipe_output_dir) {
              logger.warn(`Config option (wipeOutputDir) was provided to schema config, so directory (${path.join(process.cwd(), config.schema.output_dir!)}) will be wiped`)
              await remove_dir(path.join(process.cwd(), config.schema.output_dir!), false)
            }
        
            await create_schema_file(raw_sdl!, config)
          }
        }
        else {
          logger.error(`Error querying schema from endpoint at (${config.global.endpoint}) and config (schemaPath) was not provided, so schema gen failed.`)
        }
      }

      if (config.schema.wipe_output_dir) {
        logger.warn(`Config option (wipeOutputDir) was provided to schema config, so directory (${path.join(process.cwd(), config.schema.output_dir!)}) will be wiped`)
        await remove_dir(path.join(process.cwd(), config.schema.output_dir!), false)
      }
  
      await create_schema_file(raw_sdl!, config)
    }
    else {
      if (config.global.schema_path) {
        // If schema path was provided, attempt to read it and if it checks out, we skip schema querying
        raw_sdl = await read_schema(config, true)
        if (!raw_sdl) logger.warn(`Error reading schema from schema path at ${config.global.schema_path}`)
        else {
          logger.info(`Schema was found. Skipping schema query.`)
          found = true
        }
      }
      
      if (!found) {
        const raw_sdl = await query_schema(config)
        if (!raw_sdl) logger.error(`Error querying schema from endpoint at (${config.global.endpoint})`)
  
        if (config.schema.wipe_output_dir) {
          logger.warn(`Config option (wipeOutputDir) was provided to schema config, so directory (${path.join(process.cwd(), config.schema.output_dir!)}) will be wiped`)
          await remove_dir(path.join(process.cwd(), config.schema.output_dir!), false)
        }
    
        await create_schema_file(raw_sdl!, config)
      }
    }

    logger.info(`Schema generator done`)
  }


  if (config.types.to_run) {
    logger.info(`Running types generator`)

    // if (config.global.schema_path && config.schema.to_run) logger.warn(`Config option (schemaPath) was provided, but schema generator was ran, so the value given to schemaPath (${config.global.schema_path}) will be preserved and used instead of the scheme file that was just generated at (${path.join(config.schema.output_dir!, 'schema.graphql')})`)

    let raw_sdl: string | null = ""

    if (config.schema.to_run) {
      // Here means we know that schema gen succeeded
      raw_sdl = await read_schema(config)
      if (!raw_sdl) logger.error(`Error reading schema from file at ${config.global.schema_path}`)
    }
    else {
      if (!config.global.schema_path) {
        logger.warn(`No schema provided and schema generator was not ran, so schema will be fetched from endpoint, but will NOT be saved`)
        raw_sdl = await query_schema(config)
        if (!raw_sdl) logger.error(`Error querying schema from endpoint`)
      }
      else {
        raw_sdl = await read_schema(config)
        if (!raw_sdl) logger.error(`Error reading schema from file at ${config.global.schema_path}`)
      }
    }

    // Here we call our custom rust graphql parser
    await run_parser(raw_sdl!, data)

    await gen_import_data(data, config)

    const enums = await gen_enums(data, config)
    const inputs = await gen_inputs(data, config)
    const interfaces = await gen_interfaces(data, config)
    const objects = await gen_objects(data, config)
    const operations = await gen_operations(data, config)
    const outputs = await gen_outputs(data, config)
    const scalars = await gen_scalars(data, config)
    const unions = await gen_unions(data, config)

    if (config.types.wipe_output_dir) {
      logger.warn(`Config option (wipeOutputDir) was provided to types config, so directory (${path.join(process.cwd(), config.types.output_dir!)}) will be wiped`)
      await remove_dir(path.join(process.cwd(), config.types.output_dir!), false)
    }

    await create_enum_files(enums, data, config)
    await create_input_files(inputs, data, config)
    await create_interfaces_files(interfaces, data, config)
    await create_object_files(objects, data, config)
    await create_operation_files(operations, data, config)
    await create_outputs_files(outputs, data, config)
    await create_scalars_files(scalars, data, config)
    await create_unions_files(unions, data, config)
    
    const exports: TypesGeneratorExport[] = []
    if (enums.length > 0) exports.push("enums")
    if (inputs.length > 0) exports.push("inputs")
    if (interfaces.length > 0) exports.push("interfaces")
    if (objects.length > 0) exports.push("objects")
    if (operations.length > 0) exports.push("operations")
    if (outputs.length > 0) exports.push("outputs")
    if (scalars.length > 0) exports.push("scalars")
    if (unions.length > 0) exports.push("unions")

    await create_types_generator_index_file(exports, config)

    logger.info(`Types generator done`)
  }

  if (config.client.to_run) {
    logger.info(`Running client generator`)
    const operation_data = await gen_client_data(data, config)
    const types = await gen_client_types(data, config)
    const constants = await gen_client_contants(data, config)
    const utils = await gen_client_utils(data, config)
    const functions = await gen_clients_functions(data, config)
    const hooks = await gen_client_hooks(data, config)

    if (config.client.wipe_output_dir) {
      logger.warn(`Config option (wipeOutputDir) was provided to client config, so directory (${path.join(process.cwd(), config.client.output_dir!)}) will be wiped`)
      await remove_dir(path.join(process.cwd(), config.client.output_dir!), false)
    }
    
    await create_client_data_files(operation_data, data, config)
    await create_client_types_files(types, data, config)
    await create_client_constants_files(constants, data, config)
    await create_client_utils_files(utils, data, config)
    await create_client_function_files(functions, data, config)
    await create_client_hooks_files(hooks, data, config)

    const exports: ClientGeneratorExport[] = []
    if (operation_data.length > 0) exports.push("data")
    if (types.length > 0) exports.push("types")
    if (constants.length > 0) exports.push("constants")
    if (utils.length > 0) exports.push("utils")
    if (functions.length > 0) exports.push("functions")
    if (hooks.length > 0) exports.push("hooks")

    await create_client_generator_index_file(exports, config)

    logger.info(`Client generator done`)
  }
  
  if (config.global.install_deps) {
    logger.info(`Installing dependencies`)
    const dependencies = await get_dependencies(data)
    await install_dependencies(dependencies, config)
    logger.info(`Dependencies installed`)
  }

  logger.info(`Done...`)
  process.exit(0)
}