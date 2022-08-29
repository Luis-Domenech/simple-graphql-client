#! /usr/bin/env node
import yargs from 'yargs'
import { Logger } from 'lfd-utils'
import { GeneratorArgs } from "./types.js"
import { run_generator } from "./index.js"
import { PACKAGE_FULL_NAME, PACKAGE_NAME } from './constants.js'
// import { Argv, command  } from "yargs"


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

  cmd.positional("warnings", {
    alias: "w",
    type: "boolean",
    describe: "Show Warnings Flag",
    default: true,
    desc: "If true, warnings will be shown by logger"
  })
}

const handler = ({config, env, warnings}: GeneratorArgs) => {
  Logger.pkg_name = PACKAGE_NAME
  Logger.full_pkg_name = PACKAGE_FULL_NAME
  Logger.disable_warnings = !warnings

  run_generator(config, env, warnings)
  .catch(e => {
    console.log(e)
    Logger.error(e)
  })
}

// eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
yarg.command("* [config] [env]", true as any, builder as any, handler as any).help().parseSync()