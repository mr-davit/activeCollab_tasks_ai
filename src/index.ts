#!/usr/bin/env node

/**
 * ac-task CLI - Main entry point
 * 
 * A CLI tool for interacting with ActiveCollab, designed for both
 * humans and LLM agents with strict error handling and JSON output support.
 */

import { Command } from 'commander';
import * as dotenv from 'dotenv';
import { registerAuthCommands } from './commands/auth';
import { registerVersionCommand, getVersion } from './commands/version';
import { registerInitCommand } from './commands/init';
import { registerListCommand } from './commands/list';
import { registerShowCommand } from './commands/show';
import { registerCreateCommand } from './commands/create';
import { registerUpdateCommand } from './commands/update';
import { registerUpdateStatusCommand } from './commands/update-status';
import { registerDeleteCommand } from './commands/delete';
import { registerCommentCommand } from './commands/comment';
import { registerLogCommand } from './commands/log';
import { handleError } from './utils/errorHandler';
import { setVerbose } from './api/client';

// Load environment variables from .env file if present
dotenv.config();

// Global format tracker for error handling
let globalFormat: 'human' | 'json' = 'human';

/**
 * Create and configure the CLI program
 */
function createProgram(): Command {
    const program = new Command();

    program
        .name('ac-task')
        .description('CLI tool for ActiveCollab task management')
        .version(getVersion())
        .option('--verbose', 'Enable verbose HTTP request/response logging');

    // Hook to enable verbose logging before commands execute
    program.hook('preAction', (thisCommand) => {
        const opts = thisCommand.opts();
        if (opts.verbose) {
            setVerbose(true);
        }
    });

    // Register command modules
    registerVersionCommand(program);
    registerAuthCommands(program);
    registerInitCommand(program);
    registerListCommand(program);
    registerShowCommand(program);
    registerCreateCommand(program);
    registerUpdateCommand(program);
    registerUpdateStatusCommand(program);
    registerDeleteCommand(program);
    registerCommentCommand(program);
    registerLogCommand(program);

    return program;
}

/**
 * Main entry point
 */
async function main(): Promise<void> {
    const program = createProgram();

    try {
        await program.parseAsync(process.argv);
    } catch (err) {
        handleError(err, globalFormat);
    }
}

// Handle uncaught errors
process.on('uncaughtException', (err) => {
    handleError(err, globalFormat);
});

process.on('unhandledRejection', (err) => {
    handleError(err, globalFormat);
});

// Run
main();
