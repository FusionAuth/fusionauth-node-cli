#! /usr/bin/env -S node --no-warnings=ExperimentalWarning
import * as fs from 'node:fs';
import { Command } from '@commander-js/extra-typings';
import chalk from 'chalk';
import figlet from 'figlet';
import * as commands from './commands/index.js';

// Handle unhandled promise rejections gracefully
process.on('unhandledRejection', (reason) => {
  const message = reason instanceof Error ? reason.message : String(reason);
  // Suppress known telemetry shutdown timeouts
  if (message.includes('PostHog') || message.includes('telemetry')) {
    process.exit(0);
  }
  console.error(chalk.red(`✖ Error: ${message}`));
  process.exit(1);
});

const fusionString = figlet.textSync('Fusion').split('\n');
const authString = figlet.textSync('Auth').split('\n');
fusionString.forEach((line, i) => {
  console.log(chalk.white(line) + chalk.hex('#F58320')(authString[i]));
});
const program = new Command();
program.name('@fusionauth/cli').description('CLI for FusionAuth');
Object.values(commands).forEach((command) => {
  // Only add Command instances, skip other exports (like executeAction)
  if (command instanceof Command) {
    program.addCommand(command as unknown as Command);
  }
});
program.parse();
