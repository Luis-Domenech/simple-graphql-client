import { DEFAULT_CONFIG, PACKAGE_FULL_NAME } from '../constants.js'
import { GeneratorConfig } from '../types.js'
import { Logger } from 'lfd-utils'

export class logger extends Logger {
  static config: GeneratorConfig = DEFAULT_CONFIG

  constructor (config: GeneratorConfig = DEFAULT_CONFIG) {
    super(PACKAGE_FULL_NAME, config.global.disable_warnings)
    logger.config = config
  }
}