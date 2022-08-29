import path from "path"
import { parse_schema_for_typescript, SchemaData } from "simple-wasm-graphql-parser"
import { FileData, GeneratorConfig, GeneratorData, ImportData, TypesGeneratorExport } from "../types.js"
import { Indent, gen_fields as gen_fields, write_format_file, gen_description, convert_scalar_to_type, add_relative_import, gen_imports, get_type_name, add_imports, override_types_data } from "../utils/index.js"
import { GRAPHQL_ROOT_OPERATIONS, logger, RESPONSE_ENDINGS, TYPES_GENERATOR_DIRS } from "../constants.js"
import { is_in, ends_with_any } from "lfd-utils"

export const run_parser = async (raw_sdl: string, data: GeneratorData) => {  
  try {
    // Here we call our awesome rust parser
    data.schema_data = parse_schema_for_typescript(raw_sdl) as SchemaData
  }
  catch(e) {
    logger.error("Error running Simple WASM GraphQL Parser")
  }
}

export const gen_import_data = async (data: GeneratorData, config: GeneratorConfig) => {
  // Basically, we have to do the following:
  // 1. Go though all types and create import data for each type

  // Here we will determine where every type should be generated to
  // This will help with automating imports for all files one we start generating file contents

  if (data.schema_data.enum_types) {
    await Promise.all(data.schema_data.enum_types.map(e => {
      const file_name = `${e.name}.ts`
      const file_name_import = `${e.name}`
      const file_name_import_js = `${e.name}.js`
      const file_dir = path.join(config.types.output_dir!, TYPES_GENERATOR_DIRS.enums)
      const file_path = path.join(file_dir, file_name)
      const same_dir_import_path = config.global.imports_as_esm ? path.join(file_dir, file_name_import_js) : path.join(file_dir, file_name_import)
      const from_import_path = config.global.imports_as_esm ? path.join(config.types.output_dir!, "index.js") : config.types.output_dir! // All files outside types folder will only import from the index file

      data.file_data.set(e.name, {
        file_name: file_name,
        file_dir: file_dir,
        file_path: file_path, // Where file is located
        same_dir_import_path: same_dir_import_path, // How imports in types folder would import this relatively
        from_import_path: from_import_path, // How utils files would import this
        imports: new Map(),
        generator: "types"
      })
    }))
  }

  if (data.schema_data.input_object_types) {
    await Promise.all(data.schema_data.input_object_types.map(i => {
      const file_name = `${i.name}.ts`
      const file_name_import = `${i.name}`
      const file_name_import_js = `${i.name}.js`
      const file_dir = path.join(config.types.output_dir!, TYPES_GENERATOR_DIRS.inputs)
      const file_path = path.join(file_dir, file_name)
      const same_dir_import_path = config.global.imports_as_esm ? path.join(file_dir, file_name_import_js) : path.join(file_dir, file_name_import)
      const from_import_path = config.global.imports_as_esm ?  path.join(config.types.output_dir!, "index.js") : config.types.output_dir!

      data.file_data.set(i.name, {
        file_name: file_name,
        file_dir: file_dir,
        file_path: file_path,
        same_dir_import_path: same_dir_import_path,
        from_import_path: from_import_path,
        imports: new Map(),
        generator: "types"
      })
    }))
  }

  if (data.schema_data.interface_types) {
    await Promise.all(data.schema_data.interface_types.map(i => {
      const file_name = `${i.name}.ts`
      const file_name_import = `${i.name}`
      const file_name_import_js = `${i.name}.js`
      const file_dir = path.join(config.types.output_dir!, TYPES_GENERATOR_DIRS.interfaces)
      const file_path = path.join(file_dir, file_name)
      const same_dir_import_path = config.global.imports_as_esm ? path.join(file_dir, file_name_import_js) : path.join(file_dir, file_name_import)
      const from_import_path = config.global.imports_as_esm ?  path.join(config.types.output_dir!, "index.js") : config.types.output_dir!

      data.file_data.set(i.name, {
        file_name: file_name,
        file_dir: file_dir,
        file_path: file_path,
        same_dir_import_path: same_dir_import_path,
        from_import_path: from_import_path,
        imports: new Map(),
        generator: "types"
      })
    }))
  }

  if (data.schema_data.object_types) {
    await Promise.all(data.schema_data.object_types.map(o => {
      const file_name = `${o.name}.ts`
      const file_name_import = `${o.name}`
      const file_name_import_js = `${o.name}.js`
      let file_dir = ""
 
      if (is_in(o.name, GRAPHQL_ROOT_OPERATIONS)) file_dir = path.join(config.types.output_dir!, TYPES_GENERATOR_DIRS.operations)
      else if (ends_with_any(o.name, RESPONSE_ENDINGS, false)) file_dir = path.join(config.types.output_dir!, TYPES_GENERATOR_DIRS.outputs)
      else file_dir = path.join(config.types.output_dir!, TYPES_GENERATOR_DIRS.objects)

      const file_path = path.join(file_dir, file_name)
      const same_dir_import_path = config.global.imports_as_esm ? path.join(file_dir, file_name_import_js) : path.join(file_dir, file_name_import)
      const from_import_path = config.global.imports_as_esm ?  path.join(config.types.output_dir!, "index.js") : config.types.output_dir!

      data.file_data.set(o.name, {
        file_name: file_name,
        file_dir: file_dir,
        file_path: file_path,
        same_dir_import_path: same_dir_import_path,
        from_import_path: from_import_path,
        imports: new Map(),
        generator: "types"
      })
    }))
  }

  if (data.schema_data.operation_types) {
    await Promise.all(data.schema_data.operation_types.map(o => {
      const file_name = `${o.name}.ts`
      const file_name_import = `${o.name}`
      const file_name_import_js = `${o.name}.js`
      const file_dir = path.join(config.types.output_dir!, TYPES_GENERATOR_DIRS.operations)
      const file_path = path.join(file_dir, file_name)
      const same_dir_import_path = config.global.imports_as_esm ? path.join(file_dir, file_name_import_js) : path.join(file_dir, file_name_import)
      const from_import_path = config.global.imports_as_esm ?  path.join(config.types.output_dir!, "index.js") : config.types.output_dir!

      data.file_data.set(o.name, {
        file_name: file_name,
        file_dir: file_dir,
        file_path: file_path,
        same_dir_import_path: same_dir_import_path,
        from_import_path: from_import_path,
        imports: new Map(),
        generator: "types"
      })
    }))
  }

  if (data.schema_data.scalar_types) {
    await Promise.all(data.schema_data.scalar_types.map(s => {
      // All scalars will be on one file. No need to have one file per scalar with just 'export type ScalarName = any'
      const file_name = `scalars.ts`
      const file_name_import = `scalars`
      const file_name_import_js = `scalars.js`
      const file_dir = path.join(config.types.output_dir!, TYPES_GENERATOR_DIRS.scalars)
      const file_path = path.join(file_dir, file_name)
      const same_dir_import_path = config.global.imports_as_esm ? path.join(file_dir, file_name_import_js) : path.join(file_dir, file_name_import)
      const from_import_path = config.global.imports_as_esm ?  path.join(config.types.output_dir!, "index.js") : config.types.output_dir!

      data.file_data.set(s.name, {
        file_name: file_name,
        file_dir: file_dir,
        file_path: file_path,
        same_dir_import_path: same_dir_import_path,
        from_import_path: from_import_path,
        imports: new Map(),
        generator: "types"
      })
    }))
  }

  if (data.schema_data.union_types) {
    await Promise.all(data.schema_data.union_types.map(u => {
      // All unions will be on one file. No need to have one file per union with just 'export type UnionName = Type1 | Type2'
      const file_name = `unions.ts`
      const file_name_import = `unions`
      const file_name_import_js = `unions.js`
      const file_dir = path.join(config.types.output_dir!, TYPES_GENERATOR_DIRS.unions)
      const file_path = path.join(file_dir, file_name)
      const same_dir_import_path = config.global.imports_as_esm ? path.join(file_dir, file_name_import_js) : path.join(file_dir, file_name_import)
      const from_import_path = config.global.imports_as_esm ?  path.join(config.types.output_dir!, "index.js") : config.types.output_dir!

      data.file_data.set(u.name, {
        file_name: file_name,
        file_dir: file_dir,
        file_path: file_path,
        same_dir_import_path: same_dir_import_path,
        from_import_path: from_import_path,
        imports: new Map(),
        generator: "types"
      })
    }))
  }

  // If user provided a types_dir, then we use those instead, so override those import data here
  await override_types_data(data, config)
}

