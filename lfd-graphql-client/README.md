# LFD GraphQL Client

## Description
This is a package I created for personal use on my projects. It can create a `schema.graphql` file by querying a graphql endpoint with a general introspection query. Furthermore, this package can also create auto generated typescript types and enums from scanning a schema from a given graphql file. Most importantly, this package can also create some functions (the client part) for querying your graphql server. The highlight of this package are those functions which are fully typed and provides everything you need to query your server.

This package is essentially a custom and very basic implementation of [@graphql-codegen/cli](https://github.com/dotansimha/graphql-code-generator). This package could have easily been a codegen plugin, but I much prefer the option of making my own package, especially since I have more control on dependencies and bundle size.

## Installation
You can install this package with:

```yarn add --dev lfd-graphql-client```

or

```npm i -D lfd-graphql-client```

or

```pnpm add -D lfd-graphql-client```
 
## Quick Start
1. Install `lfd-graphql-client`
2. Create a file named `lfd-config.yml` with the following content:
```yml
endpoint: http://localhost:4000/graphql
devEndpoint: http://localhost:4000/graphql
installDeps: true
installTypes: true
indentSpaces: 2

generator:
  - schema:
      outputDir: generated/graphql
  - types:
      outputDir: generated/lfd/types
      addTypenameField: true
  - client:
      outputDir: generated/lfd/client
```
3. Add the following script to your script section in your `package.json` file:
```json
"gen": "lfd -c lfd-config.yml"
```
4. Now, in the root of your project, run the following:
```bash
yarn gen
```
5. Now you have a graphql schema file from your server, a folder with all info from that schema converted to typescript types and an easy way to query operations from your server with various functions that are type safe and have auto complete functionality. To use it, just import the function:
```typescript
import { operation_fetch } from './where/ever/client/was/generated'

// Assuming the return value is something like:
/*
type Response = {
  success: boolean
  errors?: {message: string}[]
  user?: User | null | undefined
}
*/
const res = await operation_fetch("login", {input: {email: 'email@test.com', pass: 'pass'}}, {success: true, user: {id: true}}, {production: false})

if (res.fetch_errors) {
  for (const err of res.fetch_errors) console.log(err)
}
if (res.output.errors) {
  for (const err of res.output.errors) console.log(err)
}
else if (res.output.success !== true || !res.output.user) {
  console.log('Error: Invalid Credentials')
}
else {
  console.log(`User ID: ${res.output.user.id}`)
}
```


## Description
This package has 3 main parts, each corresponding to a Generator:
- Schema
- Types
- Client


### Schema
The Schema Generator takes as input (through the config) an endpoint to a graphql server and then queries it. From the data it receives, it then creates a `schema.graphql` in the default location or a location you provided through the config.

There's not much to say on this one since all it does is generate a schema file.

### Types

The types generator does a couple of this. The first thing it does is run the Schame Generator if no `schemaPath` was provided. After we have a schema file to read, the Types Generator then runs [simple-wasm-graphql-parser](https://github.com/Luis-Domenech/simple-wasm-graphql-parser), a web assembly parser written in Rust that parser a schema file and returns ALL data from a schema file in a data structure that is easy to understand and use for other thing, ie, the Types Generator. 

After running the parser, we have all the data from the schema file and thus can now start generating thes types files. Here, we seperate seperate all types into the following folder/categories:
- enums
- inputs
- interfaces
- objects
- operations
- outputs
- scalars
- unions

Those folders contain their respective types. Outputs is the only folder that is not obvious. Basically, any type that ends (case sensitive) with the following:
- Response
- Result
- Output
- Return
- Responses
- Results
- Outputs
- Returns

If all of those types are palces in objects, nothing would change, but for some stuff I do in my own project, I need to seperate types that are outputs from types that are not. From your POV, this shouldn't affect anything as you can still import those types from the main index file in the root of the client output directory.

By default, `__typename` is added to all types. If you don't know what this field is, you can read more [here](https://graphql.org/learn/queries/#meta-fields), but basically, all graphql servers can return a `__typename` field for all objects. This is usefuly for union resolution. However, for our case, this field is EXTREMELY important for being able to differentiate from various object type returns for a union type field in a return object. An example, will better explain the issue:
```typescript
// Imagine you have an operation with the following return type
type Tweet = {
  __typename: Tweet,
  id: string,
  body: string
}
type VanishTweet = {
  __typename: VanishTweet,
  id: number, // This is on purpose for the example
  body: string,
  expires: Date
}
type UserTopTweetResponse = {
  errors?: {message: string}[]
  tweet?: Tweet | VanishTweet
}

import { operation_fetch } from './where/ever/client/was/generated'

const res = await operation_fetch("getUserTopTweet", {user_id: "1234"}, {
  errors: true,
  tweet: {
    union_select: "VanishTweet", // Here we would have auto complete suggest "Tweet" or "VanishTweet"
  }
})

// If we do the following, auto complete will only show fields from VanishTweet, id, __typename, expires, body
res.output.tweet.

// And thus doing the following would work and hovering over that will show that id is a number type and expires is a Date type 
res.output.tweet.id
res.output.tweet.expires

// This is pretty usefuly and even better, the logic inside the functions constructs queries where we only fetch data from the union we selected, so no unecessary field querying is done

// HOWEVER, none of this works if `addTypenameField` is false and thus __typename is never palced on Tweet and VanishTweet. Without that, then we have no way of differentiating types from a union in Typescript land. Without `__typenane`, the following lines say that id is of type string | number and expires is of type Date, which is correct since no other union member has an expires field.
res.output.tweet.id
res.output.tweet.expires
```

Basically, the above is why it is not recommended to turn off the `addTypenameField` option since it removes important functionality for union differentiation.


One important thing to mention is that you may already have some types implemented in typescript from the schema of your server. In that case, it is unecessary for code duplication and your implementation probably has extra stuff that my generator does not generate, so what you can do is set the `typesDir` global option. If this is set, then ALL TS, TSX, JS and JSX files will be read and if a type is found in the typesDir, than that type will not be generated in the types output directory. Furthermore, if a type imports another type that was not generated, than the import that is used is the one from the directory set in `typesDir`.

More eccentricities from the options for this Generator is in the Options section of the Config section.

After the types are generated, you can use them in your project without problem.

### Client

This is the last part of the package, the Client Generator. Here enters the oh so important `objectRecursionLimit` option. Before that, let me explain the functionality of the functions that are generated by the Generator.

The Client Generator, by default, exports four functions:
- `custom_fetch`
- `operation_fetch`
- `loop_fetch`
- `bounded_loop_fetch`

The last three functions all have the following parameters:
- operation_fetch(operation, input, selection_set, options)
- operation: This is a string and it is a union of the name of ALL operations from your server. The operation you select will affect the types of the next parameters in the function.
- input: If the operation you chose as the first parameter has is an operation that expects input, then input is exactly that. The function will throw an error if you provide an input that does not match the operation's input type. Furthermore, TS auto complete can be used to know what exactly you have to provide. If the operation you chose has no inputs, than you can pass `null` or `{}` as the input.
- selection_set: This is exactly what it sound like, but a bit more. After choosing an operation and setting an input, then the next parameter is this one and basically, you can select what fields you want from the return type associated with the operation you chose. An example better explains the nuances of the selection_set object:
```typescript
// If you have the following response type to an operation called login and `objectRecursionLimit` is set to 2
type User = {
  id: string
  name: string
  best_friend: User
}
type Response = {
  success: boolean
  errors?: {message: string}[]
  user?: User
}
import { operation_fetch } from './where/ever/client/was/generated'

// All of the following examples have their expected output based on their selection_set
// Do note that all of those expected values are also reflected by TS inference system
const res1 = await operation_fetch("login", {email: 'a@a.com', pass: 'pass'}, false) // => res.output is null
const res2 = await operation_fetch("login", {email: 'a@a.com', pass: 'pass'}, {}) // => res.output is null

const res3 = await operation_fetch("login", {email: 'a@a.com', pass: 'pass'}, true) 
// On this one, setting to true, means you want to query ALL fields, which an example output would be
console.log(res3.output)
/* Output:
{
  success: true,
  user: {
    id: 1,
    name: "Cool Name",
    best_friend: {
      id: 3,
      name: "Other Name",
      best_friend: {
        id: 1,
        name: "Cool Name",
        best_friend: {
          id: 3,
          name: "Other Name"
        }
      }
    }
  }
}


*/
// Notice we dont continue recursive chain of best_friend since `objectRecursionLimit` is set to 2. TS inference also reflects this. 
// Note that the equivalent of using true is tu set all fields to true
const res4 = await operation_fetch("login", {email: 'a@a.com', pass: 'pass'}, {
  errors: {
    message: true
  }
  success: true,
  user: {
    id: true,
    name: true,
    best_friend: {
      id: true,
      name: true,
      best_friend: {
        id: true,
        name: true,
        best_friend: {
          id: true,
          name: true // In here, TS will only allow you to select id and name since this is the recursion limit
        }
      }
    }
  }})
  // The output of res4.output is the same as res3.output


const res5 = await operation_fetch("login", {email: 'a@a.com', pass: 'pass'}, {users: true}) 
// Setting true on a field that is an object means choosing all of its field
console.log(res5.output)
/* Output:
{
  user: {
    id: 1,
    name: "Cool Name",
    best_friend: {
      id: 3,
      name: "Other Name",
      best_friend: {
        id: 1,
        name: "Cool Name",
        best_friend: {
          id: 3,
          name: "Other Name" 
        }
      }
    }
  }
}
*/
```
Having seen this example, hopefully you have a better idea of how selection_set works. Note that for EVERY object field in a selection_set, you can query a `__typename` field. It wasn't shown above since it is just an example.
- options: This last parameter is just an options object used to configure every fetch function. The options are the following types:
```typescript
type BaseFetchOptions = {
  endpoint?: string | null | undefined
  dev_endpoint?: string | null | undefined
  production?: boolean | null | undefined
  Authorization?: string | null | undefined
  log?: boolean | null | undefined
  use_conventions?: boolean | null | undefined
}
export type CustomFetchOptions<Operation extends GraphQLOperation | void = void> = BaseFetchOptions
export type OperationFetchOptions<Operation extends GraphQLOperation | void = void> = BaseFetchOptions
export type LoopFetchOptions<Operation extends GraphQLOperation | void = void> = { delay?: number | null | undefined } & OperationFetchOptions<Operation>
export type BoundedLoopFetchOptions<Operation extends GraphQLOperation | void = void> = { limit?: number | null | undefined } & LoopFetchOptions<Operation>
```

These options are:

**BaseFetchOptions**:

- `Authorization`:
  - Type: `string | null | undefined`,
  - Default: `undefined`,
  - Info: If the server you are trying to query need an auth token, then here you can set that token.

- `dev_endpoint`:
  - Type: `string | null | undefined`,
  - Default: `undefined`,
  - Info: If `production` options is set to false, then `dev_endpoint` is used for querying server.

- `endpoint`:
  - Type: `string | null | undefined`,
  - Default: `undefined`,
  - Info: If `production` options is set to true, then the `endpoint` will be used to query the server.

- `log`:
  - Type: `boolean | null | undefined`,
  - Default: `false`,
  - Info: All of the functions console log when they start and if they suceeded or not. However, if an error occurs, that error is suppressed unless `log` is set to true.

- `production`:
  - Type: `boolean | null | undefined`,
  - Default: `true`,
  - Info: This determine whether to use `endpoint` or `dev_endpoint`

**LoopFetchOptions**:

- `delay`
  - Type: `number | null | undefined`
  - Default: `3000`
  - Info: Amount of milliseconds to wait before attempting a new fetch if a fetch failed in `loop_fetch` and `bounded_loop_fetch`.

**BoundedLoopFetchOptions**:

- `limit`
  - Type: `number | null | undefined`
  - Default: `10`
  - Info: Amount of times `bounded_loop_fetch` will retry a fetch before stopping.


Now that you know about the functions that are generated, we can see how `objectRecursionLimit` affects these functions. As you have seen, seletion_sets and return types can be infinitely recursive. To stop that, I have added the notion of object recursion limit. If we have the following

```typescript
type User = {
  id: string
  name: string
  best_friend: User
}
type Response = {
  success: boolean
  array_of_array_of_users?: User[][]
  user?: User
}

// Imagine we got a response and this is how it turned out
/*
{
  success: true, // recursion 0
  users: [
    [
      {
        id: 1, // recursion 1
        name: "Cool Name", //recursion 1
        best_friend: {
          id: 3, // recursion 2
          name: "Other Name" // recursion 2
        } 
      },
    ]
  ]
  user: {
    id: 1, // recursion 1
    name: "Cool Name", //recursion 1
    best_friend: {
      id: 3, // recursion 2
      name: "Other Name" // recursion 2
    } 
  },
}
*/
// A selection_set that could've have created this object would look like this:
const selection_set = {
  success: true, // recursion 0
  users: {
    id: true, // recursion 1
    name: true, //recursion 1
    best_friend: {
      id: true, // recursion 2
      name: true // recursion 2
    } 
  }
  user: {
    id: true, // recursion 1
    name: true, //recursion 1
    best_friend: {
      id: true, // recursion 2
      name: true // recursion 2
    } 
  }
}

```


and have an `objectRecursionLimit` of 2, then we know start counting, for example, from user field onwards. In the example, even though we have the fields of user and users and one is an array of an array and the other isn't, we still get the same level of recursion for both object of the User type. Basically, arrays don't count towards recursion and the response from all functions and selections sets are all bounded by the `objectRecursionLimit`.

The `objectRecursionLimit` option does much more too like input cleaning. Take this example:
```typescript
// Imagine this is the input for the login operation
type LoginInput = {
  email: string
  pass: string
}

const my_input = {
  email: 'a@a.com',
  pass: 'pass',
  random_field: 'random_value'
}

// If you try to run the login operation with my_input passed as the input for the login operation, than GraphQL will throw an error since you must pass only expected variables to the server. Lets assume you passed my_input to our function and TS does not warn that `random_field` is not a valid input parameter
const res = operation_fetch('login', my_input)

// In this case, everything works even though you passed an invalid variable. That is because all the fetch functions that require an operation as input have access to the `GRAPHQL_OPERATION_DATA` constant that is generated in the `client/data/data.js`. More on that below.

```

The `GRAPHQL_OPERATION_DATA` is a contant that gets generated during the Client Generator. It is basically a constant that holds the following information for EVERY operation:
- operation_name: Just the name of the operation, for example, 'login'
- type: The type of the operation:
  - Query
  - Mutation
  - Subscription
- input_types: Just the `__typename` field for every field in the input object... UP TO 1 level of recursion. This is because we don't need that extra data. If no input is expected for the operation, than null is set.
- output_types: Same as `input_types`, but up to the recursion limit set by `objectRecursionLimit`
- input_selection_sets: A complete selection set of the input object up to one level of recursion. If no input is expected for the operation, than null is set.
- output_selection_sets: Same as `input_selection_sets`, but up to the recursion limit set by `objectRecursionLimit`


Both `operation_name` and `type` are used in all functions that have an operation parameter. These are used to auto build the query that is sent to the server.

The `intput_types` is used for validating if an input's data is correct (up to one level of recursion) and the `output_types` is used to validate if a selection_set that was provided is correct and for differentiating fields between unions.

Finally, the selections sets are used to know what are ALL the possible field names of an operation's input and output. The  `input_selection_sets` are used to know what are the expected fields for an input type and remove any fields from the input that are not part of the fields found in the `input_selection_sets`. On the other hand, the `output_selection_sets` main function is to know what are all the fields in a response object. Since we can set a selection_set to true with the intention that we want all fields from the return object, then we need a way to know what are ALL the fields. My solution to that is to store all of those in the `output_selection_sets`.


The Client Generator can be ran with `recursionOverrides`. A global `objectRecursionLimit` works quite well, but you might want to have custom recursion limit for some types. Well, you can do that. Look at this example:
```typescript
// In this example, imagine you have the following in your config
/*
...config
objectRecursionLimit: 3
generator: 
 - UserA: 2
*/

type UserA = {
  id: string,
  best_friend: UserA
}

type UserB = {
  id: string,
  best_friend: UserB
}

let x: UserB

// With the previously established, any operation that returns UserA is bounded by a recursion limit of 2 while any operation returning UserB is bounded bu the global limit of 3
// This means the following

const res = await operation_fetch("operationThatReturnsUserA", {user_a_account: true})
// Valid
console.log(res.output.user_a_account.best_friend.best_friend.id) // At recursion limit, we only have primitives, hence why we can call id
// Invalid since we passed recursion override of 2 for type UserA
console.log(res.output.user_a_account.best_friend.best_friend.best_friend.id)

const res = await operation_fetch("operationThatReturnsUserB", {user_b_account: true})
console.log(res.output.user_a_account.best_friend.best_friend.best_friend.id)
```

Basically, we overrode the limit of UserA. This is reflected in all responses that return a UserA and all selections sets that have a UserA field are also affected. With the `recursionOverrides`, you have control on recursion limits of every type.


Besides the functions that have an operation parameter, we also have the `custom_fetch` function. This function has none of the bells and whistles of the other function since the idea of this function is to make custom queries yourself.

`custom_fetch`:
- Parameter 1 -> operation_request: This parameter is an object defined as an object with three fields. First, the `operationName` which is the name of the operation you are executing. Next we have the `query` which is the actual graphql query you are sending to the server. Lastly is the variables, if any, that are needed for the operation. The TS type fo the object is:
```typescript
type SimpleGraphQLOperationRequest = {
  operationName: string
  query: string
  variables?: Record<string, any> | null | undefined
}
```
- Parameter 2 -> selection_set: This selection set has no type assurance. Unlike the selection_set of other functions, in this one, you can't provide union_select
- Parameter 3 -> options: These are just the options for the function. These are the same as the options of operation_fetch


Last but not least, if `genHooks` is set to true, the generator will generate 2 React hooks for you to use:
- `useOperation`: A React hook created using [react-query](https://github.com/tanstack/query). It uses the useMutation hook and returns what useMutation returns, but scoped to our operation_fetch return statements. This hook has the same parameters as operation_fetch, with the exceptions of `options` which now has the same fields as the `options` in `operation_fetch`, but it also has all the options that you can use in useMutation, so you can pass options to useMutation within the options parameter.
- `useOperationSWR`: A React hook created using [swr](https://github.com/vercel/swr). It uses the useSWR hook and returns what and SWRResponse that is scoped to our operation_fetch return statements. This hook has the same parameters as operation_fetch, with the exceptions of `options` which now has the same fields as the `options` in `operation_fetch`, but it also has all the options that you can use in useSWR, so you can pass options to useMutation within the options parameter.


## Config

### Naming Conventions
For the config file, you can basically choose from any combination of the following default names and extensions (all in lowercase):

Default Names:
- `lfd-graphql-client`
- `lfd-graphql-client-config`
- `lfd-graphql-client-conf'`
- `lfd`
- `lfd-config`
- `lfd-conf`
- `.lfd-graphql-client`
- `.lfd-graphql-client-config`
- `.lfd-graphql-client-conf'`
- `.lfd`
- `.lfd-config`
- `.lfd-conf`
- `generator-config`
- `generator-conf`
- `lfd-generator-config`
- `lfd-generator-conf`
- `.generator-config`
- `.generator-conf`
- `.lfd-generator-config`
- `.lfd-generator-conf`

Extensions: 
- `.yml`
- `.yaml`
- `.js`
- `.jsx`
- `.json`

If using these, than you can omit passing a config file path to the `lfd` program since the program will find attempt to find these whereever the lfd program is ran. If you want to provide a config file with a custom name, than just provide that to the `-c` option in the `lfd` program.

### Notes
All of these notes are important when creating a config file. However, the config parser in the `lfd` program will warn of any logical errors and will throw an error when something was set incorrectly in the config file, so the following notes can be ignored and picking an example config and modifying it is enough to get started.

Some notes regarding config options is that ALL options can be written in camel case and in snake case. For example, you can provide `importsAsESM` as an option, but you can also provide `imports_as_esm` as an option and the program will count it as `importsAsESM`. Due to how I made this work, providing `importsAsEsm` also is valid.

For yml and json config files, you can use environment variables by using `dollar-basic` or `dollar-curly` syntax, `$MYVAR` and `${MYVAR}` respectively. Note that somethine like `${process.env.NODE_ENV}` does not work. You can't use dots for variables. Something like `${NODE_ENV}` would work if `NODE_ENV` was set in the environment where the program was ran. The program tries to read environment variables but you can aslo provide an env file to the program so it can load environment variables from there too. 

Regarding yml config files, there are many ways a yml file can be written. The `lfd` program has the following constraints for yml config file:
- If the yml config file has no articles (so it's a regular yml file), then all root variables are `GlobalGeneratorConfig`, which is described below in the Config Types section. In this case, the `generator` option can be:
  - An array of objects where each object is an object where its key is a generator name and its value is the corresponding options for that generator.
  - An object each key is a generator name and each value is the corresponding options for that generator.
- If the file has ONE article, then the `lfd` program treat the config as above.
- If the file has more tha one article, then options from `GlobalGeneratorConfig` can be split between all articles. However, ALL articles must have the `generator` option provided and regardles of whether the option was proided an array or an object, the array or object must contains ONE key value pair of generator name to generator option. Each article must contain a unique generator name and generator option pair.

For js config files, you can export an object or a function or async function that returns an object. 

### Config Types
The package exports the following types, which you can use to construct your own config object in a Javascript config file.

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
```

### Examples
Here are a couple of examples on how to set up the config file. Anything set to null or undefined is the same as not passing the option at all.

Javascript Async Function Config
```javascript
module.exports = async () => {
  /** 
   * @type { import('lfd-graphql-client').LFDGeneratorConfig }
   */
  const config = {
    schemaPath: undefined,
    endpoint: 'http://localhost:4000/graphql',
    devEndpoint: 'http://localhost:4000/graphql',
    installDeps: true
    installTypes: true,
    useYarn: false,
    indentSpaces: 2,
    useSingleQuotes: true,
    objectRecursionLimit: 2,
    importsAsESM: false,
    prettierFormat: false,
    typesDir: undefined,
    generator: {
      schema: {
        outputDir: 'graphql',
        useEndpoint: false,
        wipeOutputDir: true,
        Authorization: undefined,
      },
      types: {
        outputDir: 'generated/lfd/types'
        wipeOutputDir: true,
        enumAsConst: true,
        addTypenameField: true,
        addNull: true,
        addUndefined: true,
        enumAsType: undefined,
        enumTypeSuffix: undefined,
        scalars: undefined
      }
      client: {
        outputDir: 'generated/lfd/client',
        wipeOutputDir: true,
        fetchDelay: undefined,
        loopFetchLimit: undefined,
        recursionOverrides: undefined,
        genHooks: undefined
      },
    }
  }

  return config
}
```

Javascript Config
```javascript
/** 
 * @type { import('lfd-graphql-client').LFDGeneratorConfig }
 */
module.exports = {
  chemaPath: undefined,
  endpoint: 'http://localhost:4000/graphql',
  devEndpoint: 'http://localhost:4000/graphql',
  installDeps: true,
  installTypes: true,
  useYarn: false,
  indentSpaces: 2,
  useSingleQuotes: true,
  objectRecursionLimit: 2,
  importsAsESM: false,
  prettierFormat: false,
  typesDir: undefined,
  generator: {
    schema: {
      outputDir: 'graphql',
      useEndpoint: false,
      wipeOutputDir: true,
      Authorization: undefined,
    },
    types: {
      outputDir: 'generated/lfd/types'
      wipeOutputDir: true,
      enumAsConst: true,
      addTypenameField: true,
      addNull: true,
      addUndefined: true,
      enumAsType: undefined,
      enumTypeSuffix: undefined,
      scalars: undefined,
    }
    client: {
      outputDir: 'generated/lfd/client',
      wipeOutputDir: true,
      fetchDelay: undefined,
      loopFetchLimit: undefined,
      recursionOverrides: undefined,
      genHooks: undefined
    },
  }
}
```

JSON Config
```json
{
  "schemaPath": null,
  "endpoint": "http://localhost:4000/graphql",
  "devEndpoint": "http://localhost:4000/graphql",
  "installDeps": true
  "installTypes": true
  "useYarn": false
  "indentSpaces": 2
  "useSingleQuotes": true
  "objectRecursionLimit": 2
  "importsAsESM": false
  "prettierFormat": false
  "typesDir": null
  "generator": {
    "schema": {
      "outputDir": "graphq"',
      "useEndpoint": false,
      "wipeOutputDir": true
      "Authorization": null,
    },
    "types": {
      "outputDir": "generated/lfd/types"
      "wipeOutputDir": true,
      "enumAsConst": true,
      "addTypenameField": true,
      "addNull": true,
      "addUndefined": true,
      "enumAsType": null,
      "enumTypeSuffix": null,
      "scalars": null,
    }
    "client": {
      "outputDir": "generated/lfd/client",
      "wipeOutputDir": true
      "fetchDelay": null,
      "loopFetchLimit": null,
      "recursionOverrides": null,
      "genHooks": null
    },
  }
}
```

YML Regular Config
```yml
schemaPath: null
endpoint: http://localhost:4000/graphql
devEndpoint: http://localhost:4000/graphql
installDeps: true
installTypes: true
useYarn: false
indentSpaces: 2
useSingleQuotes: true
objectRecursionLimit: 2
importsAsESM: false
prettierFormat: false
typesDir: null

generator:
  - schema:
      outputDir: graphql
      useEndpoint: false
      wipeOutputDir: true
      Authorization: null

  - types:
      outputDir: generated/lfd/types
      wipeOutputDir: true
      enumAsConst: true
      addTypenameField: true
      addNull: true
      addUndefined: true
      enumAsType: undefined
      enumTypeSuffix: undefined
      scalars: undefined
  - client:
      outputDir: generated/lfd/client
      wipeOutputDir: true
      fetchDelay: null
      loopFetchLimit: null
      recursionOverrides: null
      genHooks: null
```

YML One Article Config
```yml
--- # LFD Config
schemaPath: null
endpoint: http://localhost:4000/graphql
devEndpoint: http://localhost:4000/graphql
installDeps: true
installTypes: true
useYarn: false
indentSpaces: 2
useSingleQuotes: true
objectRecursionLimit: 2
importsAsESM: false
prettierFormat: false
typesDir: null

generator:
  - schema:
      outputDir: graphql
      useEndpoint: false
      wipeOutputDir: true
      Authorization: null

  - types:
      outputDir: generated/lfd/types
      wipeOutputDir: true
      enumAsConst: true
      addTypenameField: true
      addNull: true
      addUndefined: true
      enumAsType: undefined
      enumTypeSuffix: undefined
      scalars: undefined
  - client:
      outputDir: generated/lfd/client
      wipeOutputDir: true
      fetchDelay: null
      loopFetchLimit: null
      recursionOverrides: null
      genHooks: null
```

YML Multiple Articles Config
```yml
--- # Schema Gen
schemaPath: null
endpoint: http://localhost:4000/graphql
devEndpoint: http://localhost:4000/graphql
installDeps: true
installTypes: true
useYarn: false
indentSpaces: 2
useSingleQuotes: true
objectRecursionLimit: 2

generator:
  - schema:
      outputDir: graphql
      useEndpoint: false
      wipeOutputDir: true
      Authorization: null

--- # Types Gen
importsAsESM: false
prettierFormat: false
typesDir: null
generator:
  - types:
      outputDir: generated/lfd/types
      wipeOutputDir: true
      enumAsConst: true
      addTypenameField: true
      addNull: true
      addUndefined: true
      enumAsType: undefined
      enumTypeSuffix: undefined
      scalars: undefined

--- # Client Gen
generator:
  - client:
      outputDir: generated/lfd/client
      wipeOutputDir: true
      fetchDelay: null
      loopFetchLimit: null
      recursionOverrides: null
      genHooks: null
```

### Option Details
In this section, we will go over every config option in detail.

**GlobalGeneratorConfig**:

- `devEndpoint`
  - Type: `string | null | undefined`
  - Default: `undefined`
  - Info: If Schema Generator is set to query the server to create a schema, then `devEndpoint` tells the `lfd` program where to query the server. The `devEndpoint` option is used if the the `NODE_ENV` variable is NOT set to `production` when the `lfd` program is ran.

- `endpoint`
  - Type: `string | null | undefined`
  - Default: `undefined`
  - Info: If Schema Generator is set to query the server to create a schema, then `endpoint` tells the `lfd` program where to query the server. The `endpoint` option is used if the the `NODE_ENV` variable is set to `production` when the `lfd` program is ran.

- `generator`
  - Info: This is required and must contain at least one Generator to run

- `importsAsESM`
  - Type: `boolean | null | undefined`
  - Default: `false`
  - Info: If you need all the imports in the generated files to foolow ES module conventions, then setting this options to true will make all imports end with `.js`

- `indentSpaces`
  - Type: `number | null | undefined`
  - Default: `2`
  - Info: The code generator genrates code with indents, and as such, this options dictates how much spaces each indent is equivalent to.

- `installDeps`
  - Type: `boolean | null | undefined`
  - Default: `false`
  - Info: When generating code for Types and Client, some code will be generated that depend on outside code. If this is set to true, then all modules necesarry will be installed in the `package.json` file where the `lfd` program was ran.
  - More Details: To be more specific, if for example, your schema has the `DecimalScalar` scalar in any field, that scalar is overriden to have the value of `Prisma.Decimal`, which requires the `@prisma/client` package. If installDeps is set to false, than you will have a file with `export type DecimalScalar = Prisma.Decimal` which imports `@prisma/client`. If you don't have that package installed already, than that file will throw an error.

- `installTypes`
  - Type: `boolean | null | undefined`
  - Default: `false`
  - Info: When generating code for Types and Client, some code will be generated that depend on outside code. If `installDeps` is set to true, than those dependencies will be installed. However, if you are using typescript, then some of those dependencies also have an `@types` package that also need to be installed to devDependencies. If this option is set to true, than those, will be installed too.
  - More Details: The logic that executes with this option is generic, if pakage `A` is installed, then `@types/A` will be installed also. Howver, not all packages have type decalrations to install, so running trying to install those types will fail. When that happens, the `lfd` program will not error out. It will instead just warn you that such thing happened.

- `objectRecursionLimit`
  - Type: `number | null | undefined`
  - Default: `2`
  - Info: Determines the depth of object recursion in Client Generator.
  - Mode Details: This is an extremely important options. When Client generator is ran, we have to construct a GRAPHQL_OPERATION_DATA object which contains data on all operations from a given schema. The data contained in this object allows our `operation_fetch` function to remove extra properties in the input field and allows the function to auto construct a query given a selection set. Play around with the number and see what gets generated in the client/data/data.ts file. That should better present what it does.

- `prettierFormat`
  - Type: `boolean | null | undefined`
  - Default: `false`
  - Info: If set to true, then the `lfd` program will look for a prettier config file inside the directory where the program was ran and if a prettier config file was found, then ALL generated code will be auto formatted based on the prettier config.

- `schemaPath`
  - Type: `string | null | undefined`
  - Default: `undefined`
  - Info: This options is used in both Schema and Types Generator. If this optios is provided, then Schema generator will NOT generate a schema file, unless `useEndpoint` is set to true. In Types Generator, `schemaPath` is used as the schema to generate types from. 

- `typesDir`
  - Type: `string | null | undefined`
  - Default: `undefined`
  - Info: Directory of types to use to use running Types and Client Generator. ALL TS, TSX, JS and JSX files inside the directory and subdirectories will be used.
  - More Details: The reason for this options is that I have a graphql server where I use prisma generate to generate type graphql types from my `prisma.schema` file. Afterwards, I can then generate a `schema.graphql` which I can then pass to the `lfd` program. However, the program will then generate some types which were already generated by running `prisma generate`. With this option, the program will only generate new types which are not present in the directory provided to `typesDir`. Imports are handled automagically, so nothing should break in the operation fetch functions if given an empty directory to `typesDir` or if nothing gets generated in Types Generator beacuse `typesDir` already has all types needed.

- `useSingleQuotes`
  - Type: `boolean | null | undefined`
  - Default: `true`
  - Info: If true, ALL single quotes and doouble quotes in generated code are replaced with single quotes. If false, then all are replaced with double quotes.

- `useYarn`
  - Type: `boolean | null | undefined`
  - Default: `false`
  - Info: If installing set to true and dependencies will be installed, then yarn will be the package manager used.


**SchemaGeneratorConfig**:

- `Authorization`
  - Type: `string | null | undefined`
  - Default: `undefined`
  - Info: If you need to add an auth token to the query made to the server to query the schema, then you can do so with this option.

- `outputDir`
  - Type: `string | null | undefined`
  - Default: `./src/generated/graphql`
  - Info: Path to a directory where the `schema.graphql` file will be generated. If the directory does not exists, the `lfd` program creates it.
  - More Details: This is a directory path and not a file path because I might generate some extra schema stuff later on. 

- `useEndpoint`
  - Type: `boolean | null | undefined`
  - Default: `false`
  - Info: If `schemaPath` is given, then Schema Generator will not run if the file in `schemaPath` exists and can be read. However, if you want to ignore that file and still query the server to generate a schema file, then setting this option to true does that.

- `wipeOutputDir`
  - Type: `boolean | null | undefined`
  - Default: `false`
  - Info: Whether to wipe output directory or not before geenrating new files.


**TypesGeneratorConfig**:

- `addTypenameField`
  - Type: `boolean | null | undefined`
  - Default: `true`
  - Info: When generating types, if this is set to true, then a `__typename` field is added which is set to optional. This is recommended since this is used in the Client fetch functions to differentiate between unions if user gives a selection set with a `union_select` field. 

- `addNull`
  - Type: `boolean | null | undefined`
  - Default: `true`
  - Info: If a field is optional, meaning that it has `?`, and this is set to true, than that field's type will be appended with `| null`, creating a union.

- `addUndefined`
  - Type: `boolean | null | undefined`
  - Default: `true`
  - Info: If a field is optional, meaning that it has `?`, and this is set to true, than that field's type will be appended with `| undefined`, creating a union.

- `enumAsConst`
  - Type: `boolean | null | undefined`
  - Default: `false`
  - Info: When generating enums, we normally generate then as enums themselves. However, if you want to generate enums as consts, then this option does that. Both this and `enumAsType` can't be set true at the same time. 
  - More Details: If working with `type-graphql`, than input and object types can both take a const enum as the GraphQL type. This can't be done with regular enums, which is why this option exists.
  - Example:
```typescript
export enum Language {
  ES,
  EN
}

// The above enum would instead be replaced with

export const Language = {
  EN: 'EN',
  ES: 'ES'
} as const 
export type Language = typeof Language[keyof typeof Langauge]

// This then allows you to do 
import { Language } from './some/where'
import { ObjectType, InputType, Field, ID } from "type-graphql"

@InputType()
export class LanguageInput {
  @Field(() => Language, { nullable: false })
  lang!: Language
}

@ObjectType()
export class LangaugeOutput {
  @Field(() => Language, { nullable: false })
  lang!: Language
}
```

- `enumAsType`
  - Type: `boolean | null | undefined`
  - Default: `false`
  - Info: When generating enums, we normally generate then as enums themselves. However, if you want to generate enums as types, then this option does that. Both this and `enumAsConst` can't be set true at the same time. 
  - Example (assyming enumTypeSuffix is set to `_Enum`): 
```typescript
export enum Language {
  ES,
  EN
}

// The above enum would instead be replaced with

export enum Language_Enum {
  EN,
  ES
}
export type Language = keyof typeof Language_Enum
```

- `enumTypeSuffix`
  - Type: `string | null | undefined`
  - Default: `_Enum`
  - Info: If `enumAsType` is set to true, then this option determines what is the suffix placed on actual enums and not the enum types.

- `outputDir`
  - Type: `string | null | undefined`
  - Default: `./src/generated/types`
  - Info: Path to a directory where the types will be generated to. If the directory does not exists, the `lfd` program creates it.

- `scalars`
  - Type: `ScalarOverride | null | undefined`
  - Default: `false`
  - Info: By default, ALL scalars are set to any. You can override scalars individually with this option.
  - Examples:
```typescript
// Imagine your yml config file has:
/*
scalars:
  - LanguageScalar: { override: Language }
  - MenuScalar: { override: Menu }
  - DateTime: { override: Date }
  - DecimalScalar: { override: 'Prisma.Decimal', import: "Prisma", from: "@prisma/client", isDefault: false }
*/
// Assuming those configs, the scalars file generated would look like this
import { Menu, Language } from './some/where'
import { Prisma } from '@prisma/client' // Here isDefault is false
import Prisma from '@prisma/client' // Here isDefault is true

export type LanguageScalar = Language
export type MenuScalar = Menu
export type DecimalScalar = Prisma.Decimal

// If we instead have isDefault to true for DecimalScalar, then DecimalScalar would be
import Prisma from '@prisma/client' // Notice we are default importing

export type DecimalScalar = Prisma.Decimal
```

- `wipeOutputDir`
  - Type: `boolean | null | undefined`
  - Default: `false`
  - Info: Whether to wipe output directory or not before geenrating new files.

**ClientGeneratorConfig**

- `fetchDelay`
  - Type: `number | null | undefined`
  - Default: `3000`
  - Info: Amount of milliseconds to wait before attempting a new fetch if a fetch failed in `loop_fetch` and `bounded_loop_fetch`.
  - More Details: If you set a number that is less than 100, the `lfd` program auto multiplies the number by 1000. Reasoning behind this is that setting a delay of for example, 3, will probably break something and is probably not what the user intended. In such scenario, I assume the number 3 is meant to be 3 seconds and not 3 milliseconds, and thus I multiple the number by 100.

- `genHooks`
  - Type: `boolean | null | undefined`
  - Default: `false`
  - Info: Whether to generate `useOperation` and `useOperationSWR` functions or not. These use `@tanstack/react-query` and `swr`, respectively.

- `loopFetchLimit`
  - Type: `number | null | undefined`
  - Default: `10`
  - Info: Amount of times `bounded_loop_fetch` will retry a fetch before stopping.

- `outputDir`
  - Type: `string | null | undefined`
  - Default: `./src/generated/client`
  - Info: Path to a directory where the client types and functions and other files will be generated to. If the directory does not exists, the `lfd` program creates it.

- `recursionOverrides`
  - Type: `Record<string, number>[] | null | undefined`
  - Default: `undefined`
  - Info: The option `objectRecusionLimit` globally bounds all of the client functions, the data we generate and other stuff too. However, if you want to set a custom recursion limit for a type, than you can do that here.
  - Example:
```typescript
// In this example, imagine you have the following in your config
/*
...config
objectRecursionLimit: 3
generator: 
 - UserA: 2
*/

type UserA = {
  id: string,
  best_friend: UserA
}

type UserB = {
  id: string,
  best_friend: UserB
}

let x: UserB

// With the previously established, any operation that returns UserA is bounded by a recursion limit of 2 while any operation returning UserB is bounded bu the global limit of 3
// This means the following

const res = await operation_fetch("operationThatReturnsUserA", {user_a_account: true})
// Valid
console.log(res.output.user_a_account.best_friend.best_friend.id) // At recursion limit, we only have primitives, hence why we can call id
// Invalid since we passed recursion override of 2 for type UserA
console.log(res.output.user_a_account.best_friend.best_friend.best_friend.id)

const res = await operation_fetch("operationThatReturnsUserB", {user_b_account: true})
console.log(res.output.user_a_account.best_friend.best_friend.best_friend.id)
```

- `wipeOutputDir`
  - Type: `boolean | null | undefined`
  - Default: `false`
  - Info: Whether to wipe output directory or not before geenrating new files.



<!-- ## Conventions -->
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
- Make the typescript auto compete suggestion be better as there are some edge cases where auto complete does not work
- Actually make a client since the Client Generator just generates some functions xD