import { describe, test } from "node:test"
import assert from "node:assert/strict"
import mock from "mock-fs"
import { KickstartValidator } from "../../../src/utilities/kickstart/validator.js"

describe('KickstartValidator', () => {

    describe('validateConfig()', () => {
      test('should reject non-object config', () => {
        const validator = new KickstartValidator()
        const result = validator.validateConfig(null)
        
        assert.equal(result.valid, false)
        assert(result.errors.length > 0)
        assert.equal(result.errors[0].category, 'schema_invalid')
      })

      test('should reject config without requests', () => {
        const validator = new KickstartValidator()
        const config = { variables: { myVar: 'value' } }
        const result = validator.validateConfig(config)
        
        assert.equal(result.valid, false)
        assert(result.errors.some(e => e.field === 'requests'))
      })

      test('should accept minimal valid config', () => {
        const validator = new KickstartValidator()
        const config = {
          requests: [
            {
              method: 'POST',
              url: '/api/application',
              body: { application: { name: 'Test' } }
            }
          ]
        }
        const result = validator.validateConfig(config)
        
        assert.equal(result.valid, true)
        assert.equal(result.errors.length, 0)
      })

      test('should accept config with variables', () => {
        const validator = new KickstartValidator()
        const config = {
          variables: { appId: 'app-123', tenantId: 'tenant-456' },
          requests: [
            {
              method: 'POST',
              url: '/api/application/#{appId}',
              body: { tenantId: '#{tenantId}' }
            }
          ]
        }
        const result = validator.validateConfig(config)
        
        assert.equal(result.valid, true)
      })

      test('should reject invalid variables structure', () => {
        const validator = new KickstartValidator()
        const config = {
          variables: 'not-an-object',
          requests: []
        }
        const result = validator.validateConfig(config)
        
        assert.equal(result.valid, false)
        assert(result.errors.some(e => e.field === 'variables'))
      })
    })

    describe('validateRequestsStructure()', () => {
      test('should reject empty requests array', () => {
        const validator = new KickstartValidator()
        const config = { requests: [] }
        const result = validator.validateConfig(config)
        
        assert.equal(result.valid, false)
        assert(result.errors.some(e => e.message.includes('cannot be empty')))
      })

      test('should reject request without method', () => {
        const validator = new KickstartValidator()
        const config = {
          requests: [
            { url: '/api/application' }
          ]
        }
        const result = validator.validateConfig(config)
        
        assert.equal(result.valid, false)
        assert(result.errors.some(e => e.message.includes('method')))
      })

      test('should reject request without URL', () => {
        const validator = new KickstartValidator()
        const config = {
          requests: [
            { method: 'POST' }
          ]
        }
        const result = validator.validateConfig(config)
        
        assert.equal(result.valid, false)
        assert(result.errors.some(e => e.message.includes('url')))
      })

      test('should accept valid HTTP methods', () => {
        const validator = new KickstartValidator()
        const methods = ['POST', 'PUT', 'PATCH']
        
        methods.forEach(method => {
          const config = {
            requests: [
              { method, url: '/api/application' }
            ]
          }
          const result = validator.validateConfig(config)
          assert.equal(result.valid, true, `Method ${method} should be valid`)
        })
      })

      test('should reject invalid body type', () => {
        const validator = new KickstartValidator()
        const config = {
          requests: [
            { method: 'POST', url: '/api/app', body: 'not-an-object' }
          ]
        }
        const result = validator.validateConfig(config)
        
        assert.equal(result.valid, false)
        assert(result.errors.some(e => e.message.includes('Body must be an object')))
      })

      test('should accept optional contentType', () => {
        const validator = new KickstartValidator()
        const config = {
          requests: [
            { method: 'POST', url: '/api/app', contentType: 'application/json' }
          ]
        }
        const result = validator.validateConfig(config)
        
        assert.equal(result.valid, true)
      })

      test('should accept optional tenantId', () => {
        const validator = new KickstartValidator()
        const config = {
          requests: [
            { method: 'POST', url: '/api/app', tenantId: 'tenant-123' }
          ]
        }
        const result = validator.validateConfig(config)
        
        assert.equal(result.valid, true)
      })
    })

    describe('validateVariableReferences()', () => {
      test('should detect undefined variables in body', () => {
        const validator = new KickstartValidator()
        const config = {
          requests: [
            { 
              method: 'POST', 
              url: '/api/app', 
              body: { name: '#{missingName}' } 
            }
          ]
        }
        const result = validator.validateConfig(config)
        
        assert.equal(result.valid, false)
        assert(result.errors.some(e => e.message.includes('missingName')))
      })

      test('should allow defined variables', () => {
        const validator = new KickstartValidator()
        const config = {
          variables: { appId: 'app-123' },
          requests: [
            { method: 'POST', url: '/api/app/#{appId}' }
          ]
        }
        const result = validator.validateConfig(config)
        
        assert.equal(result.valid, true)
      })

      test('should allow default variables', () => {
        const validator = new KickstartValidator()
        const config = {
          requests: [
            { 
              method: 'POST', 
              url: '/api/app/#{FUSIONAUTH_APPLICATION_ID}',
              body: { 
                tenantId: '#{FUSIONAUTH_TENANT_ID}',
                managerId: '#{TENANT_MANAGER_ID}'
              }
            }
          ]
        }
        const result = validator.validateConfig(config)
        
        assert.equal(result.valid, true)
      })

      test('should allow UUID() pattern', () => {
        const validator = new KickstartValidator()
        const config = {
          requests: [
            { method: 'POST', url: '/api/app/#{UUID()}' }
          ]
        }
        const result = validator.validateConfig(config)
        
        assert.equal(result.valid, true)
      })

      test('should allow DEFAULT_TENANT_ID() pattern', () => {
        const validator = new KickstartValidator()
        const config = {
          requests: [
            { method: 'POST', url: '/api/app/#{DEFAULT_TENANT_ID()}' }
          ]
        }
        const result = validator.validateConfig(config)
        
        assert.equal(result.valid, true)
      })
      
      test('should detect multiple undefined variables', () => {
        const validator = new KickstartValidator()
        const config = {
          requests: [
            { 
              method: 'POST', 
              url: '/api/app',
              body: { 
                field1: '#{missing1}',
                field2: '#{missing2}'
              }
            }
          ]
        }
        const result = validator.validateConfig(config)
        
        assert.equal(result.valid, false)
        assert(result.errors.filter(e => e.category === 'variable_not_defined').length >= 2)
      })

      test('should extract variables from nested objects', () => {
        const validator = new KickstartValidator()
        const config = {
          variables: { userId: 'user-123' },
          requests: [
            {
              method: 'POST',
              url: '/api/user',
              body: {
                user: {
                  id: '#{userId}',
                  metadata: {
                    created: '#{undefinedVar}'
                  }
                }
              }
            }
          ]
        }
        const result = validator.validateConfig(config)
        
        assert.equal(result.valid, false)
        assert(result.errors.some(e => e.message.includes('undefinedVar')))
      })

      test('should extract variables from arrays in body', () => {
        const validator = new KickstartValidator()
        const config = {
          variables: { id1: 'val1' },
          requests: [
            {
              method: 'POST',
              url: '/api/list',
              body: {
                items: [
                  { id: '#{id1}' },
                  { id: '#{missingId}' }
                ]
              }
            }
          ]
        }
        const result = validator.validateConfig(config)
        
        assert.equal(result.valid, false)
        assert(result.errors.some(e => e.message.includes('missingId')))
      })
    })

    describe('validateFileExists()', () => {
      test('should report error for missing file', () => {
        const validator = new KickstartValidator()
        const result = validator.validateFileExists('/nonexistent/file.json')
        
        assert.equal(result.valid, false)
        assert(result.errors.some(e => e.category === 'file_not_found'))
      })

      test('should accept existing file', () => {
        mock({
          '/test/kickstart.json': '{"requests": []}'
        })
        try {
          const validator = new KickstartValidator()
          const result = validator.validateFileExists('/test/kickstart.json')
          
          assert.equal(result.valid, true)
          assert.equal(result.errors.length, 0)
        } finally {
          mock.restore()
        }
      })

      test('should report error if path is directory', () => {
        mock({
          '/test/': {}
        })
        try {
          const validator = new KickstartValidator()
          const result = validator.validateFileExists('/test')
          
          assert.equal(result.valid, false)
          assert(result.errors.some(e => e.message.includes('not a file')))
        } finally {
          mock.restore()
        }
      })
    })

    describe('loadAndValidateJSON()', () => {
      test('should return error if file not found', () => {
        const validator = new KickstartValidator()
        const result = validator.loadAndValidateJSON('/nonexistent.json')
        
        assert.equal(result.valid, false)
        assert(result.errors.some(e => e.category === 'file_not_found'))
      })

      test('should return error if JSON is invalid', () => {
        mock({
          '/test/bad.json': '{ invalid json }'
        })
        try {
          const validator = new KickstartValidator()
          const result = validator.loadAndValidateJSON('/test/bad.json')
          
          assert.equal(result.valid, false)
          assert(result.errors.some(e => e.category === 'schema_invalid'))
        } finally {
          mock.restore()
        }
      })

      test('should load and parse valid JSON', () => {
        const config = {
          requests: [
            { method: 'POST', url: '/api/app' }
          ]
        }
        mock({
          '/test/valid.json': JSON.stringify(config)
        })
        try {
          const validator = new KickstartValidator()
          const result = validator.loadAndValidateJSON('/test/valid.json')
          
          assert('config' in result)
          assert.equal(result.config.requests.length, 1)
          assert('lineNumbers' in result)
        } finally {
          mock.restore()
        }
      })

      test('should include line numbers in result', () => {
        const config = {
          requests: [
            { method: 'POST', url: '/api/app1' },
            { method: 'POST', url: '/api/app2' }
          ]
        }
        mock({
          '/test/valid.json': JSON.stringify(config)
        })
        try {
          const validator = new KickstartValidator()
          const result = validator.loadAndValidateJSON('/test/valid.json')
          
          assert('lineNumbers' in result)
        } finally {
          mock.restore()
        }
      })
    })
  })
