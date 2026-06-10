import { describe, test } from "node:test"
import assert from "node:assert/strict"

import { createConfig } from '../../src/utils.js'

import mock from 'mock-fs'
import fs, { readdirSync, readFileSync } from 'node:fs'

describe('postInstall runs properly', () => {
    test('No config creates dir', () => {
      mock({
        'dist': {},
      })
      try {
        const configFileExists = createConfig('dist/.fa')
        assert.equal(configFileExists, true, 'Config not created at dist/.fa/config.json')
      } finally {
        mock.restore()
      }
    })
    test('No dist directory, still create the directory and file', () => {
      mock({
        "./": {}
      })
      try {
        const configFileExists = createConfig('dist/.fa')
        assert.equal(configFileExists, true, 'Config not created at dist/.fa/config.json')
      } finally {
        mock.restore()
      }
    })
    test('No config creates full config file with expected types', () => {
      mock({
        'dist': {},
      })
      try {
        const configFileExists = createConfig('dist/.fa')
        const configObject = JSON.parse(readFileSync('dist/.fa/config.json'))
        assert(configObject.telemetry, true, 'Default telemetry not set to true')
        assert(typeof configObject.id, 'string', "ID doesn't exist or isn't a string")
      } finally {
        mock.restore()
      }
    })

    test('Complete config returns false', () => {
      mock({
        dist: {
          '.fa': {
            'config.json': JSON.stringify({id: '8c0a77f2-27e4-4284-b5d3-5618ec2a56eb', telemetry: true})
          }
        }
      })
      try {
        assert.equal(createConfig('dist/.fa'), false, 'Postinstall did not return false properly')
      } finally {
        mock.restore()
      }
    })
    test('No ID in config, but telemetry false', () => {
      mock({
        dist: {
          '.fa': {
            'config.json': JSON.stringify({telemetry: false})
          }
        }
      })
      try {
        createConfig('dist/.fa')
        const configObject = JSON.parse(fs.readFileSync('dist/.fa/config.json'))
        assert.equal(typeof configObject.id, 'string', 'No ID after run')
        assert.equal(configObject.telemetry, false, 'Telemetry got reset')
      } finally {
        mock.restore()
      }
    })
    test('No telemetry in config, but ID', () => {
      mock({
        dist: {
          '.fa': {
            'config.json': JSON.stringify({id: '8c0a77f2-27e4-4284-b5d3-5618ec2a56eb'})
          }
        }
      })
      try {
        createConfig('dist/.fa')
        const configObject = JSON.parse(fs.readFileSync('dist/.fa/config.json'))
        assert.equal(configObject.id, '8c0a77f2-27e4-4284-b5d3-5618ec2a56eb', 'ID got reset')
        assert.equal(configObject.telemetry, true, 'Telemetry did not get set')
      } finally {
        mock.restore()
      }
    })


})
