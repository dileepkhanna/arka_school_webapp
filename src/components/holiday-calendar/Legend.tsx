import { HOLIDAY_TYPE_COLORS, HolidayType } from './types';

const LEGEND_LABELS: { type: HolidayType; label: string }[] = [
    { type: 'national', label: 'National' },
    { type: 'religious', label: 'Religious' },
    { type: 'school', label: 'School' },
    { type: 'optional', label: 'Optional' },
];

export default function Legend() {
    return (
        <div className="flex flex-wrap items-center gap-4">
            {LEGEND_LABELS.map(({ type, label }) => (
                <div key={type} className="flex items-center gap-1.5">
                    <span
                        className="inline-block w-3 h-3 rounded-full flex-shrink-0"
                        style={{ backgroundColor: HOLIDAY_TYPE_COLORS[type] }}
                    />
                    <span className="text-sm text-gray-600">{label}</span>
                </div>
            ))}
        </div>
    );
}
