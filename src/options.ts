import {Option} from '@commander-js/extra-typings';

/**
 * Mandatory API Key Option
 */
export const apiKeyOption = new Option('-k, --key <key>', 'The API key to use')
    .env('FUSIONAUTH_API_KEY')
    .makeOptionMandatory();

/**
 * Mandatory Host Option
 */
export const hostOption = new Option('-h, --host <url>', 'The FusionAuth host to use')
    .default('http://localhost:9011')
    .env('FUSIONAUTH_HOST')
    .makeOptionMandatory();

/**
 * Theme Template Types
 */
export const themeTemplateTypes = ['templates', 'messages', 'stylesheet'] as const;

/**
 * Theme Template Option for Theme commands
 */
export const themeTypeOption = new Option('-t, --types <types...>', 'The types of templates to watch')
    .choices(themeTemplateTypes)
    .default(themeTemplateTypes)
    .makeOptionMandatory();
