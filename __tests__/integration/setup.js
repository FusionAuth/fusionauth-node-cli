import * as fs from 'node:fs'
import * as path from 'node:path'
import { exec } from 'node:child_process'
import { promisify } from 'node:util'

const execAsync = promisify(exec)

/**
 * Container management for integration tests
 * Handles docker compose lifecycle and FusionAuth readiness checks
 */

const FUSIONAUTH_URL = 'http://localhost:9011'
const DEFAULT_API_KEY = '90dd6b25-d1ef-4175-9656-159dd994932e'
const HEALTH_CHECK_TIMEOUT = 120000 // 2 minutes
const HEALTH_CHECK_INTERVAL = 5000 // 5 seconds
const REQUEST_TIMEOUT = 10000 // 10 seconds

let isContainerRunning = false

/**
 * Start FusionAuth via docker compose
 * @returns {Promise<{url: string, apiKey: string}>}
 */
export async function startFusionAuthContainer() {
  if (isContainerRunning || process.env.REUSE_CONTAINER === 'true') {
    console.log('ℹ Using existing FusionAuth container')
    return { url: FUSIONAUTH_URL, apiKey: DEFAULT_API_KEY }
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

    isContainerRunning = true
    console.log('✓ FusionAuth container started and ready')

    return { url: FUSIONAUTH_URL, apiKey: DEFAULT_API_KEY }
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
      
      const response = await fetch(`${FUSIONAUTH_URL}/api/status`, {
        signal: controller.signal
      })
      clearTimeout(timeoutId)

      if (response.ok) {
        // Verify authenticated API requests work by fetching tenants, there was a problem with the status returning OK but the Key did not work
        let authReady = false
        const authStartTime = Date.now()
        
        while (Date.now() - authStartTime < 30000) { // 30 second timeout for auth readiness
          try {
            const authController = new AbortController()
            const authTimeoutId = setTimeout(() => authController.abort(), 5000)
            
            const tenantsResponse = await fetch(`${FUSIONAUTH_URL}/api/tenant`, {
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
  const url = `${FUSIONAUTH_URL}${path}`
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
 * Sleep for specified milliseconds
 * @param {number} ms - Milliseconds to sleep
 * @returns {Promise<void>}
 */
function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms))
}
