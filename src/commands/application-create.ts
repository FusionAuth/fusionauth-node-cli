import * as fs from 'node:fs';
import {Command, Option} from '@commander-js/extra-typings';
import boxen from 'boxen';
import {
    Application,
    ClientAuthenticationPolicy,
    CORSConfiguration,
    FusionAuthClient,
    GrantType,
    ProofKeyForCodeExchangePolicy,
    RefreshTokenExpirationPolicy,
    RefreshTokenUsagePolicy,
} from '@fusionauth/typescript-client';
import chalk from 'chalk';
import {confirmOrExit, logEvent} from '../utils.js';
import {apiKeyOption, hostOption} from '../options.js';
import * as utils from '../utils.js';

type Profile = 'spa' | 'native' | 'webapp';

export interface ApplicationCreateOptions {
    name?: string;
    profile?: string;
    redirectUri?: string[];
    logoutUrl?: string;
    authorizedOriginUrl?: string[];
    applicationId?: string;
    tenantId?: string;
    data?: string;
    yes?: boolean;
    key: string;
    host: string;
}

export interface ApplicationCreateResult {
    success: boolean;
    error?: string;
    rawError?: unknown;
    applicationId?: string;
    clientId?: string;
    clientSecret?: string;
    name?: string;
}

// Shared refresh token policy for all profiles. A sliding window of
// one-time-use refresh tokens is the recommended default across
// spa/native/webapp — only timeToLiveInSeconds differs per profile.
const defaultRefreshTokenPolicy = {
    refreshTokenUsagePolicy: RefreshTokenUsagePolicy.OneTimeUse,
    refreshTokenExpirationPolicy: RefreshTokenExpirationPolicy.SlidingWindow,
};

// requireRegistration: true means a user must have a registration for this
// application before they can complete the authorization_code/implicit grant.
// registrationConfiguration.enabled is intentionally left false (self-service
// registration is off), so registrations must be created out-of-band — e.g.
// via the Registration API — before a user can log in. See the "Create users"
// Next Steps link printed after a successful create.
function buildPublicClientDefaults(): Application {
    return {
        oauthConfiguration: {
            enabledGrants: [GrantType.authorization_code, GrantType.refresh_token],
            generateRefreshTokens: true,
            proofKeyForCodeExchangePolicy: ProofKeyForCodeExchangePolicy.Required,
            clientAuthenticationPolicy: ClientAuthenticationPolicy.NotRequired,
            requireClientAuthentication: false,
            requireRegistration: true,
        },
        jwtConfiguration: {
            enabled: true,
            timeToLiveInSeconds: 300,
            ...defaultRefreshTokenPolicy,
        },
    };
}

const profileDefaults: Record<Profile, Application> = {
    spa: buildPublicClientDefaults(),
    native: buildPublicClientDefaults(),
    webapp: {
        oauthConfiguration: {
            enabledGrants: [GrantType.authorization_code, GrantType.refresh_token],
            generateRefreshTokens: true,
            proofKeyForCodeExchangePolicy: ProofKeyForCodeExchangePolicy.NotRequiredWhenUsingClientAuthentication,
            clientAuthenticationPolicy: ClientAuthenticationPolicy.Required,
            requireClientAuthentication: true,
            // See comment on buildPublicClientDefaults() above re: requireRegistration.
            requireRegistration: true,
        },
        jwtConfiguration: {
            enabled: true,
            timeToLiveInSeconds: 3600,
            ...defaultRefreshTokenPolicy,
        },
    },
};

const REQUIRED_CORS_HEADERS = ['dpop', 'Authorization', 'Accept'];

/**
 * Wraps an unknown error with additional context while preserving the
 * original value (e.g. a FusionAuth `ClientResponse` rejection, which
 * carries structured `fieldErrors`/`generalErrors`) as `.cause`, so callers
 * further up the stack can still access it for rich reporting instead of
 * only the flattened message string.
 */
function wrapError(message: string, cause: unknown): Error {
    const error = new Error(message);
    (error as Error & {cause?: unknown}).cause = cause;
    return error;
}

/**
 * Unwraps an error produced by wrapError() back to its original cause, for
 * use as ApplicationCreateResult.rawError. Falls back to the error itself
 * when there's no cause (e.g. errors that were never wrapped).
 */
