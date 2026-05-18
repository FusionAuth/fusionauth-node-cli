import { describe, after, before, test, mock as mockit, beforeEach, afterEach } from "node:test"
import assert from "node:assert"

import { createConfig } from '../../dist/utils.js'

import mock from 'mock-fs'
import fs, { readdirSync, readFileSync } from 'node:fs'
import { json } from "node:stream/consumers"
import { config } from "node:process"
import { randomUUID } from "node:crypto"


export function postInstall() {
  

  describe('postInstall runs properly', () => {
    beforeEach(() => {
      mock({
        'dist': {},
      })
    })

    afterEach(() => {
      mock.restore();
    })

    test('No config creates dir', (t) => {
      const configFileExists = createConfig('dist/.fa')
      assert.equal(configFileExists, true, 'Config not created at dist/.fa/config.json')
    })
    test('No dist directory, still create the directory and file', (t) => {
      before(() => {
        mock({
          "./": {}
        })
      })
      const configFileExists = createConfig('dist/.fa')
      assert.equal(configFileExists, true, 'Config not created at dist/.fa/config.json')
    })
    test('No config creates full config file with expected types', (t) => {
      const configFileExists = createConfig('dist/.fa')
      const configObject = JSON.parse(readFileSync('dist/.fa/config.json'))
      assert(configObject.telemetry, true, 'Default telemetry not set to true')
      assert(typeof configObject.id, 'string', "ID doesn't exist or isn't a string")
    })

    test('Complete config returns false', (t) => {
      before(() => {
        mock({
          dist: {
            '.fa': {
              'config.json': JSON.stringify({id: '8c0a77f2-27e4-4284-b5d3-5618ec2a56eb', telemetry: true})
            }
          }
        })
      }) 
      assert.equal(createConfig('dist/.fa'), false, 'Postinstall did not return false properly')
    })
    test('No ID in config, but telemetry false', (t) => {
      before(() => {
        mock({
          dist: {
            '.fa': {
              'config.json': JSON.stringify({telemetry: false})
            }
          }
        })
      }) 
      createConfig('dist/.fa')
      const configObject = JSON.parse(fs.readFileSync('dist/.fa/config.json'))
      assert.equal(typeof configObject.id, 'string', 'No ID after run')
      assert.equal(configObject.telemetry, false, 'Telemetry got reset')
    })
    test('No telemetry in config, but ID', (t) => {
      before(() => {
        mock({
          dist: {
            '.fa': {
              'config.json': JSON.stringify({id: '8c0a77f2-27e4-4284-b5d3-5618ec2a56eb'})
            }
          }
        })
      }) 
      createConfig('dist/.fa')
      const configObject = JSON.parse(fs.readFileSync('dist/.fa/config.json'))
      assert.equal(configObject.id, '8c0a77f2-27e4-4284-b5d3-5618ec2a56eb', 'ID got reset')
      assert.equal(configObject.telemetry, true, 'Telemetry did not get set')
    })


  })


} 