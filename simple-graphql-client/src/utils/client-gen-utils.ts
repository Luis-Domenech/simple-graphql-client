import { is_in } from "lfd-utils"
import { FieldArgumentData, FieldData } from "simple-wasm-graphql-parser"
import { INPUT_RECURSION_LIMIT, PRIMITIVES, REGEX } from "../constants.js"
import { GeneratorConfig, GeneratorData } from "../types.js"
import { add_relative_import, convert_scalar_to_type, convert_to_ts_type, fill_is_type_field_Data, gen_description, Indent, is_an_input } from "./index.js"

export const gen_fields_with_response_as_type = async (fields: FieldData[], add_imports_to: string, data: GeneratorData, config: GeneratorConfig): Promise<string> => {
  const i = new Indent(config).indent

  const all_fields = await Promise.all(fields.map(async (field) => {
    
    add_relative_import(add_imports_to, field.field_type, data, config)

    // const field_name = field.is_nullable ? `${field.name}?` : `${field.name}!` // Only use ! if making classes, else no need for the !
    const field_name = field.is_nullable ? `${field.name}?` : field.name
    const field_desc = gen_description(field.description, 1, config)
    
    let field_type = convert_to_ts_type(field, add_imports_to, data)

    if (field_name.includes("?") && config.types.add_null) field_type += ' | null'
    if (field_name.includes("?") && config.types.add_undefined) field_type += ' | undefined'

    return [
      field_desc,
      `${i(1)}${field_name}: ${field_type}`
    ].filter(Boolean).join("\n")
  }))

  return all_fields.filter(Boolean).join("\n")
}


export const gen_fields_with_args_as_type = async (fields: FieldData[], add_imports_to: string, indent: number, data: GeneratorData, config: GeneratorConfig): Promise<string> => {
  const i = new Indent(config).indent

  const all_fields = await Promise.all(fields.map(async (field) => {
    const has_arguments = field.arguments ? true : false
    
    // const field_name = field.is_nullable ? `${field.name}?` : `${field.name}!` // Only use ! if making classes, else no need for the !
    const field_name = field.is_nullable ? `${i(indent)}${field.name}?` : `${i(indent)}${field.name}`
    const field_desc = gen_description(field.description, indent, config)
    
    let field_type = ""

    // Now we recurse the arguments and get every field, their types and descs
    if (has_arguments) {
      const field_arguments: string[] = [] // Since arguments could be in random positions, we get their data and store them where they belong
      const args = field.arguments!

      args.map((arg: FieldArgumentData) => {
        add_relative_import(add_imports_to, arg.argument_type, data, config)

        const arg_name = arg.is_nullable ? `${arg.name}?` : arg.name
        const arg_desc = gen_description(arg.description, indent + 1, config)
        
        let arg_type = convert_to_ts_type(arg, add_imports_to, data)
        if (arg_name.includes("?") && config.types.add_null) arg_type += ' | null'
        if (arg_name.includes("?") && config.types.add_undefined) arg_type += ' | undefined'

        field_arguments[arg.argument_index] = [
          arg_desc,
          `${i(indent + 1)}${arg_name}: ${arg_type}`
        ].filter(Boolean).join("\n")
      })

      // Now that we have the arguments, let's edit the field_type to be a function
      field_type = [
        `{`,
          field_arguments.join(",\n"),
        `${i(indent)}}`
      ].join("\n")
    }
    else {
      field_type = "null | undefined"
    }

    if (field_name.includes("?") && config.types.add_null) field_type += ' | null'
    if (field_name.includes("?") && config.types.add_undefined) field_type += ' | undefined'


    return [
      field_desc,
      `${field_name}: ${field_type}`
    ].filter(Boolean).join("\n")
  }))

  return all_fields.filter(Boolean).join("\n")
}

