import { is_in, match_first, stringify } from "lfd-utils"
import path from "node:path"
import { CLIENT_GENERATOR_DIRS, GRAPHQL_ROOT_OPERATIONS, OPERATION_DATA_AUTO_GENERATED_COMMENT, REGEX, TO_REMOVE_STRING } from "../constants.js"
import { ClientGeneratorExport, FileData, GeneratorConfig, GeneratorData, ImportData } from "../types.js"
import { add_import, add_imports, add_relative_import, gen_fields_with_args_as_type, gen_fields_with_response_as_type, gen_imports, get_type_name, Indent, logger, gen_data_fields, write_format_file } from "../utils/index.js"

// These objects are constructs filled with extremely helpful data from operations
// These objects are essential to create the type-safe fetch client functions
export const gen_client_data = async (data: GeneratorData, config: GeneratorConfig): Promise<string[]> => {
  const i = new Indent(config).indent
  const operation_data: string[] = []

  // operation_data.push([
  //   `export type GraphQLOperationDataSelectionSet = {`,
  //     `${TO_REMOVE_STRING}`,
  //   `}`
  // ].join("\n"))

  // This is an objects with ALL data for every operation
  // It holds argument fields, response fields, operation name and it's type (query, mutation, fragment, subscription)
  // All of this data is crucial for the type safe utility fetch functions to work and be type-safe 
  operation_data.push([
    `export const GRAPHQL_OPERATION_DATA = {`,
      `${TO_REMOVE_STRING}`,
    `}`
  ].join("\n"))

  operation_data.map(s => {
    const name = get_type_name(s, "const")
    // if (!name) name = get_type_name(s, "type")
    const file_name = `data.ts`
    const file_name_import = `data`
    const file_name_import_js = `data.js`
    const file_dir = path.join(config.client.output_dir!, CLIENT_GENERATOR_DIRS.data)
    const file_path = path.join(file_dir, file_name)
    const same_dir_import_path = config.global.imports_as_esm ? path.join(file_dir, file_name_import_js) : path.join(file_dir, file_name_import)
    const from_import_path = config.global.imports_as_esm ?  path.join(config.client.output_dir!, "index.js") : config.client.output_dir!

    data.file_data.set(name, {
      file_name: file_name,
      file_dir: file_dir,
      file_path: file_path,
      same_dir_import_path: same_dir_import_path,
      from_import_path: from_import_path,
      imports: new Map(),
      generator: "client"
    })
  })

  const data_fields = await Promise.all(data.schema_data.object_types!.map(async (root_op) => { 
    if (is_in(root_op.name, GRAPHQL_ROOT_OPERATIONS)) {
      const fields = await Promise.all(root_op.fields.map(async op => {
        const input_selection_sets: any = {}
        const input_types: any = {}

        if (op.arguments) {
          await Promise.all(op.arguments.map(async (arg) => {
            // input_fields[arg.name] = await gen_data_fields(arg, 'GRAPHQL_OPERATION_DATA', 1, true, false, data, config)
            input_types[arg.name] = await gen_data_fields(arg, 'GRAPHQL_OPERATION_DATA', 1, config.global.object_recursion_limit, "input_types", data, config)
            input_selection_sets[arg.name] = await gen_data_fields(arg, 'GRAPHQL_OPERATION_DATA', 1, config.global.object_recursion_limit, "input_selection_sets", data, config)
          }))
        }
        
        // Since the function returns {op.name: value }, we have to index it
        // We don't do it for arguments since we do need the {arg.name: value} since those are stored in input_fields
        // Outputs tho, are just one field with a value, hence the index here
        const output_selection_sets = await gen_data_fields(op, 'GRAPHQL_OPERATION_DATA', 1, config.global.object_recursion_limit, "output_selection_sets", data, config)
        const output_types = await gen_data_fields(op, 'GRAPHQL_OPERATION_DATA', 1, config.global.object_recursion_limit, "output_types", data, config)

        let field_input_selection_sets = stringify(input_selection_sets, config.global.indent_spaces, 2, true, false)
        if (field_input_selection_sets === "{}") field_input_selection_sets = "null"

        let field_output_selection_sets = stringify(output_selection_sets, config.global.indent_spaces, 2, true, false)
        if (field_output_selection_sets === "{}") field_output_selection_sets = "true"

        let field_input_types = stringify(input_types, config.global.indent_spaces, 2, true, false)
        if (field_input_types === "{}") field_input_types = "null"

        let field_output_types = stringify(output_types, config.global.indent_spaces, 2, true, false)
        if (field_output_types === "{}") field_output_types = "null"

        return [
          `${i(1)}${op.name}: {`,
            `${i(2)}operation_name: "${op.name}",`,
            `${i(2)}type: "${root_op.name.toLowerCase()}",`,
            `${i(2)}input_types: ${field_input_types},`,
            `${i(2)}output_types: ${field_output_types},`,
            `${i(2)}input_selection_sets: ${field_input_selection_sets},`,
            `${i(2)}output_selection_sets: ${field_output_selection_sets},`,
          `${i(1)}}`,
        ].join("\n")
      }))

      return fields.filter(Boolean).join(",\n")
    }
  }))

  // const type_fields = await Promise.all(data.schema_data.object_types!.map(async (root_op) => { 
  //   if (is_in(root_op.name, GRAPHQL_ROOT_OPERATIONS)) {
  //     const fields = await Promise.all(root_op.fields.map(async op => {
  //       const input_selection_sets: any = {}

  //       if (op.arguments) {
  //         await Promise.all(op.arguments.map(async (arg) => {
  //           input_selection_sets[arg.name] = await gen_selection_set_type(arg, 'GRAPHQL_OPERATION_DATA', 1, config.global.object_recursion_limit, true, data, config)
  //         }))
  //       }

  //       const output_selection_sets = await gen_selection_set_type(op, 'GRAPHQL_OPERATION_DATA', 1, config.global.object_recursion_limit, false, data, config)

  //       let field_input_selection_sets = stringify(input_selection_sets, config.global.indent_spaces, 2, true, false)
  //       if (field_input_selection_sets === "{}") field_input_selection_sets = "null"
  //       field_input_selection_sets = field_input_selection_sets.replace(REGEX.match_one_colon, "?:")

  //       let field_output_select_sets = stringify(output_selection_sets, config.global.indent_spaces, 2, true, false)
  //       if (field_output_select_sets === "{}") field_output_select_sets = add_artefacts("boolean")
  //       field_output_select_sets = field_output_select_sets.replace(REGEX.match_one_colon, "?:")


  //       return [
  //         `${i(1)}${op.name}: {`,
  //           `${i(2)}operation_name: "${op.name}"`,
  //           `${i(2)}type: GraphQLOperationType`,
  //           `${i(2)}output_types: OperationDataTypeField`,
  //           `${i(2)}input_selection_sets: ${field_input_selection_sets}`,
  //           `${i(2)}output_selection_sets: ${field_output_select_sets}`,
  //         `${i(1)}}`,
  //       ].join("\n")
  //     }))

  //     return fields.filter(Boolean).join(",\n")
  //   }
  // }))

  operation_data.map((s, pos) => {
    let name = get_type_name(s, "const")
    if (!name) name = get_type_name(s, "type")

    if (name === 'GRAPHQL_OPERATION_DATA') operation_data[pos] = operation_data[pos].replace(REGEX.match_to_remove_string, data_fields.filter(Boolean).join(",\n"))
    // if (name === 'GraphQLOperationDataSelectionSet') operation_data[pos] = operation_data[pos].replace(REGEX.match_to_remove_string, type_fields.filter(Boolean).join("\n"))
  })

  // add_relative_import("GraphQLOperationDataSelectionSet", "GraphQLOperation", data, config)
  // add_relative_import("GraphQLOperationDataSelectionSet", "GraphQLOperationType", data, config)
  // add_relative_import("GraphQLOperationDataSelectionSet", "OperationDataTypeField", data, config)

  return operation_data
}

