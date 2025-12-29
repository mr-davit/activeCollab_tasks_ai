/**
 * Authentication commands for ac-task CLI
 * - auth:setup: Interactive setup of ActiveCollab connection
 * - auth:whoami: Display current authenticated user
 */

import { Command } from 'commander';
import { input, confirm } from '@inquirer/prompts';
import chalk from 'chalk';
import { GlobalConfig, OutputFormat, WhoAmIResult } from '../types';
import { loadGlobalConfig, saveGlobalConfig, getApiToken } from '../config/loader';
import { verifyCredentials, fetchCurrentUser } from '../api/auth';
import { ACTaskError, handleError } from '../utils/errorHandler';
import { output, success, info, labelValue, warning } from '../utils/formatting';
import { getClient, resetClient, setInsecure } from '../api/client';

/**
 * Get the output format from command options
 */
function getFormat(options: { format?: string }): OutputFormat {
    return options.format === 'json' ? 'json' : 'human';
}

/**
 * Check if an error is an SSL/TLS certificate error
 */
function isSSLError(err: unknown): boolean {
    // Check both the error message and details (for ACTaskError)
    const checkText = (text: string | undefined): boolean => {
        if (!text) return false;
        const lower = text.toLowerCase();
        return (
            lower.includes('certificate') ||
            lower.includes('ssl') ||
            lower.includes('tls') ||
            lower.includes('unable_to_verify') ||
            lower.includes('cert_has_expired') ||
            lower.includes('self signed') ||
            lower.includes('self_signed')
        );
    };

    if (err instanceof ACTaskError) {
        return checkText(err.message) || checkText(err.details);
    }

    if (err instanceof Error) {
        return checkText(err.message);
    }

    return false;
}

/**
 * auth:setup command handler
 * Interactive setup to configure ActiveCollab connection
 */
async function setupHandler(options: { format?: string; insecure?: boolean }): Promise<void> {
    const format = getFormat(options);
    let forceUnsafeSsl = options.insecure ?? false;

    // Set global insecure flag for this session if --insecure passed
    if (forceUnsafeSsl) {
        setInsecure(true);
    }
    try {
        // Check if config already exists
        const existingConfig = loadGlobalConfig();
        if (existingConfig) {
            if (format === 'human') {
                console.log(info(`Existing configuration found for ${existingConfig.base_url}`));
            }
            const shouldOverwrite = await confirm({
                message: 'Configuration already exists. Do you want to overwrite it?',
                default: false,
            });
            if (!shouldOverwrite) {
                if (format === 'human') {
                    console.log('Setup cancelled.');
                }
                return;
            }
        }

        // Prompt for Base URL
        const baseUrl = await input({
            message: 'Enter your ActiveCollab instance URL:',
            validate: (value) => {
                if (!value.trim()) {
                    return 'URL is required';
                }
                try {
                    new URL(value);
                    return true;
                } catch {
                    return 'Please enter a valid URL (e.g., https://app.activecollab.com/123456)';
                }
            },
        });

        // Prompt for API token directly
        const token = await input({
            message: 'Enter your ActiveCollab API token:',
            validate: (value) => {
                if (!value.trim()) {
                    return 'API token is required';
                }
                return true;
            },
        });

        // Verify connection (with SSL error handling)
        if (format === 'human') {
            console.log(info('Verifying connection...'));
        }

        let user;
        try {
            user = await verifyCredentials(baseUrl.trim(), token, forceUnsafeSsl);
        } catch (err) {
            // Check if this is an SSL certificate error
            if (isSSLError(err) && format === 'human' && !forceUnsafeSsl) {
                console.log('');
                console.log(warning('SSL Certificate Verification Failed.'));
                console.log(chalk.gray('  This usually means the server has an expired or self-signed certificate.'));
                console.log('');

                const disableSsl = await confirm({
                    message: 'Do you want to disable SSL verification for this server?',
                    default: false,
                });

                if (disableSsl) {
                    forceUnsafeSsl = true;
                    setInsecure(true);
                    console.log(info('Retrying with SSL verification disabled...'));
                    user = await verifyCredentials(baseUrl.trim(), token, true);
                } else {
                    throw err;
                }
            } else {
                throw err;
            }
        }

        if (format === 'human' && forceUnsafeSsl) {
            console.log(warning('SSL certificate validation is disabled for this server.'));
        }

        // Save configuration (including force_unsafe_ssl if set)
        const config: GlobalConfig = {
            base_url: baseUrl.trim(),
            token: token.trim(),
            cached_user_id: user.id,
            cached_user_name: user.display_name,
            ...(forceUnsafeSsl && { force_unsafe_ssl: true }),
        };

        saveGlobalConfig(config);
        resetClient(); // Reset cached client

        // Output success
        if (format === 'json') {
            output({
                success: true,
                user: {
                    id: user.id,
                    name: user.display_name,
                },
                config_path: '~/.ac-task/config.json',
                force_unsafe_ssl: forceUnsafeSsl,
            }, format);
        } else {
            console.log('');
            console.log(success(`Authenticated as ${chalk.bold(user.display_name)} (ID: ${user.id})`));
            console.log(info(`Configuration saved to ~/.ac-task/config.json`));
            if (forceUnsafeSsl) {
                console.log(info('SSL verification is disabled for this server.'));
            }
        }
    } catch (err) {
        handleError(err, format);
    }
}