/**
 * Helper function used in gen_data_fields to merge objects types from a union
 * @param base_obj Object to marge to
 * @param to_merge Object to merge
 */
 export const merge_objects_recursively = async (base_obj: Record<string, any>, to_merge: Record<string, any>) => {
  const base_obj_keys = Object.keys(base_obj).length
  const to_merge_keys = Object.keys(to_merge).length

  // Deal with easy cases first
  if (to_merge_keys === 0) return
  if (base_obj_keys === 0) { base_obj = to_merge; return }

  if (typeof base_obj === "object" || typeof to_merge === "object") {
    await Promise.all(Object.keys(to_merge).map(async (key) => {
      if (key in base_obj) {
        // Here means that base_obj[key] is an object, so check if to_merge[key] is an object too
        if (typeof to_merge[key] !== "object") {
          // Here means that to_merge[key] is not an object and hence do nothing
        }
        else {
          // Now we know both are objects, so we just merge all fields from that object to base_obj[key]
          await merge_objects_recursively(base_obj[key], to_merge[key])
        }
      }
      else {
        // If here, then base_obj[key] either does not exists or is just null, so this override does not break anything
        base_obj[key] = to_merge[key]
      }
    }))
  }
}

/**
 * Recursively iterate a type's fields. Basically returns an object where keys are field names and values are null if the field is not an object, but if it is, then the value is the result of recursively doing the same on that field  
 * @param field 
 * @param add_imports_to 
 * @param type_name 
 * @param recursion 
 * @param data 
 * @param config
 * @returns
 */
