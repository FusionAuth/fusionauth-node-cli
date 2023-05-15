import ClientResponse from '@fusionauth/typescript-client/build/src/ClientResponse.js';
import {Errors} from '@fusionauth/typescript-client';
import chalk from 'chalk';
import {TemplateType, templateTypes} from './template-types.js';

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
    host: string,
    types: TemplateType[]
    create?: boolean
}

/**
 * Validates the options provided to the CLI and returns a valid options object
 * @param options The options to validate
 */
export const validateOptions = (options: any): Options => {
    const input = options.input ?? './tpl/';
    const output = options.output ?? './tpl/';
    const apiKey = options.key ?? process.env.FUSIONAUTH_API_KEY;
    const host = options.host ?? process.env.FUSIONAUTH_HOST ?? 'http://localhost:9011';
    const types: TemplateType[] = options.types ?? templateTypes;
    const create = options.create ?? false;

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
        types,
        create
    }
}
