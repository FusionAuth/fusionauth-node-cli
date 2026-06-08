(async () => {
  const { postInstall } = await import("./postInstall/index.js");
  const { telemetry } = await import("./telemetry/index.js");
  const { variableSubstitution } = await import("./utilities/kickstart/variable-substitution.test.js");
  const { validator } = await import("./utilities/kickstart/validator.test.js");

  if (process.env.SKIP_UNIT_TESTS !== 'true') {
    postInstall()
    telemetry()
    variableSubstitution()
    validator()
  }

  // Integration tests require Docker and FusionAuth instance
  // Run with: npm run test:integration
  if (process.env.RUN_INTEGRATION_TESTS === 'true') {
    const { applyIntegration } = await import("./integration/apply/apply.integration.test.js");
    applyIntegration()
  }
})()