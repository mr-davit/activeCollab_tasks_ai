/**
 * Delete command for ac-task CLI
 * 
 * Deletes a task with safety confirmation.
 * Requires interactive confirmation unless --force is used.
 */

import { Command } from 'commander';
import chalk from 'chalk';
import { confirm } from '@inquirer/prompts';
import { OutputFormat, ACTask } from '../types';
import { requireGlobalConfig, loadProjectConfig } from '../config/loader';
import { getClient } from '../api/client';
import { fetchTask } from '../api/utils';
import { ACTaskError, handleError } from '../utils/errorHandler';
import { output, success, warning } from '../utils/formatting';

/**
 * Get the output format from command options
 */
function getFormat(options: { format?: string }): OutputFormat {
    return options.format === 'json' ? 'json' : 'human';
}

interface DeleteOptions {
    format?: string;
    force?: boolean;
}

/**
 * delete command handler
 */
async function deleteHandler(taskId: string, options: DeleteOptions): Promise<void> {
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

        const client = getClient();

        // Fetch task first to get details for confirmation
        const taskResponse = await fetchTask(projectId, id, client);
        const task: ACTask = taskResponse.single;

        // Safety confirmation (unless --force)
        if (!options.force) {
            // JSON mode cannot do interactive confirmation
            if (format === 'json') {
                throw new ACTaskError(
                    'SAFETY_ERROR',
                    'Confirmation required for deletion',
                    1,
                    'Use --force flag to delete without confirmation in JSON mode.'
                );
            }

            console.log(warning(`You are about to delete task #${task.task_number}: ${task.name}`));
            console.log(chalk.gray('  This action cannot be undone.'));
            console.log('');

            const confirmed = await confirm({
                message: 'Are you sure you want to delete this task?',
                default: false,
            });

            if (!confirmed) {
                console.log(chalk.gray('Deletion cancelled.'));
                return;
            }
        }

        // Delete the task (move to trash)
        await client.delete(`/projects/${projectId}/tasks/${id}`);

        // Output result
        if (format === 'json') {
            output({
                success: true,
                deleted: {
                    id: task.id,
                    task_number: task.task_number,
                    name: task.name,
                },
            }, format);
        } else {
            console.log(success(`Deleted task #${task.task_number}: ${task.name}`));
        }
    } catch (err) {
        handleError(err, format);
    }
}

/**
 * Register delete command with the CLI program
 */
export function registerDeleteCommand(program: Command): void {
    program
        .command('delete <task_id>')
        .description('Delete a task (moves to trash)')
        .option('-f, --format <format>', 'Output format (human|json)', 'human')
        .option('--force', 'Skip confirmation prompt')
        .action(deleteHandler);
}
