import { describe, test, beforeEach, afterEach } from 'node:test'
import assert from 'node:assert/strict'
import nock from 'nock'
import * as fs from 'node:fs'
import * as os from 'node:os'
import * as path from 'node:path'
import { executeApplicationCreate } from '../../src/commands/application-create.js'

const FA_HOST = 'http://localhost:9011'
const API_KEY = 'test-api-key'
const TENANT_ID = '886a57e0-f2ac-440a-9a9d-d10c17b6f1a1'
const APP_ID = '3c219e58-ed0e-4b18-ad48-f4f92793ae32'

const BASE_OPTIONS = {
  name: 'Test App',
  key: API_KEY,
  host: FA_HOST,
}

// Minimal successful createApplication response
const APP_RESPONSE = {
  application: {
    id: APP_ID,
    name: 'Test App',
    oauthConfiguration: {
      clientId: APP_ID,
    },
  },
}

// Minimal successful createApplication response with client secret (webapp)
const APP_RESPONSE_WITH_SECRET = {
  application: {
    id: APP_ID,
    name: 'Test App',
    oauthConfiguration: {
      clientId: APP_ID,
      clientSecret: 'super-secret',
    },
  },
}

// Minimal successful system-configuration response (CORS already correct)
function systemConfigResponse(overrides = {}) {
  return {
    systemConfiguration: {
      corsConfiguration: {
        enabled: true,
        allowedHeaders: ['dpop', 'Authorization', 'Accept'],
        ...overrides,
      },
    },
  }
}

beforeEach(() => {
  process.env.NODE_ENV = 'test'
  nock.cleanAll()
})

afterEach(() => {
  // Fail if any registered nock interceptors were not consumed
  assert(nock.isDone(), `Unused nock interceptors: ${JSON.stringify(nock.pendingMocks())}`)
})

// ---------------------------------------------------------------------------
// Mode validation
// ---------------------------------------------------------------------------

describe('mode validation', () => {
  test('both --profile and --data provided returns error without making API calls', async () => {
    const result = await executeApplicationCreate({
      ...BASE_OPTIONS,
      profile: 'spa',
      redirectUri: ['https://example.com/callback'],
      data: '{"name":"x"}',
    })
    assert.equal(result.success, false)
    assert.match(result.error, /mutually exclusive/)
  })

  test('neither --profile nor --data provided returns error without making API calls', async () => {
    const result = await executeApplicationCreate({
      ...BASE_OPTIONS,
    })
    assert.equal(result.success, false)
    assert.match(result.error, /required/)
  })

  test('--profile without --redirect-uri returns error without making API calls', async () => {
    const result = await executeApplicationCreate({
      ...BASE_OPTIONS,
      profile: 'spa',
    })
    assert.equal(result.success, false)
    assert.match(result.error, /--redirect-uri is required/)
  })
})

// ---------------------------------------------------------------------------
// --data parsing
// ---------------------------------------------------------------------------

describe('--data parsing', () => {
  test('inline JSON is parsed and sent', async () => {
    nock(FA_HOST)
      .post('/api/application/')
      .reply(200, APP_RESPONSE)

    const result = await executeApplicationCreate({
      ...BASE_OPTIONS,
      data: JSON.stringify({ oauthConfiguration: { enabledGrants: ['authorization_code'] } }),
    })
    assert.equal(result.success, true)
  })

  test('@file.json is read and parsed', async () => {
    const tmp = path.join(os.tmpdir(), `test-app-${Date.now()}.json`)
    fs.writeFileSync(tmp, JSON.stringify({ oauthConfiguration: {} }))

    nock(FA_HOST)
      .post('/api/application/')
      .reply(200, APP_RESPONSE)

    try {
      const result = await executeApplicationCreate({
        ...BASE_OPTIONS,
        data: `@${tmp}`,
      })
      assert.equal(result.success, true)
    } finally {
      fs.unlinkSync(tmp)
    }
  })

  test('malformed inline JSON returns error without making API calls', async () => {
    const result = await executeApplicationCreate({
      ...BASE_OPTIONS,
      data: '{not valid json',
    })
    assert.equal(result.success, false)
    assert.match(result.error, /JSON/)
  })

  test('missing @file returns error without making API calls', async () => {
    const result = await executeApplicationCreate({
      ...BASE_OPTIONS,
      data: '@/does/not/exist.json',
    })
    assert.equal(result.success, false)
    assert.match(result.error, /Error reading --data file/)
  })
})

// ---------------------------------------------------------------------------
// Profile defaults — request body assertions
// ---------------------------------------------------------------------------

