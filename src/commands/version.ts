/**
 * Version command for ac-task CLI
 */

import { Command } from 'commander';
import * as fs from 'fs';
import * as path from 'path';

/**
 * Get the package version from package.json
 */
function getVersion(): string {
    try {
        // Try to read from the package.json relative to dist folder
        const packagePath = path.resolve(__dirname, '../../package.json');
        const packageJson = JSON.parse(fs.readFileSync(packagePath, 'utf-8'));
        return packageJson.version || '0.0.0';
    } catch {
        return '0.0.0';
    }
}

/**
 * Register the version command
 */
export function registerVersionCommand(program: Command): void {
    program.version(getVersion(), '-v, --version', 'Output the current version');
}

export { getVersion };
