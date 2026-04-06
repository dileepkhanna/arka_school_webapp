import { useEffect, useMemo, useState } from 'react';
import { CalendarDays, Filter, Plus, Search } from 'lucide-react';
import { Loader2 } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { deleteAcademicCalendarEntry, fetchAcademicCalendar } from './academicCalendarApi';
import AddEditAcademicCalendarModal from './AddEditAcademicCalendarModal';
import CalendarView from './CalendarView';
import Legend from './Legend';
import ListView from './ListView';
import {
  ACADEMIC_CALENDAR_CATEGORY_LABELS,
  ACADEMIC_CALENDAR_STATUS_LABELS,
  type AcademicCalendarCategory,
  type AcademicCalendarEntry,
  type AcademicCalendarStatus,
} from './types';

const CATEGORY_OPTIONS = Object.entries(ACADEMIC_CALENDAR_CATEGORY_LABELS) as [AcademicCalendarCategory, string][];
const STATUS_OPTIONS = Object.entries(ACADEMIC_CALENDAR_STATUS_LABELS) as [AcademicCalendarStatus, string][];

export default function AcademicCalendarContent() {
  const { userRole } = useAuth();
  const isAdmin = userRole === 'admin';
  const now = new Date();

  const [currentYear, setCurrentYear] = useState(now.getFullYear());
  const [currentMonth, setCurrentMonth] = useState(now.getMonth());
  const [entries, setEntries] = useState<AcademicCalendarEntry[]>([]);
  const [loadingEntries, setLoadingEntries] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<'all' | AcademicCalendarCategory>('all');
  const [selectedStatus, setSelectedStatus] = useState<'all' | AcademicCalendarStatus>('all');
  const [modalState, setModalState] = useState<{ open: boolean; entry: AcademicCalendarEntry | null }>({ open: false, entry: null });

  async function loadEntries(year: number) {
    setLoadingEntries(true);
    try {
      const data = await fetchAcademicCalendar(year);
      setEntries(data ?? []);
    } catch {
      setEntries([]);
    } finally {
      setLoadingEntries(false);
    }
  }

  useEffect(() => {
    loadEntries(currentYear);
  }, [currentYear]);

  const filteredEntries = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();

    return entries.filter((entry) => {
      if (selectedCategory !== 'all' && entry.category !== selectedCategory) return false;
      if (selectedStatus !== 'all' && entry.status !== selectedStatus) return false;
      if (!query) return true;

      return [entry.title, entry.description, entry.location, entry.subcategory]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(query));
    });
  }, [entries, searchQuery, selectedCategory, selectedStatus]);

  const quickStats = useMemo(() => ({
    total: filteredEntries.length,
    timed: filteredEntries.filter((entry) => !entry.all_day).length,
    recurring: filteredEntries.filter((entry) => entry.is_recurring).length,
  }), [filteredEntries]);

  function handlePrevMonth() {
    if (currentMonth === 0) {
      setCurrentMonth(11);
      setCurrentYear((value) => value - 1);
      return;
    }

    setCurrentMonth((value) => value - 1);
  }

  function handleNextMonth() {
    if (currentMonth === 11) {
      setCurrentMonth(0);
      setCurrentYear((value) => value + 1);
      return;
    }

    setCurrentMonth((value) => value + 1);
  }

  async function handleDelete(entry: AcademicCalendarEntry) {
    if (!window.confirm(`Delete "${entry.title}"? This action cannot be undone.`)) return;

    try {
      await deleteAcademicCalendarEntry(entry.id);
      await loadEntries(currentYear);
    } catch {
      // Error feedback is intentionally quiet here to match surrounding patterns.
    }
  }

  async function handleSaved(_saved: AcademicCalendarEntry) {
    setModalState({ open: false, entry: null });
    await loadEntries(currentYear);
  }

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="overflow-hidden rounded-3xl border border-slate-200/80 bg-[linear-gradient(135deg,#fffaf0_0%,#ffffff_45%,#eff6ff_100%)] p-6 shadow-sm">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div className="space-y-2">
            <div className="inline-flex items-center gap-2 rounded-full border border-slate-200/80 bg-white/80 px-3 py-1 text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">
              <CalendarDays className="h-4 w-4" /> Academic Calendar
            </div>
            <div>
              <h1 className="font-display text-2xl font-bold text-slate-900">School-wide dates, milestones, and reminders</h1>
              <p className="text-sm text-slate-600">Track holidays, events, academic activities, meetings, and important dates from a single calendar workspace.</p>
            </div>
          </div>

          {isAdmin ? (
            <Button onClick={() => setModalState({ open: true, entry: null })} className="gap-2 self-start lg:self-auto">
              <Plus className="h-4 w-4" /> Add Entry
            </Button>
          ) : null}
        </div>

        <div className="mt-5 flex flex-wrap gap-3">
          <Badge variant="outline" className="border-slate-200 bg-white/80 px-3 py-1 text-slate-600">{quickStats.total} visible entries</Badge>
          <Badge variant="outline" className="border-slate-200 bg-white/80 px-3 py-1 text-slate-600">{quickStats.timed} timed items</Badge>
          <Badge variant="outline" className="border-slate-200 bg-white/80 px-3 py-1 text-slate-600">{quickStats.recurring} recurring items</Badge>
        </div>
      </div>

      <div className="grid gap-3 rounded-2xl border border-slate-200/80 bg-white/90 p-4 shadow-sm lg:grid-cols-[1.6fr_1fr_1fr]">
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <Input className="pl-9" placeholder="Search titles, descriptions, locations..." value={searchQuery} onChange={(event) => setSearchQuery(event.target.value)} />
        </div>

        <Select value={selectedCategory} onValueChange={(value) => setSelectedCategory(value as 'all' | AcademicCalendarCategory)}>
          <SelectTrigger>
            <div className="flex items-center gap-2"><Filter className="h-4 w-4 text-slate-400" /><SelectValue placeholder="Filter by category" /></div>
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All categories</SelectItem>
            {CATEGORY_OPTIONS.map(([value, label]) => (
              <SelectItem key={value} value={value}>{label}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={selectedStatus} onValueChange={(value) => setSelectedStatus(value as 'all' | AcademicCalendarStatus)}>
          <SelectTrigger><SelectValue placeholder="Filter by status" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All statuses</SelectItem>
            {STATUS_OPTIONS.map(([value, label]) => (
              <SelectItem key={value} value={value}>{label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {loadingEntries ? (
        <div className="flex items-center justify-center py-20"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>
      ) : (
        <div className="grid grid-cols-1 items-start gap-6 xl:grid-cols-[1.15fr_0.95fr]">
          <div className="space-y-4">
            <CalendarView
              entries={filteredEntries}
              year={currentYear}
              month={currentMonth}
              onPrevMonth={handlePrevMonth}
              onNextMonth={handleNextMonth}
              onYearChange={setCurrentYear}
              isAdmin={isAdmin}
              onEdit={(entry) => setModalState({ open: true, entry })}
              onDelete={handleDelete}
            />
            <Legend />
          </div>

          <ListView
            entries={filteredEntries}
            isAdmin={isAdmin}
            onEdit={(entry) => setModalState({ open: true, entry })}
            onDelete={handleDelete}
          />
        </div>
      )}

      <AddEditAcademicCalendarModal
        open={modalState.open}
        entry={modalState.entry}
        onClose={() => setModalState({ open: false, entry: null })}
        onSaved={handleSaved}
      />
    </div>
  );
}