export const gen_enums = async (data: GeneratorData, config: GeneratorConfig): Promise<string[] | null> => {
  if (data.schema_data.enum_types) {
    const i = new Indent(config).indent

    const enums = await Promise.all(data.schema_data.enum_types.map(async (e) => {
      const file_data = data.file_data.get(e.name)
      if (file_data!.overriden) return "" // Skip if this type was overriden

      const enum_values = e.values.map((value) => {
        const value_desc = gen_description(value.description, 1, config)
        return [
          value_desc,
          `${i(1)}${value.value} = '${value.value}'`
        ].filter(Boolean).join("\n")
      }
      ).filter(Boolean).join(',\n')

      const enum_desc = gen_description(e.description, 0, config)
      
      const enum_as_type = `export type ${e.name} = keyof typeof ${e.name}${config.types.enum_type_suffix}` 

      const enum_as_const = e.values.map((value) => {
        const value_desc = gen_description(value.description, 1, config)
        return [
          value_desc,
          `${i(1)}${value.value}: '${value.value}'`
        ].filter(Boolean).join("\n")
      }).filter(Boolean).join(',\n')

      const enum_as_const_type = `export type ${e.name} = typeof ${e.name}[keyof typeof ${e.name}]`
      
      if (config.types.enum_as_const) {
        return [
          `export const ${e.name} = {`,
            `${enum_as_const}`,
          `} as const`,
          enum_desc,
          `${enum_as_const_type}\n`
        ].filter(Boolean).join("\n")
      }
      else if (config.types.enum_as_type) {
        return [
          enum_desc,
          `export enum ${e.name}${config.types.enum_type_suffix} {`,
            `${enum_values}`,
          `}`,
          `${enum_as_type}\n`
        ].filter(Boolean).join("\n")
      }
      else {
        return [
          enum_desc,
          `export enum ${e.name} {`,
            `${enum_values}`,
          `}\n`
        ].filter(Boolean).join("\n")
      }
    }))
    
    return enums.filter(Boolean) 
  }

  return null
}

