/**
 * API Utilities for ActiveCollab
 * 
 * Contains helper functions for fetching data, pagination,
 * HTML stripping, and date formatting.
 */

import { AxiosInstance } from 'axios';
import {
    ACTaskHeader,
    ACTask,
    ACSubtask,
    ACProject,
    ACUser,
    ACTaskList,
    ACSingleResponse,
    TaskFilterOptions,
} from '../types/activecollab';
import { getClient } from './client';
import { formatDate as formatDateUtil, unixToDateString } from '../utils/date';

// ============================================================================
// Pagination & Fetching
// ============================================================================

/**
 * Fetch all pages of a paginated endpoint
 * ActiveCollab returns empty array when no more pages
 * 
 * @param endpoint - API endpoint (e.g., '/projects/123/tasks')
 * @param client - Axios client instance
 * @param maxPages - Maximum pages to fetch (safety limit)
 * @returns Combined array of all results
 */
export async function fetchAllPages<T>(
    endpoint: string,
    client?: AxiosInstance,
    maxPages: number = 10
): Promise<T[]> {
    const apiClient = client || getClient();
    const results: T[] = [];

    for (let page = 1; page <= maxPages; page++) {
        const separator = endpoint.includes('?') ? '&' : '?';
        const url = `${endpoint}${separator}page=${page}`;

        const response = await apiClient.get(url);
        const data = response.data;

        // Handle array response
        if (Array.isArray(data)) {
            if (data.length === 0) {
                break; // No more pages
            }
            results.push(...data);
        } else if (data && typeof data === 'object') {
            // Handle wrapped responses like { tasks: [...] }
            const keys = Object.keys(data);
            for (const key of keys) {
                if (Array.isArray(data[key])) {
                    if (data[key].length === 0) break;
                    results.push(...data[key]);
                    break;
                }
            }
            // If no array found in object, stop pagination
            if (!keys.some(k => Array.isArray(data[k]))) {
                break;
            }
        } else {
            // Single item or unexpected format
            break;
        }
    }

    return results;
}

/**
 * Fetch task headers (minimal data) for a project
 * 
 * Note: ActiveCollab's /projects/:id/tasks endpoint doesn't seem to 
 * support standard pagination - it returns all tasks in one response.
 * 
 * @param projectId - Project ID
 * @param client - Optional Axios client
 * @returns Array of task headers (no body/HTML)
 */
export async function fetchTaskHeaders(
    projectId: number,
    client?: AxiosInstance
): Promise<ACTaskHeader[]> {
    const apiClient = client || getClient();
    const response = await apiClient.get(`/projects/${projectId}/tasks`);
    const data = response.data;

    // Handle wrapped response { tasks: [...] }
    if (data && data.tasks && Array.isArray(data.tasks)) {
        return data.tasks;
    }

    // Handle direct array response
    if (Array.isArray(data)) {
        return data;
    }

    return [];
}

/**
 * Fetch a single task with full details
 * 
 * @param projectId - Project ID
 * @param taskId - Task ID
 * @param client - Optional Axios client
 * @returns Task with subtasks
 */
export async function fetchTask(
    projectId: number,
    taskId: number,
    client?: AxiosInstance
): Promise<ACSingleResponse<ACTask>> {
    const apiClient = client || getClient();
    const response = await apiClient.get(`/projects/${projectId}/tasks/${taskId}`);
    return response.data;
}

/**
 * Fetch project details
 */
export async function fetchProject(
    projectId: number,
    client?: AxiosInstance
): Promise<ACProject> {
    const apiClient = client || getClient();
    const response = await apiClient.get(`/projects/${projectId}`);
    // Handle both wrapped and direct responses
    return response.data.single || response.data;
}

/**
 * Fetch all users (system-wide)
 */
export async function fetchAllUsers(
    client?: AxiosInstance
): Promise<ACUser[]> {
    const apiClient = client || getClient();
    const response = await apiClient.get('/users');
    return Array.isArray(response.data) ? response.data : [];
}