export const gen_data_fields = async (field: FieldData | FieldArgumentData, add_imports_to: string, recursion: number, recursion_limit: number, data_field: "output_types" | "output_selection_sets" | "input_selection_sets" | "input_types", data: GeneratorData, config: GeneratorConfig, type_override = ""): Promise<{__typename?: string | boolean, fields?: object | undefined, [k: string]: object | boolean | string | undefined} | boolean> => {
  const is_argument = (field as FieldArgumentData).argument_type
  const field_type = is_argument ? (field as FieldArgumentData).argument_type : (field as FieldData).field_type
  let complete_field_type = is_argument ? (field as FieldArgumentData).argument_complete_type : (field as FieldData).field_complete_type
  complete_field_type = type_override ? complete_field_type.replace(REGEX.match_word, type_override) : complete_field_type
  const default_to_return_value: {__typename?: string | boolean, fields?: object | undefined, [k: string]: object | boolean | string | undefined} | boolean = data_field === "input_selection_sets" ? true : data_field === "output_selection_sets" ? true : data_field === "output_types" ? {__typename: type_override ? type_override : field_type} : data_field === "input_types" ? {complete_type: complete_field_type } : true

  let to_return: {__typename?: string | boolean, field?: object | undefined, [k: string]: object | boolean | string | undefined} | boolean = default_to_return_value

  const ret = (return_value: {__typename?: string | boolean, fields?: object | undefined, [k: string]: object | boolean | string | undefined} | boolean = default_to_return_value, typename = type_override ? type_override : field_type): {__typename?: string | boolean, fields?: object | undefined, [k: string]: object | boolean | string | undefined} | boolean => {
    if (data_field === "input_selection_sets") {
      if (typeof return_value === "object") return return_value
      else return return_value  
    }
    else if (data_field === "output_selection_sets") {
      if (typeof return_value === "object") return {...return_value, __typename: true}
      else return return_value  
    }
    else if (data_field === "output_types") {
      if (typeof return_value === "object") {
        if (return_value.fields) {
          if (Object.keys(return_value.fields).length > 0) return {__typename: typename, fields: return_value.fields}
        }
      }
      return {__typename: typename}
    }
    else if (data_field === "input_types") {
      if (typeof return_value === "object") {
        if (return_value.fields) {
          if (Object.keys(return_value.fields).length > 0) return {complete_type: complete_field_type.replace(REGEX.match_word, typename), fields: return_value.fields}
        }
      }
      return {complete_type: complete_field_type.replace(REGEX.match_word, typename)}
    }
    else return return_value
  }

  if (data_field === "input_selection_sets" && recursion > INPUT_RECURSION_LIMIT) return ret()
  if (data_field === "input_types" && recursion > INPUT_RECURSION_LIMIT) return ret()

  if (recursion <= recursion_limit) {
    if (is_in(field_type, [...PRIMITIVES, 'any'])) to_return = ret()
    else if (field.is_enum) to_return = ret()
    else if (field.is_union) {
      // Since the idea of this function is to generate objects with which we can then validate inputs and outputs
      // of operations, then for unions, the idea is to recurse all union member of this union
      // and then create a super objects with all fields from all unions

      // For conflicting field names where types are not same, we will choose the one which is not null
      // For example, if we have name: string and name: NameObjectType on another union member type, 
      // then the one that is not null is added to objects

      const obj: any = {}
      const obj_data: any[] = []

      data.schema_data.union_types!.map(async (u) => {      
        if (u.name === field_type) {
          if (!u.member_types) obj_data.push(false)
          else {
            await Promise.all(u.member_types.map(async (member_type) => {
              let temp_field
  
              if (is_argument) {
                temp_field = {
                  ...field,
                  is_enum: false,
                  is_scalar: false,
                  is_union: false,
                  argument_type: member_type,
                  argument_complete_type: (field as FieldArgumentData).argument_complete_type.replace(REGEX.match_words, member_type)
                } as FieldArgumentData
              }
              else {
                temp_field = {
                  ...field,
                  is_enum: false,
                  is_scalar: false,
                  is_union: false,
                  field_type: member_type,
                  field_complete_type: (field as FieldData).field_complete_type.replace(REGEX.match_words, member_type)
                } as FieldData
              }
              fill_is_type_field_Data(temp_field, data)
  
              // Since we are dealing with same field, recusrion stays the same
              const val = await gen_data_fields(temp_field, add_imports_to, recursion, recursion_limit, data_field, data, config)
              if (typeof val === "object") obj_data.push(val)
            }))
          }
        }
      })

      // In case of field witht two differing types, we just take combine those into one just like the union logic
      obj_data.map(async to_merge => {
        await merge_objects_recursively(obj, to_merge)
      })
      
      to_return = ret(obj)
    }
    else if (field.is_scalar) {
      const actual_type = convert_scalar_to_type(field_type, add_imports_to, data, config)

      if (actual_type === "any") {
        to_return = default_to_return_value
      }
      else {
        // Here the scalar could be a anything, so we will just recurse again with this new type
        // But first we have to determine the new is_types fields
        let temp_field

        if (is_argument) {
          temp_field = {
            ...field,
            is_enum: false,
            is_scalar: false,
            is_union: false,
            argument_type: actual_type,
            argument_complete_type: (field as FieldArgumentData).argument_complete_type.replace(REGEX.match_words, actual_type)
          } as FieldArgumentData
        }
        else {
          temp_field = {
            ...field,
            is_enum: false,
            is_scalar: false,
            is_union: false,
            field_type: actual_type,
            field_complete_type: (field as FieldData).field_complete_type.replace(REGEX.match_words, actual_type)
          } as FieldData
        }

        fill_is_type_field_Data(temp_field, data)

        // Since we are not iterating on an object, but jut recursing again for the same field, recursion number stays the same
        to_return = ret(await gen_data_fields(temp_field, add_imports_to, recursion, recursion_limit, data_field, data, config, field_type))
      }
    }
    else {
      // Here means type is probably an object
      const obj: any = data_field === "output_types" ? {fields: {}} : {}

      if (is_an_input(field, data)) {
        await Promise.all(data.schema_data.input_object_types!.map(async (t) => {
          if (t.name === field_type) {
            await Promise.all(t.fields.map(async (f) => {
              // If on recursion one, then we set the recursion limit for every field so that every nested field respects the recursion limit
              // of the current field, wheter it is a default limit or an overriden one
              let rec_limit = recursion_limit
              if (recursion === 1) {
                const overriden_recursion_limit = config.client.recursion_overrides ? config.client.recursion_overrides.get(f.field_type) : undefined
                rec_limit = overriden_recursion_limit !== undefined ? overriden_recursion_limit : recursion_limit
              }
  
              const value = await gen_data_fields(f, add_imports_to, recursion + 1, rec_limit, data_field, data, config)
  
              if (data_field === "output_types") obj.fields[f.name] = value
              else obj[f.name] = value
            }))
          }
        }))
      }
      else {
        await Promise.all(data.schema_data.object_types!.map(async (t) => {
          if (t.name === field_type) {
            await Promise.all(t.fields.map(async (f) => {
              // If on recursion one, then we set the recursion limit for every field so that every nested field respects the recursion limit
              // of the current field, wheter it is a default limit or an overriden one
              let rec_limit = recursion_limit
              if (recursion === 1) {
                const overriden_recursion_limit = config.client.recursion_overrides ? config.client.recursion_overrides.get(f.field_type) : undefined
                rec_limit = overriden_recursion_limit !== undefined ? overriden_recursion_limit + 1 : recursion_limit // Plus one is to offset current recursion number of one
              }
  
              const value = await gen_data_fields(f, add_imports_to, recursion + 1, rec_limit, data_field, data, config)
              
              if (data_field === "output_types") obj.fields[f.name] = value
              else obj[f.name] = value
            }))
          }
        }))
      }

      to_return = Object.keys(obj).length > 0 ? ret(obj) : ret()
    }
  }

  if (typeof to_return === "object") {
    if (to_return.fields) {
      if (Object.keys(to_return.fields).length === 0) delete to_return.fields
      if (Object.keys(to_return).length === 1 && Object.keys(to_return)[0] === "__typename") to_return = true
    }
  }

  return typeof to_return === "object" ? Object.keys(to_return).length === 0 ? true : to_return : to_return
}

