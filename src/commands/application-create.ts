import * as fs from 'node:fs';
import {Command, Option} from '@commander-js/extra-typings';
import {
    Application,
    ClientAuthenticationPolicy,
    FusionAuthClient,
    GrantType,
    ProofKeyForCodeExchangePolicy,
    RefreshTokenExpirationPolicy,
    RefreshTokenUsagePolicy,
} from '@fusionauth/typescript-client';
import chalk from 'chalk';
import {errorAndExit, logEvent} from '../utils.js';
import {apiKeyOption, hostOption} from '../options.js';

type Profile = 'spa' | 'native' | 'webapp';

const publicClientDefaults: Application = {
    oauthConfiguration: {
        enabledGrants: [GrantType.authorization_code],
        generateRefreshTokens: true,
        proofKeyForCodeExchangePolicy: ProofKeyForCodeExchangePolicy.Required,
        clientAuthenticationPolicy: ClientAuthenticationPolicy.NotRequired,
        requireClientAuthentication: false,
    },
    jwtConfiguration: {
        enabled: true,
        timeToLiveInSeconds: 300,
        refreshTokenUsagePolicy: RefreshTokenUsagePolicy.OneTimeUse,
        refreshTokenExpirationPolicy: RefreshTokenExpirationPolicy.SlidingWindow,
    },
};

const profileDefaults: Record<Profile, Application> = {
    spa: publicClientDefaults,
    native: publicClientDefaults,
    webapp: {
        oauthConfiguration: {
            enabledGrants: [GrantType.authorization_code],
            generateRefreshTokens: true,
            proofKeyForCodeExchangePolicy: ProofKeyForCodeExchangePolicy.NotRequiredWhenUsingClientAuthentication,
            clientAuthenticationPolicy: ClientAuthenticationPolicy.Required,
            requireClientAuthentication: true,
        },
        jwtConfiguration: {
            enabled: true,
            timeToLiveInSeconds: 3600,
            refreshTokenUsagePolicy: RefreshTokenUsagePolicy.Reusable,
            refreshTokenExpirationPolicy: RefreshTokenExpirationPolicy.Fixed,
        },
    },
};

/**
 * Parses the --data value. If it begins with '@', reads the referenced file.
 * Otherwise parses the value as inline JSON.
 */
function parseData(data: string): Application {
    let json: string;
    if (data.startsWith('@')) {
        const filePath = data.slice(1);
        try {
            json = fs.readFileSync(filePath, 'utf-8');
        } catch (e: unknown) {
            const message = e instanceof Error ? e.message : String(e);
            errorAndExit(`Error reading --data file "${filePath}": ${message}`);
            // unreachable — errorAndExit calls process.exit, but satisfies TS
            throw e;
        }
    } else {
        json = data;
    }
    try {
        return JSON.parse(json) as Application;
    } catch (e: unknown) {
        const message = e instanceof Error ? e.message : String(e);
        errorAndExit(`Error parsing --data JSON: ${message}`);
        throw e;
    }
}

const action = async function (
    name: string,
    {
        profile,
        redirectUri,
        logoutUrl,
        authorizedOriginUrl,
        applicationId,
        tenantId,
        data,
        key: apiKey,
        host,
    }: {
        profile?: string;
        redirectUri?: string[];
        logoutUrl?: string;
        authorizedOriginUrl?: string[];
        applicationId?: string;
        tenantId?: string;
        data?: string;
        key: string;
        host: string;
    }
) {
    await logEvent('cli command application:create');

    // --- Mode validation ---
    if (profile && data) {
        errorAndExit('--profile and --data are mutually exclusive. Provide one or the other.');
        return;
    }
    if (!profile && !data) {
        errorAndExit('Either --profile <spa|native|webapp> or --data <json|@file.json> is required.');
        return;
    }

    let application: Application;

    if (profile) {
        // --- Profile mode ---
        if (redirectUri === undefined || redirectUri.length === 0) {
            errorAndExit('--redirect-uri is required when using --profile.');
            return;
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
        application = parseData(data!);
        application.name = name;
    }

    // --- ID overrides (applied last in both modes) ---
    if (applicationId) {
        application.id = applicationId;
    }
    if (tenantId) {
        application.tenantId = tenantId;
    }

    // --- API call ---
    try {
        const fusionAuthClient = new FusionAuthClient(apiKey, host);
        const clientResponse = await fusionAuthClient.createApplication(
            application.id ?? '',
            {application}
        );

        if (!clientResponse.wasSuccessful()) {
            errorAndExit('Error creating application: ', clientResponse);
            return;
        }

        const created = clientResponse.response.application!;
        const clientId = created.oauthConfiguration?.clientId ?? created.id ?? '';
        const clientSecret = created.oauthConfiguration?.clientSecret;

        console.log(chalk.green('Application created.'));
        console.log(`  Name:                       ${created.name}`);
        console.log(`  Application ID / client_id: ${clientId}`);
        if (clientSecret) {
            console.log(`  Client Secret:              ${clientSecret}`);
        }
    } catch (e: unknown) {
        errorAndExit('Error creating application: ', e);
    }
};

// noinspection JSUnusedGlobalSymbols
export const applicationCreate = new Command('application:create')
    .description('Create an application in FusionAuth')
    .argument('<name>', 'The name of the application')
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
    .addOption(apiKeyOption)
    .addOption(hostOption)
    .action(action);