export const gen_client_types = async (data: GeneratorData, config: GeneratorConfig): Promise<string[]> => {
  const i = new Indent(config).indent

  let client_types: string[] = []

  // For now, all operations are on object_types, so no need to check for operation_types
  // This means that the object_types is always not empty since type Query is REQUIRED to make a valid schema
  let types = await Promise.all(data.schema_data.object_types!.map((op) => { 
    if (is_in(op.name, GRAPHQL_ROOT_OPERATIONS)) {
      if (op.name === "Query") return `export type GraphQLQuery = ${op.fields.map(f => `"${f.name}"`).filter(Boolean).join(` | `)}`
      else if (op.name === "Mutation") return `export type GraphQLMutation = ${op.fields.map(f => `"${f.name}"`).filter(Boolean).join(` | `)}`
      else if (op.name === "Subscription") return `export type GraphQLSubscription = ${op.fields.map(f => `"${f.name}"`).filter(Boolean).join(` | `)}`
    }
  }))


  client_types = [...types.filter(Boolean) as string[]]

  types = await Promise.all(data.schema_data.object_types!.map((op) => { 
    if (is_in(op.name, GRAPHQL_ROOT_OPERATIONS)) {
      if (op.name === "Query") return `GraphQLQuery`
      else if (op.name === "Mutation") return `GraphQLMutation`
      else if (op.name === "Subscription") return `GraphQLSubscription`
    }
  }))

  client_types = [
    ...client_types, 
    `export type GraphQLOperation = ${types.filter(Boolean).join(" | ")}`
  ]


  if (config.client.recursion_overrides!.size > 0) {
    const fields = []
    for (const [type_to_override, recursion_override] of Array.from(config.client.recursion_overrides!.entries())) {
      fields.push(`${i(1)}${type_to_override}: ${recursion_override}`)
    }
    client_types = [
      ...client_types,
      [
        `type TypeRecursionOverride = {`,
        fields.join("\n"),
        `}`
      ].join("\n")
    ]
  }
  else {
    client_types = [
      ...client_types,
      `type TypeRecursionOverride = {}`
    ]
  }

  client_types = [
    ...client_types,
    [
      `export type GraphQLOperationInput = {`,
      `${TO_REMOVE_STRING}`,
      `}\n`
    ].join("\n"),
    [
      `export type GraphQLOperationOutput = {`,
      `${TO_REMOVE_STRING}`,
      `}\n`
    ].join("\n"),
    `export type GraphQLOperationInputFields = { [Key in GraphQLOperation]: Record<keyof GraphQLOperationInput[Key], any> | null  }`,
    `export type GraphQLOperationOutputFields = { [Key in GraphQLOperation]: Record<keyof GraphQLOperationOutput[Key], any> | null  }`,
    `export type GraphQLOperationType = 'query' | 'mutation' | 'subscription'`,
    `type DeepPartial<T> = { [K in keyof T]?: T[K] extends object ? DeepPartial<T[K]> | boolean : T[K] }`,
    `type Common<T1, T2, ReturnT2 extends boolean = true> = { [K in keyof T1 & keyof T2]: ReturnT2 extends true ? T2[K] : T1[K] }`,
    `type IsEmptyObject<Obj extends Record<PropertyKey, unknown>> = [keyof Obj] extends [never] ? true : false`,
    `type DeepOmitNever<T> = T extends Array<infer I> ? DeepOmitNever<I>[] : { [K in keyof T as T[K] extends never ? never : K]: T[K] extends object ? DeepOmitNever<T[K]> : T[K] }`,
    `type OmitNulls<T> = { [K in keyof T as T[K] extends never ? never : T[K] extends null ? never : T[K] extends undefined ? never : K]: T[K] extends object ? OmitNulls<T[K]> : T[K] }`,
    `type DeepPickNulls<T> = { [K in keyof T as T[K] extends never ? K : T[K] extends null ? K : T[K] extends undefined ? K : never]: T[K] extends object ? DeepPickNulls<T[K]> : T[K] }`,
    `type ShallowPickNulls<T> = { [K in keyof T as T[K] extends never ? K : T[K] extends null ? K : T[K] extends undefined ? K : never]: T[K] }`,
    `type ShallowPickNonNulls<T> = { [K in keyof T as T[K] extends never ? never : T[K] extends null ? never : T[K] extends undefined ? never : K]: T[K] }`,
    `type Ran<T extends number> = number extends T ? number :_Range<T, []> // To limit range of object recursion`,
    `type _Range<T extends number, R extends unknown[]> = R['length'] extends T ? R[number] : _Range<T, [R['length'], ...R]>`,
    `type PositiveNumber<N extends number> = number extends N ? N : \`\${N}\` extends \`-\${string}\` ? 1 : N extends 0 ? 1 : N`,
    `type BoundedRecursionLimit<N extends number> = number extends N ? N extends Ran<typeof OBJECT_RECURSION_LIMIT> ? N : 0 : 0`,
    `type NestedType<T> = T extends (infer A)[] ? NestedType<A> : T`,
    `type IsAUnion<T, U extends T = T> = T extends unknown ? [U] extends [T] ? never : true : never;`,
    `type IsUnion<T> = true extends IsAUnion<T> ? true : false`,
    `type SelectUnionType<U, Typename extends string> = Extract<U, {__typename: Typename}>`,
    `type UnionMemberTypename<U> = Extract<U, {__typename: string}>["__typename"]`,
    `type UnionMemberWithTypename<U> = Extract<U, {__typename: string}>`, 
    `type RecursionOverride<Output extends any, N extends PositiveNumber<number>> = "__typename" extends keyof Output ? Output["__typename"] extends keyof TypeRecursionOverride ? TypeRecursionOverride[Output["__typename"]] : N : N`,
    `export type IndentOverload = { <T extends string>(to_indent?: string, indent_amount?: number, indent_spaces?: number): string, (indent_amount?: number, indent_spaces?: number, to_indent?: string): string }`,
    `export type OperationFetchError = { fetch_errors?: string[] }`,
    `export type SelectionSetSelection = boolean`,
    `export type RawSelectionSet = { [k: string]: RawSelectionSet } | SelectionSetSelection`,
    `export type OperationDataTypeField = {__typename: string, fields?: Record<string, OperationDataTypeField> | undefined | null} | {complete_type: string, fields?: Record<string, OperationDataTypeField> | undefined | null}`,
    // `export type OperationSelectionSet<Operation extends GraphQLOperation> = GRAPHQL_OPERATION_DATA[Operation]["output_selection_sets"]`,
    // `type SelectionSetKeys<SelectionSet extends RawSelectionSet | Record<PropertyKey, unknown>> = { [Selection in keyof SelectionSet as SelectionSet[Selection] extends Record<PropertyKey, unknown> ? IsEmptyObject<SelectionSet[Selection]> extends true ? never : Selection : SelectionSet[Selection] extends  boolean ? SelectionSet[Selection] extends true ? Selection : never : never]: SelectionSet[Selection] }`,
    // `type CleanSelectionSet<SelectionSet extends RawSelectionSet | Record<PropertyKey, unknown>> = { [Selection in keyof SelectionSetKeys<SelectionSet>]: SelectionSet[Selection] extends Record<string, RawSelectionSet | SelectionSetSelection> ? (SelectionSet[Selection] extends Record<string, SelectionSetSelection> ? SelectionSet<SelectionSet[Selection]> : SelectionSet[Selection] extends Record<string, RawSelectionSet> ? SelectionSet<SelectionSet[Selection]> : SelectionSet<Record<string, false>>) : SelectionSet[Selection] extends Record<PropertyKey, unknown> ? SelectionSet<SelectionSet[Selection]> : SelectionSet[Selection] extends true ? true : false }`,
    // `type CleanSelectionSet<SelectionSet extends RawSelectionSet | Record<PropertyKey, unknown>> = { [Selection in keyof SelectionSetKeys<SelectionSet>]: SelectionSet[Selection] extends Record<string, RawSelectionSet | SelectionSetSelection> ? (SelectionSet[Selection] extends Record<string, SelectionSetSelection> ? CleanSelectionSet<SelectionSet[Selection]> : SelectionSet[Selection] extends Record<string, RawSelectionSet> ? CleanSelectionSet<SelectionSet[Selection]> : CleanSelectionSet<Record<string, false>>) : SelectionSet[Selection] extends Record<PropertyKey, unknown> ? CleanSelectionSet<SelectionSet[Selection]> : SelectionSet[Selection] extends true ? true : false }`,
    // `export type GraphQLFetchGeneralResponse<SelectionSet extends RawSelectionSet> = { [Selection in keyof CleanSelectionSet<SelectionSet>]: SelectionSet[Selection] extends SelectionSetSelection ? any : SelectionSet[Selection] extends RawSelectionSet ? GraphQLFetchGeneralResponse<SelectionSet[Selection]> : any }`,
    // `type ShallowOmitFalseSelectionWithReference<T1, T2> = { [K in keyof Common<T1, T2> as T1[K] extends false ? never : K] }`,
    // [
    //   `type DeepOmitFalseSelectionWithReference<T1, T2> = T2 extends Array<infer I> ?`,
    //   `${i(1)}DeepOmitFalseSelectionWithReference<T1, I>[] :`,
    //   `${i(1)}T1 extends object ?`,
    //   `${i(1)}{ [K in keyof ShallowOmitFalseSelectionWithReference<T1, T2>]: T1[K] extends SelectionSetSelection ?`,
    //   `${i(2)}(`,
    //   `${i(3)}T1[K] extends true ?`,
    //   `${i(3)}(`,
    //   `${i(4)}T2[K] extends object ? T2[K] : // This makes it so that setting true on objects return types will return everything for that return type`,
    //   `${i(4)}T2[K]`,
    //   `${i(3)}) :`,
    //   `${i(3)}T2[K]`,
    //   `${i(2)}) :`,
    //   `${i(2)}T1[K] extends RawSelectionSet ? DeepOmitFalseSelectionWithReference<T1[K], T2[K]> :`,
    //   `${i(2)}null`,
    //   `${i(1)}} :`,
    //   `${i(1)}T1 extends SelectionSetSelection ?`,
    //   `${i(1)}(`,
    //   `${i(2)}T1 extends true ? `,
    //   `${i(2)}(`,
    //   `${i(3)}T2 extends object ? DeepOmitFalseSelectionWithReference<T1, T2> : // This makes it so that setting true on objects return types will return everything for that return type`,
    //   `${i(3)}T2`,
    //   `${i(2)}) :`,
    //   `${i(2)}null`,
    //   `${i(1)}) :`,
    //   `${i(1)}null`,
    // ].join("\n"),
    // [
    //   `export type GraphQLFetchOperationResponse<Operation extends GraphQLOperation, SelectionSet extends OperationSelectionSet<Operation> | SelectionSetSelection> = SelectionSet extends SelectionSetSelection ?`,
    //   `${i(1)}(`,
    //   `${i(2)}SelectionSet extends true ? GraphQLOperationOutput[Operation] :`,
    //   `${i(2)}null`,
    //   `${i(1)}):`,
    //   `${i(1)}SelectionSet extends OperationSelectionSet<Operation> ?`,
    //   `${i(1)}{ `,
    //   `${i(2)}[Selection in keyof ShallowOmitFalseSelectionWithReference<SelectionSet, GraphQLOperationOutput[Operation]>]: SelectionSet[Selection] extends SelectionSetSelection ?`,
    //   `${i(2)}(`,
    //   `${i(3)}SelectionSet[Selection] extends true ?`,
    //   `${i(3)}(`,
    //   `${i(4)}GraphQLOperationOutput[Operation][Selection] extends object ? `,
    //   `${i(4)}(`,
    //   `${i(5)}Selection extends keyof OperationSelectionSet<Operation> ?`,
    //   `${i(5)}DeepOmitFalseSelectionWithReference<OperationSelectionSet<Operation>[Selection], GraphQLOperationOutput[Operation][Selection]> : // This makes it so that setting true on objects return types will return everything for that return type  `,
    //   `${i(5)}null`,
    //   `${i(4)}):`,
    //   `${i(4)}GraphQLOperationOutput[Operation][Selection]`,
    //   `${i(3)}):`,
    //   `${i(3)}null`,
    //   `${i(2)}):`,
    //   `${i(2)}SelectionSet[Selection] extends RawSelectionSet ? DeepOmitFalseSelectionWithReference<SelectionSet[Selection], GraphQLOperationOutput[Operation][Selection]> :`,
    //   `${i(2)}null`,
    //   `${i(1)}}:`,
    //   `${i(1)}null`,
    // ].join("\n"),
    // [
    //   `export type OperationFetchResponse<Operation extends GraphQLOperation | void = void, SelectionSet extends RawSelectionSet | void = void> = Operation extends void ? `,
    //   `${i(1)}(`,
    //   `${i(2)}SelectionSet extends void | null | never | undefined ? any :`,
    //   `${i(2)}SelectionSet extends RawSelectionSet ? `,
    //   `${i(2)}(`,
    //   `${i(3)}SelectionSet extends SelectionSetSelection ?`,
    //   `${i(3)}(`,
    //   `${i(4)}SelectionSet extends true ? any :`,
    //   `${i(4)}null`,
    //   `${i(3)}) :`,
    //   `${i(3)}SelectionSet extends object ? `,
    //   `${i(3)}(`,
    //   `${i(4)}IsEmptyObject<SelectionSet> extends true ? null :`,
    //   `${i(4)}GraphQLFetchGeneralResponse<CleanSelectionSet<SelectionSet>>`,
    //   `${i(3)}) :`,
    //   `${i(3)}GraphQLFetchGeneralResponse<CleanSelectionSet<SelectionSet>>`,
    //   `${i(2)}) :`,
    //   `${i(2)}null // If SelectionSet does not extend RawSelection set, we return null`,
    //   `${i(1)}) : // Here operation is void, but still we check stuff since we can be still be given a selection set if operationis void`,
    //   `${i(1)}(`,
    //   `${i(2)}Operation extends GraphQLOperation ?`,
    //   `${i(2)}(`,
    //   `${i(3)}SelectionSet extends void | null | never | undefined ? GraphQLFetchOperationResponse<Operation, OperationSelectionSet<Operation>> :`,
    //   `${i(3)}SelectionSet extends RawSelectionSet ?`,
    //   `${i(3)}(`,
    //   `${i(4)}SelectionSet extends boolean ?`,
    //   `${i(4)}(`,
    //   `${i(5)}SelectionSet extends true ? `,
    //   `${i(5)}(`,
    //   `${i(6)}GraphQLFetchOperationResponse<Operation, SelectionSet> extends object ?`,
    //   `${i(6)}(`,
    //   `${i(7)}IsEmptyObject<GraphQLFetchOperationResponse<Operation, SelectionSet>> extends true ? null :`,
    //   `${i(7)}GraphQLFetchOperationResponse<Operation, SelectionSet>`,
    //   `${i(6)}) :`,
    //   `${i(6)}GraphQLFetchOperationResponse<Operation, SelectionSet>`,
    //   `${i(5)}) :`,
    //   `${i(5)}null`,
    //   `${i(4)}) :`,
    //   `${i(4)}SelectionSet extends object ?`,
    //   `${i(4)}(`,
    //   `${i(5)}IsEmptyObject<SelectionSet> extends true ? null :`,
    //   `${i(5)}SelectionSet extends OperationSelectionSet<Operation> ? `,
    //   `${i(5)}(`,
    //   `${i(6)}GraphQLFetchOperationResponse<Operation, SelectionSet> extends object ?`,
    //   `${i(6)}(`,
    //   `${i(7)}IsEmptyObject<GraphQLFetchOperationResponse<Operation, SelectionSet>> extends true ? null :`,
    //   `${i(7)}GraphQLFetchOperationResponse<Operation, SelectionSet>`,
    //   `${i(6)}) :`,
    //   `${i(6)}GraphQLFetchOperationResponse<Operation, SelectionSet>`,
    //   `${i(5)}) :`,
    //   `${i(5)}null`,
    //   `${i(4)}) :`,
    //   `${i(4)}null`,
    //   `${i(3)}) :`,
    //   `${i(3)}SelectionSet extends OperationSelectionSet<Operation> ? `,
    //   `${i(3)}(`,
    //   `${i(4)}GraphQLFetchOperationResponse<Operation, SelectionSet> extends object ?`,
    //   `${i(4)}(`,
    //   `${i(5)}IsEmptyObject<GraphQLFetchOperationResponse<Operation, SelectionSet>> extends true ? null :`,
    //   `${i(5)}GraphQLFetchOperationResponse<Operation, SelectionSet>`,
    //   `${i(4)}) :`,
    //   `${i(4)}GraphQLFetchOperationResponse<Operation, SelectionSet>`,
    //   `${i(3)}) :`,
    //   `${i(3)}null`,
    //   `${i(2)}) :`,
    //   `${i(2)}null // If Operation is invalid, return null`,
    //   `${i(1)})`,
    // ].join("\n"),
    // [
    //   `type SelectionSetFromReferenceResponse<Operation extends GraphQLOperation, SelectionSet extends RawSelectionSet, Reference extends any> = Reference extends Array<infer I> ?`,
    //   `${i(1)}SelectionSetFromReferenceResponse<Operation, SelectionSet, I>[] :`,
    //   `${i(1)}SelectionSet extends object ?`,
    //   `${i(1)}{ [Selection in keyof Common<SelectionSet, Reference> as SelectionSet[Selection] extends false ? never : Selection]: `,
    //   `${i(2)}SelectionSet[Selection] extends SelectionSetSelection ?`,
    //   `${i(2)}(`,
    //   `${i(3)}SelectionSet[Selection] extends true ?`,
    //   `${i(3)}(`,
    //   `${i(4)}Reference[Selection] extends object ? // This would be the end of the selection set recursion`,
    //   `${i(4)}any :`,
    //   `${i(4)}Reference[Selection]`,
    //   `${i(3)}) :`,
    //   `${i(3)}null`,
    //   `${i(2)}) :`,
    //   `${i(2)}SelectionSet[Selection] extends RawSelectionSet ? `,
    //   `${i(2)}SelectionSetFromReferenceResponse<Operation, SelectionSet[Selection], Reference[Selection]> :`,
    //   `${i(2)}null`,
    //   `${i(1)}} :`,
    //   `${i(1)}SelectionSet extends boolean ?`,
    //   `${i(1)}(`,
    //   `${i(2)}SelectionSet extends true ? `,
    //   `${i(2)}(`,
    //   `${i(3)}Reference extends object ?`,
    //   `${i(3)}SelectionSetFromReferenceResponse<Operation, OperationSelectionSet<Operation>, Reference> :`,
    //   `${i(3)}Reference`,
    //   `${i(2)}) :`,
    //   `${i(2)}null`,
    //   `${i(1)}) :`,
    //   `${i(1)}null`,
    // ].join("\n"),
    // [
    //   `export type OperationSelectionSetResponse<Operation extends GraphQLOperation, SelectionSet extends OperationSelectionSet<Operation> | SelectionSetSelection> = (`,
    //   `${i(1)}SelectionSet extends SelectionSetSelection ?`,
    //   `${i(1)}(`,
    //   `${i(2)}SelectionSet extends true ? `,
    //   `${i(2)}OperationSelectionSet<Operation> :`,
    //   `${i(2)}OperationFetchError`,
    //   `${i(1)}) :`,
    //   `${i(1)}{`,
    //   `${i(2)}[Selection in keyof SelectionSet as SelectionSet[Selection] extends boolean ? SelectionSet[Selection] extends true ? Selection : never : Selection]: (`,
    //   `${i(3)}SelectionSet[Selection] extends true ? `,
    //   `${i(3)}any : `,
    //   `${i(3)}SelectionSet[Selection] extends RawSelectionSet ? `,
    //   `${i(3)}GraphQLFetchGeneralResponse<SelectionSet[Selection]> : `,
    //   `${i(3)}any`,
    //   `${i(2)})`,
    //   `${i(1)}}`,
    //   `)`,
    // ].join("\n"),
    [
      `export type SmartGraphQLOperationRequest<Operation extends GraphQLOperation> = {`,
      `${i(1)}operationName: Operation`,
      `${i(1)}query?: string | null | undefined`,
      `${i(1)}variables: GraphQLOperationInput[Operation] extends null ? null : GraphQLOperationInput[Operation]`,
      `}`,
    ].join("\n"),
    [
      `export type SimpleGraphQLOperationRequest = {`,
      `${i(1)}operationName: string`,
      `${i(1)}query: string`,
      `${i(1)}variables?: Record<string, any> | null | undefined`,
      `}`,
    ].join("\n"),
    `export type EnhancedSmartGraphQLOperationRequest<Operation extends GraphQLOperation> = ShallowPickNonNulls<SmartGraphQLOperationRequest<Operation>>`,
    `export type GraphQLOperationRequest<Operation extends GraphQLOperation | void = void> = Operation extends void ? SimpleGraphQLOperationRequest : Operation extends GraphQLOperation ? EnhancedSmartGraphQLOperationRequest<Operation> : never`,
    [
      `type BaseFetchOptions = {`,
      `${i(1)}endpoint?: string | null | undefined`,
      `${i(1)}dev_endpoint?: string | null | undefined`,
      `${i(1)}production?: boolean | null | undefined`,
      `${i(1)}Authorization?: string | null | undefined`,
      `${i(1)}log?: boolean | null | undefined`,
      `${i(1)}use_conventions?: boolean | null | undefined`,
      `}`,
    ].join("\n"),
    `export type CustomFetchOptions<Operation extends GraphQLOperation | void = void> = Operation extends void ? BaseFetchOptions : BaseFetchOptions`,
    `export type OperationFetchOptions<Operation extends GraphQLOperation | void = void> = Operation extends void ? BaseFetchOptions : BaseFetchOptions`,
    `export type LoopFetchOptions<Operation extends GraphQLOperation | void = void> = { delay?: number | null | undefined } & OperationFetchOptions<Operation>`,
    `export type BoundedLoopFetchOptions<Operation extends GraphQLOperation | void = void> = { limit?: number | null | undefined } & LoopFetchOptions<Operation>`,
    [
      `type OutputFromUnion<SelectionSet extends any, U extends any> = (`,
      `${i(1)}SelectionSet extends object ?`,
      `${i(1)}IsUnion<U> extends true ? (`,
      `${i(2)}(`,
      `${i(3)}"union_select" extends keyof SelectionSet ? // Check if we were given a union_select`,
      `${i(3)}(`,
      `${i(4)}SelectionSet["union_select"] extends string ?`,
      `${i(4)}(`,
      `${i(5)}SelectUnionType<U, SelectionSet["union_select"]> extends never ?`,
      `${i(5)}U :`,
      `${i(5)}SelectUnionType<U, SelectionSet["union_select"]>`,
      `${i(4)}) :`,
      `${i(4)}U`,
      `${i(3)}) :`,
      `${i(3)}U`,
      `${i(2)})`,
      `${i(1)}) : `,
      `${i(1)}U :`,
      `${i(1)}U`,
      `)`,
    ].join("\n"),
    `type BoundedOperationOutput<Output extends any, N extends PositiveNumber<number>, FirstRecursion extends boolean = false> = BoundedOperationOutput_<N, [], Output, true>`,
    [
      `type BoundedOperationOutput_<N extends PositiveNumber<number>, Depth extends unknown[] = unknown[], Output extends any = {}, FirstRecursion extends boolean = false> = (`,
      `${i(1)}N extends Depth['length'] ? `,
      `${i(1)}Output extends object ?`,
      `${i(1)}{ [K in keyof Output as Output[K] extends object ? never : K]: Output[K] } : // Base case`,
      `${i(1)}FirstRecursion extends true ?`,
      `${i(1)}(`,
      `${i(2)}Output extends Array<infer I> ? I extends object ? BoundedOperationOutput_<N, Depth, I, true>[] : I : // Arrays don't count towards recursion`,
      `${i(2)}{ [K in keyof Output as Output[K] extends Record<PropertyKey, unknown> ? IsEmptyObject<Output[K]> extends true ? never : K : K]: Output[K] extends object ? BoundedOperationOutput_<RecursionOverride<Output[K], N>, [RecursionOverride<Output[K], N>, ...Depth], Output[K]> : Output[K] }`,
      `${i(1)}) :`,
      `${i(1)}null :`,
      `${i(1)}Output extends object ?`,
      `${i(1)}Output extends Array<infer I> ? I extends object ? BoundedOperationOutput_<N, Depth, I>[] : I : // Arrays don't count towards recursion`,
      `${i(1)}{ [K in keyof Output as Output[K] extends Record<PropertyKey, unknown> ? IsEmptyObject<Output[K]> extends true ? never : K : K]: Output[K] extends object ? BoundedOperationOutput_<N, [N, ...Depth], Output[K]> : Output[K] } :`,
      `${i(1)}null`,
      `)`,
    ].join("\n"),
    `export type BoundedOperationSelectionSetType<Output extends any, N extends PositiveNumber<number>> = BoundedOperationSelectionSetType_<N, [], Output, true>`,
    [
      `type BoundedOperationSelectionSetType_<N extends PositiveNumber<number>, Depth extends unknown[] = unknown[], Output extends any = {}, FirstRecursion extends boolean = false> = (`,
      `${i(1)}N extends Depth['length'] ?`,
      `${i(1)}{ [K in keyof Output as Output[K] extends object ? never : K]?: boolean } : // Base case`,
      `${i(1)}FirstRecursion extends true ?`,
      `${i(1)}(`,
      `${i(2)}Output extends object ? `,
      `${i(2)}{`,
      `${i(3)}[K in keyof Output as NestedType<Output[K]> extends Record<PropertyKey, unknown> ? IsEmptyObject<NestedType<Output[K]>> extends true ? never : K : K]?: `,
      `${i(3)}true extends IsUnion<NestedType<Output[K]>> ? // boolean | Account | etc... does not extend object, but it is still a union`,
      `${i(3)}(`,
      `${i(4)}UnionMemberTypename<NestedType<Output[K]>> extends never ? `,
      `${i(4)}BoundedOperationSelectionSetType_<RecursionOverride<NestedType<Output[K]>, N>, [RecursionOverride<NestedType<Output[K]>, N>, ...Depth], NestedType<Output[K]>> | boolean :`,
      `${i(4)}BoundedOperationSelectionSetType_<RecursionOverride<NestedType<Output[K]>, N>, [RecursionOverride<NestedType<Output[K]>, N>, ...Depth], UnionMemberWithTypename<NestedType<Output[K]>>> & {union_select: UnionMemberTypename<NestedType<Output[K]>> }`,
      `${i(3)}) :`,
      `${i(3)}NestedType<Output[K]> extends object ? `,
      `${i(3)}BoundedOperationSelectionSetType_<RecursionOverride<NestedType<Output[K]>, N>, [RecursionOverride<NestedType<Output[K]>, N>, ...Depth], NestedType<Output[K]>> | boolean :`,
      `${i(3)}boolean`,
      `${i(2)}} :`,
      `${i(2)}boolean`,
      `${i(1)}) :`,
      `${i(1)}(`,
      `${i(2)}Output extends object ? `,
      `${i(2)}{`,
      `${i(3)}[K in keyof Output as NestedType<Output[K]> extends Record<PropertyKey, unknown> ? IsEmptyObject<NestedType<Output[K]>> extends true ? never : K : K]?: `,
      `${i(3)}true extends IsUnion<NestedType<Output[K]>> ? // boolean | Account | etc... does not extend object, but it is still a union`,
      `${i(3)}(`,
      `${i(4)}UnionMemberTypename<NestedType<Output[K]>> extends never ? `,
      `${i(4)}BoundedOperationSelectionSetType_<N, [N, ...Depth], NestedType<Output[K]>> | boolean :`,
      `${i(4)}BoundedOperationSelectionSetType_<N, [N, ...Depth], UnionMemberWithTypename<NestedType<Output[K]>>> & {union_select: UnionMemberTypename<NestedType<Output[K]>> }`,
      `${i(3)}) :`,
      `${i(3)}NestedType<Output[K]> extends object ? `,
      `${i(3)}BoundedOperationSelectionSetType_<N, [N, ...Depth], NestedType<Output[K]>> | boolean :`,
      `${i(3)}boolean`,
      `${i(2)}} :`,
      `${i(2)}boolean`,
      `${i(1)})`,
      `)`,
    ].join("\n"),
    // `type BoundedOperationSelectionSet<Output extends any, N extends PositiveNumber<number>> = BoundedOperationSelectionSet_<N, [], Output, true>`,
    // [
    //   `type BoundedOperationSelectionSet_<N extends PositiveNumber<number>, Depth extends unknown[] = unknown[], Output extends any = {}, FirstRecursion extends boolean = false> = (`,
    //   `${i(1)}N extends Depth['length'] ?`,
    //   `${i(1)}{ [K in keyof Output as Output[K] extends object ? never : K]?: true } : // Base case`,
    //   `${i(1)}FirstRecursion extends true ?`,
    //   `${i(1)}(`,
    //   `${i(2)}// true extends IsUnion<Output> ? `,
    //   `${i(2)}Output extends Array<infer I> ? I extends object ? (BoundedOperationSelectionSetType_<N, Depth, I, true>) : true : // Arrays don't count towards recursion`,
    //   `${i(2)}Output extends object ?`,
    //   `${i(2)}{ `,
    //   `${i(3)}[K in keyof Output as NestedType<Output[K]> extends Record<PropertyKey, unknown> ? IsEmptyObject<NestedType<Output[K]>> extends true ? never : K : K]?: `,
    //   `${i(3)}NestedType<Output[K]> extends object ? `,
    //   `${i(3)}true extends IsUnion<NestedType<Output[K]>> ? `,
    //   `${i(3)}(`,
    //   `${i(4)}"__typename" extends keyof NestedType<Output[K]> ?`,
    //   `${i(4)}BoundedOperationSelectionSetType_<RecursionOverride<NestedType<Output[K]>, N>, [RecursionOverride<NestedType<Output[K]>, N>, ...Depth], NestedType<Output[K]>> :`,
    //   `${i(4)}BoundedOperationSelectionSetType_<RecursionOverride<NestedType<Output[K]>, N>, [RecursionOverride<NestedType<Output[K]>, N>, ...Depth], NestedType<Output[K]>>`,
    //   `${i(3)}) :`,
    //   `${i(3)}BoundedOperationSelectionSetType_<RecursionOverride<NestedType<Output[K]>, N>, [RecursionOverride<NestedType<Output[K]>, N>, ...Depth], NestedType<Output[K]>> : `,
    //   `${i(3)}true `,
    //   `${i(2)}} :`,
    //   `${i(2)}true`,
    //   `${i(1)}) :`,
    //   `${i(1)}(`,
    //   `${i(2)}Output extends Array<infer I> ? NestedType<I> extends object ? BoundedOperationSelectionSetType_<N, Depth, NestedType<I>> | boolean : boolean : // Arrays don't count towards recursion`,
    //   `${i(2)}Output extends object ? `,
    //   `${i(2)}// { [K in keyof Output as Output[K] extends Record<PropertyKey, unknown> ? IsEmptyObject<Output[K]> extends true ? never : K : K]?: Output[K] extends object ? BoundedSelectionSetType_<N, [N, ...Depth], Output[K]> | boolean : boolean } :`,
    //   `${i(2)}{ `,
    //   `${i(3)}[K in keyof Output as NestedType<Output[K]> extends Record<PropertyKey, unknown> ? IsEmptyObject<NestedType<Output[K]>> extends true ? never : K : K]?: `,
    //   `${i(3)}NestedType<Output[K]> extends object ? `,
    //   `${i(3)}true extends IsUnion<NestedType<Output[K]>> ? `,
    //   `${i(3)}(`,
    //   `${i(4)}"__typename" extends keyof NestedType<Output[K]> ?`,
    //   `${i(4)}BoundedOperationSelectionSetType_<N, [N, ...Depth], NestedType<Output[K]>> :`,
    //   `${i(4)}BoundedOperationSelectionSetType_<N, [N, ...Depth], NestedType<Output[K]>>`,
    //   `${i(3)}) :`,
    //   `${i(3)}BoundedOperationSelectionSetType_<N, [N, ...Depth], NestedType<Output[K]>> : `,
    //   `${i(3)}true`,
    //   `${i(2)}} :`,
    //   `${i(2)}true`,
    //   `${i(1)})`,
    //   `)`,
    // ].join("\n"),
    [
      `type SelectionSetResponse<SelectionSet extends RawSelectionSet> = (`,
      `${i(1)}SelectionSet extends object ?`,
      `${i(1)}{ `,
      `${i(2)}[Selection in keyof SelectionSet as SelectionSet[Selection] extends boolean ? SelectionSet[Selection] extends true ? Selection : never : SelectionSet[Selection] extends object ? Selection : never]: (`,
      `${i(3)}SelectionSet[Selection] extends true ? `,
      `${i(3)}any : `,
      `${i(3)}SelectionSet[Selection] extends RawSelectionSet ? `,
      `${i(3)}SelectionSetResponse<SelectionSet[Selection]> : `,
      `${i(3)}any`,
      `${i(2)})`,
      `${i(1)}} :`,
      `${i(1)}SelectionSet extends true ?`,
      `${i(1)}{} :`,
      `${i(1)}null `,
      `)\n`,
    ].join("\n"),
    [
      `export type BoundedOperationResponse<SelectionSet extends any, Output extends any | void, N extends PositiveNumber<number>> = { `,
      `${i(1)}output: (`,
      `${i(2)}Output extends void ?`,
      `${i(2)}(`,
      `${i(3)}[SelectionSet] extends [object] ?`,
      `${i(3)}(`,
      `${i(4)}[SelectionSet] extends [RawSelectionSet] ?`,
      `${i(4)}SelectionSetResponse<SelectionSet> :`,
      `${i(4)}null`,
      `${i(3)}) :`,
      `${i(3)}[SelectionSet] extends true ?`,
      `${i(3)}any :`,
      `${i(3)}null`,
      `${i(2)}) :`,
      `${i(2)}Output extends any ?`,
      `${i(2)}(`,
      `${i(3)}SelectionSet extends true ? `,
      `${i(3)}BoundedOperationOutput_<N, [], NestedType<Output>> :`,
      `${i(3)}SelectionSet extends Record<PropertyKey, unknown> ? `,
      `${i(3)}(`,
      `${i(4)}IsEmptyObject<SelectionSet> extends true ?`,
      `${i(4)}null :`,
      `${i(4)}BoundedOperationResponse_<N, [], SelectionSet, NestedType<Output>, true>`,
      `${i(3)}) :`,
      `${i(3)}BoundedOperationResponse_<N, [], SelectionSet, NestedType<Output>, true>`,
      `${i(2)}) :`,
      `${i(2)}null`,
      `${i(1)})`,
      `}`,
    ].join("\n"),
    [
      `type BoundedOperationResponse_<N extends PositiveNumber<number>, Depth extends unknown[] = unknown[], SelectionSet extends any = true, Output extends any = {}, FirstRecursion extends boolean = false> = (`,
      `${i(1)}N extends Depth['length'] ? // This only occurs when we add a number to the array and this only happends on base case`,
      `${i(1)}Output extends object ?`,
      `${i(1)}{ [Selection in keyof Common<SelectionSet, Output> as Output[Selection] extends object ? never : IsUnion<Output[Selection]> extends true ? never : SelectionSet[Selection] extends false ? never : Selection]: Output[Selection] } : `,
      `${i(1)}FirstRecursion extends true ? // First iteration where we override recursion based on overrides. This is only done here and thus all children types are not analyzed for overrides`,
      `${i(1)}(`,
      `${i(2)}{ [Selection in keyof Common<SelectionSet, Output> as SelectionSet[Selection] extends false | string ? never : NestedType<Output[Selection]> extends Record<PropertyKey, unknown> ? IsEmptyObject<NestedType<Output[Selection]>> extends true ? never : Selection : Selection]: `,
      `${i(3)}(`,
      `${i(4)}IsUnion<NestedType<Output[Selection]>> extends true ? `,
      `${i(4)}(`,
      `${i(5)}OutputFromUnion<SelectionSet[Selection], NestedType<Output[Selection]>> extends object ? `,
      `${i(5)}(`,
      `${i(6)}SelectionSet[Selection] extends true ? `,
      `${i(6)}BoundedOperationOutput_<RecursionOverride<OutputFromUnion<SelectionSet[Selection], NestedType<Output[Selection]>>, N>, [RecursionOverride<OutputFromUnion<SelectionSet[Selection], NestedType<Output[Selection]>>, N>, ...Depth], OutputFromUnion<SelectionSet[Selection], NestedType<Output[Selection]>>> :`,
      `${i(6)}SelectionSet[Selection] extends object ? `,
      `${i(6)}BoundedOperationResponse_<RecursionOverride<OutputFromUnion<SelectionSet[Selection], NestedType<Output[Selection]>>, N>, [RecursionOverride<OutputFromUnion<SelectionSet[Selection], NestedType<Output[Selection]>>, N>, ...Depth], SelectionSet[Selection], OutputFromUnion<SelectionSet[Selection], NestedType<Output[Selection]>>> :`,
      `${i(6)}null`,
      `${i(5)}) :`,
      `${i(5)}OutputFromUnion<SelectionSet[Selection], NestedType<Output[Selection]>>`,
      `${i(4)}) :`,
      `${i(4)}NestedType<Output[Selection]> extends object ? `,
      `${i(4)}(`,
      `${i(5)}SelectionSet[Selection] extends true ? `,
      `${i(5)}BoundedOperationOutput_<RecursionOverride<NestedType<Output[Selection]>, N>, [RecursionOverride<NestedType<Output[Selection]>, N>, ...Depth], NestedType<Output[Selection]>> :`,
      `${i(5)}SelectionSet[Selection] extends object ? `,
      `${i(5)}BoundedOperationResponse_<RecursionOverride<NestedType<Output[Selection]>, N>, [RecursionOverride<NestedType<Output[Selection]>, N>, ...Depth], SelectionSet[Selection], NestedType<Output[Selection]>> :`,
      `${i(5)}null`,
      `${i(4)}) :`,
      `${i(4)}NestedType<Output[Selection]>`,
      `${i(3)})`,
      `${i(2)}}`,
      `${i(1)}) :`,
      `${i(1)}null :`,
      `${i(1)}(`,
      `${i(2)}Output extends object ?`,
      `${i(2)}{ [Selection in keyof Common<SelectionSet, Output> as SelectionSet[Selection] extends false | string ? never : NestedType<Output[Selection]> extends Record<PropertyKey, unknown> ? IsEmptyObject<NestedType<Output[Selection]>> extends true ? never : Selection : Selection]: `,
      `${i(3)}(`,
      `${i(4)}IsUnion<NestedType<Output[Selection]>> extends true ? `,
      `${i(4)}(`,
      `${i(5)}OutputFromUnion<SelectionSet[Selection], NestedType<Output[Selection]>> extends object ? `,
      `${i(5)}(`,
      `${i(6)}SelectionSet[Selection] extends true ? `,
      `${i(6)}BoundedOperationOutput_<RecursionOverride<OutputFromUnion<SelectionSet[Selection], NestedType<Output[Selection]>>, N>, [RecursionOverride<OutputFromUnion<SelectionSet[Selection], NestedType<Output[Selection]>>, N>, ...Depth], OutputFromUnion<SelectionSet[Selection], NestedType<Output[Selection]>>> :`,
      `${i(6)}SelectionSet[Selection] extends object ? `,
      `${i(6)}BoundedOperationResponse_<N, [N, ...Depth], SelectionSet[Selection], OutputFromUnion<SelectionSet[Selection], NestedType<Output[Selection]>>> :`,
      `${i(6)}null`,
      `${i(5)}) :`,
      `${i(5)}OutputFromUnion<SelectionSet[Selection], NestedType<Output[Selection]>>`,
      `${i(4)}) :`,
      `${i(4)}NestedType<Output[Selection]> extends object ? `,
      `${i(4)}(`,
      `${i(5)}SelectionSet[Selection] extends true ? `,
      `${i(5)}BoundedOperationOutput_<N, [N, ...Depth], NestedType<Output[Selection]>> :`,
      `${i(5)}SelectionSet[Selection] extends object ? `,
      `${i(5)}BoundedOperationResponse_<N, [N, ...Depth], SelectionSet[Selection], NestedType<Output[Selection]>> :`,
      `${i(5)}null`,
      `${i(4)}) :`,
      `${i(4)}NestedType<Output[Selection]>`,
      `${i(3)})`,
      `${i(2)}} :`,
      `${i(2)}null`,
      `${i(1)})`,
      `)`,
    ].join("\n"),
    // [
    //   `export type OperationFetchResponse<Operation extends GraphQLOperation | void = void, SelectionSet extends RawSelectionSet | void = void> = (`,
    //   `${i(1)}Operation extends void ?`,
    //   `${i(1)}(`,
    //   `${i(2)}SelectionSet extends RawSelectionSet ?`,
    //   `${i(2)}(`,
    //   `${i(3)}SelectionSetResponse<SelectionSet>`,
    //   `${i(2)}) :`,
    //   `${i(2)}null`,
    //   `${i(1)}) :`,
    //   `${i(1)}(`,
    //   `${i(2)}Operation extends GraphQLOperation ?`,
    //   `${i(2)}(`,
    //   `${i(3)}SelectionSet extends void ?`,
    //   `${i(3)}SelectionSetFromReferenceResponse<Operation, OperationSelectionSet<Operation>, GraphQLOperationOutput[Operation]> :`,
    //   `${i(3)}// GraphQLOperationOutput[Operation] :`,
    //   `${i(3)}SelectionSet extends RawSelectionSet ?`,
    //   `${i(3)}IsEmptyObject<SelectionSetFromReferenceResponse<Operation, SelectionSet, GraphQLOperationOutput[Operation]>> extends true ?`,
    //   `${i(3)}null :`,
    //   `${i(3)}SelectionSetFromReferenceResponse<Operation, SelectionSet, GraphQLOperationOutput[Operation]> :`,
    //   `${i(3)}null`,
    //   `${i(2)}) :`,
    //   `${i(2)}null`,
    //   `${i(1)}) `,
    //   `)`,
    // ].join("\n"),
    // `export type GraphQLOperationInputWithoutArguments = { [Operation in keyof GraphQLOperationInput as GraphQLOperationInput[Operation] extends null ? Operation : never]: GraphQLOperationInput[Operation] }`,
    `export type GraphQLOperationInputWithArguments = { [Operation in keyof GraphQLOperationInput as GraphQLOperationInput[Operation] extends null ? never : Operation]: GraphQLOperationInput[Operation] }`,
    [
      `export type CustomFetchOverload = {`,
      // `${i(1)}<Operation extends GraphQLOperation, SelectionSet extends BoundedOperationSelectionSetType<GraphQLOperationOutput[Operation], typeof OBJECT_RECURSION_LIMIT>>(operation: Operation, operation_request: GraphQLOperationRequest<Operation>, selection_set?: SelectionSet, options?: CustomOperationFetchOptions): Promise<OperationFetchResponse<Operation, SelectionSet> extends null ? OperationFetchError : OperationFetchResponse<Operation, SelectionSet> & OperationFetchError>`,
      `${i(1)}<SelectionSet extends RawSelectionSet = false>(operation_request: GraphQLOperationRequest, selection_set?: SelectionSet, options?: CustomFetchOptions): Promise<BoundedOperationResponse<SelectionSet, void, typeof OBJECT_RECURSION_LIMIT> & OperationFetchError>`,
      `}`,
    ].join("\n"),
    [
      `export type OperationFetchOverload = {`,
      // `${i(1)}<Operation extends keyof GraphQLOperationInputWithArguments, SelectionSet extends RawSelectionSet = OperationSelectionSet<Operation>>(operation: Operation, input: GraphQLOperationInputWithArguments[Operation], selection_set?: SelectionSet, options?: OperationFetchOptions): Promise<OperationFetchResponse<Operation, SelectionSet> extends null ? OperationFetchError : OperationFetchResponse<Operation, SelectionSet> & OperationFetchError>`,
      // `${i(1)}<Operation extends keyof GraphQLOperationInputWithoutArguments, SelectionSet extends RawSelectionSet = OperationSelectionSet<Operation>>(operation: Operation, selection_set?: SelectionSet, options?: OperationFetchOptions): Promise<OperationFetchResponse<Operation, SelectionSet> extends null ? OperationFetchError : OperationFetchResponse<Operation, SelectionSet> & OperationFetchError>`,
      `${i(1)}<Operation extends GraphQLOperation, SelectionSet extends BoundedOperationSelectionSetType<GraphQLOperationOutput[Operation], typeof OBJECT_RECURSION_LIMIT>>(operation: Operation, input: Operation extends keyof GraphQLOperationInputWithArguments ? GraphQLOperationInput[Operation] : (Record<string, unknown> | null), selection_set?: SelectionSet, options?: OperationFetchOptions): Promise<BoundedOperationResponse<SelectionSet, GraphQLOperationOutput[Operation], typeof OBJECT_RECURSION_LIMIT> & OperationFetchError>`,
      `}`,
    ].join("\n"),
    [
      `export type LoopFetchOverload = {`,
      // `${i(1)}<Operation extends keyof GraphQLOperationInputWithArguments, SelectionSet extends RawSelectionSet = OperationSelectionSet<Operation>>(operation: Operation, input: GraphQLOperationInputWithArguments[Operation], selection_set?: SelectionSet, options?: LoopFetchOptions): Promise<OperationFetchResponse<Operation, SelectionSet>>`,
      // `${i(1)}<Operation extends keyof GraphQLOperationInputWithoutArguments, SelectionSet extends RawSelectionSet = OperationSelectionSet<Operation>>(operation: Operation, selection_set?: SelectionSet, options?: LoopFetchOptions): Promise<OperationFetchResponse<Operation, SelectionSet>>`,
      `${i(1)}<Operation extends GraphQLOperation, SelectionSet extends BoundedOperationSelectionSetType<GraphQLOperationOutput[Operation], typeof OBJECT_RECURSION_LIMIT>>(operation: Operation, input: Operation extends keyof GraphQLOperationInputWithArguments ? GraphQLOperationInput[Operation] : (Record<string, unknown> | null), selection_set?: SelectionSet, options?: LoopFetchOptions): Promise<BoundedOperationResponse<SelectionSet, GraphQLOperationOutput[Operation], typeof OBJECT_RECURSION_LIMIT>>`,
      `}`,
    ].join("\n"),
    [
      `export type BoundedLoopFetchOverload = {`,
      // `${i(1)}<Operation extends keyof GraphQLOperationInputWithArguments, SelectionSet extends RawSelectionSet = OperationSelectionSet<Operation>>(operation: Operation, input: GraphQLOperationInputWithArguments[Operation], selection_set?: SelectionSet, options?: BoundedLoopFetchOptions): Promise<OperationFetchResponse<Operation, SelectionSet> extends null ? OperationFetchError : OperationFetchResponse<Operation, SelectionSet> & OperationFetchError>`,
      // `${i(1)}<Operation extends keyof GraphQLOperationInputWithoutArguments, SelectionSet extends RawSelectionSet = OperationSelectionSet<Operation>>(operation: Operation, selection_set?: SelectionSet, options?: BoundedLoopFetchOptions): Promise<OperationFetchResponse<Operation, SelectionSet> extends null ? OperationFetchError : OperationFetchResponse<Operation, SelectionSet> & OperationFetchError>`,
      `${i(1)}<Operation extends GraphQLOperation, SelectionSet extends BoundedOperationSelectionSetType<GraphQLOperationOutput[Operation], typeof OBJECT_RECURSION_LIMIT>>(operation: Operation, input: Operation extends keyof GraphQLOperationInputWithArguments ? GraphQLOperationInput[Operation] : (Record<string, unknown> | null), selection_set?: SelectionSet, options?: BoundedLoopFetchOptions): Promise<BoundedOperationResponse<SelectionSet, GraphQLOperationOutput[Operation], typeof OBJECT_RECURSION_LIMIT> & OperationFetchError>`,
      `}`,
    ].join("\n")
  ]

  // Now we iterate all these types and generate file data
  client_types.map(t => {
    const name = match_first(t, REGEX.match_type_name)
    const file_name = `types.ts`
    const file_name_import = `types`
    const file_name_import_js = `types.js`
    const file_dir = path.join(config.client.output_dir!, CLIENT_GENERATOR_DIRS.types)
    const file_path = path.join(file_dir, file_name)
    const same_dir_import_path = config.global.imports_as_esm ? path.join(file_dir, file_name_import_js) : path.join(file_dir, file_name_import)
    const from_import_path = config.global.imports_as_esm ?  path.join(config.client.output_dir!, "index.js") : config.client.output_dir!

    data.file_data.set(name, {
      file_name: file_name,
      file_dir: file_dir,
      file_path: file_path,
      same_dir_import_path: same_dir_import_path,
      from_import_path: from_import_path,
      imports: new Map(),
      generator: "client"
    })
  })
  
  // Now that we have imports for all of these generated types, we can do the following then
  types = await Promise.all(data.schema_data.object_types!.map(async (op) => {
    if (is_in(op.name, GRAPHQL_ROOT_OPERATIONS)) return await gen_fields_with_args_as_type(op.fields, 'GraphQLOperationInput', 1, data, config)
    else return ""
  }))
  client_types.map((t, pos) => {
    const name = get_type_name(t, "type")
    if (name === 'GraphQLOperationInput') client_types[pos] = client_types[pos].replace(REGEX.match_to_remove_string, types.filter(Boolean).join("\n"))
  })

  types = await Promise.all(data.schema_data.object_types!.map(async (op) => {
    if (is_in(op.name, GRAPHQL_ROOT_OPERATIONS)) return await gen_fields_with_response_as_type(op.fields, 'GraphQLOperationOutput', data, config)
    else return ""
  }))
  client_types.map((t, pos) => {
    const name = get_type_name(t, "type")
    if (name === 'GraphQLOperationOutput') client_types[pos] = client_types[pos].replace(REGEX.match_to_remove_string, types.filter(Boolean).join("\n"))
  })

  // add_relative_import("OperationSelectionSet", "GRAPHQL_OPERATION_DATA", data, config)

  // Both types and data depend on each other so to avoid problems of which to do first, we will add this here
  // add_relative_import("GraphQLOperationDataSelectionSet", "GraphQLOperation", data, config)
  // add_relative_import("GraphQLOperationDataSelectionSet", "GraphQLOperationType", data, config)
  // add_relative_import("GraphQLOperationDataSelectionSet", "OperationDataTypeField", data, config)
  
  return client_types
}

