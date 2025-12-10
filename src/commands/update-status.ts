/**
 * Update-status command for ac-task CLI
 * 
 * Changes task completion status:
 * - 'done' -> is_completed = 1
 * - 'open' -> is_completed = 0
 */

import { Command } from 'commander';
import chalk from 'chalk';
import { OutputFormat, ACTask } from '../types';
import { requireGlobalConfig, loadProjectConfig } from '../config/loader';
import { getClient } from '../api/client';
import { ACTaskError, handleError } from '../utils/errorHandler';
import { output, success } from '../utils/formatting';

/**
 * Get the output format from command options
 */
function getFormat(options: { format?: string }): OutputFormat {
    return options.format === 'json' ? 'json' : 'human';
}

interface UpdateStatusOptions {
    format?: string;
}

type StatusValue = 'done' | 'open';

/**
 * Map status string to is_completed value
 */
function statusToCompleted(status: StatusValue): number {
    return status === 'done' ? 1 : 0;
}

/**
 * Delay execution for a specified number of milliseconds
 */
function delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Fetch task and verify is_completed matches expected value
 * Retries with exponential backoff if mismatch (eventual consistency)
 */
async function verifyTaskStatus(
    client: ReturnType<typeof getClient>,
    projectId: number,
    taskId: number,
    expectedCompleted: boolean,
    maxRetries = 3
): Promise<ACTask> {
    const delays = [500, 1000, 2000]; // ms backoff

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
        const response = await client.get(`/projects/${projectId}/tasks/${taskId}`);
        const task: ACTask = response.data.single || response.data;

        const actualCompleted = task.is_completed === true || task.is_completed === 1;

        if (actualCompleted === expectedCompleted) {
            return task; // Success
        }

        // Mismatch — retry if attempts remain
        if (attempt < maxRetries) {
            await delay(delays[attempt]);
        } else {
            // Final attempt failed — return task with warning
            return task;
        }
    }

    throw new ACTaskError(
        'API_ERROR',
        'Failed to verify task status after retries',
        1,
        'The server may be experiencing delays. Check task status manually.'
    );
}

/**
 * Try to complete/reopen a task using canonical endpoints first, fallback to PUT with completed_on
 */
async function updateTaskCompletionStatus(
    client: ReturnType<typeof getClient>,
    projectId: number,
    taskId: number,
    complete: boolean
): Promise<ACTask> {
    const canonicalEndpoint = complete ? `/complete/task/${taskId}` : `/open/task/${taskId}`;

    try {
        // Try canonical endpoint first (PUT /complete/task/:id or PUT /open/task/:id)
        const response = await client.put(canonicalEndpoint, {});
        const task: ACTask = response.data.single || response.data;
        return task;
    } catch (err) {
        // If canonical endpoint fails (404/405 or error), fallback to PUT with completed_on
        if (err instanceof ACTaskError || (err as any).response?.status === 404 || (err as any).response?.status === 405) {
            // Fallback: PUT /projects/{p}/tasks/{id} with completed_on set/cleared
            const now = Math.floor(Date.now() / 1000);
            const payload = complete
                ? { is_completed: 1, completed_on: now }
                : { is_completed: 0, completed_on: null };

            const fallbackResponse = await client.put(`/projects/${projectId}/tasks/${taskId}`, payload);
            const task: ACTask = fallbackResponse.data.single || fallbackResponse.data;
            return task;
        }
        // Re-throw if it's not a routing error
        throw err;
    }
}

/**
 * update-status command handler
 */
async function updateStatusHandler(
    taskId: string,
    status: string,
    options: UpdateStatusOptions
): Promise<void> {
    const format = getFormat(options);

    try {
        // Validate status
        const normalizedStatus = status.toLowerCase();
        if (normalizedStatus !== 'done' && normalizedStatus !== 'open') {
            throw new ACTaskError(
                'VALIDATION_ERROR',
                'Invalid status value',
                1,
                'Status must be "done" or "open".'
            );
        }

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

        const client = getClient();
        const expectedCompleted = normalizedStatus === 'done';

        // Update task status using canonical endpoint with fallback
        await updateTaskCompletionStatus(client, projectId, id, expectedCompleted);

        // Verify with read-after-write (retry on eventual-consistency mismatch)
        const task = await verifyTaskStatus(client, projectId, id, expectedCompleted);

        const actualCompleted = task.is_completed === true || task.is_completed === 1;

        // Output result
        if (format === 'json') {
            output({
                success: actualCompleted === expectedCompleted,
                task: {
                    id: task.id,
                    task_number: task.task_number,
                    name: task.name,
                    is_completed: actualCompleted,
                },
                ...(actualCompleted !== expectedCompleted && {
                    warning: 'Status update sent but server returned different value. Check manually.'
                })
            }, format);
        } else {
            const statusLabel = actualCompleted
                ? chalk.green('✓ Completed')
                : chalk.yellow('○ Reopened');

            console.log(success(`Task #${task.task_number}: ${task.name}`));
            console.log(`  Status: ${statusLabel}`);

            if (actualCompleted !== expectedCompleted) {
                console.log(chalk.yellow('  ⚠ Warning: Server returned different status. Verify manually.'));
            }
        }
    } catch (err) {
        handleError(err, format);
    }
}

/**
 * Register update-status command with the CLI program
 */
export function registerUpdateStatusCommand(program: Command): void {
    program
        .command('update-status <task_id> <status>')
        .description('Change task status (done|open)')
        .option('-f, --format <format>', 'Output format (human|json)', 'human')
        .action(updateStatusHandler);
}
