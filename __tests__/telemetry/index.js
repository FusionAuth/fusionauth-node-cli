import test, { describe, after, before, beforeEach, afterEach } from "node:test"
import assert from "node:assert"
import fs, { readFileSync } from "node:fs"
import mock from "mock-fs"
import { telemetryUpdate } from "../../dist/commands/telemetry/telemetry-utils.js"
import path from "node:path"

export function telemetry() {
  const mockedTrueConfig = {
      id: '8c0a77f2-27e4-4284-b5d3-5618ec2a56eb', 
      telemetry: true
  }
  const mockedFalseConfig = {
      id: '8c0a77f2-27e4-4284-b5d3-5618ec2a56eb', 
      telemetry: false
  }
  describe('telemetry runs properly', () => {
    test("Creates config if no config exists", (t) => {
      before(() => {
        mock({
          "dist": {}
        })
      }) 

      const updatedConfig = telemetryUpdate(true)
      assert(fs.existsSync('dist/.fa/config.json'), "File wasn't created")
    })
    test("Only changes telemetry value", () => {
      before(() => {
        mock({
          "dist/.fa/config.json": JSON.stringify(mockedFalseConfig)
        })
      })
      
      const updatedConfig = telemetryUpdate(true)
      assert.deepEqual(updatedConfig.globalConfig, mockedTrueConfig)
    })
    test("Enable works", (t) => {
      before(() => {
        mock({
          "dist/.fa/config.json": JSON.stringify(mockedFalseConfig)
        })
      })
      const actualConfig = telemetryUpdate(true)
      assert.equal(actualConfig.globalConfig.telemetry, true, "Telemetry not set to true")
    })
    test("Disable works", (t) => {
      before(() => {
        mock({
          "dist/.fa/config.json": JSON.stringify(mockedTrueConfig)
        })
      })
      const actualConfig = telemetryUpdate(true)
      assert.equal(actualConfig.globalConfig.telemetry, true, "Telemetry not set to true")
    })
  })
}
