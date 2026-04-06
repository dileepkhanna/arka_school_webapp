import { useEffect } from 'react';
import { Loader2 } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import AcademicCalendarContent from '@/components/academic-calendar/AcademicCalendarContent';
import DashboardLayout from '@/components/layouts/DashboardLayout';
import { useAuth } from '@/hooks/useAuth';
import { adminSidebarItems } from '@/config/adminSidebar';

export default function AcademicCalendar() {
  const { user, userRole, loading } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (!loading && (!user || userRole !== 'admin')) navigate('/auth');
  }, [user, userRole, loading, navigate]);

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <DashboardLayout sidebarItems={adminSidebarItems} roleColor="admin">
      <AcademicCalendarContent />
    </DashboardLayout>
  );
}