// export const gen_selection_set_type = async (field: FieldData | FieldArgumentData, add_imports_to: string, recursion: number, recursion_limit: number, is_input: boolean, data: GeneratorData, config: GeneratorConfig, type_override = ""): Promise<Record<string, string | object> | string> => {
//   const is_argument = (field as FieldArgumentData).argument_type
//   const field_type = is_argument ? (field as FieldArgumentData).argument_type : (field as FieldData).field_type
//   const complete_field_type = is_argument ? (field as FieldArgumentData).argument_complete_type : (field as FieldData).field_complete_type

//   const default_to_return_value = add_artefacts("boolean")

//   let to_return: Record<string, string | object> | string = default_to_return_value

//   if (is_input && recursion > INPUT_RECURSION_LIMIT) return to_return

//   if (recursion <= recursion_limit) {
//     if (is_in(field_type, [...PRIMITIVES, 'any'])) to_return = default_to_return_value
//     else if (field.is_enum) to_return = default_to_return_value
//     else if (field.is_union) {
//       // Here the idea is to get type for all unions and make a union out of that fot this field's type

//       const obj_data: string[] = []

//       data.schema_data.union_types!.map(async (u) => {      
//         if (u.name === field_type) {
//           if (u.member_types)
//           await Promise.all(u.member_types.map(async (member_type) => {
//             let temp_field

//             if (is_argument) {
//               temp_field = {
//                 ...field,
//                 is_enum: false,
//                 is_scalar: false,
//                 is_union: false,
//                 argument_type: member_type,
//                 argument_complete_type: (field as FieldArgumentData).argument_complete_type.replace(REGEX.match_words, member_type)
//               } as FieldArgumentData
//             }
//             else {
//               temp_field = {
//                 ...field,
//                 is_enum: false,
//                 is_scalar: false,
//                 is_union: false,
//                 field_type: member_type,
//                 field_complete_type: (field as FieldData).field_complete_type.replace(REGEX.match_words, member_type)
//               } as FieldData
//             }
//             fill_is_type_field_Data(temp_field, data)

//             // Since we are dealing with same field, recusrion stays the same
//             const val = await gen_selection_set_type(temp_field, add_imports_to, recursion, recursion_limit, is_input, data, config)
            
//             if (typeof val === "object") {
//               if (!is_input) val.__typename = add_artefacts("boolean")
//             }

//             obj_data.push(stringify(val, config.global.indent_spaces, recursion + 1, false, false))
//           }))
//         }
//       })
      
//       to_return = obj_data.join(" | ")
//     }
//     else if (field.is_scalar) {
//       const actual_type = convert_scalar_to_type(field_type, add_imports_to, data, config)

