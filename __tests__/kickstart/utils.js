import test, { describe, before, after } from "node:test"
import assert from "node:assert";
import fs from "node:fs"
import path, { dirname } from 'node:path';
import { startSetup } from "../../dist/commands/kickstart/utils.js";
import mock from "mock-fs";
export function kickstartUtils() {

  describe("Kickstart Utilities work", () => {
    test("Errors if the CLI_DIR doesn't match", async () => {
      before(() => {
        const cliDirPath = path.resolve('../')
        process.env.CLI_DIR = cliDirPath
      })
      after(() => {
        delete process.env.CLI_DIR
      })
      assert.throws(startSetup, /Error: Current directory was not kickstarted./)
    })
    test("Errors with no compose file", () => {
      after(() => {
        delete process.env.CLI_DIR
      })
      before(() => {
        process.env.CLI_DIR = path.resolve('./')
      })

      assert.throws(startSetup, /Error: Current directory does not contain docker-compose.yml/, "startSetup doesn't throw proper error on docker-compose mistake")
    })

    test("Errors with no kickstart file", () => {
      after(() => {
        delete process.env.CLI_DIR
      })
      before(() => {
        process.env.CLI_DIR = path.resolve('./')
        mock({
          './docker-compose.yml': 'yo'
        })
      })
      assert.throws(startSetup, /The kickstart.json file does not exist./, "startSetup doesn't throw proper error on kickstart.json mistake")
    })


  })

}
