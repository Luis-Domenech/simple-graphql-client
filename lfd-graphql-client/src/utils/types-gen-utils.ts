import fs from 'fs'
import path from 'path'
import readline from 'readline'
import events from 'events'

import { FieldData, FieldArgumentData } from 'simple-wasm-graphql-parser'
import { logger, REGEX, TYPE_FILES_TO_READ } from "../constants.js"
import { GeneratorConfig, GeneratorData } from "../types.js"
import { add_import, add_relative_import } from "./import-utils.js"
import { Indent } from "./indent.js"
import { ends_with_any, match_first } from "lfd-utils"
import { add_artefacts } from "./addArtefacts.js"


const gen_arguments_types = async (field: FieldData, add_imports_to: string, data: GeneratorData, config: GeneratorConfig): Promise<string | null> => {
  const has_arguments = field.arguments ? true : false
  
  if (has_arguments) {
    const args: string[] = []

    field.arguments!.map((arg: FieldArgumentData) => {
      if (field.default_value) args.push()

      const array_depth = (arg.argument_complete_type.match(REGEX.match_closing_brackets) || []).length

      const arg_name = arg.is_nullable ? `${arg.name}?` : arg.name
      
      let arg_type = ""

      if (arg.argument_type === "String") arg_type = 'string' + '[]'.repeat(array_depth)
      else if (arg.argument_type === "ID") arg_type = 'string' + '[]'.repeat(array_depth)
      else if (arg.argument_type === "Int") arg_type = 'number' + '[]'.repeat(array_depth)
      else if (arg.argument_type === "Float") arg_type = 'number' + '[]'.repeat(array_depth)
      else if (arg.argument_type === "GraphQLBigInt") arg_type = 'bigint' + '[]'.repeat(array_depth)
      else if (arg.argument_type === "GraphQLByte") arg_type = 'Buffer' + '[]'.repeat(array_depth)
      // else if (arg.argument_type === "DateTime") arg_type = field.is_array ? `Date[]` : `Date`
      else if (arg.argument_type === "Boolean") arg_type = 'boolean' + '[]'.repeat(array_depth)
      else if (arg.argument_type === "Json" || arg.argument_type === "JSON" || arg.argument_type === "GraphQLJSONObject") arg_type = 'JSON' + '[]'.repeat(array_depth)
      else if (arg.argument_type === "DecimalScalar") {
        const file_data = data.file_data.get(add_imports_to)
        if (!file_data) logger.error(`Error getting file data for ${add_imports_to}`)
      
        add_import('Prisma', '@prisma/client', false, data.dependencies)
        add_import('Prisma', '@prisma/client', false, file_data!.imports)

        arg_type = `Prisma.Decimal` + '[]'.repeat(array_depth)
      }
      else arg_type = `${arg_type}` + '[]'.repeat(array_depth)
      
      if (arg_name.includes("?") && config.types.add_null) arg_type += ' | null'
      if (arg_name.includes("?") && config.types.add_undefined) arg_type += ' | undefined'

      args.push(`${arg.name}: ${arg_type}`)
    })
    return `(${args.join(", ")})`
  }

  return null
}



export const gen_description = (description: string | null | undefined, indent: number, config: GeneratorConfig): string | null => {
  if (!description) return null

  const i = new Indent(config).indent
  const desc_lines = description.replace(/\r\n/gm, "\n").split("\n")
  const desc = desc_lines.map(desc_line => `${i(indent)} * ${desc_line}`).filter(Boolean).join('\n')

  return [
    `${i(indent)}/**`,
    desc,
    `${i(indent)} */`
  ].join("\n")
}

const instantiate_field_return = (field: FieldData | FieldArgumentData, to_return: any, add_artefact: boolean, args: string | null, config: GeneratorConfig) => {
  const is_argument = (field as FieldArgumentData).argument_type
  const complete_field_type = is_argument ? (field as FieldArgumentData).argument_complete_type : (field as FieldData).field_complete_type
  const array_depth = (complete_field_type.match(REGEX.match_closing_brackets) || []).length  
  
  let ret = add_artefact ? `${to_return}` : to_return

  for (let i = 0; i < array_depth; i++) {
    ret = add_artefact ? `[${ret}]` : [ret]
  }

  ret = add_artefact ? add_artefacts(ret) : ret

  // Field has argument and thus is a function
  if (args) add_artefacts(`${args} => ${JSON.stringify(ret)}`)
  return ret
}

