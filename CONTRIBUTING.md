# Contributing

## Command Structure
Commands generally follow the form:

fusionauth namespace:command [--command-option] ...

Where
* Commands are grouped into a functional or domain namespace
* Option names use kebab-case (e.g. `--admin-email`, `--number-of-files`)
* Sensitive items can be passed via environment variable. In this case use `--option-name-env ENV_VAR` to indicate that the value is coming from the specified environment variable

## Risky Operations Policy

Commands that perform risky operations must gate execution behind user confirmation using `confirmOrExit()` from `src/utils.ts`. All such commands must expose a `--yes` flag.

## Testing

### Running the tests

```bash
# Unit tests (run these before every commit)
npm run test:unit

# Integration tests (requires a live FusionAuth instance)
npm run test:integration

# Full suite
npm run test
```

The integration tests manage a Docker container automatically. Several environment variables control their behaviour:

| Variable | Effect |
|---|---|
| `VERBOSE_CONTAINER=true` | Print each health-check attempt, elapsed time, and error reason; dump `docker compose logs` on failure |
| `REUSE_CONTAINER=true` | Skip container startup and use a FusionAuth instance already running on `localhost:9011` |
| `SKIP_TEARDOWN=true` | Leave the container running after the tests finish (useful for manual inspection) |

### Requirements

- **All new functionality must be covered by tests.** This includes new commands, new options on existing commands, and new utility functions.
- **All existing tests must pass cleanly before a PR is submitted.** A clean run means zero failures — `# fail 0` in the test output.
