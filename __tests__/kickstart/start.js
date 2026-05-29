import test, { it,describe, after, before, beforeEach, afterEach } from "node:test"
import assert from "node:assert"
import fs, { readdirSync, readFileSync } from "node:fs"
import mock from "mock-fs"
import path, { dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

import {kickstartStartAction} from '../../dist/commands/kickstart-start.js'
import { createEnv, createKickstart, kickstartInstall, moveResources } from "../../dist/commands/kickstart-install.js";

import { __dirname } from "../../dist/utils.js";
import { execSync } from "node:child_process";

export function kickstartStart() {

  describe("Kickstart:start runs properly", () => {
    before(() => mock.restore())
    afterEach(() => {
      mock?.restore()
    })
    test("Docker throws error when it doesn't connect properly", async (t) => {
      before(() => {
        mock.restore()
        // Sets up docker to interfere with ports
        execSync("docker run -d --name my-apache-app -p 9011:80 -v $(PWD)/website:/usr/local/apache2/htdocs/ httpd:latest")
        
        // properly sets up files to run FA docker
        t.envContents = fs.readFileSync('./.env').toString()
        fs.writeFileSync('./kickstart/kickstart.json', fs.readFileSync(path.resolve('./__tests__/resources/kickstart.json')))
        fs.writeFileSync('./docker-compose.yml', fs.readFileSync(path.resolve('./dist/commands/resources/kickstart/fusionauth/docker-compose.yml')).toString())
        fs.appendFileSync("./.env", `OPENSEARCH_JAVA_OPTS="-Xms512m -Xmx512m"\n
            FUSIONAUTH_APP_MEMORY=512M\n
            FUSIONAUTH_APP_RUNTIME_MODE=development\n
            FUSIONAUTH_APP_KICKSTART_FILE=/usr/local/fusionauth/kickstart/kickstart.json\n
            FUSIONAUTH_APP_INSTALLATION_SOURCE=fusionauth-node-cli\n
            POSTGRES_USER=postgres\n
            DATABASE_USERNAME=fusionauth\n

            POSTGRES_PASSWORD=29587d14-0cc7-40f8-8bc9-292044a4688e\n
            DATABASE_PASSWORD=99b8a98f-3cf4-4cb1-9114-c52158a4f4a5\n
            CLI_DIR=/Users/bryanrobinson/Documents/Dev/cli-test/mytest`)
        process.env.CLI_DIR = path.resolve('./')

      
      })
      after(() => {
        fs.writeFileSync("./.env", t.envContents)
        fs.rmSync('./docker-compose.yml')
        execSync('docker stop my-apache-app && docker rm my-apache-app')
      })
      assert.rejects(kickstartStartAction())
      // const startPage = await fetch('http://localhost:9011')
      // assert.equal(startPage.status, 200, "localhost:9011 is not returning 200")
    })
    
  })

}