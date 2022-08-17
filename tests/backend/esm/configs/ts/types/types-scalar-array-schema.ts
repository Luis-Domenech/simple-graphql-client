import { SGC_Config } from 'simple-graphql-client'


export const config: SGC_Config = {
  schemaPath: "graphql/schema.graphql",
  endpoint: "http://localhost:4000/graphql",
  devEndpoint: "http://localhost:4000/graphql",
  installDeps: false,
  useYarn: true,
  indentSpaces: 2,
  useSingleQuotes: true,
  disableWarnings: false,
  objectRecursionLimit: 5,
  importsAsEsm: false,
  prettierFormat: false,
  generator: {
    schema: {
      outputDir: "graphql",
      Authorization: null
    },
    types: {
      outputDir: "generated/sgc",
      enumAsType: false,
      enumAsConst: true,
      addTypenameField: true,
      enumTypeSuffix: "_Enum",
      addNull: true,
      addUndefined: true,
      scalarOverrides: [
        { Lang: { override: 'Record<Language, string>' } },
        { Langs: { override: 'Record<Language, string[]>' } },
        { MenuScalar: { override: 'Menu' } },
        { DecimalScalar: { override: 'Prisma.Decimal', import: "Prisma", from: "@prisma/client", isDefault: false } }
      ]
    }
  }
}

export default config