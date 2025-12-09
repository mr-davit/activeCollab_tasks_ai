/**
 * Show command for ac-task CLI
 * 
 * Displays detailed task information including:
 * - Full description (HTML stripped)
 * - Subtasks
 * - Metadata
 */

import { Command } from 'commander';
import chalk from 'chalk';
import { OutputFormat, ACTask, ACSubtask, ACTaskList } from '../types';
import { requireGlobalConfig, loadProjectConfig } from '../config/loader';
import { fetchTask, fetchTaskLists, stripHtml, formatDueDate, buildTaskListMap } from '../api/utils';
import { getClient } from '../api/client';
import { ACTaskError, handleError } from '../utils/errorHandler';
import { output, info, labelValue } from '../utils/formatting';

/**
 * Get the output format from command options
 */
function getFormat(options: { format?: string }): OutputFormat {
    return options.format === 'json' ? 'json' : 'human';
}

interface ShowOptions {
    format?: string;
    raw?: boolean; // Keep HTML in output
}

/**
 * Format a subtask for human output
 */
function formatSubtask(subtask: ACSubtask, index: number): string {
    const status = subtask.is_completed ? chalk.green('✓') : chalk.gray('○');
    // API uses 'name' for subtasks, not 'body'
    const text = subtask.name || stripHtml(subtask.body) || 'Untitled subtask';
    return `  ${status} ${index + 1}. ${text}`;
}

/**
 * show command handler
 */
async function showHandler(taskId: string, options: ShowOptions): Promise<void> {
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

        // Fetch task data
        if (format === 'human') {
            console.log(info('Fetching task details...'));
        }

        const client = getClient();

        // Fetch task and task lists in parallel
        const [taskResponse, taskLists] = await Promise.all([
            fetchTask(projectId, id, client),
            fetchTaskLists(projectId, client),
        ]);

        const task: ACTask = taskResponse.single;
        const subtasks: ACSubtask[] = taskResponse.subtasks || [];
        const taskListMap = buildTaskListMap(taskLists);

        // Output results
        if (format === 'json') {
            // JSON output with cleaned data
            const jsonOutput = {
                id: task.id,
                task_number: task.task_number,
                name: task.name,
                body: options.raw ? task.body : stripHtml(task.body),
                is_completed: task.is_completed === 1,
                assignee_id: task.assignee_id,
                due_on: task.due_on ? formatDueDate(task.due_on) : null,
                start_on: task.start_on ? formatDueDate(task.start_on) : null,
                task_list_id: task.task_list_id,
                task_list_name: taskListMap.get(task.task_list_id) || null,
                project_id: task.project_id,
                created_on: task.created_on ? formatDueDate(task.created_on) : null,
                created_by_name: task.created_by_name || null,
                subtasks: subtasks.map(st => ({
                    id: st.id,
                    name: st.name || stripHtml(st.body) || '',
                    is_completed: st.is_completed === true || st.is_completed === 1,
                    assignee_id: st.assignee_id || null,
                    due_on: st.due_on ? formatDueDate(st.due_on) : null,
                })),
            };

            output(jsonOutput, format);
        } else {
            // Human-readable output
            console.log('');

            // Header
            const status = task.is_completed
                ? chalk.green('✓ Completed')
                : chalk.yellow('○ Open');

            console.log(chalk.bold.cyan(`#${task.task_number}`) + ' ' + chalk.bold(task.name));
            console.log(chalk.gray('─'.repeat(60)));
            console.log('');

            // Status row
            console.log(labelValue('Status', status));

            // Task list
            const listName = taskListMap.get(task.task_list_id) || 'Unknown';
            console.log(labelValue('List', listName));

            // Due date
            if (task.due_on) {
                const dueStr = formatDueDate(task.due_on);
                const now = Date.now() / 1000;
                if (task.due_on < now && !task.is_completed) {
                    console.log(labelValue('Due', chalk.red(dueStr + ' (overdue)')));
                } else {
                    console.log(labelValue('Due', dueStr));
                }
            } else {
                console.log(labelValue('Due', chalk.gray('No due date')));
            }

            // Assignee
            if (task.assignee_id) {
                console.log(labelValue('Assignee ID', task.assignee_id.toString()));
            } else {
                console.log(labelValue('Assignee', chalk.gray('Unassigned')));
            }

            // Created info
            if (task.created_by_name) {
                const createdDate = task.created_on ? formatDueDate(task.created_on) : 'Unknown date';
                console.log(labelValue('Created', `${task.created_by_name} on ${createdDate}`));
            }

            console.log('');

            // Description
            console.log(chalk.bold('Description:'));
            console.log(chalk.gray('─'.repeat(60)));
            const body = stripHtml(task.body);
            if (body) {
                console.log(body);
            } else {
                console.log(chalk.gray('No description provided.'));
            }
            console.log('');

            // Subtasks
            if (subtasks.length > 0) {
                const completedCount = subtasks.filter(st => st.is_completed === true || st.is_completed === 1).length;
                console.log(chalk.bold(`Subtasks (${completedCount}/${subtasks.length} completed):`));
                console.log(chalk.gray('─'.repeat(60)));
                for (let i = 0; i < subtasks.length; i++) {
                    console.log(formatSubtask(subtasks[i], i));
                }
                console.log('');
            }
        }
    } catch (err) {
        handleError(err, format);
    }
}

/**
 * Register show command with the CLI program
 */
export function registerShowCommand(program: Command): void {
    program
        .command('show <task_id>')
        .description('Show detailed task information')
        .option('-f, --format <format>', 'Output format (human|json)', 'human')
        .option('-r, --raw', 'Keep raw HTML in body (default: strip HTML)')
        .action(showHandler);
}
