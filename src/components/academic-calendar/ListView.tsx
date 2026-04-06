import { useMemo, useState } from 'react';
import { Clock3, MapPin, MoreHorizontal, Repeat, X } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  ACADEMIC_CALENDAR_CATEGORY_COLORS,
  ACADEMIC_CALENDAR_CATEGORY_LABELS,
  ACADEMIC_CALENDAR_STATUS_LABELS,
  computeDuration,
  formatDateRange,
  formatTimeRange,
  type AcademicCalendarEntry,
} from './types';

interface ListViewProps {
  entries: AcademicCalendarEntry[];
  isAdmin: boolean;
  onEdit: (entry: AcademicCalendarEntry) => void;
  onDelete: (entry: AcademicCalendarEntry) => void;
}

function ImageLightbox({ src, name, onClose }: { src: string; name: string; onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4" onClick={onClose}>
      <button
        type="button"
        className="absolute right-4 top-4 rounded-full bg-black/50 p-2 text-white transition-colors hover:bg-black/70"
        onClick={onClose}
        aria-label="Close image"
      >
        <X className="h-5 w-5" />
      </button>
      <img src={src} alt={name} className="max-h-[90vh] max-w-full rounded-lg object-contain shadow-2xl" onClick={(event) => event.stopPropagation()} />
    </div>
  );
}

export default function ListView({ entries, isAdmin, onEdit, onDelete }: ListViewProps) {
  const [lightboxImage, setLightboxImage] = useState<{ src: string; name: string } | null>(null);
  const sortedEntries = useMemo(() => [...entries].sort((a, b) => a.start_date.localeCompare(b.start_date)), [entries]);

  return (
    <>
      <div className="overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-sm">
        <div className="max-h-[640px] overflow-y-auto">
          {sortedEntries.length === 0 ? (
            <div className="flex items-center justify-center py-16 text-sm text-slate-400">No calendar entries match the selected filters</div>
          ) : (
            <ul className="divide-y divide-slate-100">
              {sortedEntries.map((entry) => (
                <EntryRow
                  key={entry.id}
                  entry={entry}
                  isAdmin={isAdmin}
                  onEdit={onEdit}
                  onDelete={onDelete}
                  onImageClick={entry.image_url ? () => setLightboxImage({ src: entry.image_url!, name: entry.title }) : undefined}
                />
              ))}
            </ul>
          )}
        </div>
      </div>

      {lightboxImage ? <ImageLightbox src={lightboxImage.src} name={lightboxImage.name} onClose={() => setLightboxImage(null)} /> : null}
    </>
  );
}

interface EntryRowProps {
  entry: AcademicCalendarEntry;
  isAdmin: boolean;
  onEdit: (entry: AcademicCalendarEntry) => void;
  onDelete: (entry: AcademicCalendarEntry) => void;
  onImageClick?: () => void;
}

function EntryRow({ entry, isAdmin, onEdit, onDelete, onImageClick }: EntryRowProps) {
  const [open, setOpen] = useState(false);
  const color = ACADEMIC_CALENDAR_CATEGORY_COLORS[entry.category];
  const duration = computeDuration(entry.start_date, entry.end_date);
  const timeRange = formatTimeRange(entry.start_time, entry.end_time);

  return (
    <li className="flex gap-4 px-4 py-4 transition-colors hover:bg-slate-50/80">
      <div className="w-1 rounded-full" style={{ backgroundColor: color }} />

      {entry.image_url ? (
        <img
          src={entry.image_url}
          alt={entry.title}
          className="h-14 w-14 cursor-pointer rounded-xl border border-slate-200 object-cover transition-opacity hover:opacity-80"
          onClick={onImageClick}
        />
      ) : (
        <div className="flex h-14 w-14 items-center justify-center rounded-xl text-lg font-bold text-white" style={{ backgroundColor: color }}>
          {entry.title.charAt(0).toUpperCase()}
        </div>
      )}

      <div className="min-w-0 flex-1 space-y-2">
        <div className="flex flex-wrap items-center gap-2">
          <span className="truncate font-semibold text-slate-900">{entry.title}</span>
          <Badge className="border-0 text-white" style={{ backgroundColor: color }}>
            {ACADEMIC_CALENDAR_CATEGORY_LABELS[entry.category]}
          </Badge>
          <Badge variant="outline" className="border-slate-200 text-slate-600">
            {ACADEMIC_CALENDAR_STATUS_LABELS[entry.status]}
          </Badge>
          {entry.is_recurring ? (
            <Badge variant="outline" className="border-slate-200 text-slate-600">
              <Repeat className="mr-1 h-3 w-3" /> Recurring
            </Badge>
          ) : null}
        </div>

        <div className="flex flex-wrap items-center gap-3 text-xs text-slate-500">
          <span>{formatDateRange(entry.start_date, entry.end_date)}</span>
          <span>{duration} {duration === 1 ? 'day' : 'days'}</span>
          {timeRange ? (
            <span className="inline-flex items-center gap-1"><Clock3 className="h-3.5 w-3.5" />{timeRange}</span>
          ) : null}
          {entry.location ? (
            <span className="inline-flex items-center gap-1"><MapPin className="h-3.5 w-3.5" />{entry.location}</span>
          ) : null}
        </div>

        {entry.description ? <p className="text-sm leading-6 text-slate-600">{entry.description}</p> : null}
      </div>

      {isAdmin ? (
        <DropdownMenu open={open} onOpenChange={setOpen}>
          <DropdownMenuTrigger asChild>
            <button type="button" className="rounded-lg p-1.5 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-700" aria-label="Academic calendar row actions">
              <MoreHorizontal className="h-4 w-4" />
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
    </li>
  );
}