export const gen_inputs = async (data: GeneratorData, config: GeneratorConfig): Promise<string[] | null> => {
  const ind = new Indent(config).indent
  
  if (data.schema_data.input_object_types) {
    const inputs = await Promise.all(data.schema_data.input_object_types.map(async (i) => {
      const file_data = data.file_data.get(i.name)
      if (file_data!.overriden) return "" // Skip if this type was overriden

      const desc = gen_description(i.description, 0, config)
      
      // gen_fields calls the add_relative_import which will do nothing is passed an empty string,
      // so pass empty string as parent_type_name if not separating by files
      const fields = await gen_fields(i.fields, i.name, data, config)

      // let typename_field = config.types.add_typename_field ? `${ind(1)}__typename?: '${i.name}',` : ""      
      // if (i.name.includes("?") && config.types.add_null && config.types.add_typename_field) typename_field += ' | null'
      // if (i.name.includes("?") && config.types.add_undefined && config.types.add_typename_field) typename_field += ' | undefined'

      return [
        desc,
        `export type ${i.name} = {`,
          // typename_field,
          fields,
        `}\n`
      ].filter(Boolean).join("\n")
    }))

    return inputs.filter(Boolean)
  }
  return null
}

export const gen_interfaces = async (data: GeneratorData, config: GeneratorConfig): Promise<string[] | null> => {
  const ind = new Indent(config).indent
  
  if (data.schema_data.interface_types) {
    const interfaces = await Promise.all(data.schema_data.interface_types.map(async (i) => {
      const file_data = data.file_data.get(i.name)
      if (file_data!.overriden) return "" // Skip if this type was overriden

      const desc = gen_description(i.description, 0, config)
      const fields = await gen_fields(i.fields, i.name, data, config)

      let typename_field = config.types.add_typename_field ? `${ind(1)}__typename?: '${i.name}',` : ""      
      if (i.name.includes("?") && config.types.add_null && config.types.add_typename_field) typename_field += ' | null'
      if (i.name.includes("?") && config.types.add_undefined && config.types.add_typename_field) typename_field += ' | undefined'

      const interface_implements = !i.implements ? "" : i.implements.map((implement: string) => {
        add_relative_import(i.name, implement, data, config)
        return config.types.add_typename_field ? `Omit<${implement}, "__typename">` : implement
      }).filter(Boolean).join(" & ")

      return [
        desc,
        `export type ${i.name} = {`,
          typename_field,
          fields,
        `} ${interface_implements ? "& " + interface_implements : ""}\n`
      ].filter(Boolean).join("\n")
    }))

    return interfaces.filter(Boolean)
  }
  return null
}

