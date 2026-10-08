import { describe, test, beforeEach, afterEach, run } from 'node:test'
import assert from 'node:assert/strict'
import nock from 'nock'
import * as fs from 'node:fs'
import * as os from 'node:os'
import * as path from 'node:path'
import { executeUpdateAction, getData, setNestedProps, splitProp } from '../../src/commands/application/update.js'


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

describe("test action function", () => {

  test("no data or props should error", async () => {
    const result = await executeUpdateAction(APP_ID, {...BASE_OPTIONS})
    await assert.equal(result.success, false)
  })

  test("Prop option errors with improper syntax", async () => {
    const result = await executeUpdateAction(APP_ID, {...BASE_OPTIONS, prop: ["something"]})
    await assert.equal(result.success, false)
    // await assert.rejects(() => executeUpdateAction(APP_ID, {...BASE_OPTIONS, prop: ["something"]}))
  })

  test("errors when response isn't 200", async () => {
    const tmp = path.join(os.tmpdir() + "test.json")
    const testJSON = {
      application: {
        authenticationTokenConfiguration: {
          enabled: false
        },
        baseURL: "http://myurl.com3"
      }
    }
    fs.writeFileSync(tmp, JSON.stringify(testJSON, null, 2))

    nock(FA_HOST)
      .patch(`/api/application/${APP_ID}`)
      .reply(400, APP_RESPONSE)

    const propResult = await executeUpdateAction((APP_ID),  {...BASE_OPTIONS, prop: ["something=somethingelse"]})
    const dataResult = await executeUpdateAction((APP_ID),  {...BASE_OPTIONS, data: tmp})
    await assert.equal(propResult.success, false)
    await assert.equal(dataResult.success, false)
    
  })
  test("success when response is 200 for prop", async () => {
    const tmp = path.join(os.tmpdir() + "test.json")
    const testJSON = {
      application: {
        authenticationTokenConfiguration: {
          enabled: false
        },
        baseURL: "http://myurl.com3"
      }
    }
    fs.writeFileSync(tmp, JSON.stringify(testJSON, null, 2))

    nock(FA_HOST)
      .patch(`/api/application/${APP_ID}`)
      .reply(200, APP_RESPONSE)

    const dataResult = await executeUpdateAction((APP_ID),  {...BASE_OPTIONS, prop: ["something2=somethingelse"]})
    await assert.equal(dataResult.success, true)
    
  })
  test("success when response is 200 for prop", async () => {
    nock(FA_HOST)
      .patch(`/api/application/${APP_ID}`)
      .reply(200, APP_RESPONSE)

    const propResult = await executeUpdateAction((APP_ID),  {...BASE_OPTIONS, prop: ["something=somethingelse"]})
    await assert.equal(propResult.success, true)
    
  })


})

describe("test utiltiy functions for update", () => {
  test('getData functions', () => {
    const tmp = path.join(os.tmpdir() + "test.json")
    const testJSON = {
      application: {
        authenticationTokenConfiguration: {
          enabled: false
        },
        baseURL: "http://myurl.com3"
      }
    }

    try {
      fs.writeFileSync(tmp, JSON.stringify(testJSON, null, 2))
      const returnedData = getData(tmp)
      assert.deepEqual(returnedData, testJSON, "Data doesn't match")
    } catch(e) {
      console.log(e)
    } finally {
      fs.rmSync(tmp)
    }
  })
  test("setNestedProps functions properly", () => {
    let obj = {}
    const propString = "prop.propString"
    const propStringValue = "test"
    const propBool = "prop.propBool"
    const propBoolValue = false
    const propObject = "prop.propObject"
    const propObjValue = { name: "value" }
    const propArray = "prop.propArray"
    const propArrayValue = [1,2,3]

    const expectedObject = {
      prop: {
        propString: "test",
        propBool: false,
        propObject: { name: "value" },
        propArray: [1,2,3],
        deep: {
          deeper: {
            deepest: "string"
          }
        }
      }
    }

    setNestedProps(obj, propString, propStringValue)
    setNestedProps(obj, propBool, propBoolValue) 
    setNestedProps(obj, propObject, propObjValue)
    setNestedProps(obj, propArray, propArrayValue)
    setNestedProps(obj, "prop.deep.deeper.deepest", "string")
    assert.deepEqual(obj, expectedObject)
  }),
  test("splitProp works", () => {
    const simpleString = 'myVar=myValue'
    const actualObj = splitProp(simpleString)
    const expectedObj = { key: "myVar", value: "myValue"}
    assert.deepEqual(actualObj, expectedObj)
    const arrayString = 'myArray=["string", "string2", 1]'
    const actualArrayObj = splitProp(arrayString)
    const expectedArrayObj = { key: "myArray", value: ["string", "string2", 1]}
    assert.deepEqual(actualArrayObj, expectedArrayObj)
    const objString = 'myObj={"name": "hi"}'
    const actualObjObj = splitProp(objString)
    const expectedObjObj = { key: "myObj", value: {name: "hi"}}
    assert.deepEqual(actualObjObj, expectedObjObj)
  })
})
