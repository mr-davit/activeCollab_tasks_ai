/**
 * Authentication API methods for ActiveCollab
 */

import { AxiosInstance } from 'axios';
import { ACUser } from '../types';
import { getClient, createTempClient } from './client';
import { ACTaskError, fromAxiosError } from '../utils/errorHandler';

/**
 * Extract user ID from ActiveCollab API token
 * Token format: {user_id}-{random_string}
 */
export function extractUserIdFromToken(token: string): number | null {
    const match = token.match(/^(\d+)-/);
    if (match) {
        return parseInt(match[1], 10);
    }
    return null;
}

/**
 * Fetch the currently authenticated user
 * Tries /user first (cloud/newer versions), falls back to /users/{id} (self-hosted)
 */
export async function fetchCurrentUser(client?: AxiosInstance, token?: string): Promise<ACUser> {
    const apiClient = client || getClient();

    try {
        // Try /user endpoint first (works on cloud/newer versions)
        const response = await apiClient.get('/user');
        const data = response.data;

        if (data.single) {
            return data.single as ACUser;
        }

        if (data.id && data.display_name) {
            return data as ACUser;
        }

        throw new ACTaskError(
            'API_ERROR',
            'Unexpected response format from /user endpoint',
            500,
            JSON.stringify(data)
        );
    } catch (err) {
        // If /user fails, try extracting user ID from token and using /users/{id}
        if (token) {
            const userId = extractUserIdFromToken(token);
            if (userId) {
                return fetchUserById(apiClient, userId);
            }
        }

        if (err instanceof ACTaskError) {
            throw err;
        }
        throw fromAxiosError(err as any);
    }
}

/**
 * Fetch a specific user by ID
 */
export async function fetchUserById(client: AxiosInstance, userId: number): Promise<ACUser> {
    try {
        const response = await client.get(`/users/${userId}`);
        const data = response.data;

        if (data.single) {
            return data.single as ACUser;
        }

        if (data.id && data.display_name) {
            return data as ACUser;
        }

        throw new ACTaskError(
            'API_ERROR',
            'Unexpected response format from /users/{id} endpoint',
            500,
            JSON.stringify(data)
        );
    } catch (err) {
        if (err instanceof ACTaskError) {
            throw err;
        }
        throw fromAxiosError(err as any);
    }
}

/**
 * Verify connection and credentials by fetching user info
 * Used during auth:setup to validate before saving config
 * 
 * Tries /user first (cloud/newer versions), falls back to /users/{id} (self-hosted)
 * 
 * @param baseUrl - The ActiveCollab instance URL
 * @param token - The API token to validate
 * @param insecure - Whether to skip TLS certificate validation
 * @returns The authenticated user info
 */
export async function verifyCredentials(baseUrl: string, token: string, insecure?: boolean): Promise<ACUser> {
    const client = createTempClient(baseUrl, token, insecure);

    // First, try /user endpoint (works on cloud/newer versions)
    try {
        const response = await client.get('/user');
        const data = response.data;

        if (data.single) {
            return data.single as ACUser;
        }

        if (data.id && data.display_name) {
            return data as ACUser;
        }
    } catch {
        // /user failed, will try /users/{id} below
    }

    // Try extracting user ID from token and using /users/{id}
    const userId = extractUserIdFromToken(token);
    if (userId) {
        try {
            return await fetchUserById(client, userId);
        } catch (err) {
            if (err instanceof ACTaskError) {
                throw err;
            }
            // Fall through to generic error handling
        }
    }

    // If both approaches fail, try to provide helpful error
    try {
        // Test if API is reachable at all
        await client.get('/info');

        // API is reachable but user endpoint failed
        throw new ACTaskError(
            'AUTH_ERROR',
            'Unable to verify user identity',
            401,
            userId
                ? `Could not fetch user info for user ID ${userId}. The token may be invalid.`
                : 'Could not determine user ID from token. Ensure the token format is correct.'
        );
    } catch (err) {
        if (err instanceof ACTaskError) {
            throw err;
        }

        // Handle connection errors
        const axiosErr = err as any;
        if (axiosErr.code === 'ENOTFOUND' || axiosErr.code === 'ECONNREFUSED') {
            throw new ACTaskError(
                'NETWORK_ERROR',
                'Unable to connect to ActiveCollab',
                0,
                `Could not reach ${baseUrl}. Please verify the URL is correct.`
            );
        }

        throw new ACTaskError(
            'NETWORK_ERROR',
            'Connection failed',
            0,
            axiosErr.message || 'Unknown error occurred'
        );
    }
}
