/**
 * Semantic Error Envelope Handler
 * 
 * When --format json is used, ALL errors must be caught and printed
 * to stdout (not stderr) as a structured JSON object.
 */

import { AxiosError } from 'axios';
import chalk from 'chalk';
import { ErrorType, SemanticError, OutputFormat } from '../types';

/**
 * Custom error class with semantic information
 */
export class ACTaskError extends Error {
    public readonly type: ErrorType;
    public readonly code: number;
    public readonly details?: string;

    constructor(type: ErrorType, message: string, code: number = 1, details?: string) {
        super(message);
        this.name = 'ACTaskError';
        this.type = type;
        this.code = code;
        this.details = details;
    }

    toJSON(): SemanticError {
        return {
            error: {
                type: this.type,
                code: this.code,
                message: this.message,
                ...(this.details && { details: this.details }),
            },
        };
    }
}

/**
 * Convert an Axios error to ACTaskError
 */
export function fromAxiosError(err: AxiosError): ACTaskError {
    if (!err.response) {
        // Network error (no response)
        return new ACTaskError(
            'NETWORK_ERROR',
            'Unable to connect to ActiveCollab API',
            0,
            err.message
        );
    }

    const status = err.response.status;
    const data = err.response.data as Record<string, unknown> | undefined;

    if (status === 401) {
        return new ACTaskError(
            'AUTH_ERROR',
            'Authentication failed',
            401,
            'The API token is invalid or expired.'
        );
    }

    if (status === 403) {
        return new ACTaskError(
            'AUTH_ERROR',
            'Access forbidden',
            403,
            'You do not have permission to access this resource.'
        );
    }

    if (status === 404) {
        return new ACTaskError(
            'API_ERROR',
            'Resource not found',
            404,
            data?.message as string || 'The requested resource does not exist.'
        );
    }

    // Generic API error
    return new ACTaskError(
        'API_ERROR',
        data?.message as string || `API error (HTTP ${status})`,
        status,
        JSON.stringify(data)
    );
}

/**
 * Handle and output an error based on format preference
 */
export function handleError(err: unknown, format: OutputFormat): never {
    let acError: ACTaskError;

    if (err instanceof ACTaskError) {
        acError = err;
    } else if (err instanceof AxiosError) {
        acError = fromAxiosError(err);
    } else if (err instanceof Error) {
        acError = new ACTaskError('UNKNOWN_ERROR', err.message, 1);
    } else {
        acError = new ACTaskError('UNKNOWN_ERROR', String(err), 1);
    }

    if (format === 'json') {
        // JSON format: output to stdout
        console.log(JSON.stringify(acError.toJSON(), null, 2));
    } else {
        // Human format: output to stderr with colors
        console.error(chalk.red(`\n✗ Error: ${acError.message}`));
        if (acError.details) {
            console.error(chalk.gray(`  ${acError.details}`));
        }
        console.error(chalk.gray(`  Type: ${acError.type}, Code: ${acError.code}\n`));
    }

    process.exit(1);
}

/**
 * Wrap an async function with error handling
 */
export function withErrorHandler<T extends unknown[]>(
    fn: (...args: T) => Promise<void>,
    getFormat: () => OutputFormat
): (...args: T) => Promise<void> {
    return async (...args: T) => {
        try {
            await fn(...args);
        } catch (err) {
            handleError(err, getFormat());
        }
    };
}
