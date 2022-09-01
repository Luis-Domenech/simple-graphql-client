import { flatten, Logger } from "lfd-utils"
import { GeneratorName, GeneratorConfig, TypesGeneratorExport, ClientGeneratorExport, SupportedConfigExtension } from "./types.js"

export const AUTO_GENERATED_COMMENT = [
  `//// -----------------------------------------------------------------`,
  `//// THIS FILE WAS AUTOMATICALLY GENERATED (NOT RECOMMENDED TO MODIFY)`,
  `//// -----------------------------------------------------------------\n`
].join("\n")

export const OPERATION_DATA_AUTO_GENERATED_COMMENT = [
  `//// -----------------------------------------------------------------------------------`,
  `//// THIS FILE WAS AUTOMATICALLY GENERATED AND IS HEAVILY RECOMMENDED YOU DO NOT MODIFY`,
  `//// ANY CHANGE HERE WILL MOST LIKELY BREAK CLIENT FUNCTION FUNCTIONALITY`,
  `//// -----------------------------------------------------------------------------------\n`
].join("\n")

export const PACKAGE_NAME = 'lfd-graphql-client'
export const PACKAGE_FULL_NAME = 'LFD GraphQL Client'
export const TO_REMOVE_STRING = "|_|"
export const TO_REMOVE_DELIMITER = "\\|\\_\\|"
export const WHAT_TO_REMOVE = `\\"\\'`

export const logger = Logger


// Is user puts recursion num higher than this, we will warn them
export const RECURSION_WARNING_THREHSOLD = 2
export const INPUT_RECURSION_LIMIT = 1


// Default YML Config
export const DEFAULT_CONFIG: GeneratorConfig = {
  global: {
    schema_path: undefined,
    endpoint: undefined,
    install_deps: false,
    install_types: false,
    use_yarn: true,
    indent_spaces: 2,
    use_single_quotes: true,
    // disable_warnings: false,
    object_recursion_limit: RECURSION_WARNING_THREHSOLD,
    dev_endpoint: 'http://localhost:4000/graphql',
    imports_as_esm: false,
    prettier_format: true,
    // use_conventions: false,
    types_dir: undefined
  },
  schema: {
    to_run: false,
    output_dir: './src/generated/lfd/graphql',
    authorization: undefined,
    wipe_output_dir: false,
    use_endpoint: false
  },
  types: {
    output_dir: './src/generated/lfd/types',
    enum_as_const: false,
    to_run: false,
    enum_as_type: false,
    add_typename_field: true,
    enum_type_suffix: "_Enum",
    add_null: false,
    add_undefined: false,
    scalars: new Map([
      [ "Decimal", {override: 'DecimalJsLike', import: "DecimalJsLike", from: "@prisma/client/runtime", is_default: false, as: "@prisma/client"} ],
      [ "DecimalScalar", {override: 'DecimalJsLike', import: "DecimalJsLike", from: "@prisma/client/runtime", is_default: false, as: "@prisma/client"} ],
      [ "DateTime", {override: 'Date'} ],
    ]),
    wipe_output_dir: false
  },
  client: {
    output_dir: './src/generated/lfd/client',
    to_run: false,
    fetch_delay: 3000,
    loop_fetch_limit: 10, // Tries before stopping
    wipe_output_dir: false,
    dev_endpoint: undefined,
    endpoint: undefined,
    recursion_overrides: new Map(),
    gen_hooks: false
  },
}

