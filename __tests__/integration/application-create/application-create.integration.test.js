import { describe, test, before, after, afterEach } from 'node:test'
import assert from 'node:assert/strict'
import {
  startFusionAuthContainer,
  stopFusionAuthContainer,
  getApplication,
  deleteApplication,
  captureSystemConfigurationBaseline,
  resetSystemConfiguration,
  makeApiRequest,
} from '../setup.js'
import { executeApplicationCreate } from '../../../src/commands/application-create.js'

const TENANT_ID = '886a57e0-f2ac-440a-9a9d-d10c17b6f1a1'
const REQUIRED_CORS_HEADERS = ['dpop', 'authorization', 'accept']
const REDIRECT_URI = 'https://example.com/callback'

describe('application:create integration tests', () => {
  let fusionAuthUrl
  let apiKey
  const createdApplicationIds = []

  before(async () => {
    const container = await startFusionAuthContainer()
    fusionAuthUrl = container.url
    apiKey = container.apiKey
    await captureSystemConfigurationBaseline(apiKey)
  })

  after(async () => {
    await stopFusionAuthContainer()
  })

  afterEach(async () => {
    // Delete any applications created during the test
    for (const id of createdApplicationIds.splice(0)) {
      try { await deleteApplication(id, apiKey) } catch (_) {}
    }
    // Restore CORS to the captured baseline
    await resetSystemConfiguration(apiKey)
  })

  function baseOptions(overrides = {}) {
    return {
      name: `Integration Test App ${Date.now()}`,
      key: apiKey,
      host: fusionAuthUrl,
      tenantId: TENANT_ID,
      // Bypasses the CORS-change confirmation prompt (spa/native profiles).
      // The confirmation gate itself is covered by unit tests; these
      // integration tests are focused on real API behavior.
      yes: true,
      ...overrides,
    }
  }

  function spaOptions(overrides = {}) {
    return baseOptions({ profile: 'spa', redirectUri: [REDIRECT_URI], ...overrides })
  }

  function webappOptions(overrides = {}) {
    return baseOptions({ profile: 'webapp', redirectUri: [REDIRECT_URI], ...overrides })
  }

  // Verifies the DPoP-related CORS headers required by spa/native profiles
  // were added to system configuration, and that CORS is enabled.
  async function assertCorsHeadersConfigured(apiKey) {
    const sysConfig = await makeApiRequest('GET', '/api/system-configuration', null, apiKey)
    const corsHeaders = (sysConfig.systemConfiguration.corsConfiguration?.allowedHeaders ?? [])
      .map(h => h.toLowerCase())
    for (const required of REQUIRED_CORS_HEADERS) {
      assert(corsHeaders.includes(required), `CORS allowedHeaders should contain '${required}'`)
    }
    assert.equal(sysConfig.systemConfiguration.corsConfiguration?.enabled, true)
  }

  // ---------------------------------------------------------------------------
  // Happy paths — one per profile
  // ---------------------------------------------------------------------------

  test('--profile spa creates application with correct settings and configures CORS', async () => {
    const result = await executeApplicationCreate(spaOptions())

    assert.equal(result.success, true, `Expected success but got: ${result.error}`)
    assert.ok(result.applicationId, 'applicationId should be set')
    assert.ok(result.clientId, 'clientId should be set')
    // Note: some FA versions generate a client secret even for public clients;
    // what matters is that authentication is not REQUIRED (enforced below).

    createdApplicationIds.push(result.applicationId)

    // Verify application settings were persisted correctly
    const app = await getApplication(result.applicationId, apiKey)
    assert.ok(app, 'application should exist in FusionAuth')
    assert.equal(app.oauthConfiguration.proofKeyForCodeExchangePolicy, 'Required')
    assert.equal(app.oauthConfiguration.clientAuthenticationPolicy, 'NotRequired')
    assert.equal(app.oauthConfiguration.requireClientAuthentication, false)
    assert.equal(app.oauthConfiguration.generateRefreshTokens, true)
    assert.equal(app.oauthConfiguration.requireRegistration, true)
    assert.deepEqual(app.oauthConfiguration.enabledGrants, ['authorization_code', 'refresh_token'])
    assert.deepEqual(app.oauthConfiguration.authorizedRedirectURLs, [REDIRECT_URI])
    assert.equal(app.jwtConfiguration.timeToLiveInSeconds, 300)
    assert.equal(app.jwtConfiguration.refreshTokenUsagePolicy, 'OneTimeUse')
    assert.equal(app.jwtConfiguration.refreshTokenExpirationPolicy, 'SlidingWindow')

    // Verify CORS headers were added to system configuration
    await assertCorsHeadersConfigured(apiKey)
  })

  test('--authorized-origin-url is added to the system CORS allowlist, not just the application', async () => {
    const origin = 'https://myapp.example.com'
    const result = await executeApplicationCreate(spaOptions({ authorizedOriginUrl: [origin] }))

    assert.equal(result.success, true, `Expected success but got: ${result.error}`)
    createdApplicationIds.push(result.applicationId)

    // The application-level setting (iframe/X-Frame-Options allowlist for
    // hosted pages) is a separate concern from the system CORS allowlist
    // below, but --authorized-origin-url should still populate it as before.
    const app = await getApplication(result.applicationId, apiKey)
    assert.deepEqual(app.oauthConfiguration.authorizedOriginURLs, [origin])

    // The system-wide CORS allowlist must also include it, or the browser
    // will block the spa's actual cross-origin requests to the API despite
    // CORS being "configured" (headers/enabled only, per the bug this
    // guards against).
    const sysConfig = await makeApiRequest('GET', '/api/system-configuration', null, apiKey)
    const allowedOrigins = sysConfig.systemConfiguration.corsConfiguration?.allowedOrigins ?? []
    assert(allowedOrigins.includes(origin), `system CORS allowedOrigins should contain '${origin}'`)
  })

  test('--profile native creates application with correct settings and configures CORS', async () => {
    const result = await executeApplicationCreate(baseOptions({
      profile: 'native',
      redirectUri: ['myapp://callback'],
    }))

    assert.equal(result.success, true, `Expected success but got: ${result.error}`)
    // Note: some FA versions generate a client secret even for public clients;
    // what matters is that authentication is not REQUIRED (enforced below).

    createdApplicationIds.push(result.applicationId)

    const app = await getApplication(result.applicationId, apiKey)
    assert.equal(app.oauthConfiguration.proofKeyForCodeExchangePolicy, 'Required')
    assert.equal(app.oauthConfiguration.clientAuthenticationPolicy, 'NotRequired')
    assert.equal(app.oauthConfiguration.requireRegistration, true)
    assert.deepEqual(app.oauthConfiguration.authorizedRedirectURLs, ['myapp://callback'])
    assert.equal(app.jwtConfiguration.timeToLiveInSeconds, 300)

    // CORS must also be configured for native
    await assertCorsHeadersConfigured(apiKey)
  })

  test('--profile webapp creates confidential client and returns clientSecret', async () => {
    const result = await executeApplicationCreate(webappOptions())

    assert.equal(result.success, true, `Expected success but got: ${result.error}`)
    assert.ok(result.clientSecret, 'webapp should have a client secret')

    createdApplicationIds.push(result.applicationId)

    const app = await getApplication(result.applicationId, apiKey)
    assert.equal(app.oauthConfiguration.proofKeyForCodeExchangePolicy, 'NotRequiredWhenUsingClientAuthentication')
    assert.equal(app.oauthConfiguration.clientAuthenticationPolicy, 'Required')
    assert.equal(app.oauthConfiguration.requireClientAuthentication, true)
    assert.equal(app.oauthConfiguration.requireRegistration, true)
    assert.equal(app.jwtConfiguration.timeToLiveInSeconds, 3600)
    assert.equal(app.jwtConfiguration.refreshTokenUsagePolicy, 'OneTimeUse')
    assert.equal(app.jwtConfiguration.refreshTokenExpirationPolicy, 'SlidingWindow')
  })

  test('--data custom mode creates application with provided configuration', async () => {
    const customApp = {
      oauthConfiguration: {
        enabledGrants: ['authorization_code', 'refresh_token'],
        authorizedRedirectURLs: ['https://custom.example.com/cb'],
        generateRefreshTokens: true,
      },
    }

    const result = await executeApplicationCreate(baseOptions({
      data: JSON.stringify(customApp),
    }))

    assert.equal(result.success, true, `Expected success but got: ${result.error}`)

    createdApplicationIds.push(result.applicationId)

    const app = await getApplication(result.applicationId, apiKey)
    assert.deepEqual(
      app.oauthConfiguration.authorizedRedirectURLs,
      ['https://custom.example.com/cb']
    )
    assert(
      app.oauthConfiguration.enabledGrants.includes('authorization_code'),
      'should include authorization_code grant'
    )
  })

  // ---------------------------------------------------------------------------
  // CORS idempotency
  // ---------------------------------------------------------------------------

  test('running spa create twice does not duplicate CORS headers', async () => {
    // First create
    const result1 = await executeApplicationCreate(spaOptions())
    assert.equal(result1.success, true)
    createdApplicationIds.push(result1.applicationId)

    // Second create without resetting CORS
    const result2 = await executeApplicationCreate(spaOptions({ redirectUri: ['https://example.com/callback2'] }))
    assert.equal(result2.success, true)
    createdApplicationIds.push(result2.applicationId)

    const sysConfig = await makeApiRequest('GET', '/api/system-configuration', null, apiKey)
    const corsHeaders = sysConfig.systemConfiguration.corsConfiguration?.allowedHeaders ?? []
    const corsHeadersLower = corsHeaders.map(h => h.toLowerCase())

    // Each required header should appear exactly once
    for (const required of REQUIRED_CORS_HEADERS) {
      const count = corsHeadersLower.filter(h => h === required).length
      assert.equal(count, 1, `'${required}' should appear exactly once in CORS allowedHeaders, got ${count}`)
    }
  })

  // ---------------------------------------------------------------------------
  // Regression: tenant header scoping (live server)
  // Confirms /api/system-configuration actually accepts the request without
  // the X-FusionAuth-TenantId header, which was the root cause of the 401.
  // ---------------------------------------------------------------------------

  test('system-configuration is reachable without tenant header when --tenant-id is provided', async () => {
    // If the tenant header were incorrectly sent to /api/system-configuration,
    // this would fail with 401 — exactly the bug we fixed.
    // (--tenant-id is already the default in baseOptions()/spaOptions().)
    const result = await executeApplicationCreate(spaOptions())
    assert.equal(result.success, true, `Expected success but got: ${result.error}`)
    createdApplicationIds.push(result.applicationId)
  })

  // ---------------------------------------------------------------------------
  // --application-id override
  // ---------------------------------------------------------------------------

  test('--application-id is respected and application is created with that ID', async () => {
    const customId = 'a1b2c3d4-e5f6-7890-abcd-ef1234567890'
    const result = await executeApplicationCreate(webappOptions({ applicationId: customId }))

    assert.equal(result.success, true, `Expected success but got: ${result.error}`)
    assert.equal(result.applicationId, customId)

    createdApplicationIds.push(customId)

    const app = await getApplication(customId, apiKey)
    assert.ok(app, 'application should exist with the specified ID')
    assert.equal(app.id, customId)
  })
})