/**
 * auth:whoami command handler
 * Display current authenticated user info
 */
async function whoamiHandler(options: { format?: string; insecure?: boolean }): Promise<void> {
    const format = getFormat(options);
    const insecure = options.insecure ?? false;

    // Set global insecure flag for this session
    if (insecure) {
        setInsecure(true);
    }

    try {
        const globalConfig = loadGlobalConfig();

        if (!globalConfig) {
            throw new ACTaskError(
                'CONFIGURATION_ERROR',
                'Not configured',
                1,
                'Run "ac-task auth:setup" to configure your ActiveCollab connection.'
            );
        }

        // Verify token env var is set
        getApiToken(globalConfig);

        // Fetch current user from API to verify connection is still valid
        resetClient(); // Reset to pick up insecure flag
        const client = getClient();
        const token = getApiToken(globalConfig);
        const user = await fetchCurrentUser(client, token);

        // Update cached info if changed
        if (user.id !== globalConfig.cached_user_id || user.display_name !== globalConfig.cached_user_name) {
            const updatedConfig: GlobalConfig = {
                ...globalConfig,
                cached_user_id: user.id,
                cached_user_name: user.display_name,
            };
            saveGlobalConfig(updatedConfig);
        }

        // Determine active status (cloud uses is_active, self-hosted uses is_archived/is_trashed)
        const isActive = user.is_active ?? !(user.is_archived || user.is_trashed);

        const result: WhoAmIResult = {
            id: user.id,
            name: user.display_name,
            status: isActive ? 'active' : 'inactive',
        };

        if (format === 'json') {
            output(result, format);
        } else {
            console.log('');
            console.log(success(`Logged in as ${chalk.bold(user.display_name)} (ID: ${user.id})`));
            console.log(labelValue('  Status', isActive ? chalk.green('active') : chalk.red('inactive')));
            console.log(labelValue('  URL', globalConfig.base_url));
            console.log('');
        }
    } catch (err) {
        handleError(err, format);
    }
}

/**
 * Register auth commands with the CLI program
 */
export function registerAuthCommands(program: Command): void {
    const authCommand = program
        .command('auth')
        .description('Authentication commands');

    authCommand
        .command('setup')
        .description('Configure ActiveCollab connection interactively')
        .option('-f, --format <format>', 'Output format (human|json)', 'human')
        .option('-k, --insecure', 'Skip TLS certificate validation (use with self-signed/expired certs)')
        .action(setupHandler);

    authCommand
        .command('whoami')
        .description('Display current authenticated user')
        .option('-f, --format <format>', 'Output format (human|json)', 'human')
        .option('-k, --insecure', 'Skip TLS certificate validation (use with self-signed/expired certs)')
        .action(whoamiHandler);
}
