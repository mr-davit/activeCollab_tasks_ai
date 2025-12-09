/**
 * Update command for ac-task CLI
 * 
 * Updates an existing task's fields:
 * - name, body, assignee, task_list, due_on, start_on
 * - Only specified fields are updated
 */

import { Command } from 'commander';
import chalk from 'chalk';
import { OutputFormat, UpdateTaskPayload, ACTask } from '../types';
import { requireGlobalConfig, loadProjectConfig } from '../config/loader';
import { getClient } from '../api/client';
import { textToHtml } from '../api/utils';
import { ACTaskError, handleError } from '../utils/errorHandler';
import { output, success } from '../utils/formatting';

/**
 * Get the output format from command options
 */
function getFormat(options: { format?: string }): OutputFormat {
    return options.format === 'json' ? 'json' : 'human';
}

interface UpdateOptions {
    format?: string;
    name?: string;
    body?: string;
    assignee?: string;
    list?: string;
    due?: string;
    start?: string;
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
 * update command handler
 */
async function updateHandler(taskId: string, options: UpdateOptions): Promise<void> {
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

        // Build payload - only include fields that were specified
        const payload: UpdateTaskPayload = {};
        const updates: string[] = [];

        if (options.name) {
            payload.name = options.name.trim();
            updates.push('name');
        }

        if (options.body) {
            payload.body = textToHtml(options.body);
            updates.push('body');
        }

        if (options.assignee) {
            const assigneeId = parseInt(options.assignee, 10);
            if (isNaN(assigneeId) || assigneeId <= 0) {
                throw new ACTaskError(
                    'VALIDATION_ERROR',
                    'Invalid assignee ID',
                    1,
                    'Assignee must be a positive number (user ID).'
                );
            }
            payload.assignee_id = assigneeId;
            updates.push('assignee');
        }

        if (options.list) {
            const listId = parseInt(options.list, 10);
            if (isNaN(listId) || listId <= 0) {
                throw new ACTaskError(
                    'VALIDATION_ERROR',
                    'Invalid task list ID',
                    1,
                    'Task list ID must be a positive number.'
                );
            }
            payload.task_list_id = listId;
            updates.push('task_list');
        }

        if (options.due) {
            validateDate(options.due, 'due date');
            payload.due_on = options.due;
            updates.push('due_on');
        }

        if (options.start) {
            validateDate(options.start, 'start date');
            payload.start_on = options.start;
            updates.push('start_on');
        }

        // Check if there's anything to update
        if (updates.length === 0) {
            throw new ACTaskError(
                'VALIDATION_ERROR',
                'No fields specified to update',
                1,
                'Specify at least one field to update: --name, --body, --assignee, --list, --due, --start'
            );
        }

        const client = getClient();

        // Update the task
        const response = await client.put(`/projects/${projectId}/tasks/${id}`, payload);
        const task: ACTask = response.data.single || response.data;

        // Output result
        if (format === 'json') {
            output({
                success: true,
                task: {
                    id: task.id,
                    task_number: task.task_number,
                    name: task.name,
                    assignee_id: task.assignee_id,
                    task_list_id: task.task_list_id,
                    due_on: task.due_on,
                    project_id: task.project_id,
                },
                updated_fields: updates,
            }, format);
        } else {
            console.log(success(`Updated task #${task.task_number}: ${task.name}`));
            console.log(chalk.gray(`  Updated: ${updates.join(', ')}`));
        }
    } catch (err) {
        handleError(err, format);
    }
}

/**
 * Register update command with the CLI program
 */
export function registerUpdateCommand(program: Command): void {
    program
        .command('update <task_id>')
        .description('Update an existing task')
        .option('-f, --format <format>', 'Output format (human|json)', 'human')
        .option('-n, --name <name>', 'New task name')
        .option('-b, --body <text>', 'New description (plain text, converted to HTML)')
        .option('-a, --assignee <user_id>', 'New assignee user ID')
        .option('-l, --list <list_id>', 'New task list ID')
        .option('-d, --due <date>', 'New due date (YYYY-MM-DD)')
        .option('-s, --start <date>', 'New start date (YYYY-MM-DD)')
        .action(updateHandler);
}
