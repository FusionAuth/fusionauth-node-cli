import { describe, test, before, after } from "node:test"

import assert from "node:assert"
import { 
  startFusionAuthContainer, 
  stopFusionAuthContainer,
  getUser,
  getTenant
} from "../setup.js"
import { executeAction } from "../../../dist/commands/apply.js"

/**
 * Display kickstart execution errors and warnings to console
 */
function displayKickstartErrors(result) {
  console.log('❌ Apply failed:', result.error)
  
  if (result.results?.steps) {
    console.log('\n📋 Kickstart execution details:')
    for (const step of result.results.steps) {
      if (step.status === 'error' || step.status === 'warning') {
        console.log(`\n  Step: ${step.id} (${step.action} ${step.request?.url})`)
        console.log(`  Status: ${step.status.toUpperCase()}`)
        console.log(`  Response Status: ${step.response?.status}`)
        
        if (step.error?.message) {
          console.log(`  Message: ${step.error.message}`)
        }
        
        if (step.response?.body?.fieldErrors) {
          console.log('  Field Errors:')
          for (const [field, fieldErrs] of Object.entries(step.response.body.fieldErrors)) {
            for (const err of fieldErrs) {
              console.log(`    - ${field}: ${err.message}`)
            }
          }
        }
        
        if (step.response?.body?.generalErrors && step.response.body.generalErrors.length > 0) {
          console.log('  General Errors:')
          for (const err of step.response.body.generalErrors) {
            console.log(`    - ${err.message || err}`)
          }
        }
      }
    }
  }
}

export function applyIntegration() {
  let fusionAuthUrl
  let apiKey

  // Test configuration
  const appId = '3c219e58-ed0e-4b18-ad48-f4f92793ae32'
  const tenantId = '886a57e0-f2ac-440a-9a9d-d10c17b6f1a1'

  // Static execute action options for POC
  const pocExecuteActionOptionsStatic = {
    file: '__tests__/integration/fixtures/kickstarts/poc/kickstart.json',
    quiet: true,
    logFile: 'kickstart-results-log.json',
    continueOnError: false
  }

  // Expected values for SMTP configuration
  const expectedSmtp = {
    host: 'smtp.sendgrid.net',
    port: 587,
    security: 'TLS',
    defaultFromEmail: 'poc@fusionauth.io'
  }

  // Expected admin user properties
  const expectedAdminUser = {
    email: 'admin@example.com',
    active: true,
    shouldHaveAdminRole: true
  }

  before(async () => {
    const container = await startFusionAuthContainer()
    fusionAuthUrl = container.url
    apiKey = container.apiKey
  })

  after(async () => {
    await stopFusionAuthContainer()
  })

  describe('Apply Command Integration Tests', () => {
    test('should properly configure SMTP server and create admin user from poc/kickstart.json test file.', async (t) => {
      // Merge static and dynamic options
      const pocExecuteActionOptions = {
        ...pocExecuteActionOptionsStatic,
        host: fusionAuthUrl,
        key: apiKey
      }

      const result = await executeAction(pocExecuteActionOptions)

      if (!result.success) {
        displayKickstartErrors(result)
        throw new Error(`Apply action failed: ${result.error}`)
      }

      // Verify SMTP configuration was properly persisted in test instance
      const tenant = await getTenant(tenantId, apiKey)
      
      assert(tenant.emailConfiguration, 'Tenant should have email configuration')
      assert.equal(tenant.emailConfiguration.host, expectedSmtp.host, `SMTP host should be correctly set to ${expectedSmtp.host}`)
      assert.equal(tenant.emailConfiguration.port, expectedSmtp.port, `SMTP port should be correctly set to ${expectedSmtp.port}`)
      assert.equal(tenant.emailConfiguration.security, expectedSmtp.security, `SMTP security should be correctly set to ${expectedSmtp.security}`)
      assert.equal(tenant.emailConfiguration.defaultFromEmail, expectedSmtp.defaultFromEmail, `Default from email should be correctly set to ${expectedSmtp.defaultFromEmail}`)
      assert(tenant.emailConfiguration.username !== undefined && tenant.emailConfiguration.username !== null, 'SMTP username should be configured')

      // Verify admin user was created with correct properties
      const retrievedUser = await getUser(expectedAdminUser.email, apiKey)
      assert.equal(retrievedUser.email, expectedAdminUser.email, `Admin user email should be set to ${expectedAdminUser.email}`)
      assert(retrievedUser.active === expectedAdminUser.active, `Admin user should be active`)
      assert(retrievedUser.registrations, 'Admin user should have application registrations')
      
      const adminRegistration = retrievedUser.registrations.find(r => r.applicationId === appId)
      assert(adminRegistration, 'Admin user should be registered to the created application')
      assert(adminRegistration.roles && adminRegistration.roles.includes('admin'), 'Admin user should have admin role for the application')
    })
  })
}
