import {Command, Option} from "@commander-js/extra-typings";
import {
    Application,
    FusionAuthClient,
    GrantType,
    Oauth2AuthorizedURLValidationPolicy,
    ProofKeyForCodeExchangePolicy,
    ReactorFeatureStatus,
    RefreshTokenUsagePolicy,
    Tenant,
} from '@fusionauth/typescript-client';
import chalk from "chalk";
import {errorAndExit} from '../utils.js';
import {apiKeyOption, hostOption} from "../options.js";

// -- Types -------------------------------------------------------------------

type CheckSeverity = 'required' | 'warning';

interface CheckResult {
    name: string;
    passed: boolean;
    severity: CheckSeverity;
    message: string;
    details?: string[];
    specSection?: string;
    specUrl?: string;
}

interface AppCheckContext {
    app: Application;
    appName: string;
    appId: string;
}

interface JsonOutput {
    compliant: boolean;
    tenantsChecked: number;
    applicationsChecked: number;
    applicationsSkipped: number;
    filters: {
        tenantId: string | null;
        applicationId: string | null;
    };
    checks: Record<string, {
        severity: string;
        passed: boolean;
        message: string;
        details?: string[];
        specSection?: string;
        specUrl?: string;
    }>;
    criticalIssues: string[];
    warnings: string[];
    educationalLinks: Record<string, string>;
}

// -- Options -----------------------------------------------------------------

const applicationIdOption = new Option(
    '--application-id <id>',
    'Check a specific application only'
);

const tenantIdOption = new Option(
    '--tenant-id <id>',
    'Check all applications in a specific tenant'
);

const strictOption = new Option(
    '--strict',
    'Fail if deprecated grants (Implicit or Password) are enabled'
).default(false);

const jsonOption = new Option(
    '--json',
    'Output results as JSON'
).default(false);

const verboseOption = new Option(
    '--verbose',
    'Show detailed per-application breakdown'
).default(false);

// -- Helpers -----------------------------------------------------------------

const SPEC_BASE = 'https://datatracker.ietf.org/doc/html/draft-ietf-oauth-v2-1-15';

/** Well-known fixed ID of the FusionAuth admin UI application. */
const FUSIONAUTH_APP_ID = '3c219e58-ed0e-4b18-ad48-f4f92793ae32';

/** Immutable role ID for the Tenant Manager 'admin' role. */
const TENANT_MANAGER_ADMIN_ROLE_ID = '631ecd9d-8d40-4c13-8277-80cedb823714';

function specUrl(section: string): string {
    return `${SPEC_BASE}#section-${section}`;
}

function isLocalhostUri(uri: string): boolean {
    try {
        const url = new URL(uri);
        return url.hostname === 'localhost' || url.hostname === '127.0.0.1' || url.hostname === '::1';
    } catch {
        return false;
    }
}

/**
 * Detect built-in FusionAuth applications that are not under the developer's
 * control and should be excluded from all OAuth 2.1 checks.
 *
 * - FusionAuth admin UI: identified by its fixed well-known application ID.
 * - Tenant Manager: identified by the combination of being a universal
 *   application, having a single redirect of "/tenant-manager", and containing
 *   a role with the immutable ID 631ecd9d-8d40-4c13-8277-80cedb823714 named
 *   "admin".
 */
function isBuiltInApplication(app: Application): boolean {
    // FusionAuth admin UI
    if (app.id === FUSIONAUTH_APP_ID) {
        return true;
    }

    // Tenant Manager — universal application with specific redirect and role
    if (app.universalConfiguration?.universal !== true) {
        return false;
    }

    const redirects = app.oauthConfiguration?.authorizedRedirectURLs || [];
    if (redirects.length !== 1 || redirects[0] !== '/tenant-manager') {
        return false;
    }

    const hasAdminRole = app.roles?.some(
        r => r.id === TENANT_MANAGER_ADMIN_ROLE_ID && r.name === 'admin'
    ) ?? false;

    return hasAdminRole;
}

