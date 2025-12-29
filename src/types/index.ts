/**
 * Type definitions for ac-task CLI
 */

// Re-export ActiveCollab types
export * from './activecollab';

// ============================================================================
// Configuration Types
// ============================================================================

/**
 * Global configuration stored in ~/.ac-task/config.json
 */
export interface GlobalConfig {
    base_url: string;
    /** Name of environment variable holding the token (for backward compatibility) */
    token_env_var?: string;
    /** API token stored directly in config (preferred method) */
    token?: string;
    cached_user_id: number;
    cached_user_name: string;
    /** If true, skip TLS certificate validation (for self-signed/expired certs) */
    force_unsafe_ssl?: boolean;
}

/**
 * Project-level configuration stored in .ac-task.json
 */
export interface ProjectConfig {
    project_id: number;
    defaults?: {
        lookahead_days?: number;
    };
}

/**
 * Merged configuration available at runtime
 */
export interface RuntimeConfig {
    global: GlobalConfig | null;
    project: ProjectConfig | null;
}

// ============================================================================
// API Types
// ============================================================================

/**
 * ActiveCollab User response from /user or /users/{id} endpoint
 * Fields vary between cloud and self-hosted versions
 */
export interface ACUser {
    id: number;
    class: string;
    display_name: string;
    email: string;
    // Cloud version uses is_active, self-hosted uses is_archived/is_trashed
    is_active?: boolean;
    is_archived?: boolean;
    is_trashed?: boolean;
    first_name?: string;
    last_name?: string;
}

/**
 * Generic API response wrapper
 */
export interface ACApiResponse<T> {
    single: T;
}

// ============================================================================
// Error Types
// ============================================================================

export type ErrorType =
    | 'CONFIGURATION_ERROR'
    | 'AUTH_ERROR'
    | 'API_ERROR'
    | 'NETWORK_ERROR'
    | 'VALIDATION_ERROR'
    | 'SAFETY_ERROR'
    | 'JOB_TYPE_ERROR'
    | 'UNKNOWN_ERROR';

/**
 * Semantic Error Envelope for JSON output
 */
export interface SemanticError {
    error: {
        type: ErrorType;
        code: number;
        message: string;
        details?: string;
    };
}

// ============================================================================
// CLI Types
// ============================================================================

export type OutputFormat = 'human' | 'json';

export interface CLIOptions {
    format?: OutputFormat;
}

/**
 * Result of auth:whoami command
 */
export interface WhoAmIResult {
    id: number;
    name: string;
    status: 'active' | 'inactive';
    base_url?: string;
}