export const gen_objects = async (data: GeneratorData, config: GeneratorConfig): Promise<string[] | null> => {
  const i = new Indent(config).indent
  
  if (data.schema_data.object_types) {
    const objects = await Promise.all(data.schema_data.object_types.map(async (o) => {
      if (!ends_with_any(o.name, RESPONSE_ENDINGS, false) && !is_in(o.name, GRAPHQL_ROOT_OPERATIONS)) {
        const file_data = data.file_data.get(o.name)
        if (file_data!.overriden) return "" // Skip if this type was overriden

        const desc = gen_description(o.description, 0, config)
        const fields = await gen_fields(o.fields, o.name, data, config)

        let typename_field = config.types.add_typename_field ? `${i(1)}__typename?: '${o.name}',` : ""      
        if (o.name.includes("?") && config.types.add_null && config.types.add_typename_field) typename_field += ' | null'
        if (o.name.includes("?") && config.types.add_undefined && config.types.add_typename_field) typename_field += ' | undefined'

        const object_implements = !o.implements ? "" : o.implements.map(implement => {
          add_relative_import(o.name, implement, data, config)
          return config.types.add_typename_field ? `Omit<${implement}, "__typename">` : implement
        }).filter(Boolean).join(" & ")

        return [
          desc,
          `export type ${o.name} = {`,
            typename_field,
            fields,
          `} ${object_implements ? "& " + object_implements : ""}\n`
        ].filter(Boolean).join("\n")
      }
      else return ""
    }))

    return objects.filter(Boolean)
  }
  return null
}

export const gen_operations = async (data: GeneratorData, config: GeneratorConfig): Promise<string[] | null> => {
  const i = new Indent(config).indent
  
  if (data.schema_data.object_types) {
    const operations = await Promise.all(data.schema_data.object_types.map(async (o) => {
      if (is_in(o.name, GRAPHQL_ROOT_OPERATIONS)) {
        const file_data = data.file_data.get(o.name)
        if (file_data!.overriden) return "" // Skip if this type was overriden

        const desc = gen_description(o.description, 0, config)
        const fields = await gen_fields(o.fields, o.name, data, config)
        let typename_field = config.types.add_typename_field ? `${i(1)}__typename?: '${o.name}',` : ""      
        if (i.name.includes("?") && config.types.add_null && config.types.add_typename_field) typename_field += ' | null'
        if (i.name.includes("?") && config.types.add_undefined && config.types.add_typename_field) typename_field += ' | undefined'
        
        const operation_implements = !o.implements ? "" : o.implements.map(implement => {
          return config.types.add_typename_field ? `Omit<${implement}, "__typename">` : implement
        }).filter(Boolean).join(" & ")

        return [
          desc,
          `export type ${o.name} = {`,
            typename_field,
            fields,
          `} ${operation_implements}\n`
        ].filter(Boolean).join("\n")
      }
      else return ""
    }))

    return operations.filter(Boolean)
  }
  return null
}

export const gen_outputs = async (data: GeneratorData, config: GeneratorConfig): Promise<string[] | null> => {
  const i = new Indent(config).indent
  
  if (data.schema_data.object_types) {
    const outputs = await Promise.all(data.schema_data.object_types.map(async (o) => {
      if (ends_with_any(o.name, RESPONSE_ENDINGS, false)) {
        const file_data = data.file_data.get(o.name)
        if (file_data!.overriden) return "" // Skip if this type was overriden

        const desc = gen_description(o.description, 0, config)
        const fields = await gen_fields(o.fields, o.name, data, config)
        let typename_field = config.types.add_typename_field ? `${i(1)}__typename?: '${o.name}',` : ""      
        if (i.name.includes("?") && config.types.add_null && config.types.add_typename_field) typename_field += ' | null'
        if (i.name.includes("?") && config.types.add_undefined && config.types.add_typename_field) typename_field += ' | undefined'
        
        const output_implements = !o.implements ? "" : o.implements.map(implement => {
          return config.types.add_typename_field ? `Omit<${implement}, "__typename">` : implement
        }).filter(Boolean).join(" & ")

        return [
          desc,
          `export type ${o.name} = {`,
            typename_field,
            fields,
          `} ${output_implements}\n`
        ].filter(Boolean).join("\n")
      }
      else return ""
    }))

    return outputs.filter(Boolean)
  }
  return null
}