function shouldCheckApplication(app: Application): boolean {
    if (isBuiltInApplication(app)) {
        return false;
    }
    const grants = app.oauthConfiguration?.enabledGrants || [];
    return grants.includes(GrantType.authorization_code) && grants.includes(GrantType.refresh_token);
}

function getAppName(app: Application): string {
    return app.name || 'Unnamed Application';
}

function getAppId(app: Application): string {
    return app.id || 'unknown';
}

// -- Individual Checks -------------------------------------------------------

function checkPkce(ctx: AppCheckContext): CheckResult | null {
    const policy = ctx.app.oauthConfiguration?.proofKeyForCodeExchangePolicy;
    if (policy === ProofKeyForCodeExchangePolicy.Required) {
        return null; // pass
    }
    return {
        name: 'pkce',
        passed: false,
        severity: 'required',
        message: `Application "${ctx.appName}" (${ctx.appId}): PKCE policy is "${policy || 'not set'}" (must be "Required")`,
        specSection: '7.5',
        specUrl: specUrl('7.5'),
    };
}

function checkRedirectUriValidation(ctx: AppCheckContext): CheckResult | null {
    const policy = ctx.app.oauthConfiguration?.authorizedURLValidationPolicy;
    if (policy === Oauth2AuthorizedURLValidationPolicy.ExactMatch) {
        return null; // pass
    }
    return {
        name: 'redirectUriValidation',
        passed: false,
        severity: 'required',
        message: `Application "${ctx.appName}" (${ctx.appId}): Redirect URI validation is "${policy || 'not set'}" (must be "ExactMatch")`,
        specSection: '4.1.3',
        specUrl: specUrl('4.1.3'),
    };
}

function checkHttpsEnforcement(ctx: AppCheckContext): CheckResult[] {
    const redirectUris = ctx.app.oauthConfiguration?.authorizedRedirectURLs || [];
    const failures: CheckResult[] = [];

    for (const uri of redirectUris) {
        if (uri.startsWith('https://')) {
            continue;
        }
        if (isLocalhostUri(uri)) {
            continue;
        }
        failures.push({
            name: 'httpsEnforcement',
            passed: false,
            severity: 'required',
            message: `Application "${ctx.appName}" (${ctx.appId}): Non-HTTPS redirect URI: ${uri}`,
            specSection: '1.5',
            specUrl: specUrl('1.5'),
        });
    }
    return failures;
}

function checkRefreshTokenRotation(ctx: AppCheckContext): CheckResult | null {
    const policy = ctx.app.jwtConfiguration?.refreshTokenUsagePolicy;
    if (policy === RefreshTokenUsagePolicy.OneTimeUse) {
        return null; // pass
    }
    return {
        name: 'refreshTokenRotation',
        passed: false,
        severity: 'required',
        message: `Application "${ctx.appName}" (${ctx.appId}): Refresh token usage policy is "${policy || 'not set'}" (must be "OneTimeUse")`,
        specSection: '4.3',
        specUrl: specUrl('4.3'),
    };
}

function checkDeprecatedGrants(ctx: AppCheckContext, strict: boolean): CheckResult[] {
    const grants = ctx.app.oauthConfiguration?.enabledGrants || [];
    const failures: CheckResult[] = [];
    const severity: CheckSeverity = strict ? 'required' : 'warning';

    if (grants.includes(GrantType.implicit)) {
        failures.push({
            name: 'deprecatedGrants',
            passed: false,
            severity,
            message: `Application "${ctx.appName}" (${ctx.appId}): Implicit grant is enabled (removed in OAuth 2.1)`,
            specSection: '10.1',
            specUrl: specUrl('10.1'),
        });
    }
    if (grants.includes(GrantType.password)) {
        failures.push({
            name: 'deprecatedGrants',
            passed: false,
            severity,
            message: `Application "${ctx.appName}" (${ctx.appId}): Password grant is enabled (removed in OAuth 2.1)`,
            specSection: '10',
            specUrl: specUrl('10'),
        });
    }
    return failures;
}

