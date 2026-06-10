(async () => {
  if (process.env.SKIP_UNIT_TESTS !== 'true') {
    await import("./postInstall/index.js");
    await import("./telemetry/index.js");
    await import("./utilities/kickstart/variable-substitution.test.js");
    await import("./utilities/kickstart/validator.test.js");
  }

  // Integration tests require Docker and FusionAuth instance
  // Run with: npm run test:integration
  if (process.env.RUN_INTEGRATION_TESTS === 'true') {
    await import("./integration/apply/apply.integration.test.js");
  }
})()