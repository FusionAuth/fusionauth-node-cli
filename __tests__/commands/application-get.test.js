import { describe, test, beforeEach, afterEach, run } from 'node:test'
import assert, { throws } from 'node:assert/strict'
import nock from 'nock'
import * as fs from 'node:fs'
import * as os from 'node:os'
import * as path from 'node:path'
import { executeGet } from '../../src/commands/application/get.js'
import { chdir, cwd } from 'node:process'


beforeEach(() => {
  process.env.NODE_ENV = 'test'
  nock.cleanAll()
})

afterEach(() => {
  // Fail if any registered nock interceptors were not consumed
  assert(nock.isDone(), `Unused nock interceptors: ${JSON.stringify(nock.pendingMocks())}`)
})

const FA_HOST = 'http://localhost:9011'
const API_KEY = 'test-api-key'
const APP_ID = '3c219e58-ed0e-4b18-ad48-f4f92793ae32'

const APP_RESPONSE = {
  application: {
    id: APP_ID,
    name: 'Test App',
    oauthConfiguration: {
      clientId: APP_ID,
    },
  },
}



const BASE_OPTIONS = {
  key: API_KEY,
  host: FA_HOST,
}


describe('application:get options checks', () => {

  test('writes to default file when none provided', async () => {
    nock(FA_HOST)
        .get(`/api/application/${APP_ID}`)
        .reply(200, APP_RESPONSE)
    if (!fs.existsSync('./tmp')) fs.mkdirSync('./tmp')
    const tmp = path.resolve('./tmp')
    chdir(tmp)

    try {
      await executeGet(APP_ID, BASE_OPTIONS)
      const fileExists = fs.existsSync(tmp + '/' + APP_ID + '.json')
      assert.equal(fileExists, true, "Response file not created")
    } catch(e) {
      console.log(e)
    } finally {
      chdir('../')
      fs.rmSync(tmp, {recursive: true})
      nock.en
    }
    
  })
  test('writes to specified file when provided', async () => {
    nock(FA_HOST)
        .get(`/api/application/${APP_ID}`)
        .reply(200, APP_RESPONSE)
    
    const tmpRoot = fs.mkdtempSync(path.join(os.tmpdir(), `/test-app-${Date.now()}`))
    try {
      await executeGet(APP_ID, {...BASE_OPTIONS, output: tmpRoot + "/myFile.json"})
      const fileExists = fs.existsSync(tmpRoot + '/myFile.json')
      assert.equal(fileExists, true, "Response file not created")
    } catch(e) {
      console.log(e)
    } finally {
      fs.rmSync(tmpRoot, {recursive: true})
    }
    
  })

})