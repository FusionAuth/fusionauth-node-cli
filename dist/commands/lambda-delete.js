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
import { errorAndExit, logEvent } from '../utils.js';
import { apiKeyOption, hostOption } from "../options.js";
const action = function (lambdaId_1, _a) {
    return __awaiter(this, arguments, void 0, function* (lambdaId, { key: apiKey, host }) {
        logEvent('cli command lambda:delete');
        console.log(`Deleting lambda ${lambdaId} from ${host}`);
        try {
            const fusionAuthClient = new FusionAuthClient(apiKey, host);
            const clientResponse = yield fusionAuthClient.deleteLambda(lambdaId);
            if (!clientResponse.wasSuccessful())
                errorAndExit(`Error deleting lambda: `, clientResponse);
            console.log(chalk.green(`Lambda deleted`));
        }
        catch (e) {
            errorAndExit(`Error deleting lambda: `, e);
        }
    });
};
// noinspection JSUnusedGlobalSymbols
export const lambdaDelete = new Command('lambda:delete')
    .description('Delete a lambda from FusionAuth')
    .argument('<lambdaId>', 'The lambda id to delete')
    .addOption(apiKeyOption)
    .addOption(hostOption)
    .action(action);
