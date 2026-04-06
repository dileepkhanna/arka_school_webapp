export type HolidayType = 'national' | 'religious' | 'school' | 'optional';

export interface Holiday {
    id: number | string;
    name: string;
    type: HolidayType;
    start_date: string;
    end_date: string | null;
    description: string | null;
    image_url: string | null;
    is_recurring: boolean;
    created_at: string;
}

export const HOLIDAY_TYPE_COLORS: Record<HolidayType, string> = {
    national: '#EF4444',
    religious: '#8B5CF6',
    school: '#3B82F6',
    optional: '#F59E0B',
};

/**
 * Returns the inclusive day count for a holiday.
 * If end_date is null, returns 1.
 */
export function computeDuration(startDate: string, endDate: string | null): number {
    if (!endDate) return 1;
    const start = new Date(startDate);
    const end = new Date(endDate);
    const msPerDay = 1000 * 60 * 60 * 24;
    const diff = Math.round((end.getTime() - start.getTime()) / msPerDay);
    return diff + 1;
}
