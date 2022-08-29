declare module 'envsub' {
  export default function envsub (args: {command?: string, templateFile: string, outputFile: "stdout" | string, options?: {
    all?: boolean,
    diff?: boolean,
    envs?: {name: string, value: any}[],
    envFiles?: string[],
    protect?: boolean,
    syntax?: "dollar-basic" | "dollar-curly" | "dollar-both" | "handlebars" = "dollar-basic",
    system?: boolean
  }}):  Promise<{
    templateFile: string,
    templateContents: string,
    outputFile: string,
    outputContents: string
  }>

}