import { GeneratorConfig } from "../types.js"

export class Indent {
  config: GeneratorConfig

  constructor(config: GeneratorConfig) {
    this.config = config
  }

  indent = (index: number): string => " ".repeat(this.config.global.indent_spaces + (index - 1) * this.config.global.indent_spaces)
}