export const gen_client_contants = async (data: GeneratorData, config: GeneratorConfig): Promise<string[]> => {
  const i = new Indent(config).indent
  
  const constants: string[] = []

  constants.push(`export const GRAPHQL_ENDPOINT = "${config.client.endpoint}"`)
  constants.push(`export const DEV_GRAPHQL_ENDPOINT = "${config.client.dev_endpoint ? config.client.dev_endpoint : config.client.endpoint}"`)
  constants.push(`export const LOOP_FETCH_DELAY = ${config.client.fetch_delay}`)
  constants.push(`export const BOUNDED_LOOP_FETCH_LIMIT = ${config.client.loop_fetch_limit}`)
  constants.push(`export const OBJECT_RECURSION_LIMIT = ${config.global.object_recursion_limit}`)
  constants.push(`export const USE_CONVENTIONS = ${config.global.use_conventions}`)
  constants.push(`export const INDENT_SPACES = ${config.global.indent_spaces}`)

  // if (data.schema_data.union_types) {
  //   if (data.schema_data.union_types.length > 0) {
  //     const fields: string[] = []
      
  //     await Promise.all(data.schema_data.union_types.map(u => {
  //       fields.push(`${i(1)}${u.name}: [${u.member_types ? u.member_types.map(m => `"${m}"`).join(", ") : ""}]`)
  //     }))

  //     constants.push([
  //       `export const GRAPHQL_UNION = {`,
  //       fields.join(", "),
  //       `}`
  //     ].join("\n"))
  //   }
  //   else {
  //     constants.push(`export type GRAPHQL_UNION = {}`)
  //   }
  // }
  // else {
  //   constants.push(`export type GRAPHQL_UNION = {}`)
  // }

  const recursion_overrides = []

  if (config.client.recursion_overrides) {
    for (const [typename, override] of config.client.recursion_overrides.entries()) {
      recursion_overrides.push(`${i(1)}["${typename}", ${override}]`)
    }
  }

  const recursion_override_string = recursion_overrides.length === 0 ? 'new Map()' : [
    'new Map([',
      recursion_overrides.join(",\n"),
    '])'
  ].join("\n")

  constants.push([
    `export const REGEX = {`,
    `${i(1)}match_all_indents_before_closing_bracket: /[\\s]*(?=[}])/gm,`,
    `${i(1)}match_indent: /(\\s){INDENT_SPACES}/gm,`,
    `}`,
  ].join("\n"))
  constants.push(`export const RECURSION_LIMIT_OVERRIDES: Map<string, number> = ${recursion_override_string}`)

  // Now we iterate all these types and generate file data
  constants.map(t => {
    const name = match_first(t, REGEX.match_const_name)
    const file_name = `constants.ts`
    const file_name_import = `contants`
    const file_name_import_js = `constants.js`
    const file_dir = path.join(config.client.output_dir!, CLIENT_GENERATOR_DIRS.constants)
    const file_path = path.join(file_dir, file_name)
    const same_dir_import_path = config.global.imports_as_esm ? path.join(file_dir, file_name_import_js) : path.join(file_dir, file_name_import)
    const from_import_path = config.global.imports_as_esm ?  path.join(config.client.output_dir!, "index.js") : config.client.output_dir!

    data.file_data.set(name, {
      file_name: file_name,
      file_dir: file_dir,
      file_path: file_path,
      same_dir_import_path: same_dir_import_path,
      from_import_path: from_import_path,
      imports: new Map(),
      generator: "client"
    })
  })

  // Must be done here since if it is done in types gen, the file data for this const won't have been made yet
  add_relative_import('BoundedRecursionLimit', 'OBJECT_RECURSION_LIMIT', data, config)


  return constants
}

