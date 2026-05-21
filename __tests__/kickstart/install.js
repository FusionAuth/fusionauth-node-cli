import test, { it,describe, after, before, beforeEach, afterEach } from "node:test"
import assert from "node:assert"
import fs, { readFileSync } from "node:fs"
import mock from "mock-fs"
import { dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { __dirname, createEnv, createKickstart, installSetup, kickstartInstallAction, moveResources } from "../../dist/commands/kickstart-install.js"



export function kickstartInstall() {
  console.log('testing install')
  beforeEach(() => {
    mock({
      "./": {}
    })
  })
  afterEach(() => {
    mock.restore()
  })

  test("Install directory throws if occupied", async () => {
    before(() => {
      mock({
        "./has-content": {
          "does-exist.json": "Has some content"
        }
      })
    })
    assert.throws(() => installSetup('./has-content'))
  })

  // describe('Kickstart resources are valid', () => {
  //   test(".env variables are correctly set", (t) => {
  //     assert(false)
  //   })
  //   test("docker-compose is properly set", (t) => {
  //     assert(false)
  //   })
  //   test("kickstart.json is valid", (t) => {
  //     assert(false)
  //   })
  //   test("kickstart.json has variables defined", (t) => {
  //     assert(false)
  //   })
  //   test("kickstart.json has no extra variables", (t) => {
  //     assert(false)
  //   })

  // })
  describe("moveResources", () => {
    it("should throw error if target directory already exists", async () => {
      before(() => {
        mock({
          "./myTargetDir": {},
          [__dirname + "/resources/kickstart/fusionauth"]: {
            "myfile.json": {"hi": "you"}
          }
        })
      })
      assert.throws(() => moveResources('./myTargetDir'), /exists/)
    })
    it("should throw error if package resources don't exist", async () => {
      assert.throws(() => moveResources('./myTargetDir'), /package/)
    })
    it("should throw error if kickstart template doesn't exist", async () => {
      before(() => {
        mock({
          [__dirname + "/resources/kickstart"]: {
            "fusionauth": {
              ".env.defaults": "hi",
              "docker-compose.yml": "yo"
            }
          }
        })
      })
      assert.throws(() => moveResources('./myTargetDir'), /Kickstart template/)
    })
    it("should throw error if .env.defaults doesn't exist", async () => {
      before(() => {
        mock({
          [__dirname + "/resources/kickstart"]: {
            "kickstart.json": "",
            "fusionauth": {
              "docker-compose.yml": "yo"
            }
          }
        })
      })
      assert.throws(() => moveResources('./myTargetDir'), /.env.defaults/)
    })
    it("should throw error if docker-compose.yml doesn't exist", async () => {
      before(() => {
        mock({
          "./": {},
          [__dirname + "/resources/kickstart"]: {
            "kickstart.json": "",
            "fusionauth": {
              ".env.defaults": "hi",
            }
          }
        })
      })
      assert.throws(() => moveResources('./myTargetDir'), /docker-compose.yml/)
    })
    it("should copy all of the files", () => {
      const targetDir = "./myTargetDir"
      /* mock-fs does NOT support the fs.cp() method and won't be
         Therefore, we have to remove the mock, allow use of the regular resources
         copy the resources to the targetDir, then remove the targetDir after the test
      */
      before(() => {
        mock.restore()
      })      
      after(() => {
        fs.rmSync(targetDir, { recursive: true, force: true })
      })
      const newResources = moveResources('./myTargetDir')
      assert.deepEqual(newResources, [".env.defaults", "docker-compose.yml"])
    })
  })
  describe("Directory is created with proper name", () => {
    test("When no name is specified, create directory at fusionauth")
  })

}