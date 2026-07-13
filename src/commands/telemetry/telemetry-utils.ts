import fs from "node:fs"
import { __dirname } from '../../utils.js'

import { loadConfig } from "../../utils.js"

export function telemetryUpdate(value: boolean) {
  let config = loadConfig()

  config.globalConfig.telemetry = value
  fs.writeFileSync(__dirname + '/.fa/config.json', JSON.stringify(config.globalConfig, null, 2))
  return config
}