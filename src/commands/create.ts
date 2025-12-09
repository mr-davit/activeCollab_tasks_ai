/**
 * Create command for ac-task CLI
 * 
 * Creates a new task in the ActiveCollab project with:
 * - Smart defaults (assign to me, use first task list)
 * - HTML body conversion
 * - Date handling
 */

import { Command } from 'commander';
import chalk from 'chalk';
import { OutputFormat, CreateTaskPayload, ACTask } from '../types';
import { requireGlobalConfig, loadProjectConfig } from '../config/loader';
import { getClient } from '../api/client';
import { textToHtml, fetchTaskLists } from '../api/utils';
import { ACTaskError, handleError } from '../utils/errorHandler';
import { output, success } from '../utils/formatting';

/**
 * Get the output format from command options
 */
function getFormat(options: { format?: string }): OutputFormat {
    return options.format === 'json' ? 'json' : 'human';
}

interface CreateOptions {
    format?: string;
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
 * create command handler
 */
async function createHandler(name: string, options: CreateOptions): Promise<void> {
    const format = getFormat(options);

    try {
        // Require configs
        const globalConfig = requireGlobalConfig();
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
        const client = getClient();

        // Build payload with smart defaults
        const payload: CreateTaskPayload = {
            name: name.trim(),
        };

        // Body (convert to HTML)
        if (options.body) {
            payload.body = textToHtml(options.body);
        }

        // Assignee: default to me
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
        } else if (globalConfig.cached_user_id) {
            // Smart default: assign to me
            payload.assignee_id = globalConfig.cached_user_id;
        }

        // Task list: use specified or find default
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
        } else {
            // Smart default: use first available task list
            const taskLists = await fetchTaskLists(projectId, client);
            if (taskLists.length > 0) {
                payload.task_list_id = taskLists[0].id;
            }
        }

        // Due date
        if (options.due) {
            validateDate(options.due, 'due date');
            payload.due_on = options.due;
        }

        // Start date
        if (options.start) {
            validateDate(options.start, 'start date');
            payload.start_on = options.start;
        }

        // Create the task
        const response = await client.post(`/projects/${projectId}/tasks`, payload);
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
            }, format);
        } else {
            console.log(success(`Created task #${task.task_number}: ${task.name}`));
            console.log(chalk.gray(`  ID: ${task.id}`));
            if (task.assignee_id) {
                console.log(chalk.gray(`  Assignee ID: ${task.assignee_id}`));
            }
            if (task.due_on) {
                console.log(chalk.gray(`  Due: ${options.due}`));
            }
        }
    } catch (err) {
        handleError(err, format);
    }
}

/**
 * Register create command with the CLI program
 */
export function registerCreateCommand(program: Command): void {
    program
        .command('create <name>')
        .description('Create a new task')
        .option('-f, --format <format>', 'Output format (human|json)', 'human')
        .option('-b, --body <text>', 'Task description (plain text, converted to HTML)')
        .option('-a, --assignee <user_id>', 'Assignee user ID (default: me)')
        .option('-l, --list <list_id>', 'Task list ID (default: first available)')
        .option('-d, --due <date>', 'Due date (YYYY-MM-DD)')
        .option('-s, --start <date>', 'Start date (YYYY-MM-DD)')
        .action(createHandler);
}
