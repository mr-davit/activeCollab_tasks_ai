/**
 * Comment command for ac-task CLI
 * 
 * Adds a comment to an existing task.
 * Body is converted from plain text to HTML.
 */

import { Command } from 'commander';
import chalk from 'chalk';
import { OutputFormat, CreateCommentPayload } from '../types';
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

interface CommentOptions {
    format?: string;
}

interface ACComment {
    id: number;
    body: string;
    created_on: number;
    created_by_id: number;
    created_by_name?: string;
}

/**
 * comment command handler
 */
async function commentHandler(
    taskId: string,
    body: string,
    options: CommentOptions
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

        // Validate body
        if (!body || body.trim() === '') {
            throw new ACTaskError(
                'VALIDATION_ERROR',
                'Comment body cannot be empty',
                1,
                'Provide a non-empty comment text.'
            );
        }

        // Build payload (convert plain text to HTML)
        const payload: CreateCommentPayload = {
            body: textToHtml(body),
        };

        const client = getClient();

        // Create the comment
        // Note: ActiveCollab uses /comments/task/{task_id} endpoint
        const response = await client.post(
            `/comments/task/${id}`,
            payload
        );

        const comment: ACComment = response.data.single || response.data;

        // Output result
        if (format === 'json') {
            output({
                success: true,
                comment: {
                    id: comment.id,
                    task_id: id,
                    created_on: comment.created_on,
                },
            }, format);
        } else {
            console.log(success(`Added comment to task #${id}`));
            console.log(chalk.gray(`  Comment ID: ${comment.id}`));
        }
    } catch (err) {
        handleError(err, format);
    }
}

/**
 * Register comment command with the CLI program
 */
export function registerCommentCommand(program: Command): void {
    program
        .command('comment <task_id> <body>')
        .description('Add a comment to a task')
        .option('-f, --format <format>', 'Output format (human|json)', 'human')
        .action(commentHandler);
}
