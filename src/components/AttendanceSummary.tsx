import { useEffect, useState } from 'react';
import { apiClient } from '@/lib/apiClient';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Loader2, Check, X, Clock, TrendingUp } from 'lucide-react';
import { format } from 'date-fns';

interface AttendanceRecord {
  id: number;
  date: string;
  status: 'present' | 'absent' | 'late';
}

interface AttendanceSummaryProps {
  studentId: number;
}

export default function AttendanceSummary({ studentId }: AttendanceSummaryProps) {
  const [loading, setLoading] = useState(true);
  const [records, setRecords] = useState<AttendanceRecord[]>([]);
  const [stats, setStats] = useState({
    total: 0,
    present: 0,
    absent: 0,
    late: 0,
    percentage: 0,
  });

  useEffect(() => {
    async function fetchAttendance() {
      setLoading(true);
      try {
        const data = await apiClient.get<AttendanceRecord[]>(`/students/${studentId}/attendance-summary`);
        if (data) {
          setRecords(data as AttendanceRecord[]);
          
          const present = data.filter(r => r.status === 'present').length;
          const absent = data.filter(r => r.status === 'absent').length;
          const late = data.filter(r => r.status === 'late').length;
          const total = data.length;
          
          // Calculate attendance percentage (present + late counts as attended)
          const attended = present + late;
          const percentage = total > 0 ? Math.round((attended / total) * 100) : 0;
          
          setStats({ total, present, absent, late, percentage });
        }
      } catch (error) {
        console.error('Error fetching attendance:', error);
      } finally {
        setLoading(false);
      }
    }

    if (studentId) {
      fetchAttendance();
    }
  }, [studentId]);

  if (loading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-8">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'present':
        return <Check className="h-3 w-3" />;
      case 'absent':
        return <X className="h-3 w-3" />;
      case 'late':
        return <Clock className="h-3 w-3" />;
      default:
        return null;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'present':
        return 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400';
      case 'absent':
        return 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400';
      case 'late':
        return 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400';
      default:
        return '';
    }
  };

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
          <TrendingUp className="h-4 w-4" />
          Attendance Summary (Last 30 Days)
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Stats Overview */}
        <div className="grid grid-cols-4 gap-2">
          <div className="text-center p-2 rounded-lg bg-muted/50">
            <p className="text-lg font-bold text-primary">{stats.percentage}%</p>
            <p className="text-xs text-muted-foreground">Rate</p>
          </div>
          <div className="text-center p-2 rounded-lg bg-green-50 dark:bg-green-950/30">
            <p className="text-lg font-bold text-green-600">{stats.present}</p>
            <p className="text-xs text-green-600">Present</p>
          </div>
          <div className="text-center p-2 rounded-lg bg-red-50 dark:bg-red-950/30">
            <p className="text-lg font-bold text-red-600">{stats.absent}</p>
            <p className="text-xs text-red-600">Absent</p>
          </div>
          <div className="text-center p-2 rounded-lg bg-yellow-50 dark:bg-yellow-950/30">
            <p className="text-lg font-bold text-yellow-600">{stats.late}</p>
            <p className="text-xs text-yellow-600">Late</p>
          </div>
        </div>

        {/* Recent Records */}
        {records.length > 0 ? (
          <div className="space-y-2">
            <p className="text-xs font-medium text-muted-foreground">Recent Records</p>
            <div className="flex flex-wrap gap-1.5">
              {records.slice(0, 14).map((record) => (
                <div
                  key={record.id}
                  className={`flex items-center gap-1 px-2 py-1 rounded text-xs font-medium ${getStatusColor(record.status)}`}
                  title={`${format(new Date(record.date), 'MMM d, yyyy')} - ${record.status}`}
                >
                  {getStatusIcon(record.status)}
                  <span>{format(new Date(record.date), 'MMM d')}</span>
                </div>
              ))}
            </div>
          </div>
        ) : (
          <p className="text-sm text-muted-foreground text-center py-2">
            No attendance records found
          </p>
        )}
      </CardContent>
    </Card>
  );
}