export const gen_client_utils = async (data: GeneratorData, config: GeneratorConfig): Promise<string[]> => {
  const i = new Indent(config).indent
  
  const utils: string[] = []

  utils.push(`export const capitalize_first_word = (input: string) => input.charAt(0).toUpperCase() + input.slice(1)`)
  utils.push(`export const delay = (d: number) => new Promise(resolve => setTimeout(resolve, d))`)
  utils.push([
    `export const indent: IndentOverload = (a?: string | number, b?: number, c?: string | number): string => {`,
    `${i(1)}let to_indent = ""`,
    `${i(1)}let indent_amount = 1`,
    `${i(1)}let indent_spaces = INDENT_SPACES`,
    `${i(1)}// These checks are to determine order of provided parameters`,
    `${i(1)}if (typeof a === "string") {`,
    `${i(2)}if (a) to_indent = a`,
    `${i(2)}if (b && typeof b === "number") indent_amount = b`,
    `${i(2)}if (c && typeof c === "number") indent_spaces = c`,
    `${i(1)}}`,
    `${i(1)}else if (typeof a === "number") {`,
    `${i(2)}if (a) indent_amount = a`,
    `${i(2)}if (b && typeof b === "number") indent_spaces = b`,
    `${i(2)}if (c && typeof c === "string") to_indent = c`,
    `${i(1)}}`,
    `${i(1)}const indent_prefix = " ".repeat(indent_spaces + (indent_amount - 1) * indent_spaces)`,
    `${i(1)}return \`\${indent_prefix}\${to_indent}\``,
    `}`,
  ].join("\n"))

  utils.map(t => {
    const name = match_first(t, REGEX.match_const_name)
    const file_name = `utils.ts`
    const file_name_import = `utils`
    const file_name_import_js = `utils.js`
    const file_dir = path.join(config.client.output_dir!, CLIENT_GENERATOR_DIRS.utils)
    const file_path = path.join(file_dir, file_name)
    const same_dir_import_path = config.global.imports_as_esm ? path.join(file_dir, file_name_import_js) : path.join(file_dir, file_name_import)
    const from_import_path = config.global.imports_as_esm ?  path.join(config.client.output_dir!, "index.js") : config.client.output_dir!

    data.file_data.set(name, {
      file_name: file_name,
      file_dir: file_dir,
      file_path: file_path,
      same_dir_import_path: same_dir_import_path,
      from_import_path: from_import_path,
      imports: new Map(),
      generator: "client"
    })
  })

  add_relative_import("indent", "IndentOverload", data, config)
  add_relative_import("indent", "INDENT_SPACES", data, config)

  return utils
}