// Regex patterns
export const REGEX = {
  match_first_word: /[^\s][\w]+/gm,
  match_words: /[\w]+/gm,
  match_word: /(\w)+/gm,
  whitespace_and_bracket: /\s+\{+/gm,
  match_whitespace: /\s+/gm,
  match_equals_whitesapce_and_bracket: /\s+\{+/gm,
  match_single_quotes: /('|\\')/gm,
  match_double_quotes: /("|\\")/gm,
  match_colon: /[:?!]+/gm,
  match_artefacts: new RegExp(`([${WHAT_TO_REMOVE}](${TO_REMOVE_DELIMITER}))+|((${TO_REMOVE_DELIMITER})[${WHAT_TO_REMOVE}])+`, 'gm'),
  match_artefact: new RegExp(`([${WHAT_TO_REMOVE}](${TO_REMOVE_DELIMITER}))+|((${TO_REMOVE_DELIMITER})[${WHAT_TO_REMOVE}])+`),
  match_to_remove_string: new RegExp(`(${TO_REMOVE_DELIMITER})+`, "gm"),
  match_word_in_single_quotes: /'(.*?)'/gm,
  match_enum_name: /(?<=(enum)[\s\w])[\w]+/gm,
  match_class_name: /(?<=(class)[\s\w])[\w]+/gm,
  match_interface_name: /(?<=(interface)[\s\w])[\w]+/gm,
  match_type_name: /(?<=(type)[\s\w])[\w]+/gm,
  match_const_name: /(?<=(const)[\s\w])[\w]+/gm,
  match_let_name: /(?<=(let)[\s\w])[\w]+/gm,
  match_var_name: /(?<=(var)[\s\w])[\w]+/gm,
  //((\/\*\*)+[\s\w*'"@():\\\/.,<>;{}\[\]|\-_+~`]+(\*\/))
  match_all_typescript_multiline_comments: /((\/\*\*)+[\s\S]+(\*\/))/, // Removed gm since we only want to remove first occurence
  match_all_inside_import_brackets: /(?<=({))[\s\S]+(?=(}))/gm,
  match_all_outside_import_brackets: /(?<=(import))[\s\S]+(?=({))/gm,
  match_from_import: /(?<=['"])[\s\S]+(?=['"])/gm,
  match_file_extension: /((.[\w]+)$)/gm,
  match_dash: /[-]/gm,
  match_file_path: /^.*[\\/]/gm,
  match_closing_brackets: /(])/gm,
  match_one_colon: /(:)/gm,
  match_comment_or_literal_char: /(\/\*)|(`)/gm,
  match_back_slash: /(\\)/gm,
  match_new_line: /[\r\n]/gm,
  match_class: (className: string) => new RegExp(`(export)+\\s+(class)+\\s+(${className})+\\s*({)`, 'gm'),
  match_exact_type: (exactTypeName: string) => new RegExp(`(?<![^\\s\\[<])${exactTypeName}(?![^\\s>)\\]])`, 'gm')
}

export const DEFAULT_CONFIG_NAME_VARIATIONS = flatten([
  'lfd-graphql-client',
  'lfd-graphql-client-config',
  'lfd-graphql-client-conf',
  'lfd',
  'lfd-config',
  'lfd-conf',
  '.lfd-graphql-client',
  '.lfd-graphql-client-config',
  '.lfd-graphql-client-conf',
  '.lfd',
  '.lfd-config',
  '.lfd-conf',
  'generator-config',
  'generator-conf',
  'lfd-generator-config',
  'lfd-generator-conf',
  '.generator-config',
  '.generator-conf',
  '.lfd-generator-config',
  '.lfd-generator-conf',
].map(conf_name => [conf_name, conf_name.replace(REGEX.match_dash, "_") !== conf_name ? conf_name.replace(REGEX.match_dash, "_") : ""].filter(Boolean)))

export const SUPPORTED_CONFIG_EXTENSIONS: Record<SupportedConfigExtension, string> = {
  '.yml': '.yml',
  '.yaml': '.yaml',
  '.js': '.js',
  '.jsx': '.jsx',
  '.json': '.json'
}

export const TYPE_FILES_TO_READ = ['.js', '.jsx', '.ts', '.tsx']

export const SUPPORTED_CONFIG_EXTENSION_VARIATIONS: string[] = flatten(Object.keys(SUPPORTED_CONFIG_EXTENSIONS).map(ext => [ext, ext.toUpperCase()]))

export const DEFAULT_CONFIG_PATHS: string[] = flatten(DEFAULT_CONFIG_NAME_VARIATIONS.map(conf_name => SUPPORTED_CONFIG_EXTENSION_VARIATIONS.map(ext => `${conf_name}${ext}`)))


export const DEFAULT_ENV_NAMES: string[] = [
  '.env',
  '.env.local',
  '.env.dev',
  '.env.development',
  '.env.prod',
  '.env.production',
  '.env.test',
  '.env.staging',
  'env',
  'env.local',
  'env.dev',
  'env.development',
  'env.prod',
  'env.production',
  'env.test',
  'env.staging',
  'local.env',
  'dev.env',
  'development.env',
  'prod.env',
  'production.env',
  'test.env',
  'staging.env',
  'settings',
  'settings.local.env',
  'settings.dev.env',
  'settings.development.env',
  'settings.prod.env',
  'settings.production.env',
  'settings.test.env',
  'settings.staging.env',
]


export const DEFAULT_ENV_SUBS = [
  {name: 'NODE_ENV', value: process.env.NODE_ENV === "production" ? process.env.NODE_ENV : "development"},
  {name: 'process.env.NODE_ENV', value: process.env.NODE_ENV === "production" ? process.env.NODE_ENV : "development"},
]

export const GENERATORS: Record<GeneratorName, GeneratorName> = {
  schema: "schema",
  types: "types",
  client: "client"
} 

export const GRAPHQL_ROOT_OPERATIONS = ["Query", "Mutation", "Subscription"]

export const RESPONSE_ENDINGS = ["Response", "Result", "Output", "Responses", "Results", "Outputs", "Return", "Returns"]


export const TYPES_GENERATOR_DIRS: Record<TypesGeneratorExport, string> = {
  enums: "./enums",
  inputs: "./inputs",
  interfaces: "./interfaces",
  objects: "./objects",
  operations: "./operations",
  outputs: "./outputs",
  scalars: "./scalars",
  unions: "./unions"
}

export const CLIENT_GENERATOR_DIRS: Record<ClientGeneratorExport, string> = {
  types: "./types",
  constants: "./constants",
  data: "./data",
  functions: "./functions",
  hooks: "./hooks",
  utils: "./utils"
}

export const DEV_PACKAGES = []

export const PRIMITIVES = [
  "String",
  "ID",
  "Int",
  "Float",
  "DecimalScalar",
  "GraphQLBigInt",
  "GraphQLJSONObject",
  "GraphQLByte",
  "Date",
  "DateTime",
  "Boolean",
  "JSON",
  "Json",
  'BigInt',
  'BigIntScalar',
]

export const CONFIG_NAMES_TO_IGNORE = ["scalars", 'recursion_overrides']
