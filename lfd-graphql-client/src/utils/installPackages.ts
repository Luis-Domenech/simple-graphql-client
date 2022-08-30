import fs from 'fs'
import path from 'path'
import { spawnSync } from 'child_process'
import { DependencyData, GeneratorConfig } from '../types.js'
import { logger } from '../constants.js'

export const install_dependencies = async (dependencies: Map<string, DependencyData>, config: GeneratorConfig) => {
  
  Array.from(dependencies.values()).map(dep => {
    logger.info(`Installing -> ${dep.dependency}`)

    if (dep.dependency === "node-fetch" && !config.global.imports_as_esm) {
      logger.info(`Client functions use node-fetch and config option (importAsEsm) is false, I assume you're project is not setup to import an ESM only module, which is what node-fetch v3 is. To solve this, node-fetch@^2.6.6 will be installed instead`)
      dep.version = "2.6.6"
    }

    const package_json = fs.readFileSync(path.join(process.cwd(), './package.json'), 'utf-8')
    
    const package_manager = config.global.use_yarn ? 'yarn add' : 'npm i'
    const dev_package_manager = config.global.use_yarn ? 'yarn add --dev' : 'npm i -D'
    
    const has_dependency = package_json.includes(`"${dep.version ? dep.dependency + "@^" + dep.version : dep.dependency}"`)
    
    if (has_dependency) {
      logger.info(`Dependency already installed`)
    }
    else {
      const spawn = spawnSync(`${dep.is_dev ? dev_package_manager : package_manager} ${dep.version ? dep.dependency + "@^" + dep.version : dep.dependency}`, [], { shell: true, stdio: ['inherit', 'ignore', 'pipe'] })
      if (spawn.stderr.length > 0) {
        if (spawn.stderr.toString().toLowerCase().includes('error')) logger.error(`There was an error installing the dependency`)
        else logger.info(`Dependency installed`)
      }
      else logger.info(`Dependency installed`)
    }

    // Don't install types if installing node-fetch@2.6.6
    if (config.global.install_types && !(dep.dependency === "node-fetch" && !config.global.imports_as_esm)) {
      logger.info(`Attempting to install types -> @types/${dep.dependency}`)
      const has_types = package_json.includes(`"@types/${dep.dependency}"`)
      if (has_types) {
        logger.info(`Types already installed`)
      }
      else {
        const second_spawn = spawnSync(`${dev_package_manager} @types/${dep.dependency}`, [], { shell: true, stdio: ['inherit', 'ignore', 'pipe'] })
        if (second_spawn.stderr.length > 0) logger.info(`Either the types don't exist or there was an error installing the types. You can ignore this issue most probably.`)
        else logger.info(`Types installed`)
      }
    }
  })
}