export const gen_clients_functions = async (data: GeneratorData, config: GeneratorConfig): Promise<string[]> => {
  const i = new Indent(config).indent
 
  const functions: string[] = []
  const file_name = `functions.ts`
  const file_name_import = `functions`
  const file_name_import_js = `functions.js`
  const file_dir = path.join(config.client.output_dir!, CLIENT_GENERATOR_DIRS.functions)
  const file_path = path.join(file_dir, file_name)
  const same_dir_import_path = config.global.imports_as_esm ? path.join(file_dir, file_name_import_js) : path.join(file_dir, file_name_import)
  const from_import_path = config.global.imports_as_esm ?  path.join(config.client.output_dir!, "index.js") : config.client.output_dir!


  functions.push([
    `// Function that returns a type for the field_name provided located at the provided after recursing it up to the last element of the parent_queue`,
    `const recurse_operation_types = (field_name: string, obj: OperationDataTypeField, parent_queue: string[]): string | null => {`,
    `${i(1)}if (!obj) return null`,
    `${i(1)}try {`,
    `${i(2)}if (Object.keys(obj).length === 0) return null`,
    `${i(2)}// Base case`,
    `${i(2)}if (parent_queue.length === 0) return (obj as any).__typename ? (obj as any).__typename : (obj as any).complete_type ? (obj as any).complete_type : null`,
    `${i(2)}else return obj.fields ? recurse_operation_types(field_name, obj.fields[parent_queue.shift()!], parent_queue) : null`,
    `${i(1)}}`,
    `${i(1)}catch(e) {`,
    `${i(2)}return null`,
    `${i(1)}}`,
    `}\n`,
  ].join("\n"))
  data.file_data.set('recurse_operation_types', {
    file_name: file_name,
    file_dir: file_dir,
    file_path: file_path,
    same_dir_import_path: same_dir_import_path,
    from_import_path: from_import_path,
    imports: new Map(),
    generator: "client"
  })
  add_relative_import('recurse_operation_types', 'OperationDataTypeField', data, config)

  functions.push([
    `// Function that returns a selection_set or selection for the selection provided located at the obj provided after recursing it up to the last element of the parent_queue`,
    `const recurse_operation_selection_sets = async (selection: string, obj: Record<string, RawSelectionSet | SelectionSetSelection> | RawSelectionSet, parent_queue: string[]): Promise<Record<string, RawSelectionSet | SelectionSetSelection> | RawSelectionSet | null> => {`,
    `${i(1)}if (!obj) return null`,
    `${i(1)}try {`,
    `${i(2)}if (Object.keys(obj).length === 0) return null`,
    `${i(2)}// Base case`,
    `${i(2)}if (parent_queue.length === 0) return obj`,
    `${i(2)}else {`,
    `${i(3)}if (typeof obj === "object") return Object.keys(obj).length > 0 ? await recurse_operation_selection_sets(selection, (obj as any)[parent_queue.shift()!], parent_queue) : null`,
    `${i(3)}else return null`,
    `${i(2)}}`,
    `${i(1)}}`,
    `${i(1)}catch(e) {`,
    `${i(2)}return null`,
    `${i(1)}}`,
    `}\n`,
  ].join("\n"))
  data.file_data.set('recurse_operation_selection_sets', {
    file_name: file_name,
    file_dir: file_dir,
    file_path: file_path,
    same_dir_import_path: same_dir_import_path,
    from_import_path: from_import_path,
    imports: new Map(),
    generator: "client"
  })
  add_relative_import('recurse_operation_selection_sets', 'RawSelectionSet', data, config)
  add_relative_import('recurse_operation_selection_sets', 'SelectionSetSelection', data, config)

  functions.push([
    `// Function that returns true if the field provided is exists at the obj provided after recursing it up to the last element of the parent_queue`,
    `const is_in_selection_set = async (field_name: string, obj: Record<string, RawSelectionSet | SelectionSetSelection> | RawSelectionSet, parent_queue: string[]): Promise<boolean> => {`,
    `${i(1)}if (!obj) return false`,
    `${i(1)}try {`,
    `${i(2)}if (Object.keys(obj).length === 0) return false`,
    `${i(2)}// Base case`,
    `${i(2)}if (parent_queue.length === 0) return Object.keys(obj).find(o => field_name === o) ? true : false`,
    `${i(2)}else {`,
    `${i(3)}if (typeof obj === "object") return Object.keys(obj).length > 0 ? await is_in_selection_set(field_name, (obj as any)[parent_queue.shift()!], parent_queue) : false`,
    `${i(3)}else return false`,
    `${i(2)}}`,
    `${i(1)}}`,
    `${i(1)}catch(e) {`,
    `${i(2)}return false`,
    `${i(1)}}`,
    `}\n`,
  ].join("\n"))
  data.file_data.set('is_in_selection_set', {
    file_name: file_name,
    file_dir: file_dir,
    file_path: file_path,
    same_dir_import_path: same_dir_import_path,
    from_import_path: from_import_path,
    imports: new Map(),
    generator: "client"
  })

  functions.push([
    `// Checks whether a given object is a selection set`,
    `const is_selection_set = async <SelectionSet extends RawSelectionSet>(selection_set: SelectionSet): Promise<boolean> => {`,
    `${i(1)}try {`,
    `${i(2)}if (selection_set === undefined || selection_set === null) return false`,
    `${i(2)}const selections: string[] = []`,
    `${i(2)}const are_valid: boolean[] = []`,
    `${i(2)}if (typeof selection_set === "object") {`,
    `${i(3)}await Promise.all(Object.keys(selection_set).map(async (selection) => {`,
    `${i(4)}selections.push(selection)`,
    `${i(4)}if (typeof selection_set[selection] === "object") are_valid.push(await is_selection_set(selection_set[selection]))`,
    `${i(4)}else if (typeof selection_set[selection] === "boolean") are_valid.push(true)`,
    `${i(3)}}))`,
    `${i(2)}}`,
    `${i(2)}else {`,
    `${i(3)}if (typeof selection_set === "boolean") return true`,
    `${i(3)}else return false`,
    `${i(2)}}`,
    `${i(2)}return are_valid.filter(Boolean).length === selections.length`,
    `${i(1)}}`,
    `${i(1)}catch(e) {`,
    `${i(2)}return false`,
    `${i(1)}}`,
    `}\n`,
  ].join("\n"))
  data.file_data.set('is_selection_set', {
    file_name: file_name,
    file_dir: file_dir,
    file_path: file_path,
    same_dir_import_path: same_dir_import_path,
    from_import_path: from_import_path,
    imports: new Map(),
    generator: "client"
  })

  functions.push([
    `// Checks whether a given selection_set is a valid subset of a selection_set of an operation`,
    `const is_valid_operation_selection_set = async <Operation extends GraphQLOperation>(operation: Operation, selection_set: RawSelectionSet, parent_queue: string[]): Promise<boolean | null> => {`,
    `${i(1)}try {`,
    `${i(2)}if (selection_set === undefined || selection_set === null) return false`,
    `${i(2)}const types: (string | null)[] = []`,
    `${i(2)}const selections: string[] = []`,
    `${i(2)}const leaf_selections: string[] = []`,
    `${i(2)}const are_valid: boolean[] = []`,
    `${i(2)}if (typeof selection_set === "object") {`,
    `${i(3)}await Promise.all(Object.keys(selection_set).map(async (selection) => {`,
    `${i(4)}selections.push(selection)`,
    `${i(4)}if (typeof selection_set[selection] === "object") {`,
    `${i(5)}const val = await is_valid_operation_selection_set(operation, selection_set[selection], [...parent_queue, selection])`,
    `${i(5)}are_valid.push(val !== null ? val : false)`,
    `${i(4)}}`,
    `${i(4)}else if (typeof selection_set[selection] === "boolean") {`,
    `${i(5)}leaf_selections.push(selection)`,
    `${i(5)}types.push(await recurse_operation_types(selection, GRAPHQL_OPERATION_DATA[operation]["output_types"], [...parent_queue, selection]))`,
    `${i(4)}}`,
    `${i(3)}}))`,
    `${i(2)}}`,
    `${i(2)}else {`,
    `${i(3)}return true`,
    `${i(2)}}`,
    `${i(2)}return types.filter(Boolean).length === leaf_selections.length && (types.filter(Boolean).length + are_valid.filter(Boolean).length) === selections.length ? true : false`,
    `${i(1)}}`,
    `${i(1)}catch(e) {`,
    `${i(2)}return false`,
    `${i(1)}}`,
    `}\n`,
  ].join("\n"))
  data.file_data.set('is_valid_operation_selection_set', {
    file_name: file_name,
    file_dir: file_dir,
    file_path: file_path,
    same_dir_import_path: same_dir_import_path,
    from_import_path: from_import_path,
    imports: new Map(),
    generator: "client"
  })
  add_relative_import('is_valid_operation_selection_set', 'GraphQLOperation', data, config)
  add_relative_import('is_valid_operation_selection_set', 'GRAPHQL_OPERATION_DATA', data, config)
  
  functions.push([
    `// Takes a selection_set and removes all selections that are false and adds selection_set from operation for all selections that are true on a field whose type is not a primitive but an object`,
    `const parse_selection_set = async (selection_set: Record<string, RawSelectionSet | SelectionSetSelection> | RawSelectionSet, obj: Record<string, RawSelectionSet | SelectionSetSelection> | RawSelectionSet): Promise<Record<string, RawSelectionSet | SelectionSetSelection> | RawSelectionSet | null> => {`,
    `${i(1)}try {`,
    `${i(2)}if (obj === undefined || obj === null) return null`,
    `${i(2)}const parsed_selection_set: any = {}`,
    `${i(2)}if (typeof selection_set === "object") {`,
    `${i(3)}await Promise.all(Object.keys(selection_set).map(async (selection: string) => {`,
    `${i(4)}if (typeof selection_set[selection] === "object") {`,
    `${i(5)}const val = await parse_selection_set(selection_set[selection], (obj as any)[selection])`,
    `${i(5)}if (val) parsed_selection_set[selection] = val`,
    `${i(4)}}`,
    `${i(4)}else if (typeof selection_set[selection] === "boolean") {`,
    `${i(5)}if (selection_set[selection] === true) parsed_selection_set[selection] = (obj as any)[selection]`,
    `${i(4)}}`,
    `${i(3)}}))`,
    `${i(2)}}`,
    `${i(2)}else if (selection_set === true) {`,
    `${i(3)}return obj`,
    `${i(2)}}`,
    `${i(2)}return Object.keys(parsed_selection_set).length > 0 ? parsed_selection_set : null`,
    `${i(1)}}`,
    `${i(1)}catch(e) {`,
    `${i(2)}return null`,
    `${i(1)}}`,
    `}\n`,
  ].join("\n"))
  data.file_data.set('parse_selection_set', {
    file_name: file_name,
    file_dir: file_dir,
    file_path: file_path,
    same_dir_import_path: same_dir_import_path,
    from_import_path: from_import_path,
    imports: new Map(),
    generator: "client"
  })


  functions.push([
    `// If Apollo Server expects {id: string} as input and it receives {id: string, phone: string}`,
    `// the server will produce a GraphQL Error. Only types specified as input should be sent to server`,
    `// This function removes properties not expected as input for current operation`,
    `// This works since we have a list of fields for arguments`,
    `// Note that this is just a shallow check because if we recurse and validate all fields`,
    `// we would need to handle very obscure csses involving nested lists and objects`,
    `// and simply setting null to any incorrect field or deleting those fields brings issues`,
    `// we won't know how to solve without knowing all details of a server implementation`,
    `// so a shallow check works well enough for what we want`,
    `const parse_operation_input_fields = async (input: any, obj: Record<string, RawSelectionSet | SelectionSetSelection> | RawSelectionSet) => {`,
    `${i(1)}if (input) {`,
    `${i(2)}if (Object.keys(obj).length) {`,
    `${i(3)}await Promise.all(Object.keys(input).map(async (prop) => {`,
    `${i(4)}const find = Object.keys(obj).find((r) => r === prop)`,
    `${i(4)}if (!find) delete (input as any)[prop]`,
    `${i(3)}}))`,
    `${i(2)}}`,
    `${i(2)}// else {} // Do nothing since this is an input that expects no data`,
    `${i(1)}}`,
    `}\n`,
  ].join("\n"))
  data.file_data.set('parse_operation_input_fields', {
    file_name: file_name,
    file_dir: file_dir,
    file_path: file_path,
    same_dir_import_path: same_dir_import_path,
    from_import_path: from_import_path,
    imports: new Map(),
    generator: "client"
  })

  add_relative_import('recurse_output_fields', 'GraphQLOperation', data, config)
  add_relative_import('recurse_output_fields', 'GraphQLOperationRequest', data, config)
  add_relative_import('recurse_output_fields', 'PROPERTIES_TO_OMIT', data, config)
  add_relative_import('recurse_output_fields', 'OBJECT_RECURSION_LIMIT', data, config)
  add_relative_import('recurse_output_fields', 'indent', data, config)

  functions.push([
    `// Helper function to add selection set to operation request query `,
    `const gen_operation_request_query = async <Operation extends GraphQLOperation>(operation: Operation, selection_set: any, recursion: number, recursion_limit: number, operation_request_query: string[], parent_queue: string[]) => {  `,
    `${i(1)}if (typeof selection_set === 'object') {`,
    `${i(2)}let rec_limit = recursion_limit`,
    `${i(2)}let rec = recursion`,
    `${i(2)}let union_select = selection_set["union_select"] ? selection_set["union_select"] : null`,
    `${i(2)}let keys = Object.keys(selection_set).length`,
    `${i(2)}if (union_select) {`,
    `${i(3)}// Here we make the following fields an inline fragment that takes on the typename field`,
    `${i(3)}// All subsequent fields are all part of the chosen union_select, hence why all of these will`,
    `${i(3)}// now be places inside an inline fragment`,
    `${i(3)}// Since we use typename for union logic, we delete from selection to avoid duplicate mention of selection`,
    `${i(3)}delete selection_set["__typename"]`,
    `${i(3)}keys = Object.keys(selection_set).length`,
    `${i(3)}if (keys > 1) { // Greater than one since we don't count union_select`,
    `${i(4)}// Here means user selected something for this union so we go ahead with the logic`,
    `${i(4)}operation_request_query.push(indent(\`__typename\`, recursion))`,
    `${i(4)}operation_request_query.push(indent(\`... on \${union_select} {\`, recursion))`,
    `${i(4)}rec_limit += 1`,
    `${i(4)}rec += 1`,
    `${i(3)}}`,
    `${i(3)}keys = Object.keys(selection_set).length`,
    `${i(2)}}`,
    `${i(2)}delete selection_set["union_select"]`,
    `${i(2)}const line = indent(\`... on \${union_select} {\`, recursion)`,
    `${i(2)}Object.keys(selection_set).map(async (selection) => {`,
    `${i(3)}if (typeof selection_set[selection] === 'object') {`,
    `${i(4)}const field_type = recurse_operation_types(selection, GRAPHQL_OPERATION_DATA[operation]['output_types'], [...parent_queue, selection])`,
    `${i(4)}if (!field_type) return // If at recursion limit, don't do anything else`,
    `${i(4)}// const union = GRAPHQL_UNION[selection] ? GRAPHQL_UNION[selection] : null`,
    `${i(4)}let type_rec_limit = rec_limit`,
    `${i(4)}if ((!union_select && rec === 2) || (union_select && rec === 3)) {`,
    `${i(5)}// Only apply recursion limit on top lever types`,
    `${i(5)}const overriden_recursion_limit = RECURSION_LIMIT_OVERRIDES.get(field_type)`,
    `${i(5)}type_rec_limit = overriden_recursion_limit !== undefined ? recursion + overriden_recursion_limit : rec_limit`,
    `${i(5)}// console.log(rec_limit)`,
    `${i(5)}if (overriden_recursion_limit) {console.log(field_type); console.log(overriden_recursion_limit); console.log(type_rec_limit)}`,
    `${i(4)}}`,
    `${i(4)}if (rec >= type_rec_limit) return`,
    `${i(4)}const line = indent(\`\${selection} {\`, rec)`,
    `${i(4)}operation_request_query.push(line)`,
    `${i(4)}await gen_operation_request_query(operation, selection_set[selection], rec + 1, type_rec_limit, operation_request_query, [...parent_queue, selection])`,
    `${i(4)}// Check if we were given an object of false selection, which in that case, we must then remove the bracket we added`,
    `${i(4)}if (operation_request_query[operation_request_query.length - 1] === line) {`,
    `${i(5)}operation_request_query[operation_request_query.length - 1] = operation_request_query[operation_request_query.length - 1].slice(0, -2)`,
    `${i(4)}}`,
    `${i(3)}}`,
    `${i(3)}else if (selection_set[selection] === true) operation_request_query.push(indent(\`\${selection}\`, rec))`,
    `${i(2)}})`,
    `${i(2)}const curr_line = operation_request_query[operation_request_query.length - 1]`,
    `${i(2)}if (curr_line !== line) {`,
    `${i(3)}if (curr_line.endsWith("{")) operation_request_query[operation_request_query.length - 1] = operation_request_query[operation_request_query.length - 1].slice(0, -2)`,
    `${i(3)}else {`,
    `${i(4)}operation_request_query.push(\`\${indent(rec - 1)}}\`)`,
    `${i(4)}if (union_select) operation_request_query.push(\`\${indent(rec - 2)}}\`)`,
    `${i(3)}}`,
    `${i(2)}}`,
    `${i(1)}}`,
    `}`,
  ].join("\n"))
  data.file_data.set('gen_operation_request_query', {
    file_name: file_name,
    file_dir: file_dir,
    file_path: file_path,
    same_dir_import_path: same_dir_import_path,
    from_import_path: from_import_path,
    imports: new Map(),
    generator: "client"
  })

  add_relative_import('gen_operation_request_query', 'RECURSION_LIMIT_OVERRIDES', data, config)
  // add_relative_import('gen_operation_request_query', 'OBJECT_RECURSION_LIMIT', data, config)
  // add_relative_import('gen_operation_request_query', 'GRAPHQL_UNION', data, config)
  add_relative_import('gen_operation_request_query', 'indent', data, config)


  functions.push([
    `export const custom_fetch: CustomFetchOverload = async <SelectionSet extends RawSelectionSet = false>(operation_request: GraphQLOperationRequest, selection_set?: SelectionSet, options?: CustomFetchOptions) => {`,
    `${i(1)}const opts = options ? options : {}`,
    `${i(1)}const operation_name = operation_request.operationName`,
    `${i(1)}const endpoint = opts.endpoint ? opts.endpoint : GRAPHQL_ENDPOINT`,
    `${i(1)}const dev_endpoint = opts.dev_endpoint ? opts.dev_endpoint : DEV_GRAPHQL_ENDPOINT`,
    `${i(1)}const use_conventions = opts.use_conventions !== undefined ? opts.use_conventions : USE_CONVENTIONS`,
    `${i(1)}const prod = opts.production !== undefined ? opts.production : process.env ? process.env.NODE_ENV ? process.env.NODE_ENV === 'production' : false : false`,
    `${i(1)}const headers = opts.Authorization ? { 'Content-Type': 'application/json', 'Authoritzation': opts.Authorization } : { 'Content-Type': 'application/json' }`,
    `${i(1)}const log = opts.log ? opts.log : true`,
    `${i(1)}`,
    `${i(1)}if (log) console.log(\`Executing operation: \${operation_name}\`)`,
    `${i(1)}try {`,
    `${i(2)}const raw_response = await fetch(prod ? endpoint : dev_endpoint, { method: 'POST', headers: headers, body: JSON.stringify(operation_request)})`,
    `${i(2)}try {`,
    `${i(3)}const json = await raw_response.json() as any`,
    `${i(3)}if (!json) {`,
    `${i(4)}if (log) console.log(\`Fetch failed on operation: \${operation_name}\`)`,
    `${i(4)}return { fetch_errors: ['Error calling .json() on fetch response'] } as any`,
    `${i(3)}}`,
    `${i(3)}if (json.errors) {`,
    `${i(4)}if (log) console.log(\`Fetch failed on operation: \${operation_name}\`)`,
    `${i(4)}return { fetch_errors: json.errors.map((e: any) => e.message) } as any`,
    `${i(3)}}`,
    `${i(3)}const operation_response = json.data[operation_name]`,
    `${i(3)}// If use_conventions is true, then we know all operations return an error array`,
    `${i(3)}// if there was an error on the server`,
    `${i(3)}if (use_conventions) {`,
    `${i(4)}// If errors is part of the selection set, then it can be assumed that if an error occurs`,
    `${i(4)}// you want that, so if errors is in selection set, the function will not recognize `,
    `${i(4)}// errors as a function error and no error will be emitted`,
    `${i(4)}const find = Object.keys(selection_set as any).find((key) => key === 'errors')`,
    `${i(4)}if (!find && operation_response.errors) {`,
    `${i(5)}if (log) console.log(\`Fetch failed on operation: \${operation_name}\`)`,
    `${i(5)}return { fetch_errors: operation_response.errors.map((e: any) => e.message) } as any`,
    `${i(4)}}`,
    `${i(3)}}`,
    `${i(3)}if (log) console.log(\`Fetch succedded on operation: \${operation_name}\`)`,
    `${i(3)}return { output: operation_response }`,
    `${i(2)}}`,
    `${i(2)}catch(e) {`,
    `${i(3)}if (log) console.log(\`Fetch failed on operation: \${operation_name}\`)`,
    `${i(3)}return { fetch_errors: [e] } as any`,
    `${i(2)}}`,
    `${i(1)}}`,
    `${i(1)}catch(e) {`,
    `${i(2)}if (log) console.log(\`Fetch failed on operation: \${operation_name}\`)`,
    `${i(2)}return { fetch_errors: [e] } as any`,
    `${i(1)}}`,
    `}`,
  ].join("\n"))
  data.file_data.set('custom_fetch', {
    file_name: file_name,
    file_dir: file_dir,
    file_path: file_path,
    same_dir_import_path: same_dir_import_path,
    from_import_path: from_import_path,
    imports: new Map(),
    generator: "client"
  })
  add_relative_import('custom_fetch', 'CustomFetchOptions', data, config)
  add_relative_import('custom_fetch', 'CustomFetchOverload', data, config)
  // add_relative_import('custom_fetch', 'OperationFetchError', data, config)
  add_relative_import('custom_fetch', 'OperationFetchResponse', data, config)
  add_relative_import('custom_fetch', 'GraphQLOperationRequest', data, config)
  add_relative_import('custom_fetch', 'OperationSelectionSet', data, config)
  add_relative_import('custom_fetch', 'CustomOperationFetchOptions', data, config)
  add_relative_import('custom_fetch', 'GRAPHQL_ENDPOINT', data, config)
  add_relative_import('custom_fetch', 'DEV_GRAPHQL_ENDPOINT', data, config)
  add_relative_import('custom_fetch', 'USE_CONVENTIONS', data, config)
  const custom_fetch_file_data = data.file_data.get('custom_fetch')
  add_import('fetch', 'node-fetch', true, custom_fetch_file_data!.imports)

  functions.push([
    `export const operation_fetch: OperationFetchOverload = async <Operation extends GraphQLOperation, SelectionSet extends BoundedOperationSelectionSetType<GraphQLOperationOutput[Operation], typeof OBJECT_RECURSION_LIMIT>>(operation: Operation, input: any, selection_set?: SelectionSet, options?: OperationFetchOptions) => {  `,
    `${i(1)}const operation_data = GRAPHQL_OPERATION_DATA[operation]`,
    `${i(1)}const sel_set = selection_set ? Object.keys(selection_set).length > 0 ? selection_set : operation_data.output_selection_sets : operation_data.output_selection_sets`,
    `${i(1)}const operation_name = operation_data.operation_name`,
    `${i(1)}const operation_type = operation_data.type`,
    `${i(1)}const opts = options ? options : {}`,
    `${i(1)}const endpoint = opts.endpoint ? opts.endpoint : GRAPHQL_ENDPOINT`,
    `${i(1)}const dev_endpoint = opts.dev_endpoint ? opts.dev_endpoint : DEV_GRAPHQL_ENDPOINT`,
    `${i(1)}const use_conventions = opts.use_conventions !== undefined ? opts.use_conventions : USE_CONVENTIONS`,
    `${i(1)}const prod = opts.production !== undefined ? opts.production : process.env ? process.env.NODE_ENV ? process.env.NODE_ENV === 'production' : false : false`,
    `${i(1)}const headers = opts.Authorization ? { 'Content-Type': 'application/json', 'Authoritzation': opts.Authorization } : { 'Content-Type': 'application/json' }`,
    `${i(1)}const log = opts.log ? opts.log : true`,
    `${i(1)}if (log) console.log(\`Executing operation: \${operation_name}\`)`,
    `${i(1)}try {`,
    `${i(2)}const selection_set_is_valid = await is_valid_operation_selection_set(operation, sel_set as any, [])`,
    `${i(2)}if (!selection_set_is_valid) {`,
    `${i(3)}if (log) console.log(\`Fetch failed on operation: \${operation_name}\`)`,
    `${i(3)}return { fetch_errors: ['Selection set is invalid'] } as any`,
    `${i(2)}}`,
    `${i(2)}let operation_request: SimpleGraphQLOperationRequest = { operationName: operation, query: '' }`,
    `${i(2)}const operation_request_query: string[] = []`,
    `${i(2)}const parsed_selection_set = await parse_selection_set(sel_set as any, operation_data.output_selection_sets)`,
    `${i(2)}// This is due to convention that all our inputs are named data`,
    `${i(2)}if (input) {`,
    `${i(3)}if (Object.keys(input).length > 0) {`,
    `${i(4)}await parse_operation_input_fields(input, operation_data.input_selection_sets as any)`,
    `${i(4)}operation_request = { ...operation_request, variables: input }`,
    `${i(4)}// If use_conventions, then we already know how to easily build th e argument section`,
    `${i(4)}if (use_conventions) {`,
    `${i(5)}const operation_input_name = capitalize_first_word(operation_data.operation_name) + 'Input'`,
    `${i(5)}operation_request_query.push(\`\${operation_type} \${capitalize_first_word(operation) + capitalize_first_word(operation_type)}($data: \${operation_input_name}!) {\`)`,
    `${i(5)}operation_request_query.push(\`\${indent(1)}\${operation}(data: $data) {\`)`,
    `${i(4)}}`,
    `${i(4)}else {`,
    `${i(5)}// Else we have to iterate all inputs and contructs the arguments sections of the query`,
    `${i(5)}const input_declarations: string[] = []`,
    `${i(5)}const input_values: string[] = []`,
    `${i(5)}Object.keys(input).map(key => {`,
    `${i(6)}const input_name = key`,
    `${i(6)}let argument_type = ''`,
    `${i(6)}try {`,
    `${i(7)}argument_type = (GRAPHQL_OPERATION_DATA[operation]['input_types'] as any)[input_name]['complete_type'] ? (GRAPHQL_OPERATION_DATA[operation]['input_types'] as any)[input_name]['complete_type'] : null`,
    `${i(6)}}`,
    `${i(6)}catch(e) {}`,
    `${i(6)}if (!argument_type) {`,
    `${i(7)}if (log) console.log(\`Fetch failed on operation: \${operation_name}\`)`,
    `${i(7)}return { fetch_errors: ['Argument type was not found in GRAPHQL_OPERATION_DATA'] } as any`,
    `${i(6)}}`,
    `${i(6)}input_declarations.push(\`$\${input_name}: \${argument_type}\`)`,
    `${i(6)}input_values.push(\`\${input_name}: $\${input_name}\`)`,
    `${i(5)}})`,
    `${i(5)}operation_request_query.push(\`\${operation_type} \${capitalize_first_word(operation) + capitalize_first_word(operation_type)}(\${input_declarations.join(', ')}) {\`)`,
    `${i(5)}operation_request_query.push(\`\${indent(1)}\${operation}(\${input_values.join(', ')}) {\`)`,
    `${i(4)}}`,
    `${i(3)}}`,
    `${i(3)}else {`,
    `${i(4)}operation_request_query.push(\`\${operation_type} \${capitalize_first_word(operation) + capitalize_first_word(operation_type)} {\`)`,
    `${i(4)}operation_request_query.push(\`\${indent(1)}\${operation} {\`)`,
    `${i(3)}}`,
    `${i(2)}}`,
    `${i(2)}else {`,
    `${i(3)}operation_request_query.push(\`\${operation_type} \${capitalize_first_word(operation) + capitalize_first_word(operation_type)} {\`)`,
    `${i(3)}operation_request_query.push(\`\${indent(1)}\${operation} {\`)`,
    `${i(2)}}`,
    `${i(2)}if (parsed_selection_set) {`,
    `${i(3)}await gen_operation_request_query(operation, parsed_selection_set, 2, OBJECT_RECURSION_LIMIT, operation_request_query, [])`,
    `${i(3)}operation_request_query.push('}')`,
    `${i(2)}}`,
    `${i(2)}else {`,
    `${i(3)}operation_request_query[operation_request_query.length - 1] = operation_request_query[operation_request_query.length - 1].slice(0, -2)`,
    `${i(3)}operation_request_query.push('}')`,
    `${i(2)}}`,
    `${i(2)}operation_request.query = operation_request_query.join("\\n")`,
    `${i(2)}const raw_response = await fetch(prod ? endpoint : dev_endpoint, { method: 'POST', headers: headers, body: JSON.stringify(operation_request)})`,
    `${i(2)}try {`,
    `${i(3)}const json = await raw_response.json() as any`,
    `${i(3)}if (!json) {`,
    `${i(4)}if (log) console.log(\`Fetch failed on operation: \${operation_name}\`)`,
    `${i(4)}return { fetch_errors: ['Error calling .json() on fetch response'] } as any`,
    `${i(3)}}`,
    `${i(3)}if (json.errors) {`,
    `${i(4)}if (log) console.log(\`Fetch failed on operation: \${operation_name}\`)`,
    `${i(4)}return { fetch_errors: json.errors.map((e: any) => e.message) } as any`,
    `${i(3)}}`,
    `${i(3)}const operation_response = json.data[operation]`,
    `${i(3)}// If use_conventions is true, then we know all operations return an error array`,
    `${i(3)}// if there was an error on the server`,
    `${i(3)}if (use_conventions) {`,
    `${i(4)}// If errors is part of the selection set, then it can be assumed that if an error occurs`,
    `${i(4)}// you want that, so if errors is in selection set, the function will not recognize `,
    `${i(4)}// errors as a function error and no error will be emitted`,
    `${i(4)}const find = Object.keys(sel_set).find((key) => key === 'errors')`,
    `${i(4)}if (!find && operation_response.errors) {`,
    `${i(5)}if (log) console.log(\`Fetch failed on operation: \${operation_name}\`)`,
    `${i(5)}return { fetch_errors: operation_response.errors.map((e: any) => e.message) } as any`,
    `${i(4)}}`,
    `${i(3)}}`,
    `${i(3)}if (log) console.log(\`Fetch succeeded on operation: \${operation_name}\`)`,
    `${i(3)}return { output: operation_response }`,
    `${i(2)}}`,
    `${i(2)}catch(e) {`,
    `${i(3)}if (log) console.log(\`Fetch failed on operation: \${operation_name}\`)`,
    `${i(3)}return { fetch_errors: [e] } as any`,
    `${i(2)}}`,
    `${i(1)}}`,
    `${i(1)}catch(e) {`,
    `${i(2)}if (log) console.log(\`Fetch failed on operation: \${operation_name}\`)`,
    `${i(2)}return { fetch_errors: [e] } as any`,
    `${i(1)}}`,
    `}`,
  ].join("\n"))
  data.file_data.set('operation_fetch', {
    file_name: file_name,
    file_dir: file_dir,
    file_path: file_path,
    same_dir_import_path: same_dir_import_path,
    from_import_path: from_import_path,
    imports: new Map(),
    generator: "client"
  })
  add_relative_import('operation_fetch', 'OperationFetchOverload', data, config)
  // add_relative_import('operation_fetch', 'GraphQLOperationInput', data, config)
  add_relative_import('operation_fetch', 'BoundedOperationSelectionSetType', data, config)
  add_relative_import('operation_fetch', 'GraphQLOperationOutput', data, config)
  add_relative_import('operation_fetch', 'OperationFetchOptions', data, config)
  add_relative_import('operation_fetch', 'SimpleGraphQLOperationRequest', data, config)
  add_relative_import('operation_fetch', 'OBJECT_RECURSION_LIMIT', data, config)
  // add_relative_import('operation_fetch', 'REGEX', data, config)
  add_relative_import('operation_fetch', 'capitalize_first_word', data, config)

  functions.push([
    `export const loop_fetch: LoopFetchOverload = async <Operation extends GraphQLOperation, SelectionSet extends BoundedOperationSelectionSetType<GraphQLOperationOutput[Operation], typeof OBJECT_RECURSION_LIMIT>>(operation: Operation, input: any, selection_set?: SelectionSet, options?: LoopFetchOptions) => {  `,
    `${i(1)}const opts = options ? options : {}`,
    `${i(1)}const fetch_delay = opts.delay ? opts.delay : LOOP_FETCH_DELAY`,
    `${i(1)}while (true) {`,
    `${i(2)}try {`,
    `${i(3)}const response = await operation_fetch(operation, input, selection_set, opts)`,
    `${i(3)}if (!response.fetch_errors) return response`,
    `${i(3)}else if (response.fetch_errors.length === 0) return response `,
    `${i(3)}// Wait for a bit before re-requesting`,
    `${i(3)}await delay(fetch_delay)`,
    `${i(2)}}`,
    `${i(2)}catch(e) {`,
    `${i(3)}// Do nothing if there was an error`,
    `${i(2)}}`,
    `${i(1)}}`,
    `}`,
  ].join("\n"))
  data.file_data.set('loop_fetch', {
    file_name: file_name,
    file_dir: file_dir,
    file_path: file_path,
    same_dir_import_path: same_dir_import_path,
    from_import_path: from_import_path,
    imports: new Map(),
    generator: "client"
  })
  add_relative_import('loop_fetch', 'LoopFetchOverload', data, config)
  add_relative_import('loop_fetch', 'LoopFetchOptions', data, config)
  add_relative_import('loop_fetch', 'GraphQLOperationInputWithArguments', data, config)
  // add_relative_import('loop_fetch', 'GraphQLOperationInputWithoutArguments', data, config)
  add_relative_import('loop_fetch', 'LOOP_FETCH_DELAY', data, config)
  add_relative_import('loop_fetch', 'delay', data, config)

  functions.push([
    `export const bounded_loop_fetch: BoundedLoopFetchOverload = async <Operation extends GraphQLOperation, SelectionSet extends BoundedOperationSelectionSetType<GraphQLOperationOutput[Operation], typeof OBJECT_RECURSION_LIMIT>>(operation: Operation, input: any, selection_set?: SelectionSet, options?: BoundedLoopFetchOptions): Promise<any> => {  `,
    `${i(1)}const opts = options ? options : {}`,
    `${i(1)}const fetch_delay = opts.delay ? opts.delay : LOOP_FETCH_DELAY`,
    `${i(1)}const fetch_limit = opts.limit ? opts.limit : BOUNDED_LOOP_FETCH_LIMIT`,
    `${i(1)}let fetches = 1`,
    `${i(1)}let response`,
    `${i(1)}while (fetches <= fetch_limit) {`,
    `${i(2)}try {`,
    `${i(3)}response = await operation_fetch(operation, input, selection_set, opts)`,
    `${i(3)}if (!response.fetch_errors) return response`,
    `${i(3)}else if (response.fetch_errors.length === 0) return response `,
    `${i(3)}// Wait for a bit before re-requesting`,
    `${i(3)}await delay(fetch_delay)`,
    `${i(3)}fetches += 1`,
    `${i(2)}}`,
    `${i(2)}catch(e) {`,
    `${i(3)}// Do nothing if there was an error`,
    `${i(3)}fetches += 1`,
    `${i(2)}}`,
    `${i(1)}}`,
    `${i(1)}return response`,
    `}`,
  ].join("\n"))
  data.file_data.set('bounded_loop_fetch', {
    file_name: file_name,
    file_dir: file_dir,
    file_path: file_path,
    same_dir_import_path: same_dir_import_path,
    from_import_path: from_import_path,
    imports: new Map(),
    generator: "client"
  })
  add_relative_import('bounded_loop_fetch', 'BoundedLoopFetchOverload', data, config)
  add_relative_import('bounded_loop_fetch', 'BoundedLoopFetchOptions', data, config)
  add_relative_import('bounded_loop_fetch', 'BOUNDED_LOOP_FETCH_LIMIT', data, config)

  return functions
}

