import {Command, Option} from "@commander-js/extra-typings";
import {FusionAuthClient} from '@fusionauth/typescript-client';
import chalk from "chalk";
import {errorAndExit} from '../utils.js';
import {apiKeyOption, hostOption} from "../options.js";

interface CheckResult {
    passed: boolean;
    message: string;
}

const skipLicenseCheckOption = new Option(
    '--skip-license-check',
    'Skip checking license activation (for community plan users)'
).default(false);

const action = async function ({key: apiKey, host, skipLicenseCheck}: {
    key: string;
    host: string;
    skipLicenseCheck: boolean;
}) {
    console.log(chalk.blue(`Checking common configuration on ${host}...`));
    
    const results: CheckResult[] = [];
    let allPassed = true;

    try {
        const fusionAuthClient = new FusionAuthClient(apiKey, host);

        // Check 1: Multiple admin users
        console.log(chalk.cyan('\n1. Checking for multiple admin users...'));
        try {
            // Search for the FusionAuth application
            const searchAppsResponse = await fusionAuthClient.searchApplications({
                search: {
                    name: 'FusionAuth'
                }
            });

            if (!searchAppsResponse.wasSuccessful() || !searchAppsResponse.response.applications || searchAppsResponse.response.applications.length === 0) {
                results.push({
                    passed: false,
                    message: 'Could not find FusionAuth application'
                });
                allPassed = false;
            } else {
                const fusionAuthApp = searchAppsResponse.response.applications[0];
                
                if (!fusionAuthApp.id) {
                    results.push({
                        passed: false,
                        message: 'FusionAuth application has no ID'
                    });
                    allPassed = false;
                } else {
                    const searchResponse = await fusionAuthClient.searchUsersByQuery({
                        search: {
                            queryString: `registrations.applicationId:${fusionAuthApp.id} AND registrations.roles:admin`,
                            accurateTotal: true
                        }
                    });

                    if (!searchResponse.wasSuccessful()) {
                        results.push({
                            passed: false,
                            message: 'Could not search for admin users'
                        });
                        allPassed = false;
                    } else {
                        const adminCount = searchResponse.response.total || 0;
                        
                        if (adminCount >= 2) {
                            results.push({
                                passed: true,
                                message: `Found ${adminCount} admin users ✓`
                            });
                        } else {
                            results.push({
                                passed: false,
                                message: `Only ${adminCount} admin user(s) found - recommend at least 2 for redundancy`
                            });
                            allPassed = false;
                        }
                    }
                }
            }
        } catch (e) {
            results.push({
                passed: false,
                message: `Admin user check failed: ${e instanceof Error ? e.message : String(e)}`
            });
            allPassed = false;
        }

        // Check 2: API Key permissions by creating and deleting a test admin user
        console.log(chalk.cyan('\n2. Checking API key permissions...'));
        try {
            const testEmail = `test-admin-${Date.now()}@fusionauth-cli-check.local`;
            const testPassword = `TestPass-${Date.now()}-!@#$`;
            
            // Create test user
            const createUserResponse = await fusionAuthClient.createUser(null!, {
                user: {
                    email: testEmail,
                    password: testPassword,
                    username: `test_admin_${Date.now()}`
                }
            });

            if (!createUserResponse.wasSuccessful()) {
                results.push({
                    passed: false,
                    message: 'API key lacks permissions to create users'
                });
                allPassed = false;
            } else if (!createUserResponse.response.user?.id) {
                results.push({
                    passed: false,
                    message: 'Created user but no user ID returned'
                });
                allPassed = false;
            } else {
                const userId = createUserResponse.response.user.id;
                
                // Search for the FusionAuth application
                const searchAppsResponse = await fusionAuthClient.searchApplications({
                    search: {
                        name: 'FusionAuth'
                    }
                });

                if (!searchAppsResponse.wasSuccessful() || !searchAppsResponse.response.applications || searchAppsResponse.response.applications.length === 0) {
                    results.push({
                        passed: false,
                        message: 'Could not find FusionAuth application'
                    });
                    allPassed = false;
                    // Clean up
                    await fusionAuthClient.deleteUser(userId);
                } else {
                    const fusionAuthApp = searchAppsResponse.response.applications[0];
                    
                    if (!fusionAuthApp.id) {
                        results.push({
                            passed: false,
                            message: 'FusionAuth application has no ID'
                        });
                        allPassed = false;
                        // Clean up
                        await fusionAuthClient.deleteUser(userId);
                    } else {
                        // Register user to FusionAuth app with admin role
                        const registrationResponse = await fusionAuthClient.register(userId, {
                            registration: {
                                applicationId: fusionAuthApp.id,
                                roles: ['admin']
                            }
                        });

                        // Clean up - delete test user
                        await fusionAuthClient.deleteUser(userId);

                        if (!registrationResponse.wasSuccessful()) {
                            results.push({
                                passed: false,
                                message: 'API key lacks permissions to register users with admin role'
                            });
                            allPassed = false;
                        } else {
                            results.push({
                                passed: true,
                                message: 'API key has appropriate permissions ✓'
                            });
                        }
                    }
                }
            }
        } catch (e) {
            results.push({
                passed: false,
                message: `API key permission check failed: ${e instanceof Error ? e.message : String(e)}`
            });
            allPassed = false;
        }

        // Check 3: Email server configuration
        console.log(chalk.cyan('\n3. Checking email server configuration...'));
        try {
            const tenantResponse = await fusionAuthClient.retrieveTenants();
            if (!tenantResponse.wasSuccessful()) {
                results.push({
                    passed: false,
                    message: 'Could not retrieve tenants'
                });
                allPassed = false;
            } else {
                const tenants = tenantResponse.response.tenants || [];
                let emailConfigured = false;

                for (const tenant of tenants) {
                    const emailHost = tenant.emailConfiguration?.host;
                    if (emailHost && emailHost !== 'localhost') {
                        emailConfigured = true;
                        break;
                    }
                }

                if (emailConfigured) {
                    results.push({
                        passed: true,
                        message: 'Email server is configured ✓'
                    });
                } else {
                    results.push({
                        passed: false,
                        message: 'Email server not configured or set to default "localhost" - required for password resets'
                    });
                    allPassed = false;
                }
            }
        } catch (e) {
            results.push({
                passed: false,
                message: `Email configuration check failed: ${e instanceof Error ? e.message : String(e)}`
            });
            allPassed = false;
        }

        // Check 4: License key activation (optional)
        if (!skipLicenseCheck) {
            console.log(chalk.cyan('\n4. Checking license key activation...'));
            try {
                const statusResponse = await fusionAuthClient.retrieveReactorStatus();
                
                if (!statusResponse.wasSuccessful()) {
                    results.push({
                        passed: false,
                        message: 'Could not retrieve Reactor status'
                    });
                    allPassed = false;
                } else {
                    const status = statusResponse.response.status;
                    
                    if (status?.licensed) {
                        results.push({
                            passed: true,
                            message: 'License key is activated ✓'
                        });
                    } else {
                        results.push({
                            passed: false,
                            message: 'License key not activated - required for paid features'
                        });
                        allPassed = false;
                    }
                }
            } catch (e) {
                results.push({
                    passed: false,
                    message: `License check failed: ${e instanceof Error ? e.message : String(e)}`
                });
                allPassed = false;
            }
        } else {
            console.log(chalk.cyan('\n4. Skipping license key check (--skip-license-check)...'));
        }

        // Check 5: Tenant issuer configuration
        console.log(chalk.cyan('\n5. Checking tenant issuer configuration...'));
        try {
            const tenantResponse = await fusionAuthClient.retrieveTenants();
            
            if (!tenantResponse.wasSuccessful()) {
                results.push({
                    passed: false,
                    message: 'Could not retrieve tenants'
                });
                allPassed = false;
            } else {
                const tenants = tenantResponse.response.tenants || [];
                let hasDefaultIssuer = false;
                let allIssuersConfigured = true;

                for (const tenant of tenants) {
                    const issuer = tenant.issuer || '';
                    
                    if (issuer === 'acme.com') {
                        hasDefaultIssuer = true;
                    }
                    if (!issuer || issuer === 'acme.com') {
                        allIssuersConfigured = false;
                    }
                }

                if (allIssuersConfigured && !hasDefaultIssuer) {
                    results.push({
                        passed: true,
                        message: 'Tenant issuer(s) properly configured ✓'
                    });
                } else if (hasDefaultIssuer) {
                    results.push({
                        passed: false,
                        message: 'Tenant issuer still set to default "acme.com" - should be changed to your domain'
                    });
                    allPassed = false;
                } else {
                    results.push({
                        passed: false,
                        message: 'Some tenant issuer(s) not configured properly'
                    });
                    allPassed = false;
                }
            }
        } catch (e) {
            results.push({
                passed: false,
                message: `Tenant issuer check failed: ${e instanceof Error ? e.message : String(e)}`
            });
            allPassed = false;
        }

        // Print results
        console.log(chalk.blue('\n\n=== Configuration Check Results ===\n'));
        results.forEach((result, index) => {
            if (result.passed) {
                console.log(chalk.green(`✓ ${result.message}`));
            } else {
                console.log(chalk.red(`✗ ${result.message}`));
            }
        });

        console.log(chalk.blue('\n===================================\n'));

        if (allPassed) {
            console.log(chalk.green.bold('SUCCESS: All common configuration checks passed!'));
            console.log(chalk.green('Your FusionAuth instance is properly configured.'));
        } else {
            console.log(chalk.yellow.bold('WARNING: Some configuration checks failed.'));
            console.log(chalk.yellow('Please address the issues above to ensure proper FusionAuth operation.'));
            console.log(chalk.yellow('\nFor more information, visit:'));
            console.log(chalk.cyan('https://fusionauth.io/docs/get-started/download-and-install/common-configuration'));
            process.exit(1);
        }

    } catch (e: unknown) {
        errorAndExit('Common configuration check error:', e);
    }
}

// noinspection JSUnusedGlobalSymbols
export const checkCommonConfig = new Command('check:common-config')
    .description('Checks for common configuration settings that should be changed')
    .addOption(apiKeyOption)
    .addOption(hostOption)
    .addOption(skipLicenseCheckOption)
    .action(action);