function unwrapError(e: unknown): unknown {
    if (e instanceof Error && 'cause' in e && e.cause !== undefined) {
        return e.cause;
    }
    return e;
}

/**
 * Ensures that the required DPoP-related CORS headers — and, when
 * authorizedOrigins is non-empty, those origins — are present in the
 * FusionAuth system configuration. Also enables CORS if it is currently
 * disabled. Should be called for spa and native profiles before creating
 * the application.
 *
 * Enabling CORS and allowing the right headers is not sufficient on its
 * own: FusionAuth's CORS allowlist (corsConfiguration.allowedOrigins) is a
 * separate, independent setting, and browsers will still block cross-origin
 * requests from a spa/native app's own origin unless it's present there (or
 * allowedOrigins is "*"). --authorized-origin-url is the only source of
 * that origin available to this command, so it's reused here in addition
 * to populating application.oauthConfiguration.authorizedOriginURLs.
 *
 * CORS is a prerequisite for spa/native DPoP flows. If this call fails the
 * entire command is aborted — no application will be created.
 *
 * This mutates system-wide configuration, so it is gated behind
 * confirmOrExit()/--yes and only prompts when a change is actually needed.
 *
 * Note: /api/system-configuration does not accept a tenant ID. The tenant
 * header is cleared for these calls and restored afterward.
 */
async function ensureCorsHeaders(client: FusionAuthClient, yes: boolean, authorizedOrigins: string[]): Promise<void> {
    const originalTenantId = client.tenantId ?? null;
    client.setTenantId(null);

    try {
        let retrieveResponse;
        try {
            retrieveResponse = await client.retrieveSystemConfiguration();
        } catch (e: unknown) {
            throw wrapError(`Error retrieving system configuration: ${e instanceof Error ? e.message : String(e)}`, e);
        }

        const systemConfig = retrieveResponse.response.systemConfiguration!;
        const cors: CORSConfiguration = systemConfig.corsConfiguration ?? {};
        const existing: string[] = cors.allowedHeaders ?? [];
        const existingLower = existing.map((h) => h.toLowerCase());

        const missing = REQUIRED_CORS_HEADERS.filter(
            (h) => !existingLower.includes(h.toLowerCase())
        );

        // Origins are case-sensitive, unlike header names, and "*" already
        // permits every origin — nothing to add in that case.
        const existingOrigins: string[] = cors.allowedOrigins ?? [];
        const missingOrigins = existingOrigins.includes('*')
            ? []
            : authorizedOrigins.filter((o) => !existingOrigins.includes(o));

        const needsEnable = cors.enabled !== true;

        if (missing.length === 0 && missingOrigins.length === 0 && !needsEnable) {
            return;
        }

        const changes = [
            ...(needsEnable ? ['enable CORS'] : []),
            ...(missing.length > 0 ? [`add CORS header(s): ${missing.join(', ')}`] : []),
            ...(missingOrigins.length > 0 ? [`add CORS allowed origin(s): ${missingOrigins.join(', ')}`] : []),
        ].join(' and ');

        await confirmOrExit(
            `This will modify your FusionAuth system configuration to ${changes}. ` +
            'This may allow cross-domain requests that were previously blocked.',
            yes
        );

        try {
            await client.patchSystemConfiguration({
                systemConfiguration: {
                    corsConfiguration: {
                        ...cors,
                        enabled: true,
                        allowedHeaders: [...existing, ...missing],
                        ...(missingOrigins.length > 0
                            ? {allowedOrigins: [...existingOrigins, ...missingOrigins]}
                            : {}),
                    },
                },
            });

            if (missing.length > 0) {
                console.log(`  CORS headers added:         ${missing.join(', ')}`);
            }
            if (missingOrigins.length > 0) {
                console.log(`  CORS allowed origins added: ${missingOrigins.join(', ')}`);
            }
        } catch (e: unknown) {
            throw wrapError(`Error updating CORS configuration: ${e instanceof Error ? e.message : String(e)}`, e);
        }
    } finally {
        client.setTenantId(originalTenantId);
    }
}

/**
 * Parses the --data value. If it begins with '@', reads the referenced file.
 * Otherwise parses the value as inline JSON.
 * Throws an Error on parse or file-read failure (caught by executeApplicationCreate).
 */