export const create_client_types_files = async (types: string[], data: GeneratorData, config: GeneratorConfig) => {
  if (!types) return
  if (types.length === 0) return
  
  const exports: string[] = []
  const imports: Map<string, ImportData> = new Map()
  let file_data: FileData

  await Promise.all(types.map(async (t) => {
    const name: string = get_type_name(t, "type")
    if (!name) logger.error(`Error getting name from this type -> ${t}`)

    const temp_file_data = data.file_data.get(name)
    if (!temp_file_data) logger.error(`Error getting file data for type -> ${name}`)
    file_data = temp_file_data!
    
    await add_imports(temp_file_data!.imports, imports)

    exports.push(`export * from './${config.global.imports_as_esm ? temp_file_data!.file_name.replace(".ts", ".js") : temp_file_data!.file_name.replace(".ts", "")}'`)
  }))

  const imports_to_add = gen_imports(imports)

  const file_contents = [
    imports_to_add ? imports_to_add.filter(Boolean).join("\n") : "",
    types.join("\n")
  ]

  await write_format_file(file_data!.file_dir, file_data!.file_name, file_contents, config)

  const index_file = exports.filter((e, pos) => exports.indexOf(e) === pos).join("\n")
  const index_file_dir = path.join(config.client.output_dir!, CLIENT_GENERATOR_DIRS.types)

  const index_contents = [
    index_file
  ]

  await write_format_file(index_file_dir, "index.ts", index_contents, config)
}