export const gen_scalars = async (data: GeneratorData, config: GeneratorConfig): Promise<string[] | null> => {
  if (data.schema_data.scalar_types) {
    const scalars = await Promise.all(data.schema_data.scalar_types.map(async (s) => {
      const file_data = data.file_data.get(s.name)
      if (file_data!.overriden) return "" // Skip if this type was overriden

      const desc = gen_description(s.description, 0, config)
      const scalar_type = convert_scalar_to_type(s.name, s.name, data, config)

      return [
        desc,
        `export type ${s.name} = ${scalar_type}`
      ].filter(Boolean).join("\n")
    }))

    return scalars.filter(Boolean)
  }
  return null
}

export const gen_unions = async (data: GeneratorData, config: GeneratorConfig): Promise<string[] | null> => {
  if (data.schema_data.union_types) {
    const unions = await Promise.all(data.schema_data.union_types.map(async (u) => {
      const file_data = data.file_data.get(u.name)
      if (file_data!.overriden) return "" // Skip if this type was overriden

      const desc = gen_description(u.description, 0, config)
      const unions = u.member_types ? u.member_types.filter(Boolean).join(" | ") : "any"

      if (u.member_types) {
        u.member_types.map(member => add_relative_import(u.name, member, data, config))
      }
      
      return [
        desc,
        `export type ${u.name} = ${unions}`
      ].filter(Boolean).join("\n")
    }))

    return unions.filter(Boolean)
  }
  return null
}


export const create_enum_files = async (enums: string[] | null, data: GeneratorData, config: GeneratorConfig) => {
  if (!enums) return
  if (enums.length === 0) return

  const exports: string[] = []

  let name: string

  await Promise.all(enums.map(async (e) => {
    if (config.types.enum_as_const) {
      name = get_type_name(e, "const")
    }
    else {
      name = get_type_name(e, "enum")
    }
    
    if (!name) logger.error(`Error getting name from this enum -> ${e}`)

    if (config.types.enum_as_type) name = name.replace(config.types.enum_type_suffix, "")

    const file_data = data.file_data.get(name)
    if (!file_data) logger.error(`Error getting file data for enum -> ${name}`)
    
    const imports = file_data ? gen_imports(file_data.imports) : ""

    const contents = [
      imports ? imports.join("\n") : "",
      e
    ]

    await write_format_file(file_data!.file_dir, file_data!.file_name, contents, config)

    exports.push(`export * from './${config.global.imports_as_esm ? file_data!.file_name.replace(".ts", ".js") : file_data!.file_name.replace(".ts", "")}'`)
  }))

  // Removes all duplicates, whic is good for cases like scalars which are all on just one file
  const index_file = exports.filter((e, pos) => exports.indexOf(e) === pos).join("\n")
  const index_file_dir = path.join(config.types.output_dir!, TYPES_GENERATOR_DIRS.enums)

  const contents = [
    index_file
  ]

  await write_format_file(index_file_dir, "index.ts", contents, config)
}

export const create_input_files = async (inputs: string[] | null, data: GeneratorData, config: GeneratorConfig) => {
  if (!inputs) return
  if (inputs.length === 0) return
  
  const exports: string[] = []

  await Promise.all(inputs.map(async (i) => {
    const name: string = get_type_name(i, "type")
    if (!name) logger.error(`Error getting name from this input -> ${i}`)

    const file_data = data.file_data.get(name)
    if (!file_data) logger.error(`Error getting file data for input -> ${name}`)
    
    const imports = file_data ? gen_imports(file_data.imports) : ""

    const contents = [
      imports ? imports.join("\n") : "",
      i
    ]

    await write_format_file(file_data!.file_dir, file_data!.file_name, contents, config)

    exports.push(`export * from './${config.global.imports_as_esm ? file_data!.file_name.replace(".ts", ".js") : file_data!.file_name.replace(".ts", "")}'`)
  }))

  const index_file = exports.filter((e, pos) => exports.indexOf(e) === pos).join("\n")
  const index_file_dir = path.join(config.types.output_dir!, TYPES_GENERATOR_DIRS.inputs)

  const contents = [
    index_file
  ]
  
  await write_format_file(index_file_dir, "index.ts", contents, config)
}

