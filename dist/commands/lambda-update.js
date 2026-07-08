var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
import { Command } from '@commander-js/extra-typings';
import { FusionAuthClient } from '@fusionauth/typescript-client';
import { readFile } from 'fs/promises';
import chalk from 'chalk';
import { join } from 'path';
import { errorAndExit, logEvent } from '../utils.js';
import { apiKeyOption, hostOption } from "../options.js";
const action = function (lambdaId_1, _a) {
    return __awaiter(this, arguments, void 0, function* (lambdaId, { input, key: apiKey, host }) {
        logEvent('cli command lambda:update');
        console.log(`Updating lambda ${lambdaId} on ${host}`);
        try {
            const filename = join(input, lambdaId + ".json");
            const data = yield readFile(filename, 'utf-8');
            const lambda = JSON.parse(data);
            const request = { lambda };
            const fusionAuthClient = new FusionAuthClient(apiKey, host);
            const clientResponse = yield fusionAuthClient.updateLambda(lambdaId, request);
            if (!clientResponse.wasSuccessful())
                errorAndExit(`Error updating lambda: `, clientResponse);
            console.log(chalk.green(`Lambda updated`));
        }
        catch (e) {
            errorAndExit(`Error updating lambda: `, e);
        }
    });
};
// noinspection JSUnusedGlobalSymbols
export const lambdaUpdate = new Command('lambda:update')
    .description('Update a lambda on FusionAuth')
    .argument('<lambdaId>', 'The lambda id to update. The lambda is read from the file <id>.json in the <input> directory.')
    .option('-i, --input <input>', 'The input directory', './lambdas/')
    .addOption(apiKeyOption)
    .addOption(hostOption)
    .action(action);