export const gen_client_hooks = async (data: GeneratorData, config: GeneratorConfig): Promise<string[]> => {
  
  const hooks: string[] = []

  // hooks.push(``)
  
  hooks.map(t => {
    const name = match_first(t, REGEX.match_const_name)
    const file_name = `hooks.ts`
    const file_name_import = `hooks`
    const file_name_import_js = `hooks.js`
    const file_dir = path.join(config.client.output_dir!, CLIENT_GENERATOR_DIRS.hooks)
    const file_path = path.join(file_dir, file_name)
    const same_dir_import_path = config.global.imports_as_esm ? path.join(file_dir, file_name_import_js) : path.join(file_dir, file_name_import)
    const from_import_path = config.global.imports_as_esm ?  path.join(config.client.output_dir!, "index.js") : config.client.output_dir!

    data.file_data.set(name, {
      file_name: file_name,
      file_dir: file_dir,
      file_path: file_path,
      same_dir_import_path: same_dir_import_path,
      from_import_path: from_import_path,
      imports: new Map(),
      generator: "client"
    })
  })

  // const hook_name_file_data = data.file_data.get('hook_name')
  // add_import('useQuery', '@tanstack/react-query', true, hook_name_file_data!.imports)
  // add_import('useMutation', '@tanstack/react-query', true, hook_name_file_data!.imports)

  return hooks
}

