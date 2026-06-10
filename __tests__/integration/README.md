# Integration Tests

This directory contains integration tests that verify the `apply` command works end-to-end with a running FusionAuth instance.

## Prerequisites

- Docker and Docker Compose must be installed and running
- Node.js 18+
- Port 9011 must be available (FusionAuth default port)

## Running Tests

### Run All Tests (unit + integration)

```bash
npm test
```

### Run Unit Tests Only (excludes integration)

```bash
npm run test:unit
```

### Run Integration Tests Only

```bash
npm run test:integration
```

### Environment Variables

- `NODE_ENV=test` — Required for test mode (prevents `process.exit()` calls in executeAction)
- `SKIP_TEARDOWN=true` — Keep FusionAuth container running after tests (useful for debugging)
- `REUSE_CONTAINER=true` — Reuse existing FusionAuth container instead of creating new one
- `FUSIONAUTH_TELEMETRY=false` — Disable telemetry in tests

## What Integration Tests Cover

Currently, the integration tests verify the following scenario:

1. **POC Kickstart Configuration** — Applies a complete kickstart configuration that:
   - Configures SMTP email settings (host, port, security, default from email, username)
   - Creates an admin user with application registration and admin role
   - Validates all settings are properly persisted in the FusionAuth instance

## How It Works

1. `setup.js` — Manages FusionAuth container lifecycle:
   - Loads docker-compose from `fixtures/kickstarts/fusionauth-integration-test-base/`
   - Starts PostgreSQL, OpenSearch, and FusionAuth containers
   - FusionAuth auto-loads `fusionauth-integration-test-base/kickstart.json` on startup (creates API key)
   - Waits for health checks
   - Provides utilities for API requests using native Node.js fetch

2. `apply/apply.integration.test.js` — Executes the actual tests:
   - Uses `poc/kickstart.json` fixture to apply complete FusionAuth configuration
   - Initializes variable substitution with dynamic variables
   - Makes API requests to running FusionAuth instance
   - Verifies SMTP configuration via tenant API query
   - Verifies user creation and application registration via user API query
   - Uses hardcoded POC test IDs: `appId: '3c219e58-ed0e-4b18-ad48-f4f92793ae32'`, `tenantId: '886a57e0-f2ac-440a-9a9d-d10c17b6f1a1'`

3. `fixtures/kickstarts/` — Test configurations:
   - `poc/kickstart.json` — Complete POC configuration with SMTP settings and admin user
   - `fusionauth-integration-test-base/docker-compose.yml` — Docker Compose for test environment
   - `fusionauth-integration-test-base/kickstart.json` — Auto-loads API key on container startup

## Docker Setup

The integration tests use a self-contained Docker setup located in `fixtures/kickstarts/fusionauth-integration-test-base/`:

- **docker-compose.yml** — Defines PostgreSQL, OpenSearch, and FusionAuth services
- **kickstart.json** — Auto-loads on FusionAuth startup (via `FUSIONAUTH_APP_KICKSTART_FILE`)
- **.env.test** — Generated at runtime with database credentials

The FusionAuth container will automatically:
1. Initialize PostgreSQL database
2. Configure search engine (OpenSearch)
3. Load the API key from `kickstart.json`
4. Be ready to accept requests on `http://localhost:9011`

## Test Architecture

The integration tests use a three-layer architecture:

1. **Layer 1: CLI Wrapper** (`action()`) — Command-line interface entry point
2. **Layer 2: Action Handler** (`executeAction()`) — Returns `{success: boolean, error?: string, results?: any}` without calling `process.exit()`
3. **Layer 3: Core Logic** (`executeKickstart()`) — Handles kickstart file parsing and API request execution

This architecture allows tests to run in Node.js test runner while preserving CLI behavior in production mode.

## Debugging

If tests fail, check:

1. **Docker availability** — Run `docker ps` and `docker-compose --version`
2. **Logs** — Check FusionAuth container logs: `docker logs fusionauth-1` (or check exact container name with `docker ps`)
3. **Port conflicts** — Ensure port 9011 is not in use
4. **Network issues** — Check Docker network connectivity
5. **NODE_ENV** — Always set `NODE_ENV=test` when running tests to prevent `process.exit()` calls
6. **Container reuse** — Use `SKIP_TEARDOWN=true REUSE_CONTAINER=true` to keep containers running between test runs for faster iteration

## Troubleshooting

### Container won't start

Clear previous containers and volumes:
```bash
cd __tests__/integration/fixtures/kickstarts/fusionauth-integration-test-base
docker-compose down -v
cd - && npm run test:integration
```

### Tests timeout waiting for FusionAuth

FusionAuth container can take 30-60 seconds to start. Increase the `HEALTH_CHECK_TIMEOUT` in `setup.js` if needed (default: 120000ms).

### Tests fail with NODE_ENV errors

Always set `NODE_ENV=test` when running tests. This prevents `executeAction()` from calling `process.exit()`:
```bash
npm run test:integration
```

### API requests fail with 401 or authentication errors

The API key is generated automatically by the FusionAuth container from `kickstart.json`. Ensure:
1. The container is fully started (wait for health check)
2. The API key in `setup.js` matches the generated key: `'90dd6b25-d1ef-4175-9656-159dd994932e'`
3. The FusionAuth container has fully initialized (check logs with `docker logs fusionauth-1`)

### SMTP configuration not persisted

Verify that:
1. The PATCH request to `/api/tenant/{tenantId}` completes successfully
2. The tenantId in the test matches the actual FusionAuth default tenant ID
3. The SMTP configuration in `poc/kickstart.json` is valid

### Port 9011 already in use

Kill the process using port 9011:
```bash
lsof -i :9011
kill -9 <PID>
```

Or use a different port by modifying `setup.js`.
