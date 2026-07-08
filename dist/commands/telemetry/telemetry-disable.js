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
        logEvent('cli do not track');
        try {
            telemetryUpdate(false);
            console.log(chalk.green(`Usage data will no longer be collected. To re-enable, run ${chalk.bold.bgWhite(' npx fusionauth telemetry:enable ')}.`));
        }
        catch (err) {
            console.log(err);
        }
    });
};
export const telemetryDisable = new Command()
    .command('telemetry:disable')
    .description('Sets a global config value to disallow telemetry from being collected')
    .action(action);
