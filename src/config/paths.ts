/**
 * Path resolution utilities for ac-task CLI
 */

import * as os from 'os';
import * as path from 'path';
import * as fs from 'fs';

/**
 * Get the global config directory path (~/.ac-task/)
 */
export function getGlobalConfigDir(): string {
    return path.join(os.homedir(), '.ac-task');
}

/**
 * Get the global config file path (~/.ac-task/config.json)
 */
export function getGlobalConfigPath(): string {
    return path.join(getGlobalConfigDir(), 'config.json');
}

/**
 * Project config filename
 */
export const PROJECT_CONFIG_FILENAME = '.ac-task.json';

/**
 * Search for a file by walking up the directory tree
 * Starting from startDir, look for filename in each parent directory
 * until found or root is reached.
 * 
 * @param filename - The filename to search for
 * @param startDir - Directory to start searching from (defaults to cwd)
 * @returns The full path to the file if found, null otherwise
 */
export function findFileUpwards(filename: string, startDir?: string): string | null {
    let currentDir = startDir || process.cwd();
    const root = path.parse(currentDir).root;

    while (true) {
        const filePath = path.join(currentDir, filename);

        if (fs.existsSync(filePath)) {
            return filePath;
        }

        // Reached filesystem root
        if (currentDir === root) {
            return null;
        }

        // Move up one directory
        currentDir = path.dirname(currentDir);
    }
}

/**
 * Find the project config file (.ac-task.json) by searching up from cwd
 */
export function findProjectConfig(): string | null {
    return findFileUpwards(PROJECT_CONFIG_FILENAME);
}

/**
 * Get the project root directory (where .ac-task.json is located)
 */
export function getProjectRoot(): string | null {
    const configPath = findProjectConfig();
    if (configPath) {
        return path.dirname(configPath);
    }
    return null;
}

/**
 * Ensure a directory exists, creating it if necessary
 */
export function ensureDir(dirPath: string): void {
    if (!fs.existsSync(dirPath)) {
        fs.mkdirSync(dirPath, { recursive: true });
    }
}
