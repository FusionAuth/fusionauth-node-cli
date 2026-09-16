import { describe, test, beforeEach, afterEach } from "node:test"
import assert from "node:assert/strict"
import fs from "node:fs"
import path from "node:path"
import { telemetryUpdate } from "../../src/commands/telemetry/telemetry-utils.js"
import { telemetryDisable } from "../../src/commands/telemetry/telemetry-disable.js"
import { telemetryEnable } from "../../src/commands/telemetry/telemetry-enable.js"
import { logEvent, loadConfig } from "../../src/utils.js"
import nock from 'nock'
import { createTempDir, removeTempDir } from '../helpers/temp-dir.js'

const mockedTrueConfig = {
    id: '8c0a77f2-27e4-4284-b5d3-5618ec2a56eb', 
    telemetry: true,
    version: '1.0'
}
const mockedFalseConfig = {
    id: '8c0a77f2-27e4-4284-b5d3-5618ec2a56eb', 
    telemetry: false,
    version: '1.0'
}

// All telemetry helpers read/write a global config file at
// `${FUSIONAUTH_CONFIG_DIR}/.fa/config.json`. Point that at a fresh real
// temp directory per test rather than mocking the filesystem, and rather
// than letting these tests write to the real repo's src/.fa/ directory.
describe('telemetry runs properly', () => {
    let tempDir
    let configPath

    beforeEach(() => {
      tempDir = createTempDir()
      process.env.FUSIONAUTH_CONFIG_DIR = tempDir
      configPath = path.join(tempDir, '.fa', 'config.json')
    })

    afterEach(() => {
      delete process.env.FUSIONAUTH_CONFIG_DIR
      removeTempDir(tempDir)
    })

    function writeConfig(config) {
      fs.mkdirSync(path.dirname(configPath), { recursive: true })
      fs.writeFileSync(configPath, JSON.stringify(config))
    }

    test("Creates config if no config exists", () => {
      const updatedConfig = telemetryUpdate(true)
      assert(fs.existsSync(configPath), "File wasn't created")
    })
    test("Only changes telemetry value", () => {
      writeConfig(mockedFalseConfig)
      const updatedConfig = telemetryUpdate(true)
      assert.deepEqual(updatedConfig.globalConfig, mockedTrueConfig)
    })
    test("Enable works", () => {
      writeConfig(mockedFalseConfig)
      const actualConfig = telemetryUpdate(true)
      assert.equal(actualConfig.globalConfig.telemetry, true, "Telemetry not set to true")
    })
    test("Disable works", () => {
      writeConfig(mockedTrueConfig)
      const actualConfig = telemetryUpdate(false)
      assert.equal(actualConfig.globalConfig.telemetry, false, "Telemetry not set to false")
    })
    test("Disable full command runs properly", () => {
      nock('https://us.i.posthog.com')
        .persist()
        .post('/batch/')
        .reply(200)
      writeConfig(mockedTrueConfig)
      try {
        telemetryDisable.parse()
        const actualConfig = JSON.parse(fs.readFileSync(configPath).toString())
        assert.equal(actualConfig.telemetry, false)
      } finally {
        nock.cleanAll()
      }
    })
    test("Enable full command runs properly", () => {
      nock('https://us.i.posthog.com')
        .persist()
        .post('/batch/')
        .reply(200)
      writeConfig(mockedFalseConfig)
      try {
        telemetryEnable.parse()
        const actualConfig = JSON.parse(fs.readFileSync(configPath).toString())
        assert.equal(actualConfig.telemetry, true)
      } finally {
        nock.cleanAll()
      }
    })
})

describe('tests for logEvent', () => {
    let tempDir

    beforeEach(() => {
      tempDir = createTempDir()
      process.env.FUSIONAUTH_CONFIG_DIR = tempDir
    })

    afterEach(() => {
      delete process.env.FUSIONAUTH_CONFIG_DIR
      delete process.env.FUSIONAUTH_TELEMETRY
      removeTempDir(tempDir)
    })

    test("If FUSIONAUTH_TELEMETRY === false don't run", async () => {
      process.env.FUSIONAUTH_TELEMETRY = 'false'
      const response = await logEvent('test event')
      assert.equal(response, false, "logEvent still fired")
    })
    test("If no .env, event submits", async () => {
      nock('https://us.i.posthog.com')
        .persist()
        .post('/batch/')
        .reply(200)
      try {
        assert.equal(process.env.FUSIONAUTH_TELEMETRY, undefined, 'Env variable FUSIONAUTH_TELEMETRY is defined')
        const response = await logEvent('test event')
        assert.equal(response, true, "logEvent didn't fire")
      } finally {
        nock.cleanAll()
      }
    })
    // Ported forward from the now-removed __tests__/telemetry/index.js — this
    // is the one test there that covered behavior not exercised anywhere
    // else: that the "we collect anonymous data" warning only prints once.
    test("Disables warning after first log", async () => {
      nock('https://us.i.posthog.com')
        .persist()
        .post('/batch/')
        .reply(200)
      try {
        const response = await logEvent('cli test')
        assert.equal(response, true, "logEvent didn't fire")
        const newConfig = loadConfig()
        assert.equal(newConfig.globalConfig.telemetryNoWarn, true)
      } finally {
        nock.cleanAll()
      }
    })
})