export const create_interfaces_files = async (interfaces: string[] | null, data: GeneratorData, config: GeneratorConfig) => {
  if (!interfaces) return
  if (interfaces.length === 0) return
  
  const exports: string[] = []

  await Promise.all(interfaces.map(async (i) => {
    const name: string = get_type_name(i, "type")
    if (!name) logger.error(`Error getting name from this inteface -> ${i}`)

    const file_data = data.file_data.get(name)
    if (!file_data) logger.error(`Error getting file data for interface -> ${name}`)
    
    const imports = file_data ? gen_imports(file_data.imports) : ""

    const contents = [
      imports ? imports.join("\n") : "",
      i
    ]

    await write_format_file(file_data!.file_dir, file_data!.file_name, contents, config)

    exports.push(`export * from './${config.global.imports_as_esm ? file_data!.file_name.replace(".ts", ".js") : file_data!.file_name.replace(".ts", "")}'`)
  }))

  const index_file = exports.filter((e, pos) => exports.indexOf(e) === pos).join("\n")
  const index_file_dir = path.join(config.types.output_dir!, TYPES_GENERATOR_DIRS.interfaces)

  const contents = [
    index_file
  ]

  await write_format_file(index_file_dir, "index.ts", contents, config)
}

export const create_object_files = async (objects: string[] | null, data: GeneratorData, config: GeneratorConfig) => {
  if (!objects) return
  if (objects.length === 0) return
  
  const exports: string[] = []

  await Promise.all(objects.map(async (o) => {
    const name: string = get_type_name(o, "type")
    if (!name) logger.error(`Error getting name from this object -> ${o}`)

    const file_data = data.file_data.get(name)
    if (!file_data) logger.error(`Error getting file data for object -> ${name}`)
    
    const imports = file_data ? gen_imports(file_data.imports) : ""

    const contents = [
      imports ? imports.join("\n") : "",
      o
    ]

    await write_format_file(file_data!.file_dir, file_data!.file_name, contents, config)

    exports.push(`export * from './${config.global.imports_as_esm ? file_data!.file_name.replace(".ts", ".js") : file_data!.file_name.replace(".ts", "")}'`)
  }))

  const index_file = exports.filter((e, pos) => exports.indexOf(e) === pos).join("\n")
  const index_file_dir = path.join(config.types.output_dir!, TYPES_GENERATOR_DIRS.objects)

  const contents = [
    index_file
  ]

  await write_format_file(index_file_dir, "index.ts", contents, config)
}

export const create_operation_files = async (operations: string[] | null, data: GeneratorData, config: GeneratorConfig) => {
  if (!operations) return
  if (operations.length === 0) return
  
  const exports: string[] = []

  await Promise.all(operations.map(async (op) => {
    const name: string = get_type_name(op, "type")
    if (!name) logger.error(`Error getting name from this operation -> ${op}`)

    const file_data = data.file_data.get(name)
    if (!file_data) logger.error(`Error getting file data for operation -> ${name}`)
    
    const imports = file_data ? gen_imports(file_data.imports) : ""

    const contents = [
      imports ? imports.join("\n") : "",
      op
    ]

    await write_format_file(file_data!.file_dir, file_data!.file_name, contents, config)

    exports.push(`export * from './${config.global.imports_as_esm ? file_data!.file_name.replace(".ts", ".js") : file_data!.file_name.replace(".ts", "")}'`)
  }))

  const index_file = exports.filter((e, pos) => exports.indexOf(e) === pos).join("\n")
  const index_file_dir = path.join(config.types.output_dir!, TYPES_GENERATOR_DIRS.operations)

  const contents = [
    index_file
  ]

  await write_format_file(index_file_dir, "index.ts", contents, config)
}

