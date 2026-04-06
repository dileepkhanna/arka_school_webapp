import {
  ACADEMIC_CALENDAR_CATEGORY_COLORS,
  ACADEMIC_CALENDAR_CATEGORY_LABELS,
  type AcademicCalendarCategory,
} from './types';

const CATEGORIES = Object.keys(ACADEMIC_CALENDAR_CATEGORY_LABELS) as AcademicCalendarCategory[];

export default function Legend() {
  return (
    <div className="flex flex-wrap items-center gap-4 rounded-xl border border-border/60 bg-white/80 px-4 py-3 shadow-sm">
      {CATEGORIES.map((category) => (
        <div key={category} className="flex items-center gap-2 text-sm text-slate-600">
          <span
            className="inline-block h-3 w-3 rounded-full"
            style={{ backgroundColor: ACADEMIC_CALENDAR_CATEGORY_COLORS[category] }}
          />
          <span>{ACADEMIC_CALENDAR_CATEGORY_LABELS[category]}</span>
        </div>
      ))}
    </div>
  );
}