/**
 * Fetch project members/users
 * 
 * Note: The /projects/:id/members endpoint returns just user IDs,
 * so we fetch all users and filter by the member IDs.
 */
export async function fetchProjectUsers(
    projectId: number,
    client?: AxiosInstance
): Promise<ACUser[]> {
    const apiClient = client || getClient();

    // Get member IDs for this project
    const memberResponse = await apiClient.get(`/projects/${projectId}/members`);
    const memberIds: number[] = Array.isArray(memberResponse.data) ? memberResponse.data : [];

    if (memberIds.length === 0) {
        return [];
    }

    // Fetch all users and filter to project members
    const allUsers = await fetchAllUsers(apiClient);
    return allUsers.filter(user => memberIds.includes(user.id));
}

/**
 * Fetch project task lists
 */
export async function fetchTaskLists(
    projectId: number,
    client?: AxiosInstance
): Promise<ACTaskList[]> {
    const apiClient = client || getClient();
    const response = await apiClient.get(`/projects/${projectId}/task-lists`);
    return Array.isArray(response.data) ? response.data : [];
}

// ============================================================================
// Filtering (In-Memory)
// ============================================================================

/**
 * Filter tasks in memory based on options
 * We filter in-memory because AC API doesn't support all filter params
 * 
 * Note: AC API returns is_completed as boolean, but we accept 0/1 for filtering
 * 
 * @param tasks - Array of tasks to filter
 * @param options - Filter options
 * @returns Filtered tasks
 */
export function filterTasks(
    tasks: ACTaskHeader[],
    options: TaskFilterOptions
): ACTaskHeader[] {
    let filtered = [...tasks];

    // Filter by assignee
    if (options.assigneeId !== undefined && options.assigneeId !== null) {
        filtered = filtered.filter(t => t.assignee_id === options.assigneeId);
    }

    // Filter by completion status
    // Handle both boolean and number (API returns boolean, we use 0/1)
    if (options.isCompleted !== undefined) {
        const targetCompleted = options.isCompleted === 1 || options.isCompleted === true;
        filtered = filtered.filter(t => {
            const taskCompleted = t.is_completed === 1 || t.is_completed === true;
            return taskCompleted === targetCompleted;
        });
    }

    // Filter by task list
    if (options.taskListId !== undefined) {
        filtered = filtered.filter(t => t.task_list_id === options.taskListId);
    }

    // Filter by due date (before)
    if (options.dueBefore) {
        const beforeTimestamp = new Date(options.dueBefore).getTime() / 1000;
        filtered = filtered.filter(t => {
            if (t.due_on === null) return false;
            return t.due_on <= beforeTimestamp;
        });
    }

    // Filter by due date (after)
    if (options.dueAfter) {
        const afterTimestamp = new Date(options.dueAfter).getTime() / 1000;
        filtered = filtered.filter(t => {
            if (t.due_on === null) return false;
            return t.due_on >= afterTimestamp;
        });
    }

    // Search by name (case-insensitive)
    if (options.search) {
        const searchLower = options.search.toLowerCase();
        filtered = filtered.filter(t =>
            t.name.toLowerCase().includes(searchLower)
        );
    }

    return filtered;
}

/**
 * Sort tasks by due date (ascending, nulls last)
 */
export function sortTasksByDueDate(tasks: ACTaskHeader[]): ACTaskHeader[] {
    return [...tasks].sort((a, b) => {
        // Nulls last
        if (a.due_on === null && b.due_on === null) return 0;
        if (a.due_on === null) return 1;
        if (b.due_on === null) return -1;
        return a.due_on - b.due_on;
    });
}

// ============================================================================
// HTML & Text Processing
// ============================================================================

/**
 * Strip HTML tags from a string
 * Converts <br> and </p> to newlines, removes all other tags
 * 
 * Uses simple regex - no heavy DOM parser needed
 * 
 * @param html - HTML string to clean
 * @returns Plain text
 */
