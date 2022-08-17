# simple-graphql-client

## IMPORTANT
This is a pre alpha and there are many things that don't work and many things that will be added and many things that will change. How everything works will most likely change in the future, especially when I create start developing the react hooks. Until I finish this readme, this package will probably not work and is not recommended for any use. 

## Description
This is a package I created for personal use on my projects. It can create a `schema.graphql` file by querying a graphql endpoint with a general introspection query. Even more importantly, this package can also create auto generated typescript types and enums from scanning a given schema.graphql file. Furthermore, the package can also creates some functions (the client part) for querying your graphql server. The highlight of this package are those functions. There are many things that have not been dealt with, especially on the typescript auto complete, but this release barely works with my current usage needs.

This package is essentially a custom and very basic implementation of [@graphql-codegen/cli](https://github.com/dotansimha/graphql-code-generator). This package could have easily been a codegen plugin, but I much prefer the option of making my own package, especially since I have much more control on dependencies and bundle size.

## Installation
Not recommended yet, but you can install this package with:

```yarn add --dev simple-graphql-client```

or

```npm i -D simple-graphql-client```
 
## Usage 
There are many intricacies on how to use the package, and I don't have the time yet to explain those and make a usage section.

## Config
For the config file, you can basically choose from the following default names and extendsions (all in lowercase):

Default Names:
- `simple-graphql-client`
- `simple-graphql-client-config`
- `simple-graphql-client-conf'`
- `sgc`
- `sgc-config`
- `sgc-conf`
- `.simple-graphql-client`
- `.simple-graphql-client-config`
- `.simple-graphql-client-conf'`
- `.sgc`
- `.sgc-config`
- `.sgc-conf`
- `generator-config`
- `generator-conf`
- `sgc-generator-config`
- `sgc-generator-conf`
- `.generator-config`
- `.generator-conf`
- `.sgc-generator-config`
- `.sgc-generator-conf`

Extensions: 
- `.yml`
- `.yaml`
- `.js`
- `.ts`
- `.jsx`
- `.tsx`
- `.json`

You can choose any combination from that. For yml and json files, you can use environment variables by using `dollar-basic` or `dollar-curly` syntax, `$MYVAR` and `${MYVAR}` respectively. Note that somethine like `${process.env.NODE_ENV}` does not work. You can't use dots for variables. Something like `${NODE_ENV}` would work if `NODE_ENV` was set in the environment where the program was ran. The program tries to read environment variables but you can aslo provide an env file to the program so it can load environment variables from there.

Now, in terms of configuration, there is a lot to cover. For now, you can use this as a reference:

```typescript
export type ScalarOverrideData = {
  override: string
  import?: string 
  from?: string
  isDefault?: boolean
}

export type SchemaGeneratorConfig = {
  outputDir?: string | undefined | null
  Authorization?: string | undefined | null
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
  importsAsEsm?: boolean | undefined | null
  prettierFormat?: boolean | undefined | null
  useConventions?: boolean | undefined | null
}

export type SGC_Config = GlobalGeneratorConfig & ({
  generator?: GeneratorConfigs
})
```

All of those are exported from the npm package itself and can be used in JS and TS configs. You can import those types there and export the config. More details will be provided eventually on how to do that in the future.


## Conventions
<!-- Due to how varied graphql schemas can be, I have opted on using some self imposed rules whe creating my graphql schemas. This allows me to automate various things. Anyhow, the following are conventions that I follow when building graphql schemas and are expected for this code generator to work:

1. All models, like prisma models, must have a createModelName resolver. This helps the generator determine which types from a graphql schema are models and which are just input and output types. This also allows the codegen to segment types into various files, inluding one for all models. However, this feature is not yet available.
2. All resolvers names are camelCase
3. All resolver inputs and responses are PascalCase
4. All inputs are named on their resolver names converted to pascal case and appending `Input` at the end. For example, if we have `resolverName` as a resolver's name, the input's name must be `ResolverNameInput`
5. All responses must be in PascalCase and must end with `Response`.
6. Resolvers that don't have any input, don't require to have an input. You can just omit putting any input as a resolver's input in that case.
7. All resolvers that have an input must have that input be named `data` and their type be `ResolverNameInput` 
8. All resolver responses must extend some general response object which returns a success field that is a boolean and a errors field that is an array of type `{messsage: string}`. This is useful for setting up the type safe fetch utility functions since we can then inside those function determine if the server returned an error and if true, then show those errors

The conventions are not that strict and by following them, we can use the magic of generic types to create our util functions and make some stuff easy for the codegen. Better conventions could exist out there, but I haven't done any research on that yet, so for now, these are the conventions I follow and expect for the codegen. Recommendations on conventions are greatly appreciated.

Regarding conventions some of the convetions assuming you are using a setup with type-graphql and prisma, an example of how to setup a resolver would be:
```typescript
import { ObjectType, InputType, Field, ID } from "type-graphql"

@InputType()
export class GetAccountInput {
  @Field(() => ID, { nullable: false })
  id!: string
}

@ObjectType()
export class RegularError {
  @Field()
  message: string
}

@ObjectType()
export class GeneralResponse {
  @Field(() => Boolean, { nullable: false })
  success!: boolean

  @Field(() => [RegularError], { nullable: true })
  errors?: RegularError[]
}

@ObjectType()
export class AccountResponse extends GeneralResponse {
  @Field(() => Account, { nullable: true })
  account?: Account
}

@Query(() => AccountResponse)
async getAccount(
@Arg('data') data: GetAccountInput,
@Ctx() { prisma }: MyContext): Promise<AccountResponse> {
  const account = prisma.account.findFirst({where: id: data.id})
  if (!account) return { success: false, errors:[ { message: "Error getting account" } ] }
  else return {success: true, account}
}

@Query(() => GeneralResponse)
async test(
@Ctx() {}: MyContext): Promise<GeneralResponse> {
  return {success: true}
}
```

Note that inputs, responses, model objects and resolvers are usually seperated and not on the same file. The above example is just that, an example. Anyways, based on the example above, our basic codegen can:
- Determine that Account is a model
- Generate types for RegularError, GeneralResponse, AccountResponse, GetAccountInput, AccountResponse, Account, getAccount and test
- Generate empty instantiated objects for RegularError, GeneralResponse, AccountResponse, GetAccountInput, AccountResponse and Account
- Generate type safe utility functions that can fetch the graphql server and provides auto completion for resolver names (getAccount and test), required inputs based on the resolver passed to function, and an options to select one result from all possible results based on the response type of the resolver pased as parameter. Essentially, you can jut do `graphql_fetch("")` and try auto complete on the first parameter and a list of all operations will be displayed -->

## Notes
TODO

## To Do
- Finish this readme
- Make the typescript auto compete suggestion be better as there are some edge cases where auto complete does not work.
- Much other stuff to complicated to explain before updating readme