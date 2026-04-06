import { format } from 'date-fns';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

export interface TimetableEntry {
  id: string;
  day_of_week: string;
  period_number: number;
  start_time: string;
  end_time: string;
  subjects?: { name: string } | null;
  teacherName?: string;
  className?: string;
}

const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

export function downloadTimetableAsCSV(
  entries: TimetableEntry[],
  title: string,
  includeTeacher: boolean = false,
  includeClass: boolean = false
) {
  const groupedByDay = DAYS.reduce((acc, day) => {
    acc[day] = entries
      .filter((t) => t.day_of_week === day)
      .sort((a, b) => a.period_number - b.period_number);
    return acc;
  }, {} as Record<string, TimetableEntry[]>);

  let headers = ['Day', 'Period', 'Subject', 'Start Time', 'End Time'];
  if (includeTeacher) headers.push('Teacher');
  if (includeClass) headers.push('Class');

  let csvContent = headers.join(',') + '\n';

  DAYS.forEach((day) => {
    const dayEntries = groupedByDay[day];
    if (dayEntries.length === 0) {
      csvContent += `${day},No classes,,,\n`;
    } else {
      dayEntries.forEach((entry) => {
        const row = [
          day,
          entry.period_number.toString(),
          `"${entry.subjects?.name || 'Free Period'}"`,
          entry.start_time?.slice(0, 5) || '',
          entry.end_time?.slice(0, 5) || '',
        ];
        if (includeTeacher) row.push(`"${entry.teacherName || ''}"`);
        if (includeClass) row.push(`"${entry.className || ''}"`);
        csvContent += row.join(',') + '\n';
      });
    }
  });

  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const link = document.createElement('a');
  const url = URL.createObjectURL(blob);
  link.href = url;
  link.download = `${title.replace(/\s+/g, '_')}_Timetable.csv`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

export function downloadTimetableAsPDF(
  entries: TimetableEntry[],
  title: string,
  includeTeacher: boolean = false,
  includeClass: boolean = false
) {
  if (entries.length === 0) return false;

  const doc = new jsPDF();
  const head = [['Day', 'Period', 'Subject', 'Time', ...(includeTeacher ? ['Teacher'] : []), ...(includeClass ? ['Class'] : [])]];

  const body = DAYS.flatMap((day) => {
    const dayEntries = entries
      .filter((entry) => entry.day_of_week === day)
      .sort((a, b) => a.period_number - b.period_number);

    if (dayEntries.length === 0) {
      return [[day, '-', 'No classes scheduled', '-', ...(includeTeacher ? ['-'] : []), ...(includeClass ? ['-'] : [])]];
    }

    return dayEntries.map((entry) => [
      day,
      String(entry.period_number),
      entry.subjects?.name || 'Free Period',
      `${entry.start_time?.slice(0, 5) || ''} - ${entry.end_time?.slice(0, 5) || ''}`,
      ...(includeTeacher ? [entry.teacherName || '-'] : []),
      ...(includeClass ? [entry.className || '-'] : []),
    ]);
  });

  doc.setFontSize(16);
  doc.text(`${title} - Weekly Timetable`, 14, 18);
  doc.setFontSize(10);
  doc.text(`Generated: ${format(new Date(), 'PPP p')}`, 14, 26);

  autoTable(doc, {
    startY: 34,
    head,
    body,
    styles: { fontSize: 8, cellPadding: 2.5, valign: 'middle' },
    headStyles: { fillColor: [37, 99, 235] },
    alternateRowStyles: { fillColor: [248, 250, 252] },
    columnStyles: {
      0: { cellWidth: 24 },
      1: { cellWidth: 16, halign: 'center' },
      2: { cellWidth: 48 },
      3: { cellWidth: 34 },
    },
    didParseCell: (hookData) => {
      if (hookData.section === 'body' && hookData.column.index === 0) {
        hookData.cell.styles.fontStyle = 'bold';
      }
    },
  });

  doc.save(`${title.replace(/\s+/g, '_')}_Timetable_${format(new Date(), 'yyyy-MM-dd')}.pdf`);
  return true;
}