export const create_client_constants_files = async (constants: string[], data: GeneratorData, config: GeneratorConfig) => {
  if (!constants) return
  if (constants.length === 0) return
  
  const exports: string[] = []
  const imports: Map<string, ImportData> = new Map()
  let file_data: FileData

  await Promise.all(constants.map(async (c) => {
    const name: string = get_type_name(c, "const")
    if (!name) logger.error(`Error getting name from this constant -> ${c}`)

    const temp_file_data = data.file_data.get(name)
    if (!temp_file_data) logger.error(`Error getting file data for constant -> ${name}`)
    file_data = temp_file_data!
    
    await add_imports(temp_file_data!.imports, imports)

    exports.push(`export * from './${config.global.imports_as_esm ? temp_file_data!.file_name.replace(".ts", ".js") : temp_file_data!.file_name.replace(".ts", "")}'`)
  }))

  const imports_to_add = gen_imports(imports)

  const file_contents = [
    imports_to_add ? imports_to_add.filter(Boolean).join("\n") : "",
    constants.join("\n")
  ]

  await write_format_file(file_data!.file_dir, file_data!.file_name, file_contents, config)

  const index_file = exports.filter((e, pos) => exports.indexOf(e) === pos).join("\n")
  const index_file_dir = path.join(config.client.output_dir!, CLIENT_GENERATOR_DIRS.constants)

  const index_contents = [
    index_file
  ]

  await write_format_file(index_file_dir, "index.ts", index_contents, config)
}

export const create_client_data_files = async (operation_data: string[], data: GeneratorData, config: GeneratorConfig) => {
  if (!operation_data) return
  if (operation_data.length === 0) return
  
  const exports: string[] = []
  const imports: Map<string, ImportData> = new Map()
  let file_data: FileData

  await Promise.all(operation_data.map(async (s) => {
    let name: string = get_type_name(s, "const")
    if (!name) name = get_type_name(s, "type")

    if (!name) logger.error(`Error getting name from this data -> ${s}`)

    const temp_file_data = data.file_data.get(name)
    if (!temp_file_data) logger.error(`Error getting file data for data -> ${name}`)
    file_data = temp_file_data!
    
    await add_imports(temp_file_data!.imports, imports)

    exports.push(`export * from './${config.global.imports_as_esm ? temp_file_data!.file_name.replace(".ts", ".js") : temp_file_data!.file_name.replace(".ts", "")}'`)
  }))

  const imports_to_add = gen_imports(imports)

  const file_contents = [
    imports_to_add ? imports_to_add.filter(Boolean).join("\n") : "",
    operation_data.join("\n")
  ]

  await write_format_file(file_data!.file_dir, file_data!.file_name, file_contents, config, "typescript", OPERATION_DATA_AUTO_GENERATED_COMMENT)

  const index_file = exports.filter((e, pos) => exports.indexOf(e) === pos).join("\n")
  const index_file_dir = path.join(config.client.output_dir!, CLIENT_GENERATOR_DIRS.data)

  const index_contents = [
    index_file
  ]

  await write_format_file(index_file_dir, "index.ts", index_contents, config)
}

export const create_client_utils_files = async (utils: string[], data: GeneratorData, config: GeneratorConfig) => {
  if (!utils) return
  if (utils.length === 0) return
  
  const exports: string[] = []
  const imports: Map<string, ImportData> = new Map()
  let file_data: FileData

  await Promise.all(utils.map(async (f) => {
    const name: string = get_type_name(f, "const")
    if (!name) logger.error(`Error getting name from this util -> ${f}`)

    const temp_file_data = data.file_data.get(name)
    if (!temp_file_data) logger.error(`Error getting file data for util -> ${name}`)
    file_data = temp_file_data!
    
    await add_imports(temp_file_data!.imports, imports)

    exports.push(`export * from './${config.global.imports_as_esm ? temp_file_data!.file_name.replace(".ts", ".js") : temp_file_data!.file_name.replace(".ts", "")}'`)
  }))

  const imports_to_add = gen_imports(imports)

  const file_contents = [
    imports_to_add ? imports_to_add.filter(Boolean).join("\n") : "",
    utils.join("\n")
  ]

  await write_format_file(file_data!.file_dir, file_data!.file_name, file_contents, config)

  const index_file = exports.filter((e, pos) => exports.indexOf(e) === pos).join("\n")
  const index_file_dir = path.join(config.client.output_dir!, CLIENT_GENERATOR_DIRS.utils)

  const index_contents = [
    index_file
  ]

  await write_format_file(index_file_dir, "index.ts", index_contents, config)
}

export const create_client_function_files = async (functions: string[], data: GeneratorData, config: GeneratorConfig) => {
  if (!functions) return
  if (functions.length === 0) return
  
  const exports: string[] = []
  const imports: Map<string, ImportData> = new Map()
  let file_data: FileData

  await Promise.all(functions.map(async (f) => {
    const name: string = get_type_name(f, "const")
    if (!name) logger.error(`Error getting name from this function -> ${f}`)

    const temp_file_data = data.file_data.get(name)
    if (!temp_file_data) logger.error(`Error getting file data for function -> ${name}`)
    file_data = temp_file_data!
    
    await add_imports(temp_file_data!.imports, imports)

    exports.push(`export * from './${config.global.imports_as_esm ? temp_file_data!.file_name.replace(".ts", ".js") : temp_file_data!.file_name.replace(".ts", "")}'`)
  }))

  const imports_to_add = gen_imports(imports, !config.global.imports_as_esm)

  const file_contents = [
    imports_to_add ? imports_to_add.filter(Boolean).join("\n") : "",
    functions.join("\n")
  ]

  await write_format_file(file_data!.file_dir, file_data!.file_name, file_contents, config)

  const index_file = exports.filter((e, pos) => exports.indexOf(e) === pos).join("\n")
  const index_file_dir = path.join(config.client.output_dir!, CLIENT_GENERATOR_DIRS.functions)

  const index_contents = [
    index_file
  ]

  await write_format_file(index_file_dir, "index.ts", index_contents, config)
}

export const create_client_hooks_files = async (hooks: string[], data: GeneratorData, config: GeneratorConfig) => {
  if (!hooks) return
  if (hooks.length === 0) return
  
  const exports: string[] = []
  const imports: Map<string, ImportData> = new Map()
  let file_data: FileData

  await Promise.all(hooks.map(async (f) => {
    const name: string = get_type_name(f, "const")
    if (!name) logger.error(`Error getting name from this hook -> ${f}`)

    const temp_file_data = data.file_data.get(name)
    if (!temp_file_data) logger.error(`Error getting file data for hook -> ${name}`)
    file_data = temp_file_data!
    
    await add_imports(temp_file_data!.imports, imports)

    exports.push(`export * from './${config.global.imports_as_esm ? temp_file_data!.file_name.replace(".ts", ".js") : temp_file_data!.file_name.replace(".ts", "")}'`)
  }))

  const imports_to_add = gen_imports(imports)

  const file_contents = [
    imports_to_add ? imports_to_add.filter(Boolean).join("\n") : "",
    hooks.join("\n")
  ]

  await write_format_file(file_data!.file_dir, file_data!.file_name, file_contents, config)

  const index_file = exports.filter((e, pos) => exports.indexOf(e) === pos).join("\n")
  const index_file_dir = path.join(config.client.output_dir!, CLIENT_GENERATOR_DIRS.hooks)

  const index_contents = [
    index_file
  ]

  await write_format_file(index_file_dir, "index.ts", index_contents, config)
}

export const create_client_generator_index_file = async (exports: ClientGeneratorExport[], config: GeneratorConfig) => {
  const index_file: string[] = []
  const index_file_name = config.global.imports_as_esm ? 'index.js' : 'index'

  exports.map(e => index_file.push(`export * from './${path.join(e, index_file_name)}'`))
  
  await write_format_file(config.client.output_dir!, "index.ts", index_file, config)
}