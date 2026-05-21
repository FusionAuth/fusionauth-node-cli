import ClientResponse from '@fusionauth/typescript-client/build/src/ClientResponse.js';
import {Errors} from '@fusionauth/typescript-client';
import fs, { readFileSync } from 'node:fs'
import { dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { randomUUID } from 'node:crypto';

import chalk from 'chalk';
import boxen from 'boxen';
import { execSync } from 'node:child_process';

import { PostHog } from 'posthog-node'

import * as dotenv from 'dotenv'

dotenv.config()

export const posthogClient = new PostHog(
    'phc_nB6C2uZX2LA6ce6VAaWZxBYPtq1wYH5x8A3n36DaLzQ',
    { host: 'https://us.i.posthog.com' }
)



export const __dirname = dirname(fileURLToPath(import.meta.url));

/**
 * Checks if the response is a client response
 * @param response
 */
export const isClientResponse = (response: any): response is ClientResponse.default<any> => {
    return response.wasSuccessful !== undefined;
}

/**
 * Checks if the response is an error response
 * @param response
 */
export const isErrors = (response: any): response is Errors => {
    return response.fieldErrors !== undefined || response.generalErrors !== undefined;
}

/**
 * Reports an error to the console
 * @param msg   The message to report
 * @param error The error to report
 */
export const reportError = (msg: string, error?: any): void => {
    console.error(chalk.red(msg));
    if (!error) {
        return;
    }

    if (isClientResponse(error) && error.exception) {
        error = error.exception;
    }
    if (isErrors(error)) {
        const {fieldErrors, generalErrors} = error;

        if (fieldErrors) {
            Object.entries(fieldErrors)
                .forEach(([field, fieldError]) => {
                    console.error(chalk.red(chalk.underline(field) + ': ' + fieldError
                        .map((fieldError) => fieldError.message)
                        .join(', ')));
                });
        }

        if (generalErrors) {
            generalErrors.forEach((generalError) => {
                console.error(chalk.red(generalError.message));
            });
        }

        return;
    }

    if (typeof error === 'string') {
        console.error(chalk.red(error));
        return;
    }

    if ('message' in error) {
        console.error(chalk.red(error.message));
        return;
    }

    console.error(chalk.red(toJson(error)));
}

/**
 * Gets the locale from a path
 * @param path
 */
export const getLocaleFromLocalizedMessageFileName = (path: string): string | undefined => {
    const matches = path.match(/localizedMessages\.([a-z]{2}(?:_[A-Z]{2})?)\.txt/);
    if (!matches) return;
    return matches[1];
}

/**
 * Returns the error message for a given email template id
 * @param action
 * @param emailTemplateId
 */
export const getEmailErrorMessage = (action: string, emailTemplateId: string | undefined) => {
    let templateIdMessage = 'templates';
    if (emailTemplateId) {
        templateIdMessage = `template ${emailTemplateId}`
    }
    return `Error ${action} email ${templateIdMessage}`
}

/**
 * Returns the success message for a given email template id
 * @param emailTemplateId
 * @param output
 */
export const getEmailSuccessMessage = (emailTemplateId: string | undefined, output: string) => {
    let templateIdMessage = 'templates';
    if (emailTemplateId) {
        templateIdMessage = `template ${emailTemplateId}`
    }
    return `Successfully downloaded email ${templateIdMessage} to ${output}`;
}

/**
 * Returns the error message for a given message template id
 * @param action
 * @param messageTemplateId
 */
export const getMessageErrorMessage = (action: string, messageTemplateId: string | undefined) => {
    let templateIdMessage = 'templates';
    if (messageTemplateId) {
        templateIdMessage = `template ${messageTemplateId}`
    }
    return `Error ${action} message ${templateIdMessage}`
}

/**
 * Returns the success message for a given message template id
 * @param messageTemplateId
 * @param output
 */
export const getMessageSuccessMessage = (messageTemplateId: string | undefined, output: string) => {
    let templateIdMessage = 'templates';
    if (messageTemplateId) {
        templateIdMessage = `template ${messageTemplateId}`
    }
    return `Successfully downloaded message ${templateIdMessage} to ${output}`;
}

/**
 * Returns the given item if it is not undefined, otherwise returns an empty string
 */
export function toString(item: string | undefined): string {
    return item ?? '';
}

/**
 * Returns the given object as a JSON string
 * @param item The item to convert to JSON
 */
export function toJson(item: unknown): string {
    return JSON.stringify(item ?? {}, null, 4)
}

/**
 * Reports an error and exits the process
 * @param message
 * @param error
 */
export function errorAndExit(message: string, error?: any) {
    reportError(message, error);
    process.exit(1);
}

/**
 * Returns a console log that can be added to a beta feature to warn the user
 */
export function betaWarning() {
    console.log(boxen(`${chalk.yellow("This feature is currently in beta.")}`, {title: 'Beta', borderColor: 'yellow', borderStyle: 'bold', textAlignment: 'center'}) + "\n")
}

/**
 * Returns if Docker is installed on the user's PATH
 */
export function isDockerInstalled() {
  try {
    execSync('docker --version');
    return true;
  } catch (e) {
    throw(chalk.red("Error: You don't have Docker installed. It's the easiest way to get everything you need\n") + chalk.cyan("Please install Docker. For developers new to Docker, we suggest Orbstack: https://docs.orbstack.dev/quick-start") )
  }
}

/**
 * Returns true if path directory contains no files
 * Path must exist
 * @param path
 */
export function isDirEmpty(path: string) {
  const data = fs.readdirSync(path)
  
  if (data.length > 0) {
    return false
  } else {
    return true
  }
}

export function loadConfig() {
    const defaultConfig = {
        telemetry: true,
        id: randomUUID(),
        version: "1.0"

    }
    const configPath = __dirname + '/.fa/config.json'
    try {
        if (!fs.existsSync(configPath)) {
            createConfig(__dirname + '/.fa', defaultConfig)
        }
        const globalConfig = JSON.parse(fs.readFileSync(configPath).toString())
        // TODO: Combine this with a local-project config
        return {globalConfig: {...defaultConfig, ...globalConfig}}
    } catch (e) {
        return {globalConfig: defaultConfig}
    }
}

export async function logEvent(eventName:string, eventDetails:any = {}) {
    if (process.env.FUSIONAUTH_TELEMETRY === "false") {
        return false
    }
    const config = loadConfig()
    
    if (config.globalConfig.telemetry) {
        const capture = await posthogClient.capture({
            distinctId: config.globalConfig.id,
            event: eventName,
            properties: eventDetails
        })
        await posthogClient.shutdown()
        return true
    } else {
        return false
    }
}

type ConfigObject = {
    id?: string,
    telemetry?: boolean

}

export function createConfig(dir: string, configObject: ConfigObject = { id: randomUUID(), telemetry: true}) {
    const configPath = dir + '/config.json'

    if (!fs.existsSync(configPath)) {
        // If no config, write a new config
        fs.mkdirSync(dir, { recursive: true })

        fs.writeFileSync(configPath, JSON.stringify(configObject, null, 2))  
        return fs.existsSync(configPath)
    } else {
        // If config exists, check for data to write or not
        const config = JSON.parse(readFileSync(dir + '/config.json').toString())

        if (!config.id || !config.telemetry) {
            // If no id OR telemetry, 
            // still write the file with a new ID and/or telemetry
            fs.writeFileSync(configPath, JSON.stringify({
                id: config.id || randomUUID(), 
                telemetry: config.telemetry === false ? false : true,
                ...config
            }))
            return fs.existsSync(configPath)
        }
        // If data is complete, return false to not write
        return false
    }
}