function parseData(data: string): Application {
    let json: string;
    if (data.startsWith('@')) {
        const filePath = data.slice(1);
        try {
            json = fs.readFileSync(filePath, 'utf-8');
        } catch (e: unknown) {
            const message = e instanceof Error ? e.message : String(e);
            throw new Error(`Error reading --data file "${filePath}": ${message}`);
        }
    } else {
        json = data;
    }
    try {
        return JSON.parse(json) as Application;
    } catch (e: unknown) {
        const message = e instanceof Error ? e.message : String(e);
        throw new Error(`Error parsing --data JSON: ${message}`);
    }
}

/**
 * Core logic for application:create. Returns a result object on every
 * validation/API failure it detects itself, rather than calling
 * process.exit() directly — this is what allows tests to import and invoke
 * it, and non-CLI callers to handle failures programmatically.
 *
 * One exception: for spa/native profiles, this calls ensureCorsHeaders(),
 * which calls confirmOrExit() to gate a system-wide CORS mutation per this
 * project's Risky Operations convention (see kickstart-kill.ts for the
 * same pattern elsewhere). confirmOrExit() does call process.exit() for a
 * non-interactive caller without yes=true, or an interactive caller who
 * declines — so a direct (non-CLI) caller in that situation will still see
 * the process terminate rather than a returned result. Pass yes: true to
 * avoid this when calling programmatically in a non-interactive context.
 */
export async function executeApplicationCreate(options: ApplicationCreateOptions): Promise<ApplicationCreateResult> {
    const {
        name,
        profile,
        redirectUri,
        logoutUrl,
        authorizedOriginUrl,
        applicationId,
        tenantId,
        data,
        yes,
        key: apiKey,
        host,
    } = options;

    try {
        await logEvent('cli command application:create');

        // --- Mode validation ---
        if (profile && data) {
            return { success: false, error: '--profile and --data are mutually exclusive. Provide one or the other.' };
        }
        if (!profile && !data) {
            return { success: false, error: 'Either --profile <spa|native|webapp> or --data <json|@file.json> is required.' };
        }

        let application: Application;

        if (profile) {
            // --- Profile mode ---
            if (redirectUri === undefined || redirectUri.length === 0) {
                return { success: false, error: '--redirect-uri is required when using --profile.' };
            }
            if (!name) {
                return { success: false, error: '--name is required when using --profile.' };
            }
            if (!(profile in profileDefaults)) {
                return { success: false, error: `--profile must be one of: ${Object.keys(profileDefaults).join(', ')}.` };
            }

            const defaults = profileDefaults[profile as Profile];
            application = {...defaults};
            application.name = name;
            application.oauthConfiguration = {
                ...application.oauthConfiguration,
                authorizedRedirectURLs: redirectUri,
                ...(logoutUrl ? {logoutURL: logoutUrl} : {}),
                ...(authorizedOriginUrl && authorizedOriginUrl.length > 0
                    ? {authorizedOriginURLs: authorizedOriginUrl}
                    : {}),
            };
        } else {
            // --- Custom mode ---
            // --data provides "full custom control": the JSON is the source of
            // truth, and --name/--redirect-uri/--logout-url/--authorized-origin-url
            // are all optional overrides that only take effect if explicitly
            // passed, leaving the JSON's own values untouched otherwise. This
            // mirrors the --application-id/--tenant-id override pattern below,
            // which applies unconditionally in both modes.
            application = parseData(data!);
            if (name) {
                application.name = name;
            }
            if (redirectUri && redirectUri.length > 0) {
                application.oauthConfiguration = {
                    ...application.oauthConfiguration,
                    authorizedRedirectURLs: redirectUri,
                };
            }
            if (logoutUrl) {
                application.oauthConfiguration = {
                    ...application.oauthConfiguration,
                    logoutURL: logoutUrl,
                };
            }
            if (authorizedOriginUrl && authorizedOriginUrl.length > 0) {
                application.oauthConfiguration = {
                    ...application.oauthConfiguration,
                    authorizedOriginURLs: authorizedOriginUrl,
                };
            }
            // Note: unlike --profile mode, this does not call ensureCorsHeaders()
            // — --data mode never mutates system-wide CORS configuration, since
            // "full custom control" means the caller owns their own
            // infrastructure config, not just the application body.
        }

        // --- ID overrides (applied last in both modes) ---
        if (applicationId) {
            application.id = applicationId;
        }
        if (tenantId) {
            application.tenantId = tenantId;
        }

        const fusionAuthClient = new FusionAuthClient(apiKey, host, tenantId);

        // For spa/native profiles, enforce DPoP-required CORS headers (and
        // allowed origins, when provided) first. If this fails (or the user
        // declines the confirmation prompt), the command aborts —
        // createApplication is never called.
        if (profile === 'spa' || profile === 'native') {
            await ensureCorsHeaders(fusionAuthClient, yes ?? false, authorizedOriginUrl ?? []);
        }

        let clientResponse;
        try {
            clientResponse = await fusionAuthClient.createApplication(
                application.id ?? '',
                {application}
            );
        } catch (e: unknown) {
            throw wrapError(`Error creating application: ${e instanceof Error ? e.message : String(e)}`, e);
        }

        const created = clientResponse.response.application!;
        // clientId intentionally mirrors applicationId here: FusionAuth does not
        // allow oauthConfiguration.clientId to be set via the API (it's only
        // ever returned, never accepted as input), so for applications created
        // by this command the two values are always identical.
        const clientId = created.oauthConfiguration?.clientId ?? created.id ?? '';
        const clientSecret = created.oauthConfiguration?.clientSecret;

        return {
            success: true,
            applicationId: created.id,
            clientId,
            clientSecret,
            name: created.name,
        };

    } catch (e: unknown) {
        const message = e instanceof Error ? e.message : String(e);
        return { success: false, error: message, rawError: unwrapError(e) };
    }
}

