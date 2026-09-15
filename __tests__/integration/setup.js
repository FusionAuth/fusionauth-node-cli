import * as fs from 'node:fs'
import * as path from 'node:path'
import { exec } from 'node:child_process'
import { promisify } from 'node:util'

/**
 * Async version of exec used in place of execSync to avoid blocking the
 * Node.js event loop during docker compose operations. Blocking the event
 * loop (e.g. while images are pulled) causes the test runner to cancel
 * pending tests with ERR_TEST_FAILURE.
 */
const execAsync = promisify(exec)

/**
 * Container management for integration tests
 * Handles docker compose lifecycle and FusionAuth readiness checks
 */

const DEFAULT_FUSIONAUTH_URL = 'http://localhost:9011'
const DEFAULT_API_KEY = '90dd6b25-d1ef-4175-9656-159dd994932e'
const HEALTH_CHECK_TIMEOUT = 240000 // 4 minutes
const HEALTH_CHECK_INTERVAL = 5000 // 5 seconds
const REQUEST_TIMEOUT = 10000 // 10 seconds
const CONTAINER_NAME = 'fusionauth-integration-test-base-fusionauth-1'

let isContainerRunning = false
let resolvedFusionAuthUrl = DEFAULT_FUSIONAUTH_URL

/**
 * Resolves the FusionAuth URL. On environments where localhost port-mapping
 * behaves differently (e.g. macOS Docker Desktop), falls back to the
 * container's direct bridge IP to ensure authenticated requests succeed.
 * @returns {Promise<string>}
 */
async function resolveFusionAuthUrl() {
  // First try localhost — if an authenticated request succeeds, use it.
  try {
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), 3000)
    const response = await fetch(`${DEFAULT_FUSIONAUTH_URL}/api/tenant`, {
      headers: { Authorization: DEFAULT_API_KEY },
      signal: controller.signal,
    })
    clearTimeout(timeoutId)
    if (response.ok) return DEFAULT_FUSIONAUTH_URL
  } catch (_) {}

  // Fall back to the container's direct bridge IP (works on macOS Docker Desktop
  // where localhost port-mapping doesn't forward API-key auth correctly).
  try {
    const { stdout } = await execAsync(
      `docker inspect ${CONTAINER_NAME} --format '{{range .NetworkSettings.Networks}}{{.IPAddress}} {{end}}'`
    )
    const ips = stdout.trim().split(/\s+/).filter(Boolean)
    for (const ip of ips) {
      try {
        const controller = new AbortController()
        const timeoutId = setTimeout(() => controller.abort(), 3000)
        const response = await fetch(`http://${ip}:9011/api/tenant`, {
          headers: { Authorization: DEFAULT_API_KEY },
          signal: controller.signal,
        })
        clearTimeout(timeoutId)
        if (response.ok) {
          console.log(`ℹ Using container IP ${ip}:9011 (localhost port-mapping not compatible)`)
          return `http://${ip}:9011`
        }
      } catch (_) {}
    }
  } catch (_) {}

  // Return localhost as a last resort — health check will catch startup failures.
  return DEFAULT_FUSIONAUTH_URL
}

/**
 * Start FusionAuth via docker compose
 * @returns {Promise<{url: string, apiKey: string}>}
 */
export async function startFusionAuthContainer() {
  if (isContainerRunning || process.env.REUSE_CONTAINER === 'true') {
    console.log('ℹ Using existing FusionAuth container')
    resolvedFusionAuthUrl = await resolveFusionAuthUrl()
    return { url: resolvedFusionAuthUrl, apiKey: DEFAULT_API_KEY }
  }

  console.log('↻ Starting FusionAuth container via docker compose...')

  const composeDir = new URL('./fixtures/kickstarts/fusionauth-integration-test-base', import.meta.url).pathname
  const envFile = path.join(composeDir, '.env.test')
  const kickstartFilePath = path.join(composeDir, 'kickstart.json')

  // Create .env.test file with test configuration
  const envContent = `
DATABASE_PASSWORD=postgres
POSTGRES_PASSWORD=postgres
POSTGRES_USER=postgres
DATABASE_USERNAME=fusionauth
DATABASE_URL=jdbc:postgresql://db:5432/fusionauth
FUSIONAUTH_APP_MEMORY=512M
FUSIONAUTH_APP_RUNTIME_MODE=development
FUSIONAUTH_APP_KICKSTART_FILE=/usr/local/fusionauth/kickstart/kickstart.json
KICKSTART_FILE_PATH=${kickstartFilePath}
OPENSEARCH_JAVA_OPTS=-Xms256m -Xmx256m
`.trim()

  fs.writeFileSync(envFile, envContent)

  try {
    // Check for and tear down any existing containers first
    try {
      const { stdout: psOutput } = await execAsync(`cd ${composeDir} && docker compose ps -q`)
      if (psOutput.trim()) {
        console.log('⚠ Found existing FusionAuth containers, tearing them down...')
        await execAsync(`cd ${composeDir} && docker compose down -v`)
        console.log('✓ Existing containers removed')
      }
    } catch (e) {
      // Container may not exist, that's fine
    }

    // Start containers
    await execAsync(`cd ${composeDir} && docker compose --env-file .env.test up -d`)

    // Wait for FusionAuth to be healthy
    await waitForFusionAuthReady()

    // Resolve the URL that actually works for authenticated requests
    resolvedFusionAuthUrl = await resolveFusionAuthUrl()

    isContainerRunning = true
    console.log('✓ FusionAuth container started and ready')

    return { url: resolvedFusionAuthUrl, apiKey: DEFAULT_API_KEY }
  } catch (err) {
    throw new Error(`Failed to start FusionAuth container: ${err.message}`)
  }
}

