/**
 * Date utilities for ac-task CLI
 * 
 * Rule: All API dates are converted to YYYY-MM-DD strings immediately.
 * No Unix Timestamps in output.
 */

/**
 * Convert a Unix timestamp to YYYY-MM-DD string
 */
export function unixToDateString(timestamp: number): string {
    const date = new Date(timestamp * 1000);
    return formatDate(date);
}

/**
 * Format a Date object to YYYY-MM-DD string
 */
export function formatDate(date: Date): string {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
}

/**
 * Get today's date as YYYY-MM-DD string
 */
export function today(): string {
    return formatDate(new Date());
}

/**
 * Parse a YYYY-MM-DD string to Date object
 */
export function parseDate(dateString: string): Date {
    const [year, month, day] = dateString.split('-').map(Number);
    return new Date(year, month - 1, day);
}

/**
 * Add days to a date string and return new YYYY-MM-DD string
 */
export function addDays(dateString: string, days: number): string {
    const date = parseDate(dateString);
    date.setDate(date.getDate() + days);
    return formatDate(date);
}