/**
 * DPoP is an instance-level capability, not a per-application setting.
 * FusionAuth automatically handles DPoP when the client initiates a DPoP flow
 * — there is no server-side toggle to enable it. The only prerequisite is an
 * Enterprise license.
 *
 * See: https://fusionauth.io/docs/lifecycle/authenticate-users/oauth/dpop
 */
function checkDpop(dpopFeatureActive: boolean): CheckResult | null {
    if (!dpopFeatureActive) {
        return {
            name: 'dpop',
            passed: false,
            severity: 'warning',
            message: 'DPoP unavailable: Enterprise license required. DPoP sender-constrains tokens to the client that requested them (§1.4.3).',
            details: [
                'DPoP requires no server-side configuration — FusionAuth handles it automatically when the client initiates a DPoP flow.',
                'However, an Enterprise license is required for this feature.',
                'See: https://fusionauth.io/docs/lifecycle/authenticate-users/oauth/dpop',
            ],
            specSection: '1.4.3',
            specUrl: specUrl('1.4.3'),
        };
    }
    return null; // pass — DPoP is available, clients can use it at will
}

function checkTenantIssuer(tenant: Tenant): CheckResult | null {
    const issuer = tenant.issuer || '';
    const tenantName = tenant.name || 'Unnamed Tenant';
    const tenantId = tenant.id || 'unknown';

    if (issuer && issuer !== 'acme.com') {
        return null; // pass
    }

    const reason = issuer === 'acme.com'
        ? 'still set to default "acme.com"'
        : 'not configured';

    return {
        name: 'tenantIssuer',
        passed: false,
        severity: 'required',
        message: `Tenant "${tenantName}" (${tenantId}): Issuer ${reason} (must be set to your domain)`,
    };
}

function checkRefreshTokenRevocationOnReuse(tenant: Tenant): CheckResult | null {
    const tenantName = tenant.name || 'Unnamed Tenant';
    const tenantId = tenant.id || 'unknown';

    // onOneTimeTokenReuse is now properly typed in the v1.64.0 client.
    const onReuse = tenant.jwtConfiguration?.refreshTokenRevocationPolicy?.onOneTimeTokenReuse === true;

    if (onReuse) {
        return null; // pass
    }

    return {
        name: 'refreshTokenRevocationOnReuse',
        passed: false,
        severity: 'required',
        message: `Tenant "${tenantName}" (${tenantId}): Refresh token revocation on one-time token reuse is not enabled`,
        details: [
            'Set tenant.jwtConfiguration.refreshTokenRevocationPolicy.onOneTimeTokenReuse = true',
            'This detects token theft when a one-time use refresh token is replayed.',
        ],
        specSection: '4.3',
        specUrl: specUrl('4.3'),
    };
}

function checkAuthCodeLifetime(tenant: Tenant): CheckResult | null {
    const tenantName = tenant.name || 'Unnamed Tenant';
    const tenantId = tenant.id || 'unknown';
    const ttl = tenant.externalIdentifierConfiguration?.authorizationGrantIdTimeToLiveInSeconds;

    if (ttl === undefined || ttl === null) {
        return null; // can't check, skip
    }

    if (ttl <= 600) {
        return null; // pass
    }

    return {
        name: 'authCodeLifetime',
        passed: false,
        severity: 'warning',
        message: `Tenant "${tenantName}" (${tenantId}): Authorization code lifetime is ${ttl} seconds (recommend <= 600)`,
        specSection: '7.5',
        specUrl: specUrl('7.5'),
    };
}

// -- Main Action -------------------------------------------------------------

