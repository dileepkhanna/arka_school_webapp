import { useState } from 'react';
import { MoreHorizontal, X } from 'lucide-react';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Holiday, HOLIDAY_TYPE_COLORS, computeDuration } from './types';

interface ListViewProps {
    holidays: Holiday[];
    searchQuery: string;
    isAdmin: boolean;
    onEdit: (h: Holiday) => void;
    onDelete: (h: Holiday) => void;
}

const MONTH_ABBR = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
    'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

function formatDateRange(startDate: string, endDate: string | null): string {
    const start = new Date(startDate + 'T00:00:00');
    const startStr = `${MONTH_ABBR[start.getMonth()]} ${String(start.getDate()).padStart(2, '0')}`;
    if (!endDate || endDate === startDate) {
        return `${startStr}, ${start.getFullYear()}`;
    }
    const end = new Date(endDate + 'T00:00:00');
    const endStr = `${MONTH_ABBR[end.getMonth()]} ${String(end.getDate()).padStart(2, '0')}`;
    return `${startStr} - ${endStr}, ${end.getFullYear()}`;
}

function capitalize(str: string): string {
    return str.charAt(0).toUpperCase() + str.slice(1);
}

function ImageLightbox({ src, name, onClose }: { src: string; name: string; onClose: () => void }) {
    return (
        <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4"
            onClick={onClose}
        >
            <button
                className="absolute top-4 right-4 text-white bg-black/50 rounded-full p-2 hover:bg-black/70 transition-colors"
                onClick={onClose}
                aria-label="Close image"
            >
                <X className="h-5 w-5" />
            </button>
            <img
                src={src}
                alt={name}
                className="max-w-full max-h-[90vh] object-contain rounded-lg shadow-2xl"
                onClick={(e) => e.stopPropagation()}
            />
        </div>
    );
}

export default function ListView({ holidays, searchQuery, isAdmin, onEdit, onDelete }: ListViewProps) {
    const [lightboxImage, setLightboxImage] = useState<{ src: string; name: string } | null>(null);

    const filtered = holidays
        .filter((h) => h.name.toLowerCase().includes(searchQuery.toLowerCase()))
        .sort((a, b) => a.start_date.localeCompare(b.start_date));

    return (
        <>
            <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
                <div className="overflow-y-auto max-h-[600px]">
                    {filtered.length === 0 ? (
                        <div className="flex items-center justify-center py-16 text-gray-400 text-sm">
                            No holidays found
                        </div>
                    ) : (
                        <ul className="divide-y divide-gray-100">
                            {filtered.map((holiday) => (
                                <HolidayRow
                                    key={holiday.id}
                                    holiday={holiday}
                                    isAdmin={isAdmin}
                                    onEdit={onEdit}
                                    onDelete={onDelete}
                                    onImageClick={holiday.image_url
                                        ? () => setLightboxImage({ src: holiday.image_url!, name: holiday.name })
                                        : undefined}
                                />
                            ))}
                        </ul>
                    )}
                </div>
            </div>
            {lightboxImage && (
                <ImageLightbox
                    src={lightboxImage.src}
                    name={lightboxImage.name}
                    onClose={() => setLightboxImage(null)}
                />
            )}
        </>
    );
}

interface HolidayRowProps {
    holiday: Holiday;
    isAdmin: boolean;
    onEdit: (h: Holiday) => void;
    onDelete: (h: Holiday) => void;
    onImageClick?: () => void;
}

function HolidayRow({ holiday, isAdmin, onEdit, onDelete, onImageClick }: HolidayRowProps) {
    const [open, setOpen] = useState(false);
    const color = HOLIDAY_TYPE_COLORS[holiday.type];
    const duration = computeDuration(holiday.start_date, holiday.end_date);
    const dateRange = formatDateRange(holiday.start_date, holiday.end_date);

    return (
        <li className="flex items-center gap-4 px-4 py-3 hover:bg-gray-50 transition-colors">
            <div className="w-1 self-stretch rounded-full flex-shrink-0" style={{ backgroundColor: color }} />

            {holiday.image_url ? (
                <img
                    src={holiday.image_url}
                    alt={holiday.name}
                    className="w-12 h-12 rounded-lg object-cover flex-shrink-0 border border-gray-100 cursor-pointer hover:opacity-80 transition-opacity"
                    onClick={onImageClick}
                    title="Click to view full image"
                />
            ) : (
                <div
                    className="w-12 h-12 rounded-lg flex-shrink-0 flex items-center justify-center text-white text-lg font-bold"
                    style={{ backgroundColor: color }}
                >
                    {holiday.name.charAt(0).toUpperCase()}
                </div>
            )}

            <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-semibold text-gray-900 text-sm truncate">{holiday.name}</span>
                    <span
                        className="inline-flex items-center px-2 py-0.5 rounded-full text-white text-[11px] font-medium flex-shrink-0"
                        style={{ backgroundColor: color }}
                    >
                        {capitalize(holiday.type)}
                    </span>
                </div>
                <div className="flex items-center gap-3 mt-0.5 text-xs text-gray-500">
                    <span>{dateRange}</span>
                    <span className="text-gray-300">·</span>
                    <span>{duration} {duration === 1 ? 'day' : 'days'}</span>
                </div>
            </div>

            {isAdmin && (
                <DropdownMenu open={open} onOpenChange={setOpen}>
                    <DropdownMenuTrigger asChild>
                        <button
                            className="flex-shrink-0 p-1.5 rounded hover:bg-gray-100 text-gray-400 hover:text-gray-600 transition-colors"
                            aria-label="Holiday actions"
                        >
                            <MoreHorizontal className="h-4 w-4" />
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
        </li>
    );
}