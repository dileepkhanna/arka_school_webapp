import { apiClient } from '@/lib/apiClient';
import type { Holiday } from './types';

export function fetchHolidays(year: number): Promise<Holiday[]> {
    return apiClient.get<Holiday[]>(`/holidays?year=${year}`);
}

export function createHoliday(payload: FormData): Promise<Holiday> {
    return apiClient.postForm<Holiday>('/holidays', payload);
}

/**
 * Recurring holidays have a synthetic id like "recurring_5_2026".
 * Extract the real numeric DB id from it so API calls work correctly.
 */
export function resolveRealId(id: number | string): number | string {
    if (typeof id === 'string' && id.startsWith('recurring_')) {
        const parts = id.split('_'); // ["recurring", "5", "2026"]
        return parseInt(parts[1], 10);
    }
    return id;
}

export function updateHoliday(id: number | string, payload: FormData): Promise<Holiday> {
    payload.set('_method', 'PUT');
    return apiClient.postForm<Holiday>(`/holidays/${resolveRealId(id)}`, payload);
}

export function deleteHoliday(id: number | string): Promise<void> {
    return apiClient.delete<void>(`/holidays/${resolveRealId(id)}`);
}