const action = async function (options: {
    key: string;
    host: string;
    applicationId?: string;
    tenantId?: string;
    strict: boolean;
    json: boolean;
    verbose: boolean;
}) {
    const {key: apiKey, host, applicationId, tenantId, strict, json: jsonOutput, verbose} = options;

    if (!jsonOutput) {
        console.log(chalk.blue(`Checking OAuth 2.1 compliance on ${host}...`));
        console.log(chalk.blue(`Reference: draft-ietf-oauth-v2-1-15\n`));
    }

    const results: CheckResult[] = [];

    try {
        const client = new FusionAuthClient(apiKey, host);

        // -- Fetch data ------------------------------------------------------

        // Reactor status (for DPoP check — DPoP requires Enterprise license)
        let dpopFeatureActive: boolean | undefined;
        let dpopStatusError: unknown;
        try {
            const reactorResponse = await client.retrieveReactorStatus();
            if (reactorResponse.wasSuccessful()) {
                dpopFeatureActive = reactorResponse.response.status?.dPoP === ReactorFeatureStatus.ACTIVE;
            } else {
                dpopFeatureActive = undefined;
            }
        } catch (e: unknown) {
            dpopFeatureActive = undefined;
            dpopStatusError = e;
        }

        if (dpopFeatureActive === undefined && verbose && !jsonOutput) {
            const errorDetail = dpopStatusError instanceof Error
                ? `: ${dpopStatusError.message}`
                : dpopStatusError
                    ? `: ${String(dpopStatusError)}`
                    : '';
            console.warn(chalk.yellow(`Warning: Unable to determine DPoP Reactor status${errorDetail}. DPoP availability is unknown.`));
        }
        // Tenants
        const tenantResponse = await client.retrieveTenants();
        if (!tenantResponse.wasSuccessful() || !tenantResponse.response.tenants) {
            errorAndExit('Failed to retrieve tenants.');
            return;
        }

        let tenants = tenantResponse.response.tenants;
        if (tenantId) {
            tenants = tenants.filter(t => t.id === tenantId);
            if (tenants.length === 0) {
                errorAndExit(`Tenant with ID "${tenantId}" not found.`);
                return;
            }
        }

        // Applications
        let allApps: Application[] = [];
        if (applicationId) {
            const appResponse = await client.retrieveApplication(applicationId);
            if (!appResponse.wasSuccessful() || !appResponse.response.application) {
                errorAndExit(`Application with ID "${applicationId}" not found.`);
                return;
            }
            allApps = [appResponse.response.application];

            // Validate the application belongs to the specified tenant
            if (tenantId && allApps[0].tenantId !== tenantId) {
                errorAndExit(`Application "${allApps[0].name || applicationId}" belongs to tenant "${allApps[0].tenantId}", not the specified tenant "${tenantId}".`);
                return;
            }

            // Narrow tenant-level checks to just this application's tenant
            if (!tenantId) {
                tenants = tenants.filter(t => t.id === allApps[0].tenantId);
            }
        } else {
            const appsResponse = await client.retrieveApplications();
            if (!appsResponse.wasSuccessful() || !appsResponse.response.applications) {
                errorAndExit('Failed to retrieve applications.');
                return;
            }
            allApps = appsResponse.response.applications;
        }

        // Filter applications by tenant if needed
        if (tenantId && !applicationId) {
            allApps = allApps.filter(app => app.tenantId === tenantId);
        }

        // Separate into checked and skipped in a single pass
        const appsToCheck: Application[] = [];
        const skippedApps: Application[] = [];
        for (const app of allApps) {
            if (shouldCheckApplication(app)) {
                appsToCheck.push(app);
            } else {
                skippedApps.push(app);
            }
        }

        if (!jsonOutput) {
            console.log(chalk.cyan(`Tenants checked: ${tenants.length}`));
            console.log(chalk.cyan(`Applications checked: ${appsToCheck.length}${tenantId ? ' (in selected tenant)' : applicationId ? '' : ' (across all tenants)'}`));
            console.log(chalk.cyan(`Applications skipped: ${skippedApps.length} (built-in FusionAuth apps or not using authorization_code + refresh_token grants)\n`));
        }

        if (appsToCheck.length === 0) {
            if (applicationId) {
                // The user explicitly requested this app but it was filtered out
                const app = allApps[0];
                if (app && isBuiltInApplication(app)) {
                    if (!jsonOutput) {
                        console.log(chalk.yellow(`Application "${app.name || applicationId}" is a built-in FusionAuth application and is excluded from OAuth 2.1 checks.`));
                    }
                } else {
                    const grants = app?.oauthConfiguration?.enabledGrants || [];
                    if (!jsonOutput) {
                        console.log(chalk.yellow(`Application "${app?.name || applicationId}" does not use both authorization_code and refresh_token grants.`));
                        console.log(chalk.yellow(`Enabled grants: ${grants.length > 0 ? grants.join(', ') : 'none'}`));
                    }
                }
            } else {
                if (!jsonOutput) {
                    console.log(chalk.yellow('No applications found using both authorization_code and refresh_token grants.'));
                    console.log(chalk.yellow('Nothing to check for OAuth 2.1 compliance.'));
                }
            }
        }

        // -- Tenant-level checks ---------------------------------------------

        for (const tenant of tenants) {
            const issuerResult = checkTenantIssuer(tenant);
            if (issuerResult) results.push(issuerResult);

            const revocationResult = checkRefreshTokenRevocationOnReuse(tenant);
            if (revocationResult) results.push(revocationResult);

            const authCodeResult = checkAuthCodeLifetime(tenant);
            if (authCodeResult) results.push(authCodeResult);
        }

        // -- Instance-level checks -------------------------------------------

        const dpopResult = checkDpop(dpopFeatureActive ?? false);
        if (dpopResult) results.push(dpopResult);

        // -- Application-level checks ----------------------------------------

        for (const app of appsToCheck) {
            const ctx: AppCheckContext = {
                app,
                appName: getAppName(app),
                appId: getAppId(app),
            };

            if (verbose && !jsonOutput) {
                console.log(chalk.cyan(`\nApplication: "${ctx.appName}" (${ctx.appId})`));
            }

            // Required checks
            const pkceResult = checkPkce(ctx);
            if (pkceResult) results.push(pkceResult);
            if (verbose && !jsonOutput) {
                console.log(pkceResult
                    ? chalk.red(`  ✗ PKCE: ${ctx.app.oauthConfiguration?.proofKeyForCodeExchangePolicy || 'not set'}`)
                    : chalk.green(`  ✓ PKCE: Required`));
            }

            const redirectResult = checkRedirectUriValidation(ctx);
            if (redirectResult) results.push(redirectResult);
            if (verbose && !jsonOutput) {
                console.log(redirectResult
                    ? chalk.red(`  ✗ Redirect URI validation: ${ctx.app.oauthConfiguration?.authorizedURLValidationPolicy || 'not set'}`)
                    : chalk.green(`  ✓ Redirect URI validation: ExactMatch`));
            }

            const httpsResults = checkHttpsEnforcement(ctx);
            results.push(...httpsResults);
            if (verbose && !jsonOutput) {
                if (httpsResults.length > 0) {
                    for (const r of httpsResults) {
                        console.log(chalk.red(`  ✗ ${r.message}`));
                    }
                } else {
                    console.log(chalk.green(`  ✓ HTTPS enforcement: All redirect URIs valid`));
                }
            }

            const rotationResult = checkRefreshTokenRotation(ctx);
            if (rotationResult) results.push(rotationResult);
            if (verbose && !jsonOutput) {
                console.log(rotationResult
                    ? chalk.red(`  ✗ Refresh token rotation: ${ctx.app.jwtConfiguration?.refreshTokenUsagePolicy || 'not set'}`)
                    : chalk.green(`  ✓ Refresh token rotation: OneTimeUse`));
            }

            // Warning checks
            const deprecatedResults = checkDeprecatedGrants(ctx, strict);
            results.push(...deprecatedResults);
            if (verbose && !jsonOutput) {
                if (deprecatedResults.length > 0) {
                    for (const r of deprecatedResults) {
                        const icon = strict ? '✗' : '⚠';
                        const color = strict ? chalk.red : chalk.yellow;
                        console.log(color(`  ${icon} ${r.message}`));
                    }
                } else {
                    console.log(chalk.green(`  ✓ No deprecated grants enabled`));
                }
            }
        }

        // -- Aggregate results -----------------------------------------------

        const criticalFailures = results.filter(r => r.severity === 'required' && !r.passed);
        const warnings = results.filter(r => r.severity === 'warning' && !r.passed);
        const allRequiredPassed = criticalFailures.length === 0;

        // -- Summary by check name -------------------------------------------

        const pkceTotal = appsToCheck.length;
        const pkcePass = pkceTotal - results.filter(r => r.name === 'pkce').length;

        const redirectTotal = appsToCheck.length;
        const redirectPass = redirectTotal - results.filter(r => r.name === 'redirectUriValidation').length;

        const httpsFailCount = results.filter(r => r.name === 'httpsEnforcement').length;

        const rotationTotal = appsToCheck.length;
        const rotationPass = rotationTotal - results.filter(r => r.name === 'refreshTokenRotation').length;

        const revocationFailCount = results.filter(r => r.name === 'refreshTokenRevocationOnReuse').length;

        const issuerFailCount = results.filter(r => r.name === 'tenantIssuer').length;

        const dpopAvailable = dpopResult === null;

        const authCodeFailCount = results.filter(r => r.name === 'authCodeLifetime').length;

        const deprecatedFailCount = results.filter(r => r.name === 'deprecatedGrants').length;

        // -- Output ----------------------------------------------------------

        if (jsonOutput) {
            const output: JsonOutput = {
                compliant: allRequiredPassed,
                tenantsChecked: tenants.length,
                applicationsChecked: appsToCheck.length,
                applicationsSkipped: skippedApps.length,
                filters: {
                    tenantId: tenantId || null,
                    applicationId: applicationId || null,
                },
                checks: {},
                criticalIssues: criticalFailures.map(r => r.message),
                warnings: warnings.map(r => r.message),
                educationalLinks: {
                    'oauth21Spec': SPEC_BASE,
                    'pkce': specUrl('7.5'),
                    'redirectUri': specUrl('4.1.3'),
                    'https': specUrl('1.5'),
                    'senderConstrainedTokens': specUrl('1.4.3'),
                    'refreshTokenSecurity': specUrl('4.3'),
                    'deprecatedGrants': specUrl('10'),
                    'fusionAuthOAuthConfig': 'https://fusionauth.io/docs/apis/applications',
                    'fusionAuthTenantConfig': 'https://fusionauth.io/docs/apis/tenants',
                    'fusionAuthDPoP': 'https://fusionauth.io/docs/lifecycle/authenticate-users/oauth/dpop',
                },
            };

            // Add individual check results
            output.checks['pkce'] = {
                severity: 'required',
                passed: pkcePass === pkceTotal,
                message: pkcePass === pkceTotal
                    ? `All applications require PKCE (${pkcePass}/${pkceTotal})`
                    : `${pkceTotal - pkcePass} application(s) do not require PKCE (${pkcePass}/${pkceTotal} compliant)`,
                specSection: '7.5',
                specUrl: specUrl('7.5'),
            };
            output.checks['redirectUriValidation'] = {
                severity: 'required',
                passed: redirectPass === redirectTotal,
                message: redirectPass === redirectTotal
                    ? `All applications use exact match redirect URI validation (${redirectPass}/${redirectTotal})`
                    : `${redirectTotal - redirectPass} application(s) allow wildcard redirect URIs (${redirectPass}/${redirectTotal} compliant)`,
                specSection: '4.1.3',
                specUrl: specUrl('4.1.3'),
            };
            output.checks['httpsEnforcement'] = {
                severity: 'required',
                passed: httpsFailCount === 0,
                message: httpsFailCount === 0
                    ? 'All redirect URIs use HTTPS (or localhost)'
                    : `${httpsFailCount} non-HTTPS redirect URI(s) found`,
                details: results.filter(r => r.name === 'httpsEnforcement').map(r => r.message),
                specSection: '1.5',
                specUrl: specUrl('1.5'),
            };
            output.checks['refreshTokenRotation'] = {
                severity: 'required',
                passed: rotationPass === rotationTotal,
                message: rotationPass === rotationTotal
                    ? `All applications use one-time use refresh tokens (${rotationPass}/${rotationTotal})`
                    : `${rotationTotal - rotationPass} application(s) do not use one-time use refresh tokens (${rotationPass}/${rotationTotal} compliant)`,
                specSection: '4.3',
                specUrl: specUrl('4.3'),
            };
            output.checks['refreshTokenRevocationOnReuse'] = {
                severity: 'required',
                passed: revocationFailCount === 0,
                message: revocationFailCount === 0
                    ? 'All tenants have refresh token revocation on reuse enabled'
                    : `${revocationFailCount} tenant(s) do not have refresh token revocation on reuse enabled`,
                specSection: '4.3',
                specUrl: specUrl('4.3'),
            };
            output.checks['tenantIssuer'] = {
                severity: 'required',
                passed: issuerFailCount === 0,
                message: issuerFailCount === 0
                    ? `All tenant issuers properly configured (${tenants.length}/${tenants.length})`
                    : `${issuerFailCount} tenant(s) have improperly configured issuers`,
            };
            output.checks['dpop'] = {
                severity: 'warning',
                passed: dpopAvailable,
                message: dpopAvailable
                    ? 'DPoP available (Enterprise license active). Clients can initiate DPoP flows — no server-side configuration needed.'
                    : 'DPoP unavailable (Enterprise license required). Sender-constrained tokens are recommended by OAuth 2.1 §1.4.3.',
                specSection: '1.4.3',
                specUrl: specUrl('1.4.3'),
            };
            output.checks['authCodeLifetime'] = {
                severity: 'warning',
                passed: authCodeFailCount === 0,
                message: authCodeFailCount === 0
                    ? 'Authorization code lifetime within recommended range'
                    : `${authCodeFailCount} tenant(s) have authorization code lifetime exceeding 600 seconds`,
                specSection: '7.5',
                specUrl: specUrl('7.5'),
            };
            output.checks['deprecatedGrants'] = {
                severity: strict ? 'required' : 'warning',
                passed: deprecatedFailCount === 0,
                message: deprecatedFailCount === 0
                    ? 'No deprecated grants enabled'
                    : `${deprecatedFailCount} deprecated grant(s) found`,
                details: results.filter(r => r.name === 'deprecatedGrants').map(r => r.message),
                specSection: '10',
                specUrl: specUrl('10'),
            };

            console.log(JSON.stringify(output, null, 2));
        } else {
            // Human-readable output
            if (!verbose) {
                // Summary lines
                console.log(pkcePass === pkceTotal
                    ? chalk.green(`✓ PKCE enforcement: Required (${pkcePass}/${pkceTotal} applications)`)
                    : chalk.red(`✗ PKCE enforcement: ${pkceTotal - pkcePass}/${pkceTotal} applications not compliant`));

                console.log(redirectPass === redirectTotal
                    ? chalk.green(`✓ Redirect URI validation: ExactMatch (${redirectPass}/${redirectTotal} applications)`)
                    : chalk.red(`✗ Redirect URI validation: ${redirectTotal - redirectPass}/${redirectTotal} applications using wildcards`));

                console.log(httpsFailCount === 0
                    ? chalk.green(`✓ HTTPS enforcement: All redirect URIs valid`)
                    : chalk.red(`✗ HTTPS enforcement: ${httpsFailCount} non-HTTPS redirect URI(s) found`));

                console.log(rotationPass === rotationTotal
                    ? chalk.green(`✓ Refresh token rotation: OneTimeUse (${rotationPass}/${rotationTotal} applications)`)
                    : chalk.red(`✗ Refresh token rotation: ${rotationTotal - rotationPass}/${rotationTotal} applications not using OneTimeUse`));

                console.log(revocationFailCount === 0
                    ? chalk.green(`✓ Refresh token revocation on reuse: Enabled (${tenants.length}/${tenants.length} tenants)`)
                    : chalk.red(`✗ Refresh token revocation on reuse: Disabled on ${revocationFailCount} tenant(s)`));

                console.log(issuerFailCount === 0
                    ? chalk.green(`✓ Tenant issuer: Properly configured (${tenants.length}/${tenants.length} tenants)`)
                    : chalk.red(`✗ Tenant issuer: ${issuerFailCount} tenant(s) not properly configured`));

                console.log(dpopAvailable
                    ? chalk.green(`✓ DPoP (sender-constrained tokens): Available (Enterprise license active)`)
                    : chalk.yellow(`⚠ DPoP (sender-constrained tokens): Unavailable (Enterprise license required)`));

                console.log(authCodeFailCount === 0
                    ? chalk.green(`✓ Authorization code lifetime: Within recommended range`)
                    : chalk.yellow(`⚠ Authorization code lifetime: ${authCodeFailCount} tenant(s) exceed 600 seconds`));

                const deprecatedIcon = strict ? '✗' : '⚠';
                const deprecatedColor = strict ? chalk.red : chalk.yellow;
                console.log(deprecatedFailCount === 0
                    ? chalk.green(`✓ Deprecated grants: None enabled`)
                    : deprecatedColor(`${deprecatedIcon} Deprecated grants: ${deprecatedFailCount} deprecated grant(s) found${strict ? '' : ' (use --strict to fail)'}`));
            }

            // Final summary
            console.log(chalk.blue('\n=== OAuth 2.1 Compliance Summary ===\n'));

            if (allRequiredPassed) {
                console.log(chalk.green.bold('SUCCESS: Your FusionAuth instance meets OAuth 2.1 requirements.'));
                if (warnings.length > 0) {
                    console.log(chalk.yellow(`\nWarnings (RECOMMENDED):`));
                    for (const w of warnings) {
                        console.log(chalk.yellow(`  - ${w.message}`));
                    }
                }
            } else {
                console.log(chalk.red.bold('FAILED: Your FusionAuth instance is NOT OAuth 2.1 compliant.\n'));

                console.log(chalk.red('Critical issues (MUST FIX):'));
                for (const f of criticalFailures) {
                    console.log(chalk.red(`  - ${f.message}`));
                    if (f.details) {
                        for (const d of f.details) {
                            console.log(chalk.red(`    ${d}`));
                        }
                    }
                }

                if (warnings.length > 0) {
                    console.log(chalk.yellow('\nWarnings (RECOMMENDED):'));
                    for (const w of warnings) {
                        console.log(chalk.yellow(`  - ${w.message}`));
                    }
                }
            }

            // Educational links
            console.log(chalk.blue('\nFor more information:'));
            console.log(chalk.cyan(`  - OAuth 2.1 Specification: ${SPEC_BASE}`));
            console.log(chalk.cyan(`    - PKCE (Section 7.5): ${specUrl('7.5')}`));
            console.log(chalk.cyan(`    - Redirect URI (Section 4.1.3): ${specUrl('4.1.3')}`));
            console.log(chalk.cyan(`    - HTTPS (Section 1.5): ${specUrl('1.5')}`));
            console.log(chalk.cyan(`    - Sender-Constrained Tokens (Section 1.4.3): ${specUrl('1.4.3')}`));
            console.log(chalk.cyan(`    - Refresh Token Security (Section 4.3): ${specUrl('4.3')}`));
            console.log(chalk.cyan(`    - Deprecated Grants (Section 10): ${specUrl('10')}`));
            console.log(chalk.cyan(`  - FusionAuth OAuth Configuration: https://fusionauth.io/docs/apis/applications`));
            console.log(chalk.cyan(`  - FusionAuth Tenant Configuration: https://fusionauth.io/docs/apis/tenants`));
            console.log(chalk.cyan(`  - FusionAuth DPoP: https://fusionauth.io/docs/lifecycle/authenticate-users/oauth/dpop`));
        }

        if (!allRequiredPassed) {
            process.exit(1);
        }

    } catch (e: unknown) {
        errorAndExit('OAuth 2.1 compliance check error:', e);
    }
}

// -- Command -----------------------------------------------------------------

// noinspection JSUnusedGlobalSymbols
export const checkOAuth21 = new Command('check:oauth-2-1')
    .description('Checks FusionAuth configuration for OAuth 2.1 compliance (draft-ietf-oauth-v2-1-15)')
    .addOption(apiKeyOption)
    .addOption(hostOption)
    .addOption(applicationIdOption)
    .addOption(tenantIdOption)
    .addOption(strictOption)
    .addOption(jsonOption)
    .addOption(verboseOption)
    .action(action);
