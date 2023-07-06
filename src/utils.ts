import ClientResponse from '@fusionauth/typescript-client/build/src/ClientResponse.js';
import {Errors} from '@fusionauth/typescript-client';
import chalk from 'chalk';
import * as types from './types.js';

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
 * Validates the options provided to the CLI and returns a valid options object
 * @param options The options to validate
 */
export const validateOptions = (options: types.CLIOptions): types.Options => {
    const input = options.input;
    const output = options.output;
    const apiKey = options.key ?? process.env.FUSIONAUTH_API_KEY;
    const host = options.host ?? process.env.FUSIONAUTH_HOST;
    const types: types.TemplateType[] = options.types;

    if (!input && !output) {
        reportError('No input or output directory provided');
        process.exit(1);
    }

    if (!apiKey) {
        reportError('No API key provided');
        process.exit(1);
    }

    if (!host) {
        reportError('No host provided');
        process.exit(1);
    }

    if (!types.length) {
        reportError('No types provided');
        process.exit(1);
    }

    return {
        input,
        output,
        apiKey,
        host,
        types
    }
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
