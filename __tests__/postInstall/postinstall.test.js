import { describe, test, beforeEach, afterEach } from "node:test"
import assert from "node:assert/strict"
import path from "node:path"

import { createConfig } from '../../src/utils.js'
import { createTempDir, removeTempDir } from '../helpers/temp-dir.js'

import fs from 'node:fs'

describe('postInstall runs properly', () => {
    let tempDir
    let configDir

    beforeEach(() => {
      tempDir = createTempDir()
      configDir = path.join(tempDir, 'dist', '.fa')
    })

    afterEach(() => {
      removeTempDir(tempDir)
    })

    test('No config creates dir', () => {
      const configFileExists = createConfig(configDir)
      assert.equal(configFileExists, true, 'Config not created at dist/.fa/config.json')
    })

    test('No dist directory, still create the directory and file', () => {
      // tempDir exists but the nested dist/.fa path does not yet.
      const configFileExists = createConfig(configDir)
      assert.equal(configFileExists, true, 'Config not created at dist/.fa/config.json')
    })

    test('No config creates full config file with expected types', () => {
      createConfig(configDir)
      const configObject = JSON.parse(fs.readFileSync(path.join(configDir, 'config.json')))
      assert(configObject.telemetry, true, 'Default telemetry not set to true')
      assert(typeof configObject.id, 'string', "ID doesn't exist or isn't a string")
    })

    test('Complete config returns false', () => {
      fs.mkdirSync(configDir, { recursive: true })
      fs.writeFileSync(
        path.join(configDir, 'config.json'),
        JSON.stringify({ id: '8c0a77f2-27e4-4284-b5d3-5618ec2a56eb', telemetry: true })
      )

      assert.equal(createConfig(configDir), false, 'Postinstall did not return false properly')
    })

    test('No ID in config, but telemetry false', () => {
      fs.mkdirSync(configDir, { recursive: true })
      fs.writeFileSync(path.join(configDir, 'config.json'), JSON.stringify({ telemetry: false }))

      createConfig(configDir)
      const configObject = JSON.parse(fs.readFileSync(path.join(configDir, 'config.json')))
      assert.equal(typeof configObject.id, 'string', 'No ID after run')
      assert.equal(configObject.telemetry, false, 'Telemetry got reset')
    })

    test('No telemetry in config, but ID', () => {
      fs.mkdirSync(configDir, { recursive: true })
      fs.writeFileSync(
        path.join(configDir, 'config.json'),
        JSON.stringify({ id: '8c0a77f2-27e4-4284-b5d3-5618ec2a56eb' })
      )

      createConfig(configDir)
      const configObject = JSON.parse(fs.readFileSync(path.join(configDir, 'config.json')))
      assert.equal(configObject.id, '8c0a77f2-27e4-4284-b5d3-5618ec2a56eb', 'ID got reset')
      assert.equal(configObject.telemetry, true, 'Telemetry did not get set')
    })
})
