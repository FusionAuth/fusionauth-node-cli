#! /usr/bin/env node

import figlet from 'figlet';
import {Command} from 'commander';
import chalk from 'chalk';
import {lambdaUpload, themeDownload, themeUpload, themeWatch} from './commands/index.js';

const fusionString = figlet.textSync('Fusion').split('\n');
const authString = figlet.textSync('Auth').split('\n');

fusionString.forEach((line, i) => {
    console.log(chalk.white(line) + chalk.hex('#F58320')(authString[i]));
});

const program = new Command();
program
    .name('@fusionauth/cli')
    .description('CLI for FusionAuth')
    .version("versionfrompackagejson");

program.addCommand(lambdaUpload);
program.addCommand(themeDownload);
program.addCommand(themeUpload);
program.addCommand(themeWatch);

program.parse();
