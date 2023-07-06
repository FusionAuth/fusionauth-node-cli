#! /usr/bin/env node

import figlet from 'figlet';
import {Command} from 'commander';
import chalk from 'chalk';
import * as commands from './commands/index.js';

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
Object.values(commands).forEach(command => program.addCommand(command));
program.parse();