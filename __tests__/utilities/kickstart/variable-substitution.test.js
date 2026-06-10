import { describe, test, afterEach } from "node:test"
import assert from "node:assert"
import nock from "nock"
import mock from 'mock-fs'
import { VariableSubstitutor } from "../../../src/utilities/kickstart/variable-substitution.js"

describe('VariableSubstitutor', () => {
    afterEach(() => {
      nock.cleanAll()
    })

    describe('initialize()', () => {
      test('should fetch FUSIONAUTH_APPLICATION_ID', (t) => {
        const substituter = new VariableSubstitutor()
        substituter.initialize({}, '/test/kickstart.json')
        
        const resolved = substituter.resolveVariables({})
        
        assert(resolved.has('FUSIONAUTH_APPLICATION_ID'), 'FUSIONAUTH_APPLICATION_ID not set')
        assert.equal(resolved.get('FUSIONAUTH_APPLICATION_ID'), '3c219e58-ed0e-4b18-ad48-f4f92793ae32')
      })

      test('should fetch FUSIONAUTH_TENANT_ID', (t) => {
        const substituter = new VariableSubstitutor()
        substituter.initialize({}, '/test/kickstart.json')
        
        const resolved = substituter.resolveVariables({})
        
        assert(resolved.has('FUSIONAUTH_TENANT_ID'), 'FUSIONAUTH_TENANT_ID not set')
        assert.equal(resolved.get('FUSIONAUTH_TENANT_ID'), '886a57e0-f2ac-440a-9a9d-d10c17b6f1a1')
      })

      test('should fetch TENANT_MANAGER_ID', (t) => {
        const substituter = new VariableSubstitutor()
        substituter.initialize({}, '/test/kickstart.json')
        
        const resolved = substituter.resolveVariables({})
        
        assert(resolved.has('TENANT_MANAGER_ID'), 'TENANT_MANAGER_ID not set')
        assert.equal(resolved.get('TENANT_MANAGER_ID'), '9ab52a6b-6abc-4aea-8f7b-525156b2ef73')
      })
    })

    describe('resolveVariables()', () => {
      test('should resolve UUID() pattern', (t) => {
        const substituter = new VariableSubstitutor()
        substituter.initialize({
          myId: '#{UUID()}'
        }, '/test/kickstart.json')
        
        const resolved = substituter.resolveVariables({})
        const id = resolved.get('myId')
        assert(id && typeof id === 'string' && id.length === 36, 'UUID not generated')
      })

      test('should resolve DEFAULT_TENANT_ID() pattern from a FusionAuth instance', async (t) => {
        // Mock the FusionAuth API response
        nock('http://mocktestserver')
          .get('/api/application')
          .reply(200, {
            applications: [
              { name: 'FusionAuth', id: '3c219e58-ed0e-4b18-ad48-f4f92793ae32', tenantId: '886a57e0-f2ac-440a-9a9d-d10c17b6f1a1' }
            ]
          })

        const substituter = new VariableSubstitutor()
        await substituter.initializeWithDynamicVariables(
          {},
          '/test/kickstart.json',
          'test-key',
          'http://mocktestserver'
        )
        
        const resolved = substituter.resolveVariables({})
        assert.equal(resolved.get('DEFAULT_TENANT_ID'), '886a57e0-f2ac-440a-9a9d-d10c17b6f1a1')
      })
    
      test('should resolve ENV variables', (t) => {
        process.env.TEST_VAR = 'test-value'
        try {
          const substituter = new VariableSubstitutor()
          substituter.initialize({
            envVar: '#{ENV.TEST_VAR}'
          }, '/test/kickstart.json')
          
          const resolved = substituter.resolveVariables({})
          assert.equal(resolved.get('envVar'), 'test-value')
        } finally {
          delete process.env.TEST_VAR
        }
      })

      test('should handle missing ENV variables', (t) => {
        const substituter = new VariableSubstitutor()
        substituter.initialize({
          envVar: '#{ENV.NONEXISTENT_VAR_XYZ}'
        }, '/test/kickstart.json')
        
        const resolved = substituter.resolveVariables({})
        assert.equal(resolved.get('envVar'), '#{ENV.NONEXISTENT_VAR_XYZ}')
      })
    })

    describe('substituteInString()', () => {
      test('should substitute simple variables', (t) => {
        const substituter = new VariableSubstitutor()
        substituter.initialize({
          apiKey: 'secret-123'
        }, '/test/kickstart.json')
        
        const resolved = substituter.resolveVariables({})
        const result = substituter.substituteInString('/api/config/#{apiKey}', resolved)
        
        assert.equal(result.value, '/api/config/secret-123')
        assert.equal(result.success, true)
      })

      test('should substitute multiple variables in one string', (t) => {
        const substituter = new VariableSubstitutor()
        substituter.initialize({
          tenant: 'tenant-123',
          resource: 'users'
        }, '/test/kickstart.json')
        
        const resolved = substituter.resolveVariables({})
        const result = substituter.substituteInString(
          '/api/tenant/#{tenant}/#{resource}',
          resolved
        )
        
        assert.equal(result.value, '/api/tenant/tenant-123/users')
      })

      test('should handle unresolved variables', (t) => {
        const substituter = new VariableSubstitutor()
        substituter.initialize({}, '/test/kickstart.json')
        
        const resolved = substituter.resolveVariables({})
        const result = substituter.substituteInString('Value: #{unknownVar}', resolved)
        
        assert.equal(result.success, false)
        assert(result.errors.length > 0, 'No error reported for missing var')
      })

      test('should handle numeric type hints', (t) => {
        const substituter = new VariableSubstitutor()
        substituter.initialize({
          port: 9011
        }, '/test/kickstart.json')
        
        const resolved = substituter.resolveVariables({})
        const result = substituter.substituteInString(
          'http://localhost:#{port?number}',
          resolved
        )
        
        assert.equal(result.value, 'http://localhost:9011')
      })
    })

    describe('substituteRequest()', () => {
      test('should substitute URL and body', (t) => {
        const substituter = new VariableSubstitutor()
        substituter.initialize({
          tenantId: 'tenant-123',
          email: 'test@example.com'
        }, '/test/kickstart.json')
        
        const resolved = substituter.resolveVariables({})
        const request = {
          method: 'PATCH',
          url: '/api/tenant/#{tenantId}',
          body: { tenant: { admin: '#{email}' } }
        }
        
        const result = substituter.substituteRequest(request, resolved)
        assert.equal(result.request.url, '/api/tenant/tenant-123')
        assert.equal(result.request.body.tenant.admin, 'test@example.com')
      })

      test('should handle JSON body substitution', (t) => {
        const substituter = new VariableSubstitutor()
        substituter.initialize({
          templateId: 'tpl-456'
        }, '/test/kickstart.json')
        
        const resolved = substituter.resolveVariables({})
        const request = {
          method: 'POST',
          url: '/api/template',
          body: {
            template: {
              id: '#{templateId}',
              name: 'Test Template'
            }
          }
        }
        
        const result = substituter.substituteRequest(request, resolved)
        assert.equal(result.request.body.template.id, 'tpl-456')
        assert.equal(result.request.body.template.name, 'Test Template')
      })

      test('should report errors for unresolved variables in requests', (t) => {
        const substituter = new VariableSubstitutor()
        substituter.initialize({}, '/test/kickstart.json')
        
        const resolved = substituter.resolveVariables({})
        const request = {
          method: 'PATCH',
          url: '/api/tenant/#{missingVar}',
          body: {}
        }
        
        const result = substituter.substituteRequest(request, resolved)
        assert(result.errors.length > 0, 'Should report error for missing variable')
      })
    })

    describe('File inclusions (@{} and ${})', () => {
      test('should report error for missing included file', (t) => {
        const substituter = new VariableSubstitutor()
        substituter.initialize({}, '/test/kickstart.json')
        
        const resolved = substituter.resolveVariables({})
        const result = substituter.substituteInString(
          '@{nonexistent/file.ftl}',
          resolved
        )
        
        assert(!result.success, 'Should fail for missing file')
        assert(result.errors.length > 0, 'Should report error')
      })

    })
  })
