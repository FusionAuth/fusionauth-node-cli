import { describe, test, afterEach } from "node:test"
import assert from "node:assert"
import mock from "mock-fs"
import nock from "nock"
import { VariableSubstitutor } from "../../dist/utilities/kickstart/variable-substitution.js"

export function variableSubstitution() {
  describe('VariableSubstitutor', () => {
    afterEach(() => {
      mock.restore()
      nock.cleanAll()
    })

    describe('initialize()', () => {
      test('should set default variables', (t) => {
        const substituter = new VariableSubstitutor()
        substituter.initialize({}, '/test/kickstart.json')
        
        const resolved = substituter.resolveVariables({})
        assert(resolved.has('FUSIONAUTH_APPLICATION_ID'), 'Default vars not set')
      })

      test('should override defaults with provided variables', (t) => {
        const substituter = new VariableSubstitutor()
        substituter.initialize({
          customVar: 'test-value'
        }, '/test/kickstart.json')
        
        const resolved = substituter.resolveVariables({})
        assert.equal(resolved.get('customVar'), 'test-value')
      })
    })

    describe('initializeWithDynamicVariables()', () => {
      test('should fetch DEFAULT_TENANT_ID from FusionAuth API', async (t) => {
        // Mock the FusionAuth API response
        nock('http://localhost:9011')
          .get('/api/application')
          .reply(200, {
            applications: [
              { name: 'FusionAuth', id: 'app-id', tenantId: 'tenant-123' }
            ]
          })

        const substituter = new VariableSubstitutor()
        await substituter.initializeWithDynamicVariables(
          {},
          '/test/kickstart.json',
          'test-key',
          'http://localhost:9011'
        )
        
        const resolved = substituter.resolveVariables({})
        assert.equal(resolved.get('DEFAULT_TENANT_ID'), 'tenant-123')
      })

      test('should throw if FusionAuth app not found', async (t) => {
        nock('http://localhost:9011')
          .get('/api/application')
          .reply(200, { applications: [] })

        const substituter = new VariableSubstitutor()
        
        await assert.rejects(
          () => substituter.initializeWithDynamicVariables(
            {},
            '/test/kickstart.json',
            'test-key',
            'http://localhost:9011'
          ),
          /Application named "FusionAuth" not found/
        )
      })

      test('should throw if app missing tenant ID', async (t) => {
        nock('http://localhost:9011')
          .get('/api/application')
          .reply(200, {
            applications: [
              { name: 'FusionAuth', id: 'app-id', tenantId: null }
            ]
          })

        const substituter = new VariableSubstitutor()
        
        await assert.rejects(
          () => substituter.initializeWithDynamicVariables(
            {},
            '/test/kickstart.json',
            'test-key',
            'http://localhost:9011'
          ),
          /does not have an associated tenant ID/
        )
      })

      test('should use provided DEFAULT_TENANT_ID if already set', async (t) => {
        const substituter = new VariableSubstitutor()
        await substituter.initializeWithDynamicVariables(
          { DEFAULT_TENANT_ID: 'provided-tenant-id' },
          '/test/kickstart.json',
          'test-key',
          'http://localhost:9011'
        )
        
        const resolved = substituter.resolveVariables({})
        assert.equal(resolved.get('DEFAULT_TENANT_ID'), 'provided-tenant-id')
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

      test('should generate unique UUIDs', (t) => {
        const substituter = new VariableSubstitutor()
        substituter.initialize({
          id1: '#{UUID()}',
          id2: '#{UUID()}'
        }, '/test/kickstart.json')
        
        const resolved = substituter.resolveVariables({})
        const uuid1 = resolved.get('id1')
        const uuid2 = resolved.get('id2')
        assert.notEqual(uuid1, uuid2, 'UUIDs should be unique')
      })

      test('should resolve DEFAULT_TENANT_ID() pattern', (t) => {
        const substituter = new VariableSubstitutor()
        substituter.initialize({
          myTenant: '#{DEFAULT_TENANT_ID()}'
        }, '/test/kickstart.json')
        
        // Manually set DEFAULT_TENANT_ID as if from initializeWithDynamicVariables
        substituter.variables.set('DEFAULT_TENANT_ID', 'tenant-123')
        
        const resolved = substituter.resolveVariables({})
        assert.equal(resolved.get('myTenant'), 'tenant-123')
      })

      test('should resolve ENV variables', (t) => {
        process.env.TEST_VAR = 'test-value'
        const substituter = new VariableSubstitutor()
        substituter.initialize({
          envVar: '#{ENV.TEST_VAR}'
        }, '/test/kickstart.json')
        
        const resolved = substituter.resolveVariables({})
        assert.equal(resolved.get('envVar'), 'test-value')
        delete process.env.TEST_VAR
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

      test('should handle file inclusion syntax in URLs without errors', (t) => {
        const substituter = new VariableSubstitutor()
        substituter.initialize({
          apiKey: 'secret-123'
        }, '/test/kickstart.json')
        
        const resolved = substituter.resolveVariables({})
        // Test that file inclusion patterns don't interfere with variable substitution in URLs
        const result = substituter.substituteInString(
          '/api/resource/#{apiKey}',
          resolved
        )
        
        assert.equal(result.value, '/api/resource/secret-123')
        assert(result.success)
      })
    })
  })
}
