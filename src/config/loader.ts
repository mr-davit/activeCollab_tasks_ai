/**
 * Configuration loader for ac-task CLI
 * 
 * Handles loading both global config (~/.ac-task/config.json)
 * and project config (.ac-task.json found by walking up directory tree)
 */

import * as fs from 'fs';
import { GlobalConfig, ProjectConfig, RuntimeConfig } from '../types';
import { ACTaskError } from '../utils/errorHandler';
import {
    getGlobalConfigPath,
    getGlobalConfigDir,
    findProjectConfig,
    ensureDir,
} from './paths';

/**
 * Load the global configuration from ~/.ac-task/config.json
 * Returns null if the file doesn't exist
 */
export function loadGlobalConfig(): GlobalConfig | null {
    const configPath = getGlobalConfigPath();

    if (!fs.existsSync(configPath)) {
        return null;
    }

    try {
        const content = fs.readFileSync(configPath, 'utf-8');
        return JSON.parse(content) as GlobalConfig;
    } catch (err) {
        throw new ACTaskError(
            'CONFIGURATION_ERROR',
            'Failed to parse global config file',
            1,
            `Error reading ${configPath}: ${err instanceof Error ? err.message : String(err)}`
        );
    }
}

/**
 * Save the global configuration to ~/.ac-task/config.json
 */
export function saveGlobalConfig(config: GlobalConfig): void {
    const configDir = getGlobalConfigDir();
    const configPath = getGlobalConfigPath();

    try {
        ensureDir(configDir);
        fs.writeFileSync(configPath, JSON.stringify(config, null, 2), 'utf-8');
    } catch (err) {
        throw new ACTaskError(
            'CONFIGURATION_ERROR',
            'Failed to save global config file',
            1,
            `Error writing ${configPath}: ${err instanceof Error ? err.message : String(err)}`
        );
    }
}

/**
 * Load the project configuration from .ac-task.json
 * Searches up the directory tree from cwd
 * Returns null if not found
 */
export function loadProjectConfig(): ProjectConfig | null {
    const configPath = findProjectConfig();

    if (!configPath) {
        return null;
    }

    try {
        const content = fs.readFileSync(configPath, 'utf-8');
        return JSON.parse(content) as ProjectConfig;
    } catch (err) {
        throw new ACTaskError(
            'CONFIGURATION_ERROR',
            'Failed to parse project config file',
            1,
            `Error reading ${configPath}: ${err instanceof Error ? err.message : String(err)}`
        );
    }
}

/**
 * Load all configuration (global + project)
 */
export function loadConfig(): RuntimeConfig {
    return {
        global: loadGlobalConfig(),
        project: loadProjectConfig(),
    };
}

/**
 * Get the API token from the environment variable specified in global config
 * Throws if global config is missing or env var is not set
 */
export function getApiToken(globalConfig?: GlobalConfig | null): string {
    const config = globalConfig ?? loadGlobalConfig();

    if (!config) {
        throw new ACTaskError(
            'CONFIGURATION_ERROR',
            'Global configuration not found',
            1,
            'Run "ac-task auth:setup" to configure your ActiveCollab connection.'
        );
    }

    const token = process.env[config.token_env_var];

    if (!token) {
        throw new ACTaskError(
            'CONFIGURATION_ERROR',
            `Environment variable "${config.token_env_var}" is not set`,
            1,
            `Set the environment variable with your ActiveCollab API token: export ${config.token_env_var}=your_token`
        );
    }

    return token;
}

/**
 * Require global config to exist, throw if not
 */
export function requireGlobalConfig(): GlobalConfig {
    const config = loadGlobalConfig();

    if (!config) {
        throw new ACTaskError(
            'CONFIGURATION_ERROR',
            'Global configuration not found',
            1,
            'Run "ac-task auth:setup" to configure your ActiveCollab connection.'
        );
    }

    return config;
}
