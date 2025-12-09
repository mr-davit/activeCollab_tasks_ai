/**
 * ActiveCollab API Data Structures
 * 
 * These types match the ActiveCollab API responses exactly.
 * Do not guess field names - use only what's documented.
 */

// ============================================================================
// Core Entities
// ============================================================================

export interface ACProject {
    id: number;
    name: string;
    body?: string;
    body_formatted?: string;
    url_path?: string;
    class: 'Project';
}

export interface ACUser {
    id: number;
    email: string;
    first_name: string;
    last_name: string;
    display_name: string;
    class: 'User' | 'Member' | 'Client' | 'Owner';
}

export interface ACTaskList {
    id: number;
    name: string;
    project_id: number;
    position?: number;
    open_tasks?: number;
    completed_tasks?: number;
    class: 'TaskList';
}

// ============================================================================
// Task Types
// ============================================================================

/**
 * Minimal Task Header for List Views (Efficient)
 * Used by `list` command to avoid fetching full HTML bodies
 * 
 * Note: is_completed comes as boolean from the API, but docs show 0/1
 */
export interface ACTaskHeader {
    id: number;
    task_number: number; // The visible ID (e.g. #34) used in UI
    name: string;
    is_completed: boolean | number; // false/0 = Open, true/1 = Completed (API returns boolean)
    assignee_id: number | null;
    due_on: number | null; // Unix Timestamp (seconds)
    task_list_id: number;
    project_id: number;
    class: 'Task';
}

/**
 * Full Task Detail for Show View
 * Extends header with body (HTML content)
 */
export interface ACTask extends ACTaskHeader {
    body: string; // Contains HTML
    body_formatted?: string;
    created_on?: number;
    created_by_id?: number;
    created_by_name?: string;
    updated_on?: number;
    start_on?: number | null;
    is_trashed?: boolean;
    labels?: number[];
}

/**
 * Subtask attached to a parent Task
 */
export interface ACSubtask {
    id: number;
    task_id: number; // Parent Task ID
    name: string; // Subtask title (API uses 'name' not 'body')
    body?: string; // Some API versions may use body
    is_completed: boolean | number; // false/0 = Open, true/1 = Completed (API returns boolean)
    assignee_id?: number | null;
    due_on?: number | null;
    created_on?: number;
    class: 'Subtask';
}

// ============================================================================
// API Response Wrappers
// ============================================================================

/**
 * Single Response Wrapper (GET /tasks/:id)
 * ActiveCollab often returns related subtasks in a side-loaded 'subtasks' array
 */
export interface ACSingleResponse<T> {
    single: T;
    subtasks?: ACSubtask[];
    task_list?: ACTaskList;
    project?: ACProject;
}

/**
 * Paginated list response metadata
 */
export interface ACPaginationInfo {
    current_page: number;
    total_pages: number;
    total_items: number;
    items_per_page: number;
}

// ============================================================================
// Filter Types (for list command)
// ============================================================================

export interface TaskFilterOptions {
    assigneeId?: number | null; // null = show all, number = filter by user
    isCompleted?: boolean | number; // false/0 = open, true/1 = completed, undefined = all
    taskListId?: number;
    dueBefore?: string; // YYYY-MM-DD
    dueAfter?: string; // YYYY-MM-DD
    search?: string;
}

// ============================================================================
// Write Payloads (for create/update operations)
// ============================================================================

/**
 * Payload for creating a new task
 * Note: body should be HTML formatted
 */
export interface CreateTaskPayload {
    name: string;
    body?: string; // HTML - use textToHtml() to convert plain text
    assignee_id?: number;
    task_list_id?: number;
    due_on?: string; // "YYYY-MM-DD"
    start_on?: string; // "YYYY-MM-DD"
}

/**
 * Payload for updating an existing task
 */
export interface UpdateTaskPayload extends Partial<CreateTaskPayload> {
    is_completed?: number; // 0 or 1
}

/**
 * Payload for creating a comment on a task
 */
export interface CreateCommentPayload {
    body: string; // HTML - use textToHtml() to convert plain text
}

/**
 * Payload for logging time on a task
 */
export interface CreateTimeRecordPayload {
    value: number; // Hours (decimal, e.g., 1.5 for 1h 30m)
    job_type_id?: number; // Optional, but may be required by strict projects
    summary?: string; // Description of work done
    record_date: string; // "YYYY-MM-DD"
    parent_type?: 'Task'; // For linking to a task
    parent_id?: number; // Task ID when using project-level endpoint
}