// Used for scalars and unions
export const fill_is_type_field_Data = (field: FieldData | FieldArgumentData, data: GeneratorData) => {
  const is_argument = (field as FieldArgumentData).argument_type
  const field_type = is_argument ? (field as FieldArgumentData).argument_type : (field as FieldData).field_type

  if (data.schema_data.enum_types) data.schema_data.enum_types.map(e => {if (e.name === field_type) field.is_enum = true; return})
  // if (data.schema_data.input_object_types) data.schema_data.input_object_types.map(i => {if (i.name === field_type) return})
  // if (data.schema_data.object_types) data.schema_data.object_types.map(o => {if (o.name === field_type) return})
  // if (data.schema_data.operation_types) data.schema_data.operation_types.map(o => {if (o.name === field_type) return})
  if (data.schema_data.scalar_types) data.schema_data.scalar_types.map(s => {if (s.name === field_type) field.is_scalar = true; return})
  if (data.schema_data.union_types) data.schema_data.union_types.map(u => {if (u.name === field_type) field.is_union = true; return})
}

export const is_an_input = (field: FieldData | FieldArgumentData, data: GeneratorData) => {
  const is_argument = (field as FieldArgumentData).argument_type
  const field_type = is_argument ? (field as FieldArgumentData).argument_type : (field as FieldData).field_type
  let found = false
  if (data.schema_data.input_object_types) data.schema_data.input_object_types.map(i => {if (i.name === field_type) found = true})

  return found
}


export const convert_to_ts_type = (field: FieldData | FieldArgumentData, add_imports_to: string, data: GeneratorData) => {  
  const field_type = (field as FieldData).field_type ? (field as FieldData).field_type : (field as FieldArgumentData).argument_type
  const complete_field_type = (field as FieldData).field_complete_type ? (field as FieldData).field_complete_type : (field as FieldArgumentData).argument_complete_type
  const array_depth = (complete_field_type.match(REGEX.match_closing_brackets) || []).length

  if (field_type === "String") return 'string' + '[]'.repeat(array_depth)
  else if (field_type === "ID") return 'string' + '[]'.repeat(array_depth)
  else if (field_type === "Int") return 'number' + '[]'.repeat(array_depth)
  else if (field_type === "Float") return 'number' + '[]'.repeat(array_depth)
  else if (field_type === "GraphQLBigInt") return 'bigint' + '[]'.repeat(array_depth)
  else if (field_type === "GraphQLByte") return 'Buffer' + '[]'.repeat(array_depth) 
  // else if (field_type === "DateTime") return field.is_array ? `Date[]` : `Date`
  else if (field_type === "Boolean") return 'boolean' + '[]'.repeat(array_depth)
  else if (field_type === "Json" || field_type === "JSON" || field_type === "GraphQLJSONObject") return 'JSON' + '[]'.repeat(array_depth)
  else if (field_type === "DecimalScalar") {
    const file_data = data.file_data.get(add_imports_to)
    if (!file_data) logger.error(`Error getting file data for ${add_imports_to}`)

    add_import('Prisma', '@prisma/client', false, file_data!.imports)
    add_import('Prisma', '@prisma/client', false, data.dependencies)

    return `Prisma.Decimal` + '[]'.repeat(array_depth)
  }
  // else if (field_type) return convert_scalar_to_type(field, data, config)
  else return `${field_type}` + '[]'.repeat(array_depth)
}

export const is_primitive = (field: FieldData | FieldArgumentData) => {
  const field_type = (field as FieldData).field_type ? (field as FieldData).field_type : (field as FieldArgumentData).argument_type

  if (field_type === "String") return true
  else if (field_type === "ID") return true
  else if (field_type === "Int") return true
  else if (field_type === "Float") return true
  else if (field_type === "DecimalScalar") true
  else if (field_type === "GraphQLBigInt") return true
  else if (field_type === "GraphQLByte") return true
  // else if (field_type === "DateTime") return true
  else if (field_type === "Boolean") return true
  else if (field_type === "Json" || field_type === "JSON" || field_type === "GraphQLJSONObject") return true
  else if (field.is_scalar) return true
  else return false
}