/**
 * Stop FusionAuth container
 * @returns {Promise<void>}
 */
export async function stopFusionAuthContainer() {
  if (process.env.SKIP_TEARDOWN === 'true') {
    console.log('ℹ Skipping container teardown (SKIP_TEARDOWN=true)')
    console.log('ℹ Container will remain running at http://localhost:9011')
    return
  }

  if (!isContainerRunning) {
    return
  }

  console.log('↻ Stopping FusionAuth container...')

  const composeDir = new URL('./fixtures/kickstarts/fusionauth-integration-test-base', import.meta.url).pathname

  try {
    await execAsync(`cd ${composeDir} && docker compose down -v`)
    isContainerRunning = false
    console.log('✓ FusionAuth container stopped')
  } catch (err) {
    console.error(`Warning: Failed to stop container: ${err.message}`)
  }
}

/**
 * Wait for FusionAuth API to be healthy
 * @returns {Promise<void>}
 */
async function waitForFusionAuthReady() {
  const startTime = Date.now()

  while (Date.now() - startTime < HEALTH_CHECK_TIMEOUT) {
    try {
      const controller = new AbortController()
      const timeoutId = setTimeout(() => controller.abort(), 5000)
      
      const response = await fetch(`${DEFAULT_FUSIONAUTH_URL}/api/status`, {
        signal: controller.signal
      })
      clearTimeout(timeoutId)

      if (response.ok) {
        // Verify the kickstart has run and the container is fully initialized.
        // We check using the container IP directly (more reliable than localhost
        // on macOS Docker Desktop where port-mapping affects auth behavior).
        let authReady = false
        const authStartTime = Date.now()
        
        while (Date.now() - authStartTime < 30000) { // 30 second timeout for auth readiness
          try {
            const authController = new AbortController()
            const authTimeoutId = setTimeout(() => authController.abort(), 5000)

            // Try localhost first, fall back to container IP check via Docker inspect
            let checkUrl = DEFAULT_FUSIONAUTH_URL
            try {
              const { stdout } = await execAsync(
                `docker inspect ${CONTAINER_NAME} --format '{{range .NetworkSettings.Networks}}{{.IPAddress}} {{end}}'`
              )
              const ip = stdout.trim().split(/\s+/).filter(Boolean)[0]
              if (ip) checkUrl = `http://${ip}:9011`
            } catch (_) {}
            
            const tenantsResponse = await fetch(`${checkUrl}/api/tenant`, {
              method: 'GET',
              headers: { Authorization: DEFAULT_API_KEY },
              signal: authController.signal
            })
            clearTimeout(authTimeoutId)

            if (tenantsResponse.ok) {
              authReady = true
              break
            }
          } catch (err) {
            // Auth not ready yet, retry
          }
          
          await sleep(HEALTH_CHECK_INTERVAL)
        }
        
        if (authReady) {
          return
        }
      }
    } catch (err) {
      // Not ready yet, retry
    }

    await sleep(HEALTH_CHECK_INTERVAL)
  }

  throw new Error(
    `FusionAuth did not become ready within ${HEALTH_CHECK_TIMEOUT / 1000} seconds`
  )
}

/**
 * Make HTTP request to FusionAuth API
 * @param {string} method - HTTP method
 * @param {string} path - API path
 * @param {object} data - Request body
 * @param {string} apiKey - API key for authentication
 * @returns {Promise<any>}
 */
