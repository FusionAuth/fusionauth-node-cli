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
const REDIRECT_URI = 'https://example.com/callback'

const BASE_OPTIONS = {
  name: 'Test App',
  key: API_KEY,
  host: FA_HOST,
}

function spaOptions(overrides = {}) {
  return { ...BASE_OPTIONS, profile: 'spa', redirectUri: [REDIRECT_URI], ...overrides }
}

function webappOptions(overrides = {}) {
  return { ...BASE_OPTIONS, profile: 'webapp', redirectUri: [REDIRECT_URI], ...overrides }
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

// Registers a GET /api/system-configuration mock reporting CORS as already
// compliant — used by every test where no CORS mutation should occur.
function mockCompliantSystemConfig() {
  nock(FA_HOST)
    .get('/api/system-configuration')
    .reply(200, systemConfigResponse())
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
      ...spaOptions(),
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

  test('--profile without --name returns error without making API calls', async () => {
    const { name, ...optionsWithoutName } = spaOptions()
    const result = await executeApplicationCreate(optionsWithoutName)
    assert.equal(result.success, false)
    assert.match(result.error, /--name is required/)
  })

  test('an invalid --profile value returns a clear error without making API calls', async () => {
    // Direct library callers bypass Commander's .choices() validation, so
    // executeApplicationCreate() must validate this itself rather than
    // silently spreading `undefined` into an empty application object.
    const result = await executeApplicationCreate(spaOptions({ profile: 'not-a-real-profile' }))
    assert.equal(result.success, false)
    assert.match(result.error, /--profile must be one of/)
    assert.match(result.error, /spa/)
    assert.match(result.error, /native/)
    assert.match(result.error, /webapp/)
  })

  test('a --profile value that is an inherited Object property is rejected', async () => {
    // `profile in profileDefaults` would incorrectly accept values like
    // 'toString' or 'constructor', since `in` checks the prototype chain,
    // not just own properties. profileDefaults['toString'] then resolves
    // to the inherited Function, and {...profileDefaults['toString']}
    // silently produces {} — reaching the exact "empty defaults, no
    // security profile applied" bug this validation exists to prevent.
    const result = await executeApplicationCreate(spaOptions({ profile: 'toString' }))
    assert.equal(result.success, false)
    assert.match(result.error, /--profile must be one of/)
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

  test('--data "null" returns a clear validation error without making API calls', async () => {
    // JSON.parse('null') succeeds (it's valid JSON), so this isn't caught
    // by the malformed-JSON case above. Without a shape check, this would
    // otherwise surface as a confusing downstream TypeError instead.
    const result = await executeApplicationCreate({
      ...BASE_OPTIONS,
      data: 'null',
    })
    assert.equal(result.success, false)
    assert.match(result.error, /--data JSON must be a non-null, non-array object/)
  })

  test('--data as a JSON array returns a clear validation error without making API calls', async () => {
    const result = await executeApplicationCreate({
      ...BASE_OPTIONS,
      data: '[1,2,3]',
    })
    assert.equal(result.success, false)
    assert.match(result.error, /--data JSON must be a non-null, non-array object/)
  })

  test('--data as a JSON primitive returns a clear validation error without making API calls', async () => {
    const result = await executeApplicationCreate({
      ...BASE_OPTIONS,
      data: '42',
    })
    assert.equal(result.success, false)
    assert.match(result.error, /--data JSON must be a non-null, non-array object/)
  })

  test('missing @file returns error without making API calls', async () => {
    const result = await executeApplicationCreate({
      ...BASE_OPTIONS,
      data: '@/does/not/exist.json',
    })
    assert.equal(result.success, false)
    assert.match(result.error, /Error reading --data file/)
  })

  test('--data mode preserves the JSON name when --name is omitted (full custom control)', async () => {
    const { name, ...optionsWithoutName } = BASE_OPTIONS

    nock(FA_HOST)
      .post('/api/application/', (body) => {
        assert.equal(body.application.name, 'Name From JSON')
        return true
      })
      .reply(200, APP_RESPONSE)

    const result = await executeApplicationCreate({
      ...optionsWithoutName,
      data: JSON.stringify({ name: 'Name From JSON', oauthConfiguration: {} }),
    })
    assert.equal(result.success, true)
  })

  test('--data mode overrides the JSON name when --name is explicitly provided', async () => {
    nock(FA_HOST)
      .post('/api/application/', (body) => {
        assert.equal(body.application.name, 'Test App')  // BASE_OPTIONS.name
        return true
      })
      .reply(200, APP_RESPONSE)

    const result = await executeApplicationCreate({
      ...BASE_OPTIONS,
      data: JSON.stringify({ name: 'Name From JSON', oauthConfiguration: {} }),
    })
    assert.equal(result.success, true)
  })

  test('--data mode preserves the JSON oauthConfiguration when the override flags are omitted', async () => {
    nock(FA_HOST)
      .post('/api/application/', (body) => {
        const oauth = body.application.oauthConfiguration
        assert.deepEqual(oauth.authorizedRedirectURLs, ['https://from-json.example.com/cb'])
        assert.equal(oauth.logoutURL, 'https://from-json.example.com/logout')
        assert.deepEqual(oauth.authorizedOriginURLs, ['https://from-json.example.com'])
        return true
      })
      .reply(200, APP_RESPONSE)

    const result = await executeApplicationCreate({
      ...BASE_OPTIONS,
      data: JSON.stringify({
        oauthConfiguration: {
          authorizedRedirectURLs: ['https://from-json.example.com/cb'],
          logoutURL: 'https://from-json.example.com/logout',
          authorizedOriginURLs: ['https://from-json.example.com'],
        },
      }),
    })
    assert.equal(result.success, true)
  })

  test('--redirect-uri overrides the JSON authorizedRedirectURLs when explicitly provided', async () => {
    nock(FA_HOST)
      .post('/api/application/', (body) => {
        assert.deepEqual(body.application.oauthConfiguration.authorizedRedirectURLs, [REDIRECT_URI])
        return true
      })
      .reply(200, APP_RESPONSE)

    const result = await executeApplicationCreate({
      ...BASE_OPTIONS,
      redirectUri: [REDIRECT_URI],
      data: JSON.stringify({ oauthConfiguration: { authorizedRedirectURLs: ['https://from-json.example.com/cb'] } }),
    })
    assert.equal(result.success, true)
  })

  test('--logout-url overrides the JSON logoutURL when explicitly provided', async () => {
    nock(FA_HOST)
      .post('/api/application/', (body) => {
        assert.equal(body.application.oauthConfiguration.logoutURL, 'https://override.example.com/logout')
        return true
      })
      .reply(200, APP_RESPONSE)

    const result = await executeApplicationCreate({
      ...BASE_OPTIONS,
      logoutUrl: 'https://override.example.com/logout',
      data: JSON.stringify({ oauthConfiguration: { logoutURL: 'https://from-json.example.com/logout' } }),
    })
    assert.equal(result.success, true)
  })

  test('--authorized-origin-url overrides the JSON authorizedOriginURLs when explicitly provided', async () => {
    nock(FA_HOST)
      .post('/api/application/', (body) => {
        assert.deepEqual(body.application.oauthConfiguration.authorizedOriginURLs, ['https://override.example.com'])
        return true
      })
      .reply(200, APP_RESPONSE)

    const result = await executeApplicationCreate({
      ...BASE_OPTIONS,
      authorizedOriginUrl: ['https://override.example.com'],
      data: JSON.stringify({ oauthConfiguration: { authorizedOriginURLs: ['https://from-json.example.com'] } }),
    })
    assert.equal(result.success, true)
  })

  test('--data mode does not mutate system CORS configuration (unlike --profile spa)', async () => {
    // Only register /api/application — if system-configuration is called,
    // nock will throw and the afterEach isDone() check will also fail.
    nock(FA_HOST)
      .post('/api/application/')
      .reply(200, APP_RESPONSE)

    const result = await executeApplicationCreate({
      ...BASE_OPTIONS,
      authorizedOriginUrl: ['https://override.example.com'],
      data: JSON.stringify({ oauthConfiguration: {} }),
    })
    assert.equal(result.success, true)
  })
})

// ---------------------------------------------------------------------------
// Profile defaults — request body assertions
// ---------------------------------------------------------------------------

describe('profile defaults', () => {
  test('spa profile sends correct oauthConfiguration and jwtConfiguration', async () => {
    mockCompliantSystemConfig()

    nock(FA_HOST)
      .post('/api/application/', (body) => {
        const oauth = body.application.oauthConfiguration
        const jwt = body.application.jwtConfiguration
        assert.deepEqual(oauth.enabledGrants, ['authorization_code', 'refresh_token'])
        assert.equal(oauth.proofKeyForCodeExchangePolicy, 'Required')
        assert.equal(oauth.clientAuthenticationPolicy, 'NotRequired')
        assert.equal(oauth.requireClientAuthentication, false)
        assert.equal(oauth.generateRefreshTokens, true)
        assert.equal(oauth.requireRegistration, true)
        assert.deepEqual(oauth.authorizedRedirectURLs, [REDIRECT_URI])
        assert.equal(jwt.enabled, true)
        assert.equal(jwt.timeToLiveInSeconds, 300)
        assert.equal(jwt.refreshTokenUsagePolicy, 'OneTimeUse')
        assert.equal(jwt.refreshTokenExpirationPolicy, 'SlidingWindow')
        return true
      })
      .reply(200, APP_RESPONSE)

    const result = await executeApplicationCreate(spaOptions())
    assert.equal(result.success, true)
  })

  test('native profile sends same oauth defaults as spa', async () => {
    nock(FA_HOST)
      .post('/api/application/', (body) => {
        const oauth = body.application.oauthConfiguration
        assert.equal(oauth.proofKeyForCodeExchangePolicy, 'Required')
        assert.equal(oauth.clientAuthenticationPolicy, 'NotRequired')
        assert.equal(oauth.requireRegistration, true)
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

  test('native profile does not call system-configuration', async () => {
    // Native apps don't go through a browser's CORS enforcement, so
    // --profile native should not touch CORS at all, unlike spa. Only
    // register /api/application — if system-configuration is called,
    // nock will throw and the afterEach isDone() check will also fail.
    nock(FA_HOST)
      .post('/api/application/')
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
        assert.equal(oauth.requireRegistration, true)
        assert.deepEqual(oauth.enabledGrants, ['authorization_code', 'refresh_token'])
        assert.equal(jwt.timeToLiveInSeconds, 3600)
        assert.equal(jwt.refreshTokenUsagePolicy, 'OneTimeUse')
        assert.equal(jwt.refreshTokenExpirationPolicy, 'SlidingWindow')
        return true
      })
      .reply(200, APP_RESPONSE_WITH_SECRET)

    const result = await executeApplicationCreate(webappOptions())
    assert.equal(result.success, true)
    assert.equal(result.clientSecret, 'super-secret')
  })

  test('webapp profile does not call system-configuration', async () => {
    // Only register /api/application — if system-configuration is called,
    // nock will throw and the afterEach isDone() check will also fail.
    nock(FA_HOST)
      .post('/api/application/')
      .reply(200, APP_RESPONSE)

    const result = await executeApplicationCreate(webappOptions())
    assert.equal(result.success, true)
  })

  test('optional profile options are included when provided', async () => {
    // allowedOrigins already includes the origin below so this test can
    // focus on the oauthConfiguration fields without also triggering the
    // CORS-origin confirmation gate (covered separately).
    nock(FA_HOST)
      .get('/api/system-configuration')
      .reply(200, systemConfigResponse({ allowedOrigins: ['https://example.com'] }))

    nock(FA_HOST)
      .post('/api/application/', (body) => {
        const oauth = body.application.oauthConfiguration
        assert.deepEqual(oauth.authorizedOriginURLs, ['https://example.com'])
        assert.equal(oauth.logoutURL, 'https://example.com/logout')
        return true
      })
      .reply(200, APP_RESPONSE)

    const result = await executeApplicationCreate(spaOptions({
      authorizedOriginUrl: ['https://example.com'],
      logoutUrl: 'https://example.com/logout',
    }))
    assert.equal(result.success, true)
  })
})

// ---------------------------------------------------------------------------
// ID overrides
// ---------------------------------------------------------------------------

describe('ID overrides', () => {
  test('--application-id is sent in the request URL and body', async () => {
    mockCompliantSystemConfig()

    nock(FA_HOST)
      .post(`/api/application/${APP_ID}`, (body) => {
        assert.equal(body.application.id, APP_ID)
        return true
      })
      .reply(200, APP_RESPONSE)

    const result = await executeApplicationCreate(spaOptions({ applicationId: APP_ID }))
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

    const result = await executeApplicationCreate(spaOptions({ tenantId: TENANT_ID }))
    assert.equal(result.success, true)
  })

  test('X-FusionAuth-TenantId is present on createApplication call when --tenant-id supplied', async () => {
    mockCompliantSystemConfig()

    nock(FA_HOST, {
      reqheaders: { 'x-fusionauth-tenantid': TENANT_ID },
    })
      .post('/api/application/')
      .reply(200, APP_RESPONSE)

    const result = await executeApplicationCreate(spaOptions({ tenantId: TENANT_ID }))
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
    const result = await executeApplicationCreate(spaOptions())
    assert.equal(result.success, false)
    // createApplication was never called, so the message must not be misattributed
    // to it — it should describe the actual (CORS retrieval) failure.
    assert.match(result.error, /Error retrieving system configuration/)
    assert.doesNotMatch(result.error, /Error creating application/)
  })

  test('CORS patch failure returns error before createApplication is called', async () => {
    nock(FA_HOST)
      .get('/api/system-configuration')
      .reply(200, systemConfigResponse({ allowedHeaders: [] }))  // missing headers → triggers patch

    nock(FA_HOST)
      .patch('/api/system-configuration')
      .reply(403)

    const result = await executeApplicationCreate(spaOptions({ yes: true }))
    assert.equal(result.success, false)
    assert.match(result.error, /Error updating CORS configuration/)
    assert.doesNotMatch(result.error, /Error creating application/)
  })

  test('createApplication failure is correctly attributed to application creation', async () => {
    // No CORS-related calls for webapp — createApplication is the only call made.
    nock(FA_HOST)
      .post('/api/application/')
      .reply(500, {})

    const result = await executeApplicationCreate(webappOptions())
    assert.equal(result.success, false)
    assert.match(result.error, /Error creating application/)
  })

  test('rawError preserves the original structured FusionAuth error rather than a generic wrapper', async () => {
    nock(FA_HOST)
      .post('/api/application/')
      .reply(400, { fieldErrors: { name: [{ message: 'is required' }] } })

    const result = await executeApplicationCreate(webappOptions())
    assert.equal(result.success, false)
    // rawError must be the original FusionAuth ClientResponse-shaped rejection
    // (so errorAndExit/reportError can format fieldErrors/generalErrors),
    // not the generic Error used for the human-readable `error` message.
    assert.equal(result.rawError instanceof Error, false)
    assert.equal(result.rawError.statusCode, 400)
    assert.deepEqual(result.rawError.exception, { fieldErrors: { name: [{ message: 'is required' }] } })
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

    const result = await executeApplicationCreate(spaOptions())
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

    const result = await executeApplicationCreate(spaOptions({ yes: true }))
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

    const result = await executeApplicationCreate(spaOptions({ yes: true }))
    assert.equal(result.success, true)
  })

  test('PATCH adds --authorized-origin-url to the system CORS allowlist', async () => {
    nock(FA_HOST)
      .get('/api/system-configuration')
      .reply(200, systemConfigResponse({ allowedOrigins: ['https://existing.example.com'] }))

    nock(FA_HOST)
      .patch('/api/system-configuration', (body) => {
        const origins = body.systemConfiguration.corsConfiguration.allowedOrigins
        assert(origins.includes('https://existing.example.com'), 'should preserve existing origin')
        assert(origins.includes('https://myapp.example.com'), 'should add the new origin')
        return true
      })
      .reply(200, {})

    nock(FA_HOST)
      .post('/api/application/')
      .reply(200, APP_RESPONSE)

    const result = await executeApplicationCreate(spaOptions({
      yes: true,
      authorizedOriginUrl: ['https://myapp.example.com'],
    }))
    assert.equal(result.success, true)
  })

  test('no PATCH when --authorized-origin-url is already in the system CORS allowlist', async () => {
    // Headers/enabled already compliant too — only origins differ from the
    // baseline, so this also exercises the "would otherwise early-return"
    // path now correctly checking origins as well.
    nock(FA_HOST)
      .get('/api/system-configuration')
      .reply(200, systemConfigResponse({ allowedOrigins: ['https://myapp.example.com'] }))

    nock(FA_HOST)
      .post('/api/application/')
      .reply(200, APP_RESPONSE)

    const result = await executeApplicationCreate(spaOptions({
      authorizedOriginUrl: ['https://myapp.example.com'],
    }))
    assert.equal(result.success, true)
  })

  test('no PATCH for origins when allowedOrigins already contains "*"', async () => {
    nock(FA_HOST)
      .get('/api/system-configuration')
      .reply(200, systemConfigResponse({ allowedOrigins: ['*'] }))

    nock(FA_HOST)
      .post('/api/application/')
      .reply(200, APP_RESPONSE)

    const result = await executeApplicationCreate(spaOptions({
      authorizedOriginUrl: ['https://myapp.example.com'],
    }))
    assert.equal(result.success, true)
  })

  test('--authorized-origin-url is not required — no origin changes attempted when omitted', async () => {
    nock(FA_HOST)
      .get('/api/system-configuration')
      .reply(200, systemConfigResponse())

    nock(FA_HOST)
      .post('/api/application/')
      .reply(200, APP_RESPONSE)

    const result = await executeApplicationCreate(spaOptions())
    assert.equal(result.success, true)
  })
})

// ---------------------------------------------------------------------------
// Confirmation gate (--yes) for CORS mutation
// Mutating system-wide CORS configuration must be gated behind
// confirmOrExit()/--yes.
// ---------------------------------------------------------------------------

describe('confirmation gate for CORS mutation', () => {
  test('non-interactive without --yes aborts before patching CORS or creating the application', async (t) => {
    // process.exit is mocked so confirmOrExit() throws instead of actually
    // exiting (see utils.ts docstring) — the throw is caught by
    // executeApplicationCreate's try/catch and returned as a normal result.
    // In production (unmocked), confirmOrExit() can still exit the process
    // directly for a non-interactive caller without yes=true — see the
    // documented exception to the "always returns a result" contract on
    // executeApplicationCreate's JSDoc. It's only this test's mock that
    // turns that exit into a returned result instead.
    const exitMock = t.mock.method(process, 'exit', () => {})

    nock(FA_HOST)
      .get('/api/system-configuration')
      .reply(200, systemConfigResponse({ allowedHeaders: [] }))  // missing headers → would trigger patch

    // Deliberately no PATCH or POST /api/application interceptors registered —
    // if either were called, afterEach's nock.isDone() check would fail.

    const result = await executeApplicationCreate(spaOptions())

    assert.equal(result.success, false)
    assert.equal(exitMock.mock.calls.length, 1, 'process.exit should be called once')
    assert.equal(exitMock.mock.calls[0].arguments[0], 1)
  })

  test('--yes bypasses the confirmation prompt and proceeds with the CORS patch', async () => {
    nock(FA_HOST)
      .get('/api/system-configuration')
      .reply(200, systemConfigResponse({ allowedHeaders: [] }))

    nock(FA_HOST)
      .patch('/api/system-configuration')
      .reply(200, {})

    nock(FA_HOST)
      .post('/api/application/')
      .reply(200, APP_RESPONSE)

    const result = await executeApplicationCreate(spaOptions({ yes: true }))

    assert.equal(result.success, true)
  })

  test('a missing authorized origin alone (headers/enabled already compliant) still requires confirmation', async (t) => {
    const exitMock = t.mock.method(process, 'exit', () => {})

    nock(FA_HOST)
      .get('/api/system-configuration')
      .reply(200, systemConfigResponse())  // headers/enabled compliant; no allowedOrigins at all

    // Deliberately no PATCH or POST /api/application interceptors registered.

    const result = await executeApplicationCreate(spaOptions({
      authorizedOriginUrl: ['https://myapp.example.com'],
    }))

    assert.equal(result.success, false)
    assert.equal(exitMock.mock.calls.length, 1, 'process.exit should be called once')
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

    const result = await executeApplicationCreate(webappOptions())
    assert.equal(result.success, true)
    assert.equal(result.clientSecret, 'super-secret')
  })

  test('spa profile result includes name/applicationId/clientId and omits clientSecret', async () => {
    mockCompliantSystemConfig()

    nock(FA_HOST)
      .post('/api/application/')
      .reply(200, APP_RESPONSE)  // no clientSecret in response

    const result = await executeApplicationCreate(spaOptions())
    assert.equal(result.success, true)
    assert.equal(result.clientSecret, undefined)
    assert.equal(result.name, 'Test App')
    assert.equal(result.applicationId, APP_ID)
    assert.equal(result.clientId, APP_ID)
  })
})
