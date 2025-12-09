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
        const isCompleted = statusToCompleted(normalizedStatus as StatusValue);

        // Update task status
        const response = await client.put(`/projects/${projectId}/tasks/${id}`, {
            is_completed: isCompleted,
        });

        const task: ACTask = response.data.single || response.data;

        // Output result
        if (format === 'json') {
            output({
                success: true,
                task: {
                    id: task.id,
                    task_number: task.task_number,
                    name: task.name,
                    is_completed: isCompleted === 1,
                },
            }, format);
        } else {
            const statusLabel = isCompleted === 1
                ? chalk.green('✓ Completed')
                : chalk.yellow('○ Reopened');

            console.log(success(`Task #${task.task_number}: ${task.name}`));
            console.log(`  Status: ${statusLabel}`);
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