export async function makeApiRequest(method, path, data = null, apiKey = DEFAULT_API_KEY) {
  const url = `${resolvedFusionAuthUrl}${path}`
  const headers = {
    Authorization: apiKey,
    'Content-Type': 'application/json'
  }

  try {
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT)
    
    const options = {
      method,
      headers,
      signal: controller.signal
    }

    if (data && ['POST', 'PUT', 'PATCH'].includes(method)) {
      options.body = JSON.stringify(data)
    }

    const response = await fetch(url, options)
    clearTimeout(timeoutId)

    if (!response.ok) {
      const errorBody = await response.text()
      throw new Error(
        `HTTP ${response.status}: ${response.statusText} - ${errorBody.substring(0, 100)}`
      )
    }

    return await response.json()
  } catch (err) {
    if (err.name === 'AbortError') {
      throw new Error(`API request timeout: ${method} ${path}`)
    }
    throw new Error(
      `API request failed: ${method} ${path} - ${err.message}`
    )
  }
}

/**
 * Get user by email from FusionAuth
 * @param {string} email - User email address
 * @param {string} apiKey - API key
 * @returns {Promise<object>}
 */
export async function getUser(email, apiKey = DEFAULT_API_KEY) {
  const data = await makeApiRequest('GET', `/api/user?email=${encodeURIComponent(email)}`, null, apiKey)
  return data.user
}

/**
 * Get tenant by ID from FusionAuth
 * @param {string} tenantId - Tenant ID
 * @param {string} apiKey - API key
 * @returns {Promise<object>}
 */
export async function getTenant(tenantId, apiKey = DEFAULT_API_KEY) {
  const data = await makeApiRequest('GET', `/api/tenant/${tenantId}`, null, apiKey)
  return data.tenant
}

/**
 * Get email template by name from FusionAuth
 * @param {string} name - Template name
 * @param {string} apiKey - API key
 * @returns {Promise<object>}
 */
export async function getEmailTemplateByName(name, apiKey = DEFAULT_API_KEY) {
  const data = await makeApiRequest('GET', '/api/email/template', null, apiKey)
  const templates = data.emailTemplates || []
  return templates.find(t => t.name === name)
}

/**
 * Get message template by name from FusionAuth
 * @param {string} name - Template name
 * @param {string} apiKey - API key
 * @returns {Promise<object>}
 */
export async function getMessageTemplateByName(name, apiKey = DEFAULT_API_KEY) {
  const data = await makeApiRequest('GET', '/api/message/template', null, apiKey)
  const templates = data.messageTemplates || []
  return templates.find(t => t.name === name)
}

/**
 * Get application by ID from FusionAuth
 * @param {string} applicationId - Application ID
 * @param {string} apiKey - API key
 * @returns {Promise<object>}
 */
export async function getApplication(applicationId, apiKey = DEFAULT_API_KEY) {
  const data = await makeApiRequest('GET', `/api/application/${applicationId}`, null, apiKey)
  return data.application
}

/**
 * Delete application by ID from FusionAuth
 * @param {string} applicationId - Application ID
 * @param {string} apiKey - API key
 * @returns {Promise<void>}
 */
export async function deleteApplication(applicationId, apiKey = DEFAULT_API_KEY) {
  // First deactivate, then hard-delete
  await makeApiRequest('DELETE', `/api/application/${applicationId}`, null, apiKey)
  await makeApiRequest('DELETE', `/api/application/${applicationId}?hardDelete=true`, null, apiKey)
}

let baselineSystemConfiguration = null

/**
 * Captures the current system configuration as the baseline to restore to
 * after CORS-mutating tests. Must be called once before any test that
 * modifies system configuration (e.g. application:create --profile spa/native).
 * @param {string} apiKey - API key
 * @returns {Promise<object>}
 */
export async function captureSystemConfigurationBaseline(apiKey = DEFAULT_API_KEY) {
  const data = await makeApiRequest('GET', '/api/system-configuration', null, apiKey)
  baselineSystemConfiguration = data.systemConfiguration
  return baselineSystemConfiguration
}

/**
 * Restores system configuration to the captured baseline. Uses PUT (full
 * overwrite) rather than PATCH so the restore is exact, not merged.
 * @param {string} apiKey - API key
 * @returns {Promise<void>}
 */
export async function resetSystemConfiguration(apiKey = DEFAULT_API_KEY) {
  if (!baselineSystemConfiguration) {
    throw new Error('captureSystemConfigurationBaseline() must be called before resetSystemConfiguration()')
  }
  await makeApiRequest('PUT', '/api/system-configuration', { systemConfiguration: baselineSystemConfiguration }, apiKey)
}

/**
 * Sleep for specified milliseconds
 * @param {number} ms - Milliseconds to sleep
 * @returns {Promise<void>}
 */
function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms))
}
