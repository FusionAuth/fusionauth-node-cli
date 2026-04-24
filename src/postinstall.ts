import { randomUUID } from 'node:crypto'
import fs from 'node:fs'

function run() {
  const dir = 'dist/.fa'
  if (!fs.existsSync(dir)) {
    const configObject = {
      id: randomUUID(),
      telemetry: true
    }

    fs.mkdirSync('dist/.fa')
    if (!fs.existsSync(dir + '/config.json')){
      fs.writeFileSync(dir + '/config.json', JSON.stringify(configObject, null, 2))
    }
    fs.chmodSync(dir, '00020')
  }
}

run()