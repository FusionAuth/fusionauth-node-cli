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
import chalk from 'chalk';
import { existsSync } from 'fs';
import { join } from 'path';
import { mkdir, writeFile } from 'fs/promises';
import { errorAndExit, logEvent, toJson } from '../utils.js';
import { apiKeyOption, hostOption } from "../options.js";
const action = function (lambdaId_1, _a) {
    return __awaiter(this, arguments, void 0, function* (lambdaId, { output, key: apiKey, host }) {
        var _b;
        logEvent('cli command lambda:retrieve');
        console.log(`Retrieving lambda ${lambdaId} from ${host}`);
        try {
            const fusionAuthClient = new FusionAuthClient(apiKey, host);
            const clientResponse = yield fusionAuthClient.retrieveLambda(lambdaId);
            if (!clientResponse.wasSuccessful())
                errorAndExit(`Error retrieving lambda: `, clientResponse);
            if (!existsSync(output))
                yield mkdir(output);
            const filename = join(output, ((_b = clientResponse.response.lambda) === null || _b === void 0 ? void 0 : _b.id) + ".json");
            yield writeFile(filename, toJson(clientResponse.response.lambda));
            console.log(chalk.green(`Lambda downloaded to ${filename}`));
        }
        catch (e) {
            errorAndExit(`Error retrieving lambda:`, e);
        }
    });
};
// noinspection JSUnusedGlobalSymbols
export const lambdaRetrieve = new Command('lambda:retrieve')
    .description('Retrieve a lambda from FusionAuth')
    .argument('<lambdaId>', 'The lambda id to retrieve')
    .option('-o, --output <output>', 'The output directory', './lambdas/')
    .addOption(apiKeyOption)
    .addOption(hostOption)
    .action(action);