export const create_outputs_files = async (outputs: string[] | null, data: GeneratorData, config: GeneratorConfig) => {
  if (!outputs) return
  if (outputs.length === 0) return
  
  const exports: string[] = []

  await Promise.all(outputs.map(async (o) => {
    const name: string = get_type_name(o, "type")
    if (!name) logger.error(`Error getting name from this output -> ${o}`)

    const file_data = data.file_data.get(name)
    if (!file_data) logger.error(`Error getting file data for output -> ${name}`)
    
    const imports = file_data ? gen_imports(file_data.imports) : ""

    const contents = [
      imports ? imports.join("\n") : "",
      o
    ]

    await write_format_file(file_data!.file_dir, file_data!.file_name, contents, config)

    exports.push(`export * from './${config.global.imports_as_esm ? file_data!.file_name.replace(".ts", ".js") : file_data!.file_name.replace(".ts", "")}'`)
  }))

  const index_file = exports.filter((e, pos) => exports.indexOf(e) === pos).join("\n")
  const index_file_dir = path.join(config.types.output_dir!, TYPES_GENERATOR_DIRS.outputs)

  const contents = [
    index_file
  ]

  await write_format_file(index_file_dir, "index.ts", contents, config)
}

export const create_scalars_files = async (scalars: string[] | null, data: GeneratorData, config: GeneratorConfig) => {
  if (!scalars) return
  if (scalars.length === 0) return
  
  const exports: string[] = []
  const imports: Map<string, ImportData> = new Map()
  let file_data: FileData

  // Since these scalars all go in one file, we have different logic for that here
  await Promise.all(scalars.map(async (s) => {
    const name: string = get_type_name(s, "type")
    if (!name) logger.error(`Error getting name from this scalar -> ${s}`)

    const temp_file_data = data.file_data.get(name)
    if (!temp_file_data) logger.error(`Error getting file data for scalar -> ${name}`)
    file_data = temp_file_data!

    await add_imports(temp_file_data!.imports, imports)

    exports.push(`export * from './${config.global.imports_as_esm ? temp_file_data!.file_name.replace(".ts", ".js") : temp_file_data!.file_name.replace(".ts", "")}'`)
  }))

  const imports_to_add = gen_imports(imports)

  const file_contents = [
    imports_to_add ? imports_to_add.filter(Boolean).join("\n") : "",
    scalars.join("\n")
  ]

  await write_format_file(file_data!.file_dir, file_data!.file_name, file_contents, config)

  const index_file = exports.filter((e, pos) => exports.indexOf(e) === pos).join("\n")
  const index_file_dir = path.join(config.types.output_dir!, TYPES_GENERATOR_DIRS.scalars)

  const index_contents = [
    index_file
  ]

  await write_format_file(index_file_dir, "index.ts", index_contents, config)
}

export const create_unions_files = async (unions: string[] | null, data: GeneratorData, config: GeneratorConfig) => {
  if (!unions) return
  if (unions.length === 0) return
  
  const exports: string[] = []
  const imports: Map<string, ImportData> = new Map()
  let file_data: FileData

  await Promise.all(unions.map(async (u) => {
    const name: string = get_type_name(u, "type")
    if (!name) logger.error(`Error getting name from this union -> ${u}`)

    const temp_file_data = data.file_data.get(name)
    if (!temp_file_data) logger.error(`Error getting file data for union -> ${name}`)
    file_data = temp_file_data!
    
    await add_imports(temp_file_data!.imports, imports)

    exports.push(`export * from './${config.global.imports_as_esm ? temp_file_data!.file_name.replace(".ts", ".js") : temp_file_data!.file_name.replace(".ts", "")}'`)
  }))

  const imports_to_add = gen_imports(imports)

  const file_contents = [
    imports_to_add ? imports_to_add.filter(Boolean).join("\n") : "",
    unions.join("\n")
  ]

  await write_format_file(file_data!.file_dir, file_data!.file_name, file_contents, config)

  const index_file = exports.filter((e, pos) => exports.indexOf(e) === pos).join("\n")
  const index_file_dir = path.join(config.types.output_dir!, TYPES_GENERATOR_DIRS.unions)

  const index_contents = [
    index_file
  ]

  await write_format_file(index_file_dir, "index.ts", index_contents, config)
}

export const create_types_generator_index_file = async (exports: TypesGeneratorExport[], config: GeneratorConfig) => {
  const index_file: string[] = []
  const index_file_name = config.global.imports_as_esm ? 'index.js' : 'index'

  exports.map(e => index_file.push(`export * from './${path.join(e, index_file_name)}'`))
  
  await write_format_file(config.types.output_dir!, "index.ts", index_file, config)
}