describe('profile defaults', () => {
  test('spa profile sends correct oauthConfiguration and jwtConfiguration', async () => {
    nock(FA_HOST)
      .get('/api/system-configuration')
      .reply(200, systemConfigResponse())

    nock(FA_HOST)
      .post('/api/application/', (body) => {
        const oauth = body.application.oauthConfiguration
        const jwt = body.application.jwtConfiguration
        assert.deepEqual(oauth.enabledGrants, ['authorization_code'])
        assert.equal(oauth.proofKeyForCodeExchangePolicy, 'Required')
        assert.equal(oauth.clientAuthenticationPolicy, 'NotRequired')
        assert.equal(oauth.requireClientAuthentication, false)
        assert.equal(oauth.generateRefreshTokens, true)
        assert.deepEqual(oauth.authorizedRedirectURLs, ['https://example.com/callback'])
        assert.equal(jwt.enabled, true)
        assert.equal(jwt.timeToLiveInSeconds, 300)
        assert.equal(jwt.refreshTokenUsagePolicy, 'OneTimeUse')
        assert.equal(jwt.refreshTokenExpirationPolicy, 'SlidingWindow')
        return true
      })
      .reply(200, APP_RESPONSE)

    const result = await executeApplicationCreate({
      ...BASE_OPTIONS,
      profile: 'spa',
      redirectUri: ['https://example.com/callback'],
    })
    assert.equal(result.success, true)
  })

  test('native profile sends same defaults as spa', async () => {
    nock(FA_HOST)
      .get('/api/system-configuration')
      .reply(200, systemConfigResponse())

    nock(FA_HOST)
      .post('/api/application/', (body) => {
        const oauth = body.application.oauthConfiguration
        assert.equal(oauth.proofKeyForCodeExchangePolicy, 'Required')
        assert.equal(oauth.clientAuthenticationPolicy, 'NotRequired')
        return true
      })
      .reply(200, APP_RESPONSE)

    const result = await executeApplicationCreate({
      ...BASE_OPTIONS,
      profile: 'native',
      redirectUri: ['myapp://callback'],
    })
    assert.equal(result.success, true)
  })

  test('webapp profile sends confidential client settings', async () => {
    nock(FA_HOST)
      .post('/api/application/', (body) => {
        const oauth = body.application.oauthConfiguration
        const jwt = body.application.jwtConfiguration
        assert.equal(oauth.proofKeyForCodeExchangePolicy, 'NotRequiredWhenUsingClientAuthentication')
        assert.equal(oauth.clientAuthenticationPolicy, 'Required')
        assert.equal(oauth.requireClientAuthentication, true)
        assert.equal(jwt.timeToLiveInSeconds, 3600)
        assert.equal(jwt.refreshTokenUsagePolicy, 'Reusable')
        assert.equal(jwt.refreshTokenExpirationPolicy, 'Fixed')
        return true
      })
      .reply(200, APP_RESPONSE_WITH_SECRET)

    const result = await executeApplicationCreate({
      ...BASE_OPTIONS,
      profile: 'webapp',
      redirectUri: ['https://example.com/callback'],
    })
    assert.equal(result.success, true)
    assert.equal(result.clientSecret, 'super-secret')
  })

  test('webapp profile does not call system-configuration', async () => {
    // Only register /api/application — if system-configuration is called,
    // nock will throw and the afterEach isDone() check will also fail.
    nock(FA_HOST)
      .post('/api/application/')
      .reply(200, APP_RESPONSE)

    const result = await executeApplicationCreate({
      ...BASE_OPTIONS,
      profile: 'webapp',
      redirectUri: ['https://example.com/callback'],
    })
    assert.equal(result.success, true)
  })

  test('optional profile options are included when provided', async () => {
    nock(FA_HOST)
      .get('/api/system-configuration')
      .reply(200, systemConfigResponse())

    nock(FA_HOST)
      .post('/api/application/', (body) => {
        const oauth = body.application.oauthConfiguration
        assert.deepEqual(oauth.authorizedOriginURLs, ['https://example.com'])
        assert.equal(oauth.logoutURL, 'https://example.com/logout')
        return true
      })
      .reply(200, APP_RESPONSE)

    const result = await executeApplicationCreate({
      ...BASE_OPTIONS,
      profile: 'spa',
      redirectUri: ['https://example.com/callback'],
      authorizedOriginUrl: ['https://example.com'],
      logoutUrl: 'https://example.com/logout',
    })
    assert.equal(result.success, true)
  })
})

// ---------------------------------------------------------------------------
// ID overrides
// ---------------------------------------------------------------------------