/**
 * CLI action wrapper — calls executeApplicationCreate and handles output/exit.
 */
const action = async function (options: ApplicationCreateOptions) {
    const result = await executeApplicationCreate(options);

    if (!result.success) {
        utils.errorAndExit(result.error ?? 'Error creating application.', result.rawError);
        return;
    }

    console.log(chalk.green('Application created.'));
    console.log(`  Name:                       ${result.name}`);
    console.log(`  Application ID / client_id: ${result.clientId}`);
    if (result.clientSecret) {
        console.log(`  Client Secret:              ${result.clientSecret}`);
    }

    console.log(boxen(
        [
            `Customize FusionAuth with a ${chalk.cyan('simple theme')}:`,
            '  https://fusionauth.io/docs/customize/look-and-feel/simple-theme-editor',
            '',
            `Create ${chalk.cyan('users')}:`,
            '  https://fusionauth.io/docs/lifecycle/register-users/',
            '',
            `Configure an ${chalk.cyan('SMTP server')}:`,
            '  https://fusionauth.io/docs/customize/email-and-messages/configure-email',
            '',
            `Set up ${chalk.cyan('email templates')}:`,
            '  https://fusionauth.io/docs/customize/email-and-messages/email-templates',
            '',
            `${chalk.cyan('Add login')} to your application:`,
            '  https://fusionauth.io/docs/get-started/start-here/step-1',
            '',
        ].join('\n'),
        {padding: 1, title: 'Next Steps', borderColor: 'green', borderStyle: 'bold'}
    ));
};

// noinspection JSUnusedGlobalSymbols
export const applicationCreate = new Command('application:create')
    .description('Create an application in FusionAuth')
    .option('--name <name>', 'The name of the application (required with --profile; overrides the name in --data if provided)')
    .addOption(
        new Option('--profile <profile>', 'Security profile to apply (mutually exclusive with --data)')
            .choices(['spa', 'native', 'webapp'] as const)
    )
    .option('--redirect-uri <uri...>', 'Authorized redirect URIs (required with --profile)')
    .option('--logout-url <url>', 'Post-logout redirect URL')
    .option('--authorized-origin-url <url...>', 'Authorized origin URLs (for CORS)')
    .option('--data <data>', 'Full application config as inline JSON or @file.json (mutually exclusive with --profile)')
    .option('--application-id <uuid>', 'Application UUID (auto-generated if omitted; overrides --data)')
    .option('--tenant-id <uuid>', 'Tenant UUID (overrides --data)')
    .option('--yes', 'Skip confirmation prompt for automatic CORS configuration changes (spa/native profiles)', false)
    .addOption(apiKeyOption)
    .addOption(hostOption)
    .action(action);