//       if (actual_type === "any") {
//         to_return = default_to_return_value
//       }
//       else {
//         // Here the scalar could be a anything, so we will just recurse again with this new type
//         // But first we have to determine the new is_types fields
//         let temp_field

//         if (is_argument) {
//           temp_field = {
//             ...field,
//             is_enum: false,
//             is_scalar: false,
//             is_union: false,
//             argument_type: actual_type,
//             argument_complete_type: (field as FieldArgumentData).argument_complete_type.replace(REGEX.match_words, actual_type)
//           } as FieldArgumentData
//         }
//         else {
//           temp_field = {
//             ...field,
//             is_enum: false,
//             is_scalar: false,
//             is_union: false,
//             field_type: actual_type,
//             field_complete_type: (field as FieldData).field_complete_type.replace(REGEX.match_words, actual_type)
//           } as FieldData
//         }

//         fill_is_type_field_Data(temp_field, data)

//         // Since we are not iterating on an object, but jut recursing again for the same field, recursion number stays the same
//         const val = await gen_selection_set_type(temp_field, add_imports_to, recursion, recursion_limit, is_input,  data, config, field_type)

//         if (typeof val === "object") {
//           if (!is_input) val.__typename = add_artefacts("boolean")
//           to_return = val
//         }
//         else to_return = val
//       }
//     }
//     else {
//       // Here means type is probably an object
//       const obj: any = {}

//       if (is_an_input(field, data)) {
//         await Promise.all(data.schema_data.input_object_types!.map(async (t) => {
//           if (t.name === field_type) {
//             await Promise.all(t.fields.map(async (f) => {
//               // If on recursion one, then we set the recursion limit for every field so that every nested field respects the recursion limit
//               // of the current field, wheter it is a default limit or an overriden one
//               let rec_limit = recursion_limit

//               if (recursion === 1) {
//                 const overriden_recursion_limit = config.client.recursion_overrides ? config.client.recursion_overrides.get(f.field_type) : undefined
//                 rec_limit = overriden_recursion_limit !== undefined ? overriden_recursion_limit : recursion_limit
//               }
  
//               const val = await gen_selection_set_type(f, add_imports_to, recursion + 1, rec_limit, is_input, data, config)
              
//               if (is_input) {
//                 if (typeof val === "object") obj[f.name] = val
//                 else obj[f.name] = val
//               }
//               else {
//                 if (typeof val === "object") obj[f.name] = {...val, __typename: add_artefacts("boolean")}
//                 else obj[f.name] = val
//               }
//             }))
//           }
//         }))
//       }
//       else {
//         await Promise.all(data.schema_data.object_types!.map(async (t) => {
//           if (t.name === field_type) {
//             await Promise.all(t.fields.map(async (f) => {
//               // If on recursion one, then we set the recursion limit for every field so that every nested field respects the recursion limit
//               // of the current field, wheter it is a default limit or an overriden one
//               let rec_limit = recursion_limit
  
//               if (recursion === 1) {
//                 const overriden_recursion_limit = config.client.recursion_overrides ? config.client.recursion_overrides.get(f.field_type) : undefined
//                 rec_limit = overriden_recursion_limit !== undefined ? overriden_recursion_limit : recursion_limit
//               }
  
//               const val = await gen_selection_set_type(f, add_imports_to, recursion + 1, rec_limit, is_input, data, config)
              
//               if (is_input) {
//                 if (typeof val === "object") obj[f.name] = val
//                 else obj[f.name] = val
//               }
//               else {
//                 if (typeof val === "object") obj[f.name] = {...val, __typename: add_artefacts("boolean")}
//                 else obj[f.name] = val
//               }
//             }))
//           }
//         }))
//       }

//       if (!is_input) obj.__typename = add_artefacts("boolean")

//       to_return = Object.keys(obj).length > 0 ? obj : add_artefacts("boolean")
//     }
//   }

//   if (typeof to_return === "object") {
//     if (Object.keys(to_return).length === 1 && Object.keys(to_return)[0] === "__typename") to_return = add_artefacts("boolean")
//   }

//   return typeof to_return === "object" ? Object.keys(to_return).length > 0 ? to_return : default_to_return_value : to_return
// }