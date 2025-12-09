/**
 * List command for ac-task CLI
 * 
 * Displays tasks with "Smart Defaults":
 * - Default: My open tasks, sorted by due date
 * - Flags to override filtering behavior
 */

import { Command } from 'commander';
import chalk from 'chalk';
import { OutputFormat, ACTaskHeader, ACTaskList, TaskFilterOptions } from '../types';
import { requireGlobalConfig, loadProjectConfig } from '../config/loader';
import {
    fetchTaskHeaders,
    fetchTaskLists,
    filterTasks,
    sortTasksByDueDate,
    formatDueDate,
    getDaysFromNow,
    isOverdue,
    buildTaskListMap,
    truncate,
} from '../api/utils';
import { getClient } from '../api/client';
import { ACTaskError, handleError } from '../utils/errorHandler';
import { output, info, warning } from '../utils/formatting';
import { today } from '../utils/date';

/**
 * Get the output format from command options
 */
function getFormat(options: { format?: string }): OutputFormat {
    return options.format === 'json' ? 'json' : 'human';
}

interface ListOptions {
    format?: string;
    all?: boolean;
    closed?: boolean;
    mine?: boolean;
    days?: string;
    listId?: string;
    search?: string;
    dueBefore?: string;
    dueAfter?: string;
}

/**
 * Format a single task row for human output
 */
function formatTaskRow(
    task: ACTaskHeader,
    taskListMap: Map<number, string>,
    maxNameLength: number = 50
): string {
    const id = chalk.cyan(`#${task.task_number}`.padEnd(6));
    const name = truncate(task.name, maxNameLength).padEnd(maxNameLength);

    const listName = taskListMap.get(task.task_list_id) || 'Unknown';
    const list = chalk.gray(truncate(listName, 15).padEnd(15));

    let dueStr = '';
    if (task.due_on) {
        const dateStr = formatDueDate(task.due_on);
        if (isOverdue(task.due_on)) {
            dueStr = chalk.red(dateStr);
        } else {
            dueStr = chalk.yellow(dateStr);
        }
    } else {
        dueStr = chalk.gray('No due date');
    }

    const status = task.is_completed ? chalk.green('✓') : chalk.gray('○');

    return `${status} ${id} ${name} ${list} ${dueStr}`;
}

/**
 * Print table header for human output
 */
function printTableHeader(maxNameLength: number = 50): void {
    const header = `  ${'ID'.padEnd(6)} ${'Title'.padEnd(maxNameLength)} ${'List'.padEnd(15)} Due Date`;
    console.log(chalk.bold(header));
    console.log(chalk.gray('─'.repeat(header.length + 5)));
}

/**
 * list command handler
 */
async function listHandler(options: ListOptions): Promise<void> {
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
        const myUserId = globalConfig.cached_user_id;

        // Build filter options based on flags
        const filterOptions: TaskFilterOptions = {};

        // Smart Defaults: My Open Tasks (unless overridden)
        if (!options.all) {
            // Default to my tasks unless --all is specified
            if (options.mine !== false) {
                filterOptions.assigneeId = myUserId;
            }
        }

        // Completion status
        if (options.closed) {
            filterOptions.isCompleted = 1;
        } else if (!options.all) {
            // Default to open tasks
            filterOptions.isCompleted = 0;
        }

        // Task list filter
        if (options.listId) {
            filterOptions.taskListId = parseInt(options.listId, 10);
        }

        // Date range filters
        if (options.days) {
            const days = parseInt(options.days, 10);
            filterOptions.dueAfter = today();
            filterOptions.dueBefore = getDaysFromNow(days);
        }

        if (options.dueBefore) {
            filterOptions.dueBefore = options.dueBefore;
        }

        if (options.dueAfter) {
            filterOptions.dueAfter = options.dueAfter;
        }

        // Search filter
        if (options.search) {
            filterOptions.search = options.search;
        }

        // Fetch data
        if (format === 'human') {
            console.log(info('Fetching tasks...'));
        }

        const client = getClient();

        // Fetch tasks and task lists in parallel
        const [allTasks, taskLists] = await Promise.all([
            fetchTaskHeaders(projectId, client),
            fetchTaskLists(projectId, client),
        ]);

        // Filter tasks in memory
        let tasks = filterTasks(allTasks, filterOptions);

        // Sort by due date
        tasks = sortTasksByDueDate(tasks);

        // Build task list lookup map
        const taskListMap = buildTaskListMap(taskLists);

        // Output results
        if (format === 'json') {
            // Clean output for JSON
            const jsonTasks = tasks.map(t => ({
                id: t.id,
                task_number: t.task_number,
                name: t.name,
                is_completed: t.is_completed === 1,
                assignee_id: t.assignee_id,
                due_on: t.due_on ? formatDueDate(t.due_on) : null,
                task_list_id: t.task_list_id,
                task_list_name: taskListMap.get(t.task_list_id) || null,
            }));

            output({
                count: jsonTasks.length,
                total_fetched: allTasks.length,
                filters: filterOptions,
                tasks: jsonTasks,
            }, format);
        } else {
            // Human-readable output
            console.log('');

            // Show active filters
            const filterParts: string[] = [];
            if (filterOptions.assigneeId === myUserId) {
                filterParts.push('My tasks');
            }
            if (filterOptions.isCompleted === 0) {
                filterParts.push('Open');
            } else if (filterOptions.isCompleted === 1) {
                filterParts.push('Closed');
            }
            if (filterOptions.search) {
                filterParts.push(`Search: "${filterOptions.search}"`);
            }

            if (filterParts.length > 0) {
                console.log(chalk.gray(`Filters: ${filterParts.join(', ')}`));
            }

            console.log(chalk.gray(`Showing ${tasks.length} of ${allTasks.length} tasks\n`));

            if (tasks.length === 0) {
                console.log(warning('No tasks found matching the criteria.'));
                console.log(chalk.gray('Try using --all to see all tasks.'));
            } else {
                printTableHeader();
                for (const task of tasks) {
                    console.log(formatTaskRow(task, taskListMap));
                }
            }

            console.log('');
        }
    } catch (err) {
        handleError(err, format);
    }
}

/**
 * Register list command with the CLI program
 */
export function registerListCommand(program: Command): void {
    program
        .command('list')
        .alias('ls')
        .description('List tasks (default: my open tasks)')
        .option('-f, --format <format>', 'Output format (human|json)', 'human')
        .option('-a, --all', 'Show all tasks (remove assignee filter)')
        .option('-c, --closed', 'Show completed tasks')
        .option('-m, --mine', 'Show only my tasks (default)')
        .option('-d, --days <n>', 'Show tasks due within N days')
        .option('-l, --list-id <id>', 'Filter by task list ID')
        .option('-s, --search <query>', 'Search tasks by name')
        .option('--due-before <date>', 'Show tasks due before date (YYYY-MM-DD)')
        .option('--due-after <date>', 'Show tasks due after date (YYYY-MM-DD)')
        .action(listHandler);
}
