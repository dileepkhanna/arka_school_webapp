import { apiClient } from '@/lib/apiClient';
import type { AcademicCalendarClassOption, AcademicCalendarEntry, AcademicCalendarRole, AcademicCalendarUserOption } from './types';

export function fetchAcademicCalendar(year: number): Promise<AcademicCalendarEntry[]> {
  return apiClient.get<AcademicCalendarEntry[]>(`/academic-calendar?year=${year}`);
}

export function createAcademicCalendarEntry(payload: FormData): Promise<AcademicCalendarEntry> {
  return apiClient.postForm<AcademicCalendarEntry>('/academic-calendar', payload);
}

export function resolveRealId(id: number | string): number | string {
  if (typeof id === 'string' && id.startsWith('recurring_')) {
    const parts = id.split('_');
    return Number(parts[1]);
  }

  return id;
}

export function updateAcademicCalendarEntry(id: number | string, payload: FormData): Promise<AcademicCalendarEntry> {
  payload.set('_method', 'PUT');
  return apiClient.postForm<AcademicCalendarEntry>(`/academic-calendar/${resolveRealId(id)}`, payload);
}

export function deleteAcademicCalendarEntry(id: number | string): Promise<void> {
  return apiClient.delete<void>(`/academic-calendar/${resolveRealId(id)}`);
}

export function fetchAcademicCalendarClasses(): Promise<AcademicCalendarClassOption[]> {
  return apiClient.get<AcademicCalendarClassOption[]>('/classes');
}

export function fetchAcademicCalendarUsers(params: { role?: AcademicCalendarRole | 'all'; search?: string; limit?: number; ids?: number[] }): Promise<AcademicCalendarUserOption[]> {
  const query = new URLSearchParams();
  if (params.role && params.role !== 'all') query.set('role', params.role);
  if (params.search && params.search.trim()) query.set('search', params.search.trim());
  if (params.limit) query.set('limit', String(params.limit));
  if (params.ids?.length) {
    params.ids.forEach((id) => query.append('ids[]', String(id)));
  }
  const suffix = query.toString();
  return apiClient.get<AcademicCalendarUserOption[]>(`/academic-calendar/audience-users${suffix ? `?${suffix}` : ''}`);
}
