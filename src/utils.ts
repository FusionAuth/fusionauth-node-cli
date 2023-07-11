import ClientResponse from '@fusionauth/typescript-client/build/src/ClientResponse.js';
import {Errors} from '@fusionauth/typescript-client';
import chalk from 'chalk';
import {TemplateType} from './template-types.js';

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

    console.error(chalk.red(JSON.stringify(error)));
}

/**
 * Options for the CLI
 */
export type Options = {
    input: string,
    output: string,
    apiKey: string,
    host: string
}

/**
 * Options for theme commands
 */
export type ThemeOptions = Options & {
    types: TemplateType[]
}

/**
 * Options for email commands
 */
export type EmailOptions = Options & {
    clean: boolean,
    overwrite: boolean,
    create: boolean
};

/**
 * Validates the host and API key options provided to the CLI and returns a valid options object
 * @param options
 */
export const validateHostKeyOptions = (options: any): Pick<Options, 'apiKey' | 'host'> => {
    const apiKey = options.key ?? process.env.FUSIONAUTH_API_KEY;
    const host = options.host ?? process.env.FUSIONAUTH_HOST;

    if (!apiKey) {
        reportError('No API key provided');
        process.exit(1);
    }

    if (!host) {
        reportError('No host provided');
        process.exit(1);
    }

    return {
        apiKey,
        host
    }
}

/**
 * Validates the options provided to the CLI and returns a valid options object
 * @param options The options to validate
 */
export const validateOptions = (options: any): Options => {
    const input = options.input;
    const output = options.output;

    if (!input && !output) {
        reportError('No input or output directory provided');
        process.exit(1);
    }

    return {
        ...validateHostKeyOptions(options),
        input,
        output
    }
}

/**
 * Validates the theme options provided to the CLI and returns a valid options object
 * @param options
 */
export const validateThemeOptions = (options: any): ThemeOptions => {
    const base = validateOptions(options);
    const types: TemplateType[] = options.types;

    if (!types.length) {
        reportError('No types provided');
        process.exit(1);
    }

    return {
        ...base,
        types
    }
}

/**
 * Validates the email options provided to the CLI and returns a valid options object
 * @param options
 */
export const validateEmailOptions = (options: any): EmailOptions => {
    const base = validateOptions(options);
    const clean: boolean = options.clean;
    const overwrite: boolean = options.overwrite;
    const create: boolean = options.create;

    return {
        ...base,
        clean,
        overwrite,
        create
    }
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
 * Gets the locale from a path
 * @param path
 */
export const getLocaleFromLocalizedMessageFileName = function getLocaleFromPath(path: string): string | undefined {
    const matches = RegExp(/localizedMessages\.([a-z]{2}(?:_[A-Z]{2})?)\.txt/).exec(path);
    return matches ? matches[1] : undefined;
}
