export type AcademicCalendarCategory =
  | 'holiday'
  | 'event'
  | 'academic_activity'
  | 'meeting'
  | 'important_date';

export type AcademicCalendarAudienceType = 'all' | 'roles' | 'classes' | 'users';
export type AcademicCalendarStatus = 'draft' | 'published' | 'cancelled';
export type AcademicCalendarRole = 'admin' | 'teacher' | 'parent';

export interface AcademicCalendarClassOption {
  id: number;
  name: string;
  section?: string | null;
  academic_year?: string | null;
}

export interface AcademicCalendarUserOption {
  id: number;
  full_name: string;
  email: string | null;
  role: AcademicCalendarRole;
}

export interface AcademicCalendarEntry {
  id: number | string;
  entry_id?: number;
  title: string;
  category: AcademicCalendarCategory;
  subcategory: string | null;
  start_date: string;
  end_date: string | null;
  all_day: boolean;
  start_time: string | null;
  end_time: string | null;
  description: string | null;
  image_url: string | null;
  location: string | null;
  is_recurring: boolean;
  recurrence_rule: string | null;
  audience_type: AcademicCalendarAudienceType;
  audience_roles: AcademicCalendarRole[];
  audience_class_ids: number[];
  audience_user_ids: number[];
  notify_enabled: boolean;
  notify_offsets_days: number[];
  status: AcademicCalendarStatus;
  created_by?: number | null;
  updated_by?: number | null;
  created_at: string;
  updated_at?: string | null;
}

export const ACADEMIC_CALENDAR_CATEGORY_LABELS: Record<AcademicCalendarCategory, string> = {
  holiday: 'Holiday',
  event: 'Event',
  academic_activity: 'Academic Activity',
  meeting: 'Meeting',
  important_date: 'Important Date',
};

export const ACADEMIC_CALENDAR_CATEGORY_COLORS: Record<AcademicCalendarCategory, string> = {
  holiday: '#DC2626',
  event: '#2563EB',
  academic_activity: '#16A34A',
  meeting: '#D97706',
  important_date: '#475569',
};

export const ACADEMIC_CALENDAR_STATUS_LABELS: Record<AcademicCalendarStatus, string> = {
  draft: 'Draft',
  published: 'Published',
  cancelled: 'Cancelled',
};

export const ACADEMIC_CALENDAR_ROLE_LABELS: Record<AcademicCalendarRole, string> = {
  admin: 'Admins',
  teacher: 'Teachers',
  parent: 'Parents',
};

export const REMINDER_DAY_OPTIONS = [3, 2, 1] as const;

export function computeDuration(startDate: string, endDate: string | null): number {
  if (!endDate) return 1;
  const start = new Date(startDate);
  const end = new Date(endDate);
  const msPerDay = 1000 * 60 * 60 * 24;
  return Math.round((end.getTime() - start.getTime()) / msPerDay) + 1;
}

export function formatDateRange(startDate: string, endDate: string | null): string {
  const start = new Date(`${startDate}T00:00:00`);
  const startLabel = start.toLocaleDateString(undefined, {
    month: 'short',
    day: '2-digit',
    year: 'numeric',
  });

  if (!endDate || endDate === startDate) {
    return startLabel;
  }

  const end = new Date(`${endDate}T00:00:00`);
  const endLabel = end.toLocaleDateString(undefined, {
    month: 'short',
    day: '2-digit',
    year: 'numeric',
  });

  return `${startLabel} - ${endLabel}`;
}

export function formatTimeRange(startTime: string | null, endTime: string | null): string | null {
  if (!startTime) return null;

  const formatOne = (value: string) => {
    const [hours = '0', minutes = '0'] = value.split(':');
    const parsed = new Date();
    parsed.setHours(Number(hours), Number(minutes), 0, 0);
    return parsed.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });
  };

  const start = formatOne(startTime);
  if (!endTime) return start;
  return `${start} - ${formatOne(endTime)}`;
}

export function normalizeReminderOffsets(offsets: number[]): number[] {
  return [...new Set(offsets)].sort((a, b) => b - a);
}