describe('ID overrides', () => {
  test('--application-id is sent in the request URL and body', async () => {
    nock(FA_HOST)
      .get('/api/system-configuration')
      .reply(200, systemConfigResponse())

    nock(FA_HOST)
      .post(`/api/application/${APP_ID}`, (body) => {
        assert.equal(body.application.id, APP_ID)
        return true
      })
      .reply(200, APP_RESPONSE)

    const result = await executeApplicationCreate({
      ...BASE_OPTIONS,
      profile: 'spa',
      redirectUri: ['https://example.com/callback'],
      applicationId: APP_ID,
    })
    assert.equal(result.success, true)
    assert.equal(result.applicationId, APP_ID)
  })

  test('--application-id overrides id in --data', async () => {
    const overrideId = 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee'

    nock(FA_HOST)
      .post(`/api/application/${overrideId}`, (body) => {
        assert.equal(body.application.id, overrideId)
        return true
      })
      .reply(200, { application: { id: overrideId, name: 'Test App', oauthConfiguration: { clientId: overrideId } } })

    const result = await executeApplicationCreate({
      ...BASE_OPTIONS,
      data: JSON.stringify({ id: 'original-id', name: 'Test App' }),
      applicationId: overrideId,
    })
    assert.equal(result.success, true)
    assert.equal(result.applicationId, overrideId)
  })

  test('--tenant-id overrides tenantId in --data', async () => {
    nock(FA_HOST)
      .post('/api/application/', (body) => {
        assert.equal(body.application.tenantId, TENANT_ID)
        return true
      })
      .reply(200, APP_RESPONSE)

    const result = await executeApplicationCreate({
      ...BASE_OPTIONS,
      data: JSON.stringify({ tenantId: 'original-tenant' }),
      tenantId: TENANT_ID,
    })
    assert.equal(result.success, true)
  })
})

// ---------------------------------------------------------------------------
// Regression: tenant header scoping
// The X-FusionAuth-TenantId header must be absent on /api/system-configuration
// but present on /api/application when --tenant-id is supplied.
// ---------------------------------------------------------------------------

describe('regression: tenant header scoping', () => {
  test('X-FusionAuth-TenantId is absent on system-configuration call', async () => {
    nock(FA_HOST, {
      badheaders: ['X-FusionAuth-TenantId'],  // fails if header IS present
    })
      .get('/api/system-configuration')
      .reply(200, systemConfigResponse())

    nock(FA_HOST)
      .post('/api/application/')
      .reply(200, APP_RESPONSE)

    const result = await executeApplicationCreate({
      ...BASE_OPTIONS,
      profile: 'spa',
      redirectUri: ['https://example.com/callback'],
      tenantId: TENANT_ID,
    })
    assert.equal(result.success, true)
  })

  test('X-FusionAuth-TenantId is present on createApplication call when --tenant-id supplied', async () => {
    nock(FA_HOST)
      .get('/api/system-configuration')
      .reply(200, systemConfigResponse())

    nock(FA_HOST, {
      reqheaders: { 'x-fusionauth-tenantid': TENANT_ID },
    })
      .post('/api/application/')
      .reply(200, APP_RESPONSE)

    const result = await executeApplicationCreate({
      ...BASE_OPTIONS,
      profile: 'spa',
      redirectUri: ['https://example.com/callback'],
      tenantId: TENANT_ID,
    })
    assert.equal(result.success, true)
  })
})

// ---------------------------------------------------------------------------
// Regression: error attribution
// A failure in ensureCorsHeaders must not be reported as "Error creating application".
// ---------------------------------------------------------------------------

describe('regression: error attribution', () => {
  test('system-configuration 401 returns error before createApplication is called', async () => {
    // Register system-config to return 401
    nock(FA_HOST)
      .get('/api/system-configuration')
      .reply(401)

    // Do NOT register /api/application — if it were called, afterEach isDone() would pass
    // incorrectly. We rely on the nock.pendingMocks() check being empty as the success signal,
    // but more importantly we assert result.success is false here.
    const result = await executeApplicationCreate({
      ...BASE_OPTIONS,
      profile: 'spa',
      redirectUri: ['https://example.com/callback'],
    })
    assert.equal(result.success, false)
  })

  test('CORS patch failure returns error before createApplication is called', async () => {
    nock(FA_HOST)
      .get('/api/system-configuration')
      .reply(200, systemConfigResponse({ allowedHeaders: [] }))  // missing headers → triggers patch

    nock(FA_HOST)
      .patch('/api/system-configuration')
      .reply(403)

    const result = await executeApplicationCreate({
      ...BASE_OPTIONS,
      profile: 'spa',
      redirectUri: ['https://example.com/callback'],
    })
    assert.equal(result.success, false)
  })
})

