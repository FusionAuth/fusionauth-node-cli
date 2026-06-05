import test, { describe } from "node:test"
import assert from "node:assert"
import fs, { readFileSync } from "node:fs"
import mock from "mock-fs"
import { telemetryUpdate } from "../../dist/commands/telemetry/telemetry-utils.js"
import { telemetryDisable } from "../../dist/commands/telemetry/telemetry-disable.js"
import { telemetryEnable } from "../../dist/commands/telemetry/telemetry-enable.js"
import path from "node:path"
import { logEvent } from "../../dist/utils.js"
import nock from 'nock'

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
      mock({
        "dist": {}
      })
      try {
        const updatedConfig = telemetryUpdate(true)
        assert(fs.existsSync('dist/.fa/config.json'), "File wasn't created")
      } finally {
        mock.restore()
      }
    })
    test("Only changes telemetry value", () => {
      mock({
        "dist/.fa/config.json": JSON.stringify(mockedFalseConfig)
      })
      try {
        const updatedConfig = telemetryUpdate(true)
        assert.deepEqual(updatedConfig.globalConfig, mockedTrueConfig)
      } finally {
        mock.restore()
      }
    })
    test("Enable works", (t) => {
      mock({
        "dist/.fa/config.json": JSON.stringify(mockedFalseConfig)
      })
      try {
        const actualConfig = telemetryUpdate(true)
        assert.equal(actualConfig.globalConfig.telemetry, true, "Telemetry not set to true")
      } finally {
        mock.restore()
      }
    })
    test("Disable works", (t) => {
      mock({
        "dist/.fa/config.json": JSON.stringify(mockedTrueConfig)
      })
      try {
        const actualConfig = telemetryUpdate(true)
        assert.equal(actualConfig.globalConfig.telemetry, true, "Telemetry not set to true")
      } finally {
        mock.restore()
      }
    })
    test("Disable full command runs properly", (t) => {
      mock({
        "dist/.fa/config.json": JSON.stringify(mockedTrueConfig)
      })
      try {
        telemetryDisable.parse()
        const actualConfig = JSON.parse(fs.readFileSync('dist/.fa/config.json').toString())
        assert.equal(actualConfig.telemetry, false)
      } finally {
        mock.restore()
      }
    })
    test("Enable full command runs properly", (t) => {
      mock({
        "dist/.fa/config.json": JSON.stringify(mockedFalseConfig)
      })
      try {
        telemetryEnable.parse()
        const actualConfig = JSON.parse(fs.readFileSync('dist/.fa/config.json').toString())
        assert.equal(actualConfig.telemetry, true)
      } finally {
        mock.restore()
      }
    })
  })
  describe('tests for logEvent', () => {
    test("If FUSIONAUTH_TELEMETRY === false don't run", async (t) => {
      before(() => {
        process.env.FUSIONAUTH_TELEMETRY = false
      })
      after(() => {
        delete process.env.FUSIONAUTH_TELEMETRY
      })

      const response = await logEvent('test event')
      assert.equal(response, false, "logEvent still fired")
    })

    test("If FUSIONAUTH_TELEMETRY === true DO run", async (t) => {
      before(() => {
        process.env.FUSIONAUTH_TELEMETRY = true
        nock('https://us.i.posthog.com')
          .post('/batch/')
          .reply(200)
      })
      after(() => {
        nock.cleanAll();
        delete process.env.FUSIONAUTH_TELEMETRY
      })

      const response = await logEvent('test event')
      assert.equal(response, true, "logEvent didn't fire")
    })
    test("If no .env, event submits", async (t) => {
      before(() => {
        nock('https://us.i.posthog.com')
          .post('/batch/')
          .reply(200)
      })
      after(() => {
        nock.cleanAll();
      })

      assert.equal(process.env.FUSIONAUTH_TELEMETRY, undefined, 'Env variable FUSIONAUTH_TELEMETRY is defined')
      const response = await logEvent('test event')
      assert.equal(response, true, "logEvent didn't fire")
    })
    
  })
}
