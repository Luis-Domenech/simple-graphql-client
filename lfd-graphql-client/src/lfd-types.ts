export type ScalarOverrideData = {
  override: string
  import?: string 
  from?: string
  isDefault?: boolean
}

export type SchemaGeneratorConfig = {
  outputDir?: string | undefined | null
  Authorization?: string | undefined | null
  useEndpoint?: boolean | undefined | null
  wipeOutputDir?: boolean | undefined | null
}

export type TypesGeneratorConfig = {
  enumAsType?: boolean | undefined | null
  enumAsConst?: boolean | undefined | null
  addTypenameField?: boolean | undefined | null
  enumTypeSuffix?: string | undefined | null
  addNull?: boolean | undefined | null
  addUndefined?: boolean | undefined | null
  scalars?: Record<string, ScalarOverrideData>[] | Record<string, ScalarOverrideData> | undefined | null
  outputDir?: string | undefined | null
  wipeOutputDir?: boolean | undefined | null
}

export type ClientGeneratorConfig = {
  fetchDelay?: number | undefined | null
  loopFetchLimit?: number | undefined | null
  outputDir?: string | undefined | null
  wipeOutputDir?: boolean | undefined | null
  recursionOverrides?: Record<string, number>[] | Record<string, number> | undefined | null
  genHooks?: boolean | undefined | null
}

export type GeneratorConfigs = {
  schema?: SchemaGeneratorConfig | undefined | null
  types?: TypesGeneratorConfig | undefined | null
  client?: ClientGeneratorConfig | undefined | null
}

export type GlobalGeneratorConfig = {
  schemaPath?: string | undefined | null
  endpoint?: string | undefined | null
  installDeps?: boolean | undefined | null
  useYarn?: boolean | undefined | null
  indentSpaces?: number | undefined | null
  useSingleQuotes?: boolean | undefined | null
  disableWarnings: boolean | undefined | null
  objectRecursionLimit?: number | undefined | null
  devEndpoint?: string | undefined | null
  importsAsESM?: boolean | undefined | null
  prettierFormat?: boolean | undefined | null
  typesDir?: string | undefined | null
  // useConventions?: boolean | undefined | null
}

export type LFDGeneratorConfig = GlobalGeneratorConfig & ({
  generator?: GeneratorConfigs
})