import { SchemaData } from "simple-wasm-graphql-parser"

export type GeneratorName = "schema" | "types" | "client"

export interface GeneratorArgs {
  config: string
  env: string,
  warnings: boolean
}

export type TypesGeneratorExport = "enums" | "inputs" | "interfaces" | "objects" | "operations" | "outputs" | "scalars" | "unions"
export type ClientGeneratorExport = "types" | "constants" | "data" | "functions" | "hooks" | "utils"
export type SupportedConfigExtension = ".yml" | ".yaml" | ".js" | ".jsx" | ".json"

export interface GlobalConfig {
  schema_path: string | undefined
  endpoint: string | undefined
  dev_endpoint: string | undefined
  install_deps: boolean
  install_types: boolean
  use_yarn: boolean
  indent_spaces: number
  use_single_quotes: boolean
  // disable_warnings: boolean
  object_recursion_limit: number,
  imports_as_esm: boolean
  prettier_format: boolean
  types_dir: string | undefined
  // use_conventions: boolean
}

export interface ScalarOverrideData {
  override: string 
  import?: string
  from?: string
  is_default?: boolean
}

export interface TypesGenConfig {
  to_run: boolean
  enum_as_type: boolean
  enum_as_const: boolean
  add_typename_field: boolean
  enum_type_suffix: string
  add_null: boolean
  add_undefined: boolean
  scalars: Map<string, ScalarOverrideData> | undefined
  output_dir: string
  wipe_output_dir: boolean
}

export interface ClientGenConfig {
  endpoint: string | undefined
  dev_endpoint: string | undefined
  to_run: boolean
  fetch_delay: number
  loop_fetch_limit: number
  output_dir: string
  wipe_output_dir: boolean
  recursion_overrides: Map<string, number> | undefined
  gen_hooks: boolean
}

export interface SchemaGenConfig {
  to_run: boolean
  output_dir: string
  use_endpoint: boolean
  authorization: string | undefined
  wipe_output_dir: boolean
}

export interface GeneratorConfig {
  schema: SchemaGenConfig
  types: TypesGenConfig
  client: ClientGenConfig
  global: GlobalConfig
}

export interface ImportData {
  imports: {
    name: string
    is_default: boolean
  }[]
  from: string
  is_relative: boolean
  as?: string
  is_dev: boolean
}

export interface DependencyData {
  dependency: string
  is_dev: boolean
  version?: string | null
}

export interface FileData {
  file_name: string,
  file_dir: string,
  file_path: string
  same_dir_import_path: string
  from_import_path: string
  imports: Map<string, ImportData>
  generator: GeneratorName
  overriden?: boolean
}

export interface GeneratorData {
  schema_data: SchemaData
  dependencies: Map<string, ImportData>
  file_data: Map<string, FileData>
}