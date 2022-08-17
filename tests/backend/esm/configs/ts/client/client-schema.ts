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
    client: {
      outputDir: "generated/sgc",
      fetchDelay: 3000,
      loopFetchLimit: 5
    },
    schema: {
      outputDir: "graphql",
      Authorization: null
    }
  }
}


export default config