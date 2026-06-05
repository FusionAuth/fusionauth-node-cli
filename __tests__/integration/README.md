# Integration Tests

This directory contains integration tests that verify the `apply` command works end-to-end with a running FusionAuth instance.

## Prerequisites

- Docker and Docker Compose must be installed and running
- Node.js 18+
- Port 9011 must be available (FusionAuth default port)

## Running Integration Tests

```bash
npm run test:integration
```

### Run Only Unit Tests (excludes integration)

```bash
npm test
```

### Run Only Integration Tests

```bash
RUN_INTEGRATION_TESTS=true node --test __tests__/integration/
```

## What Integration Tests Cover

The integration tests verify the following scenarios:

1. **Simple Application Creation** — Creating a basic application in FusionAuth
2. **Multi-Request Workflows** — Multiple requests with variable substitution (POST + PATCH)
3. **User Creation with Application Registration** — Creating users and registering them to applications
4. **Error Handling** — Graceful error handling for invalid requests
5. **Application Listing** — Retrieving all applications via API
6. **Variable Resolution** — Multiple concurrent UUID generations and variable resolution

## How It Works

1. `setup.js` — Manages FusionAuth container lifecycle:
   - Loads docker-compose from `fixtures/kickstarts/fusionauth-integration-test-base/`
   - Starts PostgreSQL, OpenSearch, and FusionAuth containers
   - FusionAuth auto-loads `fusionauth-integration-test-base/kickstart.json` on startup (creates API key)
   - Waits for health checks
   - Provides utilities for API requests using native Node.js fetch

2. `apply/apply.integration.test.js` — Executes the actual tests:
   - Uses `simple-app.json`, `app-with-oauth.json`, `app-with-users.json` fixtures
   - Initializes variable substitution
   - Makes API requests to running FusionAuth instance
   - Verifies results by querying the API

3. `fixtures/kickstarts/` — Test configurations:
   - `simple-app.json` — Basic application
   - `app-with-oauth.json` — Application with OAuth configuration
   - `app-with-users.json` — Application with user creation
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

## Debugging

If tests fail, check:

1. **Docker availability** — Run `docker ps` and `docker-compose --version`
2. **Logs** — Check FusionAuth container logs: `docker logs fusionauth_fusionauth_1`
3. **Port conflicts** — Ensure port 9011 is not in use
4. **Network issues** — Check Docker network connectivity

## Troubleshooting

### Container won't start

Clear previous containers:
```bash
docker-compose down -v
```

### Tests timeout waiting for FusionAuth

FusionAuth container can take 30-60 seconds to start. Increase the `HEALTH_CHECK_TIMEOUT` in `setup.js` if needed.

### API requests fail with 401

Ensure the API key in `setup.js` matches the FusionAuth instance configuration.

### Port 9011 already in use

Kill the process using port 9011:
```bash
lsof -i :9011
kill -9 <PID>
```

Or use a different port by modifying `setup.js`.
