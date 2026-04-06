import { useMemo, useState } from 'react';
import { ChevronLeft, ChevronRight, MoreHorizontal } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  ACADEMIC_CALENDAR_CATEGORY_COLORS,
  ACADEMIC_CALENDAR_CATEGORY_LABELS,
  type AcademicCalendarEntry,
} from './types';

interface CalendarViewProps {
  entries: AcademicCalendarEntry[];
  year: number;
  month: number;
  onPrevMonth: () => void;
  onNextMonth: () => void;
  onYearChange: (year: number) => void;
  isAdmin: boolean;
  onEdit: (entry: AcademicCalendarEntry) => void;
  onDelete: (entry: AcademicCalendarEntry) => void;
}

const MONTH_NAMES = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const DAY_HEADERS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

function toDateString(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function getEntriesForDay(entries: AcademicCalendarEntry[], cellDateStr: string): AcademicCalendarEntry[] {
  return entries.filter((entry) => {
    if (entry.end_date) {
      return entry.start_date <= cellDateStr && cellDateStr <= entry.end_date;
    }

    return entry.start_date === cellDateStr;
  });
}

export default function CalendarView({
  entries,
  year,
  month,
  onPrevMonth,
  onNextMonth,
  onYearChange,
  isAdmin,
  onEdit,
  onDelete,
}: CalendarViewProps) {
  const currentYear = new Date().getFullYear();
  const yearOptions = useMemo(() => Array.from({ length: 11 }, (_, index) => currentYear - 5 + index), [currentYear]);
  const firstDayOfMonth = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const rows = Math.ceil((firstDayOfMonth + daysInMonth) / 7);

  return (
    <div className="overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-sm">
      <div className="flex items-center justify-between border-b border-slate-100 bg-slate-50/80 px-4 py-3">
        <Button variant="ghost" size="icon" onClick={onPrevMonth} aria-label="Previous month">
          <ChevronLeft className="h-4 w-4" />
        </Button>

        <div className="flex items-center gap-2 text-slate-800">
          <span className="font-display text-base font-semibold">{MONTH_NAMES[month]}</span>
          <select
            value={year}
            onChange={(event) => onYearChange(Number(event.target.value))}
            className="rounded-md border border-transparent bg-transparent px-2 py-1 text-sm font-semibold outline-none hover:border-slate-200"
            aria-label="Select year"
          >
            {yearOptions.map((option) => (
              <option key={option} value={option}>{option}</option>
            ))}
          </select>
        </div>

        <Button variant="ghost" size="icon" onClick={onNextMonth} aria-label="Next month">
          <ChevronRight className="h-4 w-4" />
        </Button>
      </div>

      <div className="grid grid-cols-7 border-b border-slate-100 bg-white">
        {DAY_HEADERS.map((day) => (
          <div key={day} className="py-2 text-center text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-400">
            {day}
          </div>
        ))}
      </div>

      <div className="grid grid-cols-7 bg-white">
        {Array.from({ length: rows * 7 }, (_, index) => {
          const dayNumber = index - firstDayOfMonth + 1;
          const isCurrentMonth = dayNumber >= 1 && dayNumber <= daysInMonth;

          if (!isCurrentMonth) {
            return <div key={index} className="min-h-[108px] border-b border-r border-slate-100 bg-slate-50/40 last:border-r-0" />;
          }

          const cellDate = new Date(year, month, dayNumber);
          const cellDateStr = toDateString(cellDate);
          const dayEntries = getEntriesForDay(entries, cellDateStr);
          const isToday = cellDateStr === toDateString(new Date());

          return (
            <div key={index} className="min-h-[108px] border-b border-r border-slate-100 p-1.5 last:border-r-0">
              <div className={`mb-2 flex h-7 w-7 items-center justify-center rounded-full text-xs font-semibold ${isToday ? 'bg-slate-900 text-white' : 'text-slate-700'}`}>
                {dayNumber}
              </div>
              <div className="space-y-1">
                {dayEntries.slice(0, 3).map((entry) => (
                  <EntryPill key={entry.id} entry={entry} isAdmin={isAdmin} onEdit={onEdit} onDelete={onDelete} />
                ))}
                {dayEntries.length > 3 ? (
                  <div className="px-1 text-[10px] font-medium text-slate-500">+{dayEntries.length - 3} more</div>
                ) : null}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

interface EntryPillProps {
  entry: AcademicCalendarEntry;
  isAdmin: boolean;
  onEdit: (entry: AcademicCalendarEntry) => void;
  onDelete: (entry: AcademicCalendarEntry) => void;
}

function EntryPill({ entry, isAdmin, onEdit, onDelete }: EntryPillProps) {
  const [open, setOpen] = useState(false);
  const color = ACADEMIC_CALENDAR_CATEGORY_COLORS[entry.category];

  return (
    <div className="group flex items-center gap-1 rounded-md px-1.5 py-1 text-[10px] leading-tight text-white" style={{ backgroundColor: color }} title={`${entry.title} (${ACADEMIC_CALENDAR_CATEGORY_LABELS[entry.category]})`}>
      <span className="min-w-0 flex-1 truncate">{entry.title}</span>
      {isAdmin ? (
        <DropdownMenu open={open} onOpenChange={setOpen}>
          <DropdownMenuTrigger asChild>
            <button
              type="button"
              className="rounded p-0.5 opacity-0 transition-opacity hover:bg-white/20 focus:opacity-100 group-hover:opacity-100"
              aria-label="Academic calendar actions"
            >
              <MoreHorizontal className="h-3 w-3" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="min-w-[120px]">
            <DropdownMenuItem onClick={() => { setOpen(false); onEdit(entry); }}>Edit</DropdownMenuItem>
            <DropdownMenuItem className="text-red-600 focus:text-red-600" onClick={() => { setOpen(false); onDelete(entry); }}>
              Delete
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      ) : null}
    </div>
  );
}
