var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
import { Command } from "@commander-js/extra-typings";
import { logEvent } from '../../utils.js';
import chalk from "chalk";
import { telemetryUpdate } from "./telemetry-utils.js";
const action = function () {
    return __awaiter(this, void 0, void 0, function* () {
        try {
            telemetryUpdate(true);
            logEvent('cli command telemetry:enable');
            console.log(chalk.green(`Sharing usage data has been re-enabled. To disable, run ${chalk.bold.bgWhite(' npx fusionauth telemetry:disable ')}.`));
        }
        catch (err) {
            console.log(err);
        }
    });
};
export const telemetryEnable = new Command()
    .command('telemetry:enable')
    .description('Sets a global config value to allow telemetry to be collected')
    .action(action);