export const convert_scalar_to_type = (scalar_name: string, add_imports_to: string, data: GeneratorData, config: GeneratorConfig) => {  
  if (config.types.scalars) {
    const override = config.types.scalars.get(scalar_name)

    if (override) {
      if (override.import && override.from) {
        const is_default = override.is_default !== undefined && override.is_default !== null ? override.is_default : false
        const file_data = data.file_data.get(add_imports_to)

        // The dependency could be a package or file, so add it to dependencies
        // Later on, install_packages will ignore the depenency if it is a relative import and not a package
        if (file_data) add_import(override.import, override.from, is_default, file_data.imports)
      }
      else if (override.import && !override.from) {
        const file_data = data.file_data.get(add_imports_to)

        // If import was given but from wasn't, then then the import must be relative import or a primitive type
        if (file_data) add_relative_import(scalar_name, override.import, data, config)
      }
      else {
        // Since we have no override imports, the type provided could be some type we have info on already, so try to add relative import
        // If no relative thing to import, than this is just a noop
        add_relative_import(scalar_name, override.override, data, config)
      }

      return override.override
    }
  }
  // else if (config.global.use_conventions) {
  //   // If using the convention of ModelNameScalar, we can extract scalar types like MenuScalar easily
  //   if (scalar_name.includes("Scalar")) {
  //     if (data.file_data.get(scalar_name.replace("Scalar", ""))) {
  //       // Here means that we have some type with the same name as the scalar name without the Scalar part
  //       add_relative_import(scalar_name, scalar_name.replace("Scalar", ""), data, config)
  //       return scalar_name.replace("Scalar", "")
  //     }
  //   }
  // }
  
  return "any"
}

export const gen_fields = async (fields: FieldData[], add_imports_to: string, data: GeneratorData, config: GeneratorConfig): Promise<string> => {
  const i = new Indent(config).indent

  const all_fields = await Promise.all(fields.map(async (field) => {
    const has_arguments = field.arguments ? true : false
    
    // const field_name = field.is_nullable ? `${field.name}?` : `${field.name}!` // Only use ! if making classes, else no need for the !
    const field_name = field.is_nullable ? `${field.name}?` : field.name
    const field_desc = gen_description(field.description, 1, config)

    add_relative_import(add_imports_to, field.field_type, data, config)
    
    let field_type = convert_to_ts_type(field, add_imports_to, data)

    // Now we recurse the arguments and get every field, their types and descs
    if (has_arguments) {
      const field_arguments: string[] = [] // Since arguments could be in random positions, we get their data and store them where they belong
      const args = field.arguments!

      args.map((arg: FieldArgumentData) => {
        add_relative_import(add_imports_to, arg.argument_type, data, config)

        const arg_name = arg.is_nullable ? `${arg.name}?` : arg.name
        const arg_desc = gen_description(arg.description, 1, config)

        let arg_type = convert_to_ts_type(arg, add_imports_to, data)
        if (arg_name.includes("?") && config.types.add_null) arg_type += ' | null'
        if (arg_name.includes("?") && config.types.add_undefined) arg_type += ' | undefined'

        field_arguments[arg.argument_index] = [
          arg_desc,
          `${i(2)}${arg_name}: ${arg_type}`
        ].join("\n")
      })

      // Now that we have the arguments, let's edit the field_type to be a function
      field_type = [
        `(`,
        field_arguments.join(",\n"),
        `) => ${field_type}`
      ].join("\n")
    }

    if (field_name.includes("?") && config.types.add_null) field_type += ' | null'
    if (field_name.includes("?") && config.types.add_undefined) field_type += ' | undefined'


    return [
      field_desc,
      `${i(1)}${field_name}: ${field_type}`
    ].filter(Boolean).join("\n")
  }))

  return all_fields.filter(Boolean).join(",\n")
}