export function stripHtml(html: string | null | undefined): string {
    if (!html) return '';

    let text = html;

    // Convert <br> and <br/> to newlines
    text = text.replace(/<br\s*\/?>/gi, '\n');

    // Convert </p> and </div> to newlines
    text = text.replace(/<\/(p|div)>/gi, '\n');

    // Remove all remaining HTML tags
    text = text.replace(/<[^>]*>/g, '');

    // Decode common HTML entities
    text = text
        .replace(/&nbsp;/g, ' ')
        .replace(/&amp;/g, '&')
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>')
        .replace(/&quot;/g, '"')
        .replace(/&#39;/g, "'")
        .replace(/&#x27;/g, "'")
        .replace(/&#x2F;/g, '/');

    // Collapse multiple newlines
    text = text.replace(/\n{3,}/g, '\n\n');

    // Trim whitespace
    text = text.trim();

    return text;
}

/**
 * Convert plain text to HTML for API payloads
 * Converts newlines to <br> tags and escapes HTML entities
 * 
 * ActiveCollab requires HTML in body fields for tasks, comments, etc.
 * 
 * @param text - Plain text to convert
 * @returns HTML formatted string
 */
export function textToHtml(text: string | null | undefined): string {
    if (!text) return '';

    let html = text;

    // Escape HTML entities first
    html = html
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');

    // Convert newlines to <br> tags
    html = html.replace(/\n/g, '<br>');

    return html;
}

// ============================================================================
// Date Formatting
// ============================================================================

/**
 * Format a Unix timestamp to YYYY-MM-DD string
 * Returns empty string for null/undefined
 * 
 * @param timestamp - Unix timestamp in seconds
 * @returns Formatted date string or empty string
 */
export function formatDueDate(timestamp: number | null | undefined): string {
    if (timestamp === null || timestamp === undefined) {
        return '';
    }
    return unixToDateString(timestamp);
}

/**
 * Get a date string for N days from now
 * Useful for --days filter
 * 
 * @param days - Number of days from today
 * @returns YYYY-MM-DD string
 */
export function getDaysFromNow(days: number): string {
    const date = new Date();
    date.setDate(date.getDate() + days);
    return formatDateUtil(date);
}

/**
 * Check if a task is overdue
 */
export function isOverdue(dueOn: number | null): boolean {
    if (dueOn === null) return false;
    const now = Math.floor(Date.now() / 1000);
    return dueOn < now;
}

/**
 * Get human-readable relative due date
 */
export function getRelativeDueDate(timestamp: number | null): string {
    if (timestamp === null) return 'No due date';

    const now = new Date();
    const due = new Date(timestamp * 1000);
    const diffDays = Math.ceil((due.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));

    if (diffDays < 0) {
        return `${Math.abs(diffDays)} days overdue`;
    } else if (diffDays === 0) {
        return 'Due today';
    } else if (diffDays === 1) {
        return 'Due tomorrow';
    } else if (diffDays <= 7) {
        return `Due in ${diffDays} days`;
    } else {
        return formatDueDate(timestamp);
    }
}

// ============================================================================
// Display Helpers
// ============================================================================

/**
 * Build a lookup map of task lists by ID
 */
export function buildTaskListMap(taskLists: ACTaskList[]): Map<number, string> {
    const map = new Map<number, string>();
    for (const list of taskLists) {
        map.set(list.id, list.name);
    }
    return map;
}

/**
 * Build a lookup map of users by ID
 */
export function buildUserMap(users: ACUser[]): Map<number, string> {
    const map = new Map<number, string>();
    for (const user of users) {
        map.set(user.id, user.display_name || `${user.first_name} ${user.last_name}`);
    }
    return map;
}

/**
 * Truncate text to a max length with ellipsis
 */
export function truncate(text: string, maxLength: number): string {
    if (text.length <= maxLength) return text;
    return text.slice(0, maxLength - 3) + '...';
}
