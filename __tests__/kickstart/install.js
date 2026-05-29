import test, { it,describe, after, before, beforeEach, afterEach } from "node:test"
import assert from "node:assert"
import fs, { readFileSync } from "node:fs"
import mock from "mock-fs"
import path, { dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { __dirname, createEnv, createKickstart, installSetup, kickstartInstallAction, moveResources } from "../../dist/commands/kickstart-install.js"

export function kickstartInstall() {
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
  describe("createKickstart", () => {
      beforeEach(async (t) => {
        mock.restore()
        mock({
          "./myDir": {},
          [__dirname + "/resources/kickstart"]: {
            "kickstart.json": fs.readFileSync(path.resolve("./src/resources/kickstart/kickstart.json")).toString(),
            "fusionauth": {
              "docker-compose.yml": "yo"
            }
          }
        })
      const answers = {
        password: "password",
        email: "test@test.com",
        appName: "myAppName"
      }
      await createKickstart(path.resolve(`${__dirname}/resources/kickstart/kickstart.json`), answers, "myDir")
      t.newKickstart = JSON.parse(fs.readFileSync('./myDir/kickstart/kickstart.json').toString())
      })

    it("should write a kickstart.json file to the kickstart folder", (t) => {
      assert.ok(t.newKickstart)
    })
    it("should write valid JSON", (t) => {
      assert.equal(typeof t.newKickstart, "object")
    })

    it("should properly write variables to the kickstart variables object", (t) => {
      const {variables} = t.newKickstart
      assert.ok(variables.adminEmail, "adminEmail")
      assert.ok(variables.adminPassword, "adminPassword")
      assert.ok(variables.applicationName, "applicationName")
      assert.ok(variables.saltPassword, "saltPassword")
      assert.ok(variables.apiKey, "apiKey")
      assert.ok(variables.asymmetricKeyId, "asymmetricKeyId")
      assert.ok(variables.applicationId, "applicationId")
      assert.ok(variables.clientSecret, "clientSecret")
      assert.ok(variables.defaultTenantId, "defaultTenantId")
      assert.ok(variables.adminUserId, "adminUserId")
    })

  })
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
    test(".env.default copies properly", () => {
      before(() => {
        mock({
          "myDir": {
            ".env.defaults": "has defaults"
          }
        })
      })
      const options = {
        postgresPass: crypto.randomUUID(),
        dbPass: crypto.randomUUID()
      }

      const expected = `has defaults\nPOSTGRES_PASSWORD=${options.postgresPass}\nDATABASE_PASSWORD=${options.dbPass}\nCLI_DIR=./myDir`

      createEnv("./myDir", options)
      assert.equal(fs.readFileSync('./myDir/.env').toString(), expected, "Environment strings don't match")
      })

  })
  describe("Directory is created with proper name", () => {
    test("When no name is specified, create directory at fusionauth")
  })

}