export const instantiate_field = async (field: FieldData, add_imports_to: string, recursion: number, data: GeneratorData, config: GeneratorConfig): Promise<any> => {
  const has_arguments = field.arguments ? true : false
  let args: string | null = null
  
  if (has_arguments) args = await gen_arguments_types(field, add_imports_to, data, config)

  if (field.default_value !== null) return instantiate_field_return(field, field.default_value, true, args, config)
  else if (field.field_type === "String") return instantiate_field_return(field, '', false, args, config)
  else if (field.field_type === "ID") return instantiate_field_return(field, '', false, args, config)
  else if (field.field_type === "Int") return instantiate_field_return(field, 1, false, args, config)
  else if (field.field_type === "Float") return instantiate_field_return(field, 1.0, false, args, config)
  else if (field.field_type === "GraphQLBigInt") return instantiate_field_return(field, 'BigInt(1)', true, args, config)
  else if (field.field_type === "GraphQLByte") return instantiate_field_return(field, '{} as Buffer', true, args, config)
  else if (field.field_type === "DateTime") return instantiate_field_return(field, 'new Date()', true, args, config)
  else if (field.field_type === "Boolean") return instantiate_field_return(field, false, false, args, config)
  else if (field.field_type === "Json" || field.field_type === "JSON" || field.field_type === "GraphQLJSONObject") return instantiate_field_return(field, '{} as JSON', true, args, config)
  else if (field.field_type === "any") return instantiate_field_return(field, {}, false, args, config)
  else if (field.field_type === "DecimalScalar") { 
    const file_data = data.file_data.get(add_imports_to)
    if (!file_data) logger.error(`Error getting file data for ${add_imports_to}`)
  
    add_import('Prisma', '@prisma/client', false, data.dependencies)
    add_import('Prisma', '@prisma/client', false, file_data!.imports)

    return instantiate_field_return(field, 'new Prisma.Decimal(1)', true, args, config)
  }
  else if (field.is_enum) {
    let option = instantiate_field_return(field, {}, false, args, config)
    
    await Promise.all(data.schema_data.enum_types!.map(async (e) => {
      if (e.name === field.field_type) option = instantiate_field_return(field, `[${e.name}.${e.values[0]}]`, true, args, config)
    }))

    return option
  }
  else if (field.is_scalar) {
    const scalar_type = convert_scalar_to_type(field.field_type, add_imports_to, data, config)

    const f: FieldData = {
      name: field.name,
      field_type: scalar_type,
      field_complete_type: scalar_type,
      directives: field.directives,
      description: field.description,
      arguments: field.arguments,
      default_value: field.default_value,
      is_nullable: field.is_nullable,
      is_optional: field.is_optional,
      is_array: field.is_array,
      is_enum: false,
      is_scalar: false,
      is_union: false
    }
    fill_is_type_field_Data(f, data)

    // We don't increase recursion here since we will recursively iterate union data types until we get an actual type to return
    // If the first union member type turns out to be a union, then we will end up here and eventually we wil get an actual type
    return instantiate_field(f, add_imports_to, recursion, data, config)
  }
  if (field.is_union) {
    await Promise.all(data.schema_data.union_types!.map(async (u) => {
      if (u.name === field.field_type) {
        // Here we must iterate again and create an enum from
        const f: FieldData = {
          name: field.name,
          field_type: u.member_types ? u.member_types[0] : "any",
          field_complete_type: u.member_types ? u.member_types[0] : "any",
          directives: field.directives,
          description: field.description,
          arguments: field.arguments,
          default_value: field.default_value,
          is_nullable: field.is_nullable,
          is_optional: field.is_optional,
          is_array: field.is_array,
          is_enum: false,
          is_scalar: false,
          is_union: false
        }
        fill_is_type_field_Data(f, data)

        // We don't increase recursion here since we will recursively iterate union data types until we get an actual type to return
        // If the first union member type turns out to be a union, then we will end up here and eventually we wil get an actual type
        return instantiate_field(f, add_imports_to, recursion, data, config)
      }
    }))

    return instantiate_field_return(field, {}, false, args, config)
  }
  else {
    // Here we iterate all fields of this type and instantiate them
    // However, any relational fields fields in this second recursion are ignored and just set to an empty object
    const overriden_recursion_limit = config.client.recursion_overrides ? config.client.recursion_overrides.get(field.field_type) : undefined
    const recursion_limit = overriden_recursion_limit !== undefined ? overriden_recursion_limit : config.global.object_recursion_limit
    
    if (recursion > recursion_limit) return instantiate_field_return(field, {}, false, args, config)

    // Return an object with insantiated types
    const obj: any = {}

    // Now we have to find the model and then use that data to instantiate this field
    if (data.schema_data.input_object_types) {
      await Promise.all(data.schema_data.input_object_types.map(async (i) => {
        if (i.name === field.field_type) {
          await Promise.all(i.fields!.map(async (field) => {
            const value = await instantiate_field(field, add_imports_to, recursion + 1, data, config)
            if (value) obj[field.name!] = value
          }))
          return instantiate_field_return(field, obj, false, args, config)
        }
      }))
    }
    if (data.schema_data.object_types) {
      await Promise.all(data.schema_data.object_types.map(async (o) => {
        if (o.name === field.field_type) {
          await Promise.all(o.fields!.map(async (field) => {
            const value = await instantiate_field(field, add_imports_to, recursion + 1, data, config)
            if (value) obj[field.name!] = value
          }))
          return instantiate_field_return(field, obj, false, args, config)
        }
      }))
    }
    if (data.schema_data.operation_types) {
      await Promise.all(data.schema_data.operation_types.map(async (op) => {
        if (op.name === field.field_type) {
          await Promise.all(op.fields!.map(async (field) => {
            const value = await instantiate_field(field, add_imports_to, recursion + 1, data, config)
            if (value) obj[field.name!] = value
          }))
          return instantiate_field_return(field, obj, false, args, config)
        }
      }))
    }

    return instantiate_field_return(field, {}, false, args, config)
  }
}

