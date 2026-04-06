import { useState } from 'react';
import { ChevronLeft, ChevronRight, MoreHorizontal } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Holiday, HOLIDAY_TYPE_COLORS } from './types';

interface CalendarViewProps {
    holidays: Holiday[];
    year: number;
    month: number; // 0-indexed (0=Jan, 11=Dec)
    onPrevMonth: () => void;
    onNextMonth: () => void;
    onYearChange: (year: number) => void;
    isAdmin: boolean;
    onEdit: (h: Holiday) => void;
    onDelete: (h: Holiday) => void;
}

const MONTH_NAMES = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December',
];

const DAY_HEADERS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

function toDateString(date: Date): string {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const d = String(date.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
}

function getHolidaysForDay(holidays: Holiday[], cellDateStr: string): Holiday[] {
    return holidays.filter((h) => {
        if (h.end_date) {
            return h.start_date <= cellDateStr && cellDateStr <= h.end_date;
        }
        return h.start_date === cellDateStr;
    });
}

export default function CalendarView({
    holidays,
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
    const yearOptions = Array.from({ length: 11 }, (_, i) => currentYear - 5 + i);

    const firstDayOfMonth = new Date(year, month, 1).getDay(); // 0=Sun
    const daysInMonth = new Date(year, month + 1, 0).getDate();

    // Build grid cells: leading empty cells + day cells
    const totalCells = firstDayOfMonth + daysInMonth;
    const rows = Math.ceil(totalCells / 7);

    return (
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
            {/* Header: nav + month/year */}
            <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
                <Button variant="ghost" size="icon" onClick={onPrevMonth} aria-label="Previous month">
                    <ChevronLeft className="h-4 w-4" />
                </Button>

                <div className="flex items-center gap-2">
                    <span className="text-base font-semibold text-gray-800">{MONTH_NAMES[month]}</span>
                    <select
                        value={year}
                        onChange={(e) => onYearChange(Number(e.target.value))}
                        className="text-base font-semibold text-gray-800 bg-transparent border-none outline-none cursor-pointer"
                        aria-label="Select year"
                    >
                        {yearOptions.map((y) => (
                            <option key={y} value={y}>{y}</option>
                        ))}
                    </select>
                </div>

                <Button variant="ghost" size="icon" onClick={onNextMonth} aria-label="Next month">
                    <ChevronRight className="h-4 w-4" />
                </Button>
            </div>

            {/* Day-of-week headers */}
            <div className="grid grid-cols-7 border-b border-gray-100">
                {DAY_HEADERS.map((day) => (
                    <div key={day} className="py-2 text-center text-xs font-medium text-gray-500 uppercase tracking-wide">
                        {day}
                    </div>
                ))}
            </div>

            {/* Calendar grid */}
            <div className="grid grid-cols-7">
                {Array.from({ length: rows * 7 }, (_, i) => {
                    const dayNumber = i - firstDayOfMonth + 1;
                    const isCurrentMonth = dayNumber >= 1 && dayNumber <= daysInMonth;

                    if (!isCurrentMonth) {
                        return (
                            <div
                                key={i}
                                className="min-h-[80px] border-b border-r border-gray-50 bg-gray-50/40 last:border-r-0"
                            />
                        );
                    }

                    const cellDate = new Date(year, month, dayNumber);
                    const cellDateStr = toDateString(cellDate);
                    const dayHolidays = getHolidaysForDay(holidays, cellDateStr);
                    const isToday = cellDateStr === toDateString(new Date());

                    return (
                        <div
                            key={i}
                            className="min-h-[80px] border-b border-r border-gray-100 p-1 last:border-r-0"
                        >
                            <div className={`text-xs font-medium mb-1 w-6 h-6 flex items-center justify-center rounded-full ${isToday
                                    ? 'bg-blue-600 text-white'
                                    : 'text-gray-700'
                                }`}>
                                {dayNumber}
                            </div>
                            <div className="space-y-0.5">
                                {dayHolidays.map((h) => (
                                    <HolidayPill
                                        key={h.id}
                                        holiday={h}
                                        isAdmin={isAdmin}
                                        onEdit={onEdit}
                                        onDelete={onDelete}
                                    />
                                ))}
                            </div>
                        </div>
                    );
                })}
            </div>
        </div>
    );
}

interface HolidayPillProps {
    holiday: Holiday;
    isAdmin: boolean;
    onEdit: (h: Holiday) => void;
    onDelete: (h: Holiday) => void;
}

function HolidayPill({ holiday, isAdmin, onEdit, onDelete }: HolidayPillProps) {
    const [open, setOpen] = useState(false);
    const color = HOLIDAY_TYPE_COLORS[holiday.type];

    return (
        <div
            className="flex items-center gap-0.5 rounded px-1 py-0.5 text-white text-[10px] leading-tight group"
            style={{ backgroundColor: color }}
            title={holiday.name}
        >
            <span className="truncate flex-1 min-w-0">{holiday.name}</span>
            {isAdmin && (
                <DropdownMenu open={open} onOpenChange={setOpen}>
                    <DropdownMenuTrigger asChild>
                        <button
                            className="flex-shrink-0 opacity-0 group-hover:opacity-100 focus:opacity-100 rounded hover:bg-white/20 p-0.5 transition-opacity"
                            onClick={(e) => e.stopPropagation()}
                            aria-label="Holiday actions"
                        >
                            <MoreHorizontal className="h-3 w-3" />
                        </button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="min-w-[100px]">
                        <DropdownMenuItem onClick={() => { setOpen(false); onEdit(holiday); }}>
                            Edit
                        </DropdownMenuItem>
                        <DropdownMenuItem
                            className="text-red-600 focus:text-red-600"
                            onClick={() => { setOpen(false); onDelete(holiday); }}
                        >
                            Delete
                        </DropdownMenuItem>
                    </DropdownMenuContent>
                </DropdownMenu>
            )}
        </div>
    );
}
