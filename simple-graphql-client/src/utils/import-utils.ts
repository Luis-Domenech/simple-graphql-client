import path from 'node:path'
import { is_in, match_first } from 'lfd-utils'
import { DEV_PACKAGES, REGEX } from "../constants.js"
import { DependencyData, GeneratorConfig, GeneratorData, ImportData } from "../types.js"

export const get_import_data = (i: string): ImportData | null => {
  const inside_brackets_matches = i.match(REGEX.match_all_inside_import_brackets)
  const raw_imports_inside_brackets = inside_brackets_matches ? inside_brackets_matches[0] : null

  const outside_brackets_matches = i.match(REGEX.match_all_outside_import_brackets)
  const raw_imports_outside_brackets = outside_brackets_matches ? outside_brackets_matches[0] : null

  if (!raw_imports_inside_brackets && !raw_imports_outside_brackets) return null

  // Now remove white space and get all imports
  const actual_import_matches_inside_brackets = raw_imports_inside_brackets ? raw_imports_inside_brackets.match(REGEX.match_words) : null
  const actual_import_matches_outside_brackets = raw_imports_outside_brackets ? raw_imports_outside_brackets.match(REGEX.match_words) : null

  if (!actual_import_matches_inside_brackets && !actual_import_matches_outside_brackets) return null

  // Get from import
  const from_import_match = i.match(REGEX.match_from_import)
  if (!from_import_match) return null
  if (from_import_match.length === 0) return null
  const from_import = from_import_match[0]

  const actual_imports: ImportData = {
    from: from_import,
    is_relative: from_import.includes("."),
    is_dev: is_in(from_import, DEV_PACKAGES),
    imports: []
  }

  actual_import_matches_inside_brackets!.map(i => {
    actual_imports.imports.push({
      name: i,
      is_default: false
    })
  })

  actual_import_matches_outside_brackets!.map(i => {
    actual_imports.imports.push({
      name: i,
      is_default: true
    })
  })
  
  
  return actual_imports
}

export const add_import = (new_import: string, from_import: string, is_default: boolean, imports: Map<string, ImportData>) => {

  const find = imports.get(from_import)

  if (find) {
    const has_import = find.imports.find(i => i.name === new_import)

    if (has_import) return

    find.imports.push({
      name: new_import,
      is_default: is_default
    })
  }
  else imports.set(from_import, {
    from: from_import,
    is_relative: from_import.includes("."),
    is_dev: is_in(from_import, DEV_PACKAGES),
    imports: [{
      name: new_import,
      is_default: is_default
    }]
  })
}

export const add_imports = async (imports_to_add: Map<string, ImportData>, imports: Map<string, ImportData>) => {
  if (!imports_to_add) return
  if (imports_to_add.size === 0) return

  for (const val of imports_to_add.values()) {
    await Promise.all(val.imports.map(i => {
      add_import(i.name, val.from, i.is_default, imports)
    }))
  }
}

export const get_imports_data = (imports: string[]): Map<string, ImportData> | null => {
  if (!imports) return null
  if (imports.length === 0) return null

  const imports_data: Map<string, ImportData> = new Map()

  imports.map(i => {
    const import_data = get_import_data(i)

    if (import_data) {
      import_data.imports.map(i => add_import(i.name, import_data.from, i.is_default, imports_data))
    }
  })

  return imports_data
}

export const gen_imports = (imports: Map<string, ImportData>, as_const = false): string[] | null => {
  if (!imports) return null
  if (imports.size === 0) return null

  const raw_imports: string[] = []

  for (const i of imports.values()) {
    let raw_import = "import "
    const default_imports = i.imports.filter(imp => imp.is_default).map(imp => imp.name).join(", ")
    const regular_imports = i.imports.filter(imp => !imp.is_default).map(imp => imp.name).join(", ")

    if (!default_imports && !regular_imports) continue

    // TODO: Make this generic
    if (i.from === "node-fetch" && as_const === true) raw_imports.push(`const fetch = require('node-fetch')`)
    else {
      raw_import += default_imports ? default_imports : ""
      raw_import += regular_imports ? default_imports ? ", { " + regular_imports + " } " : "{ " + regular_imports + " } " : ""

      raw_import += ` from '${i.from}'`

      raw_imports.push(raw_import)
    }
  }

  return raw_imports
}

export const get_dependencies = async (data: GeneratorData): Promise<Map<string, DependencyData>> => {
  const imports: Map<string, DependencyData> = new Map()

  await Promise.all(Array.from(data.file_data.values()).map(async (file_data) => {
    await Promise.all(Array.from(file_data.imports.values()).map(async (i) => {
      if (!i.is_relative) {
        if (!imports.has(i.from)) imports.set(i.from, {
          dependency: i.from,
          is_dev: i.is_dev
        })
      }
    }))
  }))

  return imports
}


// Here we receive imports and format them
// Basically, if we have import {A} from 'abc' and import {B} from 'abc', we want import {A, B} from 'abc'
export const clean_imports = (imports: string[]): string[] | null => {
  const imports_data = get_imports_data(imports)
  if (!imports_data) return null
  const raw_imports = gen_imports(imports_data)
  return raw_imports
}

// Only add import if type_name and type_to_import both are valid
export const add_relative_import = (type_name: string, type_to_import: string, data: GeneratorData, config: GeneratorConfig) => {
  // Make sure we don't import ourselves
  if (type_name === type_to_import) return

  const type_file_data = data.file_data.get(type_name)
  const to_import_file_data = data.file_data.get(type_to_import)

  if (type_file_data && to_import_file_data) {
    const same_dir = type_file_data.generator === to_import_file_data.generator
    
    let type_file_path = path.join(process.cwd(), type_file_data.file_path)
    let to_import_file_path = same_dir ? path.join(process.cwd(), to_import_file_data.same_dir_import_path) : path.join(process.cwd(), to_import_file_data.from_import_path)

    if (type_file_path.endsWith("/") || type_file_path.endsWith("\\")) type_file_path = type_file_path.slice(0, -1)
    type_file_path = match_first(type_file_path, REGEX.match_file_path)
    if (type_file_path.endsWith("/") || type_file_path.endsWith("\\")) type_file_path = type_file_path.slice(0, -1)

    if (to_import_file_path.endsWith("/") || to_import_file_path.endsWith("\\")) to_import_file_path = to_import_file_path.slice(0, -1)
    to_import_file_path = same_dir ? match_first(to_import_file_path, REGEX.match_file_path) : to_import_file_path
    if (to_import_file_path.endsWith("/") || to_import_file_path.endsWith("\\")) to_import_file_path = to_import_file_path.slice(0, -1)

    let relative_import_path = path.relative(type_file_path, to_import_file_path)

    if (!relative_import_path) relative_import_path = config.global.imports_as_esm ? './index.js' : './'

    if (config.global.imports_as_esm) {
      if (!relative_import_path.endsWith('.js')) relative_import_path += '.js'
    }

    add_import(type_to_import, relative_import_path, false, type_file_data.imports)
  }
}