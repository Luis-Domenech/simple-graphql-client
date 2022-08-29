import prettier, { BuiltInParserName, CustomParser, LiteralUnion } from 'prettier'
import { logger } from '../constants.js'

export const format_file = async (content: string, parser: LiteralUnion<BuiltInParserName, string> | CustomParser = "typescript"): Promise<string> => {
  try {
    const options = await prettier.resolveConfig(process.cwd())

    // if (!options) {
    //   logger.warn(`Prettier config file was not found, so generated files will not be formatted`)
    //   return content // no prettier config was found, no need to format
    // }

    const formatted = prettier.format(content, { ...options, parser: parser })
    return formatted
  }
  catch(e) {
    logger.error(`${e}`)
  }

  return content
}