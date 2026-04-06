import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { apiClient } from '@/lib/apiClient';
import DashboardLayout from '@/components/layouts/DashboardLayout';
import { Loader2 } from 'lucide-react';
import { parentSidebarItems } from '@/config/parentSidebar';
import { format, startOfMonth, endOfMonth, subMonths } from 'date-fns';
import { BackButton } from '@/components/ui/back-button';
import AttendanceCalendar from '@/components/attendance/AttendanceCalendar';

interface AttendanceRecord {
  id: string;
  date: string;
  status: string;
  session: string | null;
  reason: string | null;
  class_id_snapshot?: string | null;
  classes?: { id?: string | null; name: string; section: string } | null;
}

interface ParentAttendanceResponse {
  student_id: string | null;
  childName: string;
  admissionNo: string;
  childClass: string;
  attendance: AttendanceRecord[];
}

export default function ParentAttendance() {
  const { user, userRole, loading } = useAuth();
  const navigate = useNavigate();
  const [attendance, setAttendance] = useState<AttendanceRecord[]>([]);
  const [childName, setChildName] = useState('');
  const [childClass, setChildClass] = useState('');
  const [admissionNo, setAdmissionNo] = useState('');
  const [loadingData, setLoadingData] = useState(true);

  useEffect(() => {
    if (!loading && (!user || userRole !== 'parent')) {
      navigate('/auth');
    }
  }, [user, userRole, loading, navigate]);

  useEffect(() => {
    async function fetchInitialAttendance() {
      if (!user) return;

      try {
        await fetchAttendance(new Date());
      } catch (error) {
        console.error('Error loading attendance:', error);
      } finally {
        setLoadingData(false);
      }
    }
    fetchInitialAttendance();
  }, [user]);

  const fetchAttendance = async (month: Date, isBackground = false) => {
    if (!isBackground) setLoadingData(true);
    try {
      const sixMonthsAgo = format(subMonths(startOfMonth(month), 5), 'yyyy-MM-dd');
      const monthEnd = format(endOfMonth(month), 'yyyy-MM-dd');
      const query = `?start_date=${encodeURIComponent(sixMonthsAgo)}&end_date=${encodeURIComponent(monthEnd)}`;
      const data = await apiClient.get<ParentAttendanceResponse>(`/parent/attendance-data${query}`);

      setChildName(data.childName || '');
      setAdmissionNo(data.admissionNo || '');
      setChildClass(data.childClass || '');
      setAttendance(data.attendance || []);
    } finally {
      if (!isBackground) setLoadingData(false);
    }
  };

  if (loading) {
    return <div className="min-h-screen flex items-center justify-center"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>;
  }

  const isLoadingContent = loadingData && attendance.length === 0;

  return (
    <DashboardLayout sidebarItems={parentSidebarItems} roleColor="parent">
      {isLoadingContent ? (
        <div className="flex items-center justify-center py-20"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>
      ) : (
      <div className="space-y-6 animate-fade-in">
        <BackButton to="/parent" />
        <div className="flex flex-col gap-1">
          <h1 className="font-display text-2xl font-bold">Attendance</h1>
          <p className="text-muted-foreground text-sm">{childName}'s attendance calendar — Click any day for details</p>
        </div>

        <AttendanceCalendar
          attendance={attendance}
          childName={childName}
          className={childClass}
          admissionNumber={admissionNo}
          onMonthChange={(month) => fetchAttendance(month)}
        />
      </div>
      )}
    </DashboardLayout>
  );
}
