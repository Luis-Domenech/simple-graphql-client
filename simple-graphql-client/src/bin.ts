#! /usr/bin/env node
import yargs from 'yargs'
import { GeneratorArgs } from "./types.js"
import { run_generator } from "./index.js"
// import { Argv, command  } from "yargs"
import { logger } from './utils/index.js'

// const yarg = yargs(hideBin(process.argv))
const hideBin = (argv: string[]) => argv.slice((process.versions.electron && !(process as any).defaultApp ? 0 : 1) + 1)
const yarg = yargs(hideBin(process.argv))




// Setup cli arguments
const builder = (cmd: any) => {
  cmd.positional("config", {
    alias: "c",
    type: "string",
    describe: "Simple GraphQL Client Config File Path",
    default: "",
    desc: "The path to a valid config for running simple-graphql-client"
  })

  cmd.positional("env", {
    alias: "e",
    type: "string",
    describe: "Env File Path",
    default: "",
    desc: "The path to the env file needed if using environment variables in a yml or json config file"
  })
}

const handler = ({config, env}: GeneratorArgs) => {
  logger.pkg_name = 'simple-graphql-client'
  logger.full_pkg_name = 'Simple GraphQL Client'

  run_generator(config, env)
  .catch(e => {
    console.log(e)
    logger.error(e)
  })
}

// eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
yarg.command("* [config] [env]", true as any, builder as any, handler as any).help().parseSync()