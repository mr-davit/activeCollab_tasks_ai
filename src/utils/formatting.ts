/**
 * Output formatting utilities
 */

import chalk from 'chalk';
import { OutputFormat } from '../types';

/**
 * Print output based on format preference
 */
export function output(data: unknown, format: OutputFormat): void {
    if (format === 'json') {
        console.log(JSON.stringify(data, null, 2));
    } else {
        // For human format, data should be a string
        console.log(data);
    }
}

/**
 * Format a success message for human output
 */
export function success(message: string): string {
    return chalk.green('✓ ') + message;
}

/**
 * Format an error message for human output
 */
export function error(message: string): string {
    return chalk.red('✗ ') + message;
}

/**
 * Format a warning message for human output
 */
export function warning(message: string): string {
    return chalk.yellow('⚠ ') + message;
}

/**
 * Format an info message for human output
 */
export function info(message: string): string {
    return chalk.blue('ℹ ') + message;
}

/**
 * Format a label-value pair for human output
 */
export function labelValue(label: string, value: string | number): string {
    return `${chalk.gray(label + ':')} ${value}`;
}

/**
 * Format a header for human output
 */
export function header(text: string): string {
    return chalk.bold.underline(text);
}
