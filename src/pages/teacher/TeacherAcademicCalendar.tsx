import { useEffect } from 'react';
import { Loader2 } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import AcademicCalendarContent from '@/components/academic-calendar/AcademicCalendarContent';
import DashboardLayout from '@/components/layouts/DashboardLayout';
import { useAuth } from '@/hooks/useAuth';
import { useTeacherSidebar } from '@/hooks/useTeacherSidebar';

export default function TeacherAcademicCalendar() {
  const { user, userRole, loading } = useAuth();
  const navigate = useNavigate();
  const sidebarItems = useTeacherSidebar();

  useEffect(() => {
    if (!loading && (!user || userRole !== 'teacher')) navigate('/auth');
  }, [user, userRole, loading, navigate]);

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <DashboardLayout sidebarItems={sidebarItems} roleColor="teacher">
      <AcademicCalendarContent />
    </DashboardLayout>
  );
}
