import fs from 'fs'
import path from 'path'
import { format_file } from './formatFile.js'
import { GeneratorConfig } from '../types.js'
import { BuiltInParserName, CustomParser, LiteralUnion } from 'prettier'
import { AUTO_GENERATED_COMMENT, logger, REGEX } from '../constants.js'

export const write_format_file_regular = async (output_dir: string, output_name: string, content: string, config: GeneratorConfig, parser: LiteralUnion<BuiltInParserName, string> | CustomParser = "typescript") => {
  try {
    if (!fs.existsSync(path.join(process.cwd(), output_dir))) fs.mkdirSync(output_dir, { recursive: true })

    const file_path = path.join(path.join(process.cwd(), output_dir), output_name)

    // Ensures our file is formatted correctly before saving
    fs.writeFileSync(file_path, config.global.prettier_format ? await format_file(content, parser) : content)
  }
  catch(e) {
    logger.error(e)
  }
}

export const write_format_file = async (output_dir: string, output_name: string, contents: string[], config: GeneratorConfig, parser: LiteralUnion<BuiltInParserName, string> | CustomParser = "typescript", header = AUTO_GENERATED_COMMENT) => {
  try {
    if (!fs.existsSync(path.join(process.cwd(), output_dir))) fs.mkdirSync(output_dir, { recursive: true })

    const file_path = path.join(path.join(process.cwd(), output_dir), output_name)

    let content = ""
    let raw_content = contents.filter(Boolean).join("\n\n")
    // Replace quotes and remove artefacts
    raw_content = config.global.use_single_quotes ? raw_content.replace(REGEX.match_double_quotes, `'`) : raw_content.replace(REGEX.match_single_quotes, `"`)
    raw_content = raw_content.replace(REGEX.match_artefacts, "")

    content = [
      header,
      raw_content
    ].join("\n\n")

    // Ensures our file is formatted correctly before saving
    fs.writeFileSync(file_path, config.global.prettier_format ? await format_file(content, parser) : content)
  }
  catch(e) {
    logger.error(e)
  }
}

// export const write_format_file = async (output_dir: string, output_name: string, contents: string[], config: GeneratorConfig, parser: LiteralUnion<BuiltInParserName, string> | CustomParser = "typescript") => {
//   // Create output folder if it doesn't exist
//   if (!fs.existsSync(path.join(process.cwd(), output_dir))) fs.mkdirSync(output_dir, { recursive: true })

//   const file_path = path.join(path.join(process.cwd(), output_dir), output_name)
//   let content = ""
//   let raw_content = contents.filter(Boolean).join("\n\n")

//   // Replace quotes and remove artefacts
//   raw_content = config.global.use_single_quotes ? raw_content.replace(REGEX.match_double_quotes, `'`) : raw_content.replace(REGEX.match_single_quotes, `"`)
//   raw_content = raw_content.replace(REGEX.match_artefacts, "")

//   try {
//     // Add auto generated message if file does not exist
//     if (!fs.existsSync(file_path)) {
//       content = [
//         AUTO_GENERATED_COMMENT, 
//         raw_content
//       ].join("\n\n")
//     }
//     else {
//       // If file exists, get content and add these new imports in the right place
//       // Since content is received by section, we can iterate contents and one of the elements will be a string of imports
//       let new_content = ""
//       const new_imports_positions: number[] = []
//       const new_imports: string[] = []

//       contents.map((c, pos) => {
//         if (c.startsWith("import")) {
//           new_imports_positions.push(pos)
//           for (const line of c.split("\n")) {
//             new_imports.push(line)
//           }
//         }
//       })

//       if (new_imports_positions.length > 0) new_content = contents.filter((c, pos) => !is_in(pos.toString(), new_imports_positions.map(i => i.toString()))).join("\n\n")
//       else new_content = contents.join("\n\n")

//       const raw_file = fs.readFileSync(file_path)

//       let pre_import_content = ""
//       let import_content: string[] | null = null
//       let post_import_content = ""

//       const old_imports_positions: number[] = []
//       const old_imports: string[] = []

//       const old_contents = raw_file.toString().split("\n")

//       console.log(old_contents)

//       old_contents.map((line, pos) => {
//         if (line.startsWith("import")) {
//           old_imports_positions.push(pos)
//           old_imports.push(line)
//         }
//       })

//       import_content = clean_imports([...new_imports, ...old_imports])

//       if (old_imports_positions.length > 0) {
//         const imports_min_pos = Math.min.apply(null, old_imports_positions)
//         const imports_max_pos = Math.max.apply(null, old_imports_positions)

//         old_contents.map((line, pos) => {
//           if (pos < imports_min_pos) {
//             pre_import_content += line
//           }
//           else if (pos > imports_max_pos) {
//             post_import_content += line
//           }
//         })
//       }

//       // Now we create a new content from all of this
//       // This basically puts new imports in import section and puts all new content after old content
//       content = [
//         pre_import_content,
//         import_content,
//         post_import_content,
//         raw_content
//       ].filter(Boolean).join("\n\n")
//     }

//     // Ensures our file is formatted correctly before saving
//     fs.writeFileSync(file_path, config.global.prettier_format ? await format_file(content, parser) : content)
//   }
//   catch(e) {
//     logger.error(e)
//   }
// }