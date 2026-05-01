import { randomUUID } from 'node:crypto'
import fs from 'node:fs'

function run() {
  const dir = 'dist/.fa'
  const configPath = dir + '/config.json'
  fs.mkdirSync(dir, { recursive: true })
  if (!fs.existsSync(configPath)) {
    const configObject = {
      id: randomUUID(),
      telemetry: true
    }
    fs.writeFileSync(configPath, JSON.stringify(configObject, null, 2))  }
}

run()