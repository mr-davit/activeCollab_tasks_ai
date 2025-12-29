/**
 * Axios HTTP client for ActiveCollab API
 */

import axios, { AxiosInstance, AxiosError, InternalAxiosRequestConfig } from 'axios';
import * as https from 'https';
import { loadGlobalConfig, getApiToken } from '../config/loader';
import { ACTaskError, fromAxiosError } from '../utils/errorHandler';

let clientInstance: AxiosInstance | null = null;

/** Global flag to allow insecure TLS (expired/self-signed certs) */
let allowInsecure = false;

/** Global flag to enable verbose HTTP logging */
let verboseLogging = false;

/**
 * Set whether to allow insecure TLS connections
 */
export function setInsecure(insecure: boolean): void {
    allowInsecure = insecure;
}

/**
 * Enable or disable verbose HTTP logging
 */
export function setVerbose(verbose: boolean): void {
    verboseLogging = verbose;
}

/**
 * Get HTTPS agent for axios (with optional insecure mode)
 */
function getHttpsAgent(insecure: boolean): https.Agent | undefined {
    if (insecure) {
        return new https.Agent({ rejectUnauthorized: false });
    }
    return undefined;
}

/**
 * Create and configure the Axios client for ActiveCollab API
 */
export function createClient(baseUrl?: string, token?: string, insecure?: boolean): AxiosInstance {
    const globalConfig = loadGlobalConfig();

    const url = baseUrl || globalConfig?.base_url;
    const apiToken = token || (globalConfig ? getApiToken(globalConfig) : undefined);

    // Check if insecure mode should be used (from param, global flag, or config)
    const useInsecureFromConfig = globalConfig?.force_unsafe_ssl ?? false;

    if (!url) {
        throw new ACTaskError(
            'CONFIGURATION_ERROR',
            'Base URL not configured',
            1,
            'Run "ac-task auth:setup" to configure your ActiveCollab connection.'
        );
    }

    if (!apiToken) {
        throw new ACTaskError(
            'CONFIGURATION_ERROR',
            'API token not available',
            1,
            'Run "ac-task auth:setup" to configure your ActiveCollab API token.'
        );
    }

    // Determine if insecure mode: any of param, global flag, or config enables it
    const useInsecure = insecure || allowInsecure || useInsecureFromConfig;
    const httpsAgent = getHttpsAgent(useInsecure);

    const client = axios.create({
        baseURL: url.replace(/\/+$/, ''), // Remove trailing slashes
        timeout: 30000,
        headers: {
            'Content-Type': 'application/json',
            'X-Angie-AuthApiToken': apiToken,
        },
        ...(httpsAgent && { httpsAgent }),
    });

    // Request interceptor for logging/debugging (if needed later)
    client.interceptors.request.use(
        (config: InternalAxiosRequestConfig) => {
            if (verboseLogging) {
                console.error('[HTTP Request]');
                console.error(`  ${config.method?.toUpperCase()} ${config.baseURL}${config.url}`);
                if (config.data) {
                    console.error('  Body:', JSON.stringify(config.data, null, 2));
                }
            }
            return config;
        },
        (error: AxiosError) => {
            return Promise.reject(error);
        }
    );

    // Response interceptor to transform errors
    client.interceptors.response.use(
        (response) => {
            if (verboseLogging) {
                console.error('[HTTP Response]');
                console.error(`  Status: ${response.status} ${response.statusText}`);
                console.error('  Data:', JSON.stringify(response.data, null, 2));
            }
            return response;
        },
        (error: AxiosError) => {
            if (verboseLogging && error.response) {
                console.error('[HTTP Error Response]');
                console.error(`  Status: ${error.response.status} ${error.response.statusText}`);
                console.error('  Data:', JSON.stringify(error.response.data, null, 2));
            }
            // Transform Axios errors to ACTaskError for consistent handling
            throw fromAxiosError(error);
        }
    );

    return client;
}

/**
 * Get or create the singleton API client
 */
export function getClient(): AxiosInstance {
    if (!clientInstance) {
        clientInstance = createClient();
    }
    return clientInstance;
}

/**
 * Reset the client (useful after config changes)
 */
export function resetClient(): void {
    clientInstance = null;
}

/**
 * Create a temporary client for auth setup (before config exists)
 */
export function createTempClient(baseUrl: string, token: string, insecure?: boolean): AxiosInstance {
    const useInsecure = insecure ?? allowInsecure;
    const httpsAgent = getHttpsAgent(useInsecure);

    return axios.create({
        baseURL: baseUrl.replace(/\/+$/, ''),
        timeout: 30000,
        headers: {
            'Content-Type': 'application/json',
            'X-Angie-AuthApiToken': token,
        },
        ...(httpsAgent && { httpsAgent }),
    });
}