export const get_type_name = (str: string, type_name_type: "type" | "class" | "enum" | "interface" | "const"): string => {
  // Remove all comments
  // const name = str.replace(REGEX.match_all_typescript_multiline_comments, "")
  let name = str
  if (str.startsWith("/**")) {
    const split = str.split("*/") 
    // If it starts with /**, then we know the comment will end with */
    // So we just split by that end of comment and the split after is what we want to analyze
    name = split[1]
  }

  // Now the string left should be something like export type TypeName = {... etc
  if (type_name_type === "type") {
    return match_first(name, REGEX.match_type_name)
  }
  else if (type_name_type === "class") {
    return match_first(name, REGEX.match_class_name)
  }
  else if (type_name_type === "enum") {
    return match_first(name, REGEX.match_enum_name)
  }
  else if (type_name_type === "interface") {
    return match_first(name, REGEX.match_interface_name)
  }
  else if (type_name_type === "const") {
    let ret = match_first(name, REGEX.match_const_name)
    if (!ret) ret = match_first(name, REGEX.match_let_name)
    if (!ret) ret = match_first(name, REGEX.match_var_name)

    return ret
  }

  return ""
}


// Used to get ALL files withing a directory recursively
const unfold = (f: any, initState: any) => f((value: any, nextState: any) => [ value, ...unfold (f, nextState) ], () => [], initState)
const None = Symbol ()
const relative_paths = (dir = '.') => fs.readdirSync(dir).map(p => path.join(dir, p))
const traverse_dir = (dir: string) => unfold((next: any, done: any, [ path = None, ...rest ]: any) => path === None ? 
  done () : 
  next(path, fs.statSync(path).isDirectory () ? 
    relative_paths (path) .concat (rest) : 
    rest
  ), relative_paths (dir)
)

export const override_types_data = async (data: GeneratorData, config: GeneratorConfig) => {
  if (config.global.types_dir) {
    try {
      let files =  traverse_dir(path.join(process.cwd(), config.global.types_dir)) as string[]

      // Filter out all files that are not js or ts files
      files = files.filter(file => ends_with_any(file, TYPE_FILES_TO_READ))

      files.map(async (filename) => {
        const rl = readline.createInterface({
          input: fs.createReadStream(filename),
          crlfDelay: Infinity
        })
      
        rl.on('line', (line) => {
          if (line.includes('export') && !line.replace(REGEX.match_whitespace, "").startsWith('//')) { // Ignore case for `// export etc...`
            let typename = get_type_name(line, 'class')
            if (!typename) typename = get_type_name(line, 'const')
            if (!typename) typename = get_type_name(line, 'enum')
            if (!typename) typename = get_type_name(line, 'interface')
            if (!typename) typename = get_type_name(line, 'type')

            if (typename) {
              const file_name = filename.replace(REGEX.match_file_path, "")
              const file_name_import = file_name.replace(REGEX.match_file_extension, "")
              const file_name_import_js = file_name_import + '.js'
              let file_dir = match_first(filename, REGEX.match_file_path)
              file_dir = file_dir.endsWith("/") ? file_dir.slice(0, -1) : file_dir
              const file_path = filename
              const same_dir_import_path = config.global.imports_as_esm ? path.join(file_dir, file_name_import_js) : path.join(file_dir, file_name_import)
              const from_import_path = same_dir_import_path

              data.file_data.set(typename, {
                file_name: file_name,
                file_dir: file_dir,
                file_path: file_path,
                same_dir_import_path: same_dir_import_path,
                from_import_path: from_import_path,
                imports: new Map(),
                generator: "types",
                overriden: true
              })
            }
          }
        })
        
        await events.once(rl, 'close')
      })
    }
    catch(e) {
      if ((e as string).includes("call stack")) logger.error(`Maximum call stack exceeded reading all files set on typesDir (${path.join(process.cwd(), config.global.types_dir)})`)
      logger.error(`Error reading typesDir set to (${path.join(process.cwd(), config.global.types_dir)})`)
    }
  }
}