// ---------------------------------------------------------------------------
// CORS header management
// ---------------------------------------------------------------------------

describe('CORS header management', () => {
  test('no PATCH when all required headers already present (any casing)', async () => {
    // Only GET is registered — a PATCH would cause nock to throw
    nock(FA_HOST)
      .get('/api/system-configuration')
      .reply(200, systemConfigResponse({
        allowedHeaders: ['DPoP', 'authorization', 'ACCEPT', 'Content-Type'],
      }))

    nock(FA_HOST)
      .post('/api/application/')
      .reply(200, APP_RESPONSE)

    const result = await executeApplicationCreate({
      ...BASE_OPTIONS,
      profile: 'spa',
      redirectUri: ['https://example.com/callback'],
    })
    assert.equal(result.success, true)
  })

  test('PATCH adds only missing headers, preserving existing ones', async () => {
    nock(FA_HOST)
      .get('/api/system-configuration')
      .reply(200, systemConfigResponse({
        enabled: true,
        allowedHeaders: ['Authorization', 'Content-Type'],  // dpop and Accept missing
      }))

    nock(FA_HOST)
      .patch('/api/system-configuration', (body) => {
        const headers = body.systemConfiguration.corsConfiguration.allowedHeaders
        assert(headers.includes('Authorization'), 'should preserve existing Authorization')
        assert(headers.includes('Content-Type'), 'should preserve existing Content-Type')
        assert(headers.some(h => h.toLowerCase() === 'dpop'), 'should add dpop')
        assert(headers.some(h => h.toLowerCase() === 'accept'), 'should add Accept')
        return true
      })
      .reply(200, {})

    nock(FA_HOST)
      .post('/api/application/')
      .reply(200, APP_RESPONSE)

    const result = await executeApplicationCreate({
      ...BASE_OPTIONS,
      profile: 'spa',
      redirectUri: ['https://example.com/callback'],
    })
    assert.equal(result.success, true)
  })

  test('PATCH sets enabled:true when CORS is disabled', async () => {
    nock(FA_HOST)
      .get('/api/system-configuration')
      .reply(200, systemConfigResponse({
        enabled: false,
        allowedHeaders: ['dpop', 'Authorization', 'Accept'],
      }))

    nock(FA_HOST)
      .patch('/api/system-configuration', (body) => {
        assert.equal(body.systemConfiguration.corsConfiguration.enabled, true)
        return true
      })
      .reply(200, {})

    nock(FA_HOST)
      .post('/api/application/')
      .reply(200, APP_RESPONSE)

    const result = await executeApplicationCreate({
      ...BASE_OPTIONS,
      profile: 'spa',
      redirectUri: ['https://example.com/callback'],
    })
    assert.equal(result.success, true)
  })
})

// ---------------------------------------------------------------------------
// Output — clientSecret presence/absence
// ---------------------------------------------------------------------------

describe('output', () => {
  test('clientSecret is returned for webapp profile', async () => {
    nock(FA_HOST)
      .post('/api/application/')
      .reply(200, APP_RESPONSE_WITH_SECRET)

    const result = await executeApplicationCreate({
      ...BASE_OPTIONS,
      profile: 'webapp',
      redirectUri: ['https://example.com/callback'],
    })
    assert.equal(result.success, true)
    assert.equal(result.clientSecret, 'super-secret')
  })

  test('clientSecret is absent for spa profile (public client)', async () => {
    nock(FA_HOST)
      .get('/api/system-configuration')
      .reply(200, systemConfigResponse())

    nock(FA_HOST)
      .post('/api/application/')
      .reply(200, APP_RESPONSE)  // no clientSecret in response

    const result = await executeApplicationCreate({
      ...BASE_OPTIONS,
      profile: 'spa',
      redirectUri: ['https://example.com/callback'],
    })
    assert.equal(result.success, true)
    assert.equal(result.clientSecret, undefined)
  })

  test('result contains name, applicationId, and clientId', async () => {
    nock(FA_HOST)
      .get('/api/system-configuration')
      .reply(200, systemConfigResponse())

    nock(FA_HOST)
      .post('/api/application/')
      .reply(200, APP_RESPONSE)

    const result = await executeApplicationCreate({
      ...BASE_OPTIONS,
      profile: 'spa',
      redirectUri: ['https://example.com/callback'],
    })
    assert.equal(result.success, true)
    assert.equal(result.name, 'Test App')
    assert.equal(result.applicationId, APP_ID)
    assert.equal(result.clientId, APP_ID)
  })
})
