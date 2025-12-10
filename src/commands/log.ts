0/**
 * Log command for ac-task CLI
 * 
 * Logs time spent on a task.
 * Handles job_type_id errors specially since some projects require it.
 */

import { Command } from 'commander';
import chalk from 'chalk';
import { OutputFormat, CreateTimeRecordPayload } from '../types';
import { requireGlobalConfig, loadProjectConfig } from '../config/loader';
import { getClient } from '../api/client';
import { ACTaskError, handleError, fromAxiosError } from '../utils/errorHandler';
import { output, success } from '../utils/formatting';
import { today } from '../utils/date';

/**
 * Get the output format from command options
 */
function getFormat(options: { format?: string }): OutputFormat {
    return options.format === 'json' ? 'json' : 'human';
}

interface LogOptions {
    format?: string;
    summary?: string;
    jobType?: string;
    date?: string;
}

interface ACTimeRecord {
    id: number;
    value: number;
    record_date: number;
    summary?: string;
    job_type_id?: number;
    created_on: number;
}

/**
 * Check if error is a job type related error
 * ActiveCollab returns 500 with specific message when job_type is missing
 * Note: Error may be an ACTaskError (transformed by client interceptor) or raw axios error
 */
function isJobTypeError(err: unknown): boolean {
    if (!err || typeof err !== 'object') return false;

    // Check for ACTaskError (transformed error from interceptor)
    const acErr = err as { message?: string; details?: string };
    if (acErr.message || acErr.details) {
        const errorText = ((acErr.message || '') + (acErr.details || '')).toLowerCase();
        if (errorText.includes('hourlyrate') ||
            errorText.includes('gethourlyratefor') ||
            errorText.includes('jobtype') ||
            errorText.includes('job_type')) {
            return true;
        }
    }

    // Check for axios error structure (fallback)
    const axiosErr = err as { response?: { status?: number; data?: unknown } };
    const data = axiosErr.response?.data;
    if (data && typeof data === 'object') {
        const message = JSON.stringify(data).toLowerCase();
        return message.includes('hourlyrate') ||
            message.includes('gethourlyratefor') ||
            message.includes('jobtype') ||
            message.includes('job_type');
    }

    return false;
}

/**
 * Validate date format (YYYY-MM-DD)
 */
function validateDate(date: string, fieldName: string): void {
    const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
    if (!dateRegex.test(date)) {
        throw new ACTaskError(
            'VALIDATION_ERROR',
            `Invalid ${fieldName} format`,
            1,
            `Date must be in YYYY-MM-DD format, got: ${date}`
        );
    }
}

/**
 * log command handler
 */
async function logHandler(
    taskId: string,
    hours: string,
    options: LogOptions
): Promise<void> {
    const format = getFormat(options);

    try {
        // Require configs
        requireGlobalConfig();
        const projectConfig = loadProjectConfig();

        if (!projectConfig) {
            throw new ACTaskError(
                'CONFIGURATION_ERROR',
                'Project not initialized',
                1,
                'Run "ac-task init" to initialize the project first.'
            );
        }

        const projectId = projectConfig.project_id;

        // Parse task ID
        const id = parseInt(taskId, 10);
        if (isNaN(id) || id <= 0) {
            throw new ACTaskError(
                'VALIDATION_ERROR',
                'Invalid task ID',
                1,
                'Task ID must be a positive number.'
            );
        }

        // Parse hours
        const hoursValue = parseFloat(hours);
        if (isNaN(hoursValue) || hoursValue <= 0) {
            throw new ACTaskError(
                'VALIDATION_ERROR',
                'Invalid hours value',
                1,
                'Hours must be a positive number (e.g., 1.5 for 1h 30m).'
            );
        }

        // Build payload
        const payload: CreateTimeRecordPayload = {
            value: hoursValue,
            record_date: options.date || today(),
            parent_type: 'Task',
            parent_id: id,
        };

        // Validate date if provided
        if (options.date) {
            validateDate(options.date, 'record date');
        }

        // Optional summary
        if (options.summary) {
            payload.summary = options.summary;
        }

        // Optional job type (some projects require this)
        if (options.jobType) {
            const jobTypeId = parseInt(options.jobType, 10);
            if (isNaN(jobTypeId) || jobTypeId <= 0) {
                throw new ACTaskError(
                    'VALIDATION_ERROR',
                    'Invalid job type ID',
                    1,
                    'Job type ID must be a positive number.'
                );
            }
            payload.job_type_id = jobTypeId;
        }

        const client = getClient();

        try {
            // Create the time record
            // Note: Uses /projects/{project_id}/time-records with parent_type/parent_id
            const response = await client.post(
                `/projects/${projectId}/time-records`,
                payload
            );

            const timeRecord: ACTimeRecord = response.data.single || response.data;

            // Output result
            if (format === 'json') {
                output({
                    success: true,
                    time_record: {
                        id: timeRecord.id,
                        task_id: id,
                        value: timeRecord.value,
                        record_date: options.date || today(),
                    },
                }, format);
            } else {
                console.log(success(`Logged ${hoursValue}h on task #${id}`));
                console.log(chalk.gray(`  Time Record ID: ${timeRecord.id}`));
                console.log(chalk.gray(`  Date: ${options.date || today()}`));
                if (options.summary) {
                    console.log(chalk.gray(`  Summary: ${options.summary}`));
                }
            }
        } catch (apiErr) {
            // Special handling for job type errors
            if (isJobTypeError(apiErr)) {
                throw new ACTaskError(
                    'JOB_TYPE_ERROR',
                    'Job Type required for time tracking',
                    400,
                    'This project requires a Job Type ID for time records. ' +
                    'Use --job-type <id> to specify one. ' +
                    'Contact your project administrator to find valid Job Type IDs.'
                );
            }
            // Re-throw other errors
            throw apiErr;
        }
    } catch (err) {
        handleError(err, format);
    }
}

/**
 * Register log command with the CLI program
 */
export function registerLogCommand(program: Command): void {
    program
        .command('log <task_id> <hours>')
        .description('Log time spent on a task')
        .option('-f, --format <format>', 'Output format (human|json)', 'human')
        .option('-m, --summary <text>', 'Description of work done')
        .option('-j, --job-type <id>', 'Job type ID (required by some projects)')
        .option('-d, --date <date>', 'Record date (YYYY-MM-DD, default: today)')
        .action(logHandler);
}
