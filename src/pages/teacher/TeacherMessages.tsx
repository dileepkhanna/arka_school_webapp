import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import DashboardLayout from '@/components/layouts/DashboardLayout';
import { Loader2 } from 'lucide-react';
import MessagingInterface from '@/components/messaging/MessagingInterface';
import { useTeacherSidebar } from '@/hooks/useTeacherSidebar';

export default function TeacherMessages() {
  const teacherSidebarItems = useTeacherSidebar();
  const { user, userRole, loading } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (!loading && (!user || userRole !== 'teacher')) {
      navigate('/auth');
    }
  }, [user, userRole, loading, navigate]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <DashboardLayout sidebarItems={teacherSidebarItems} roleColor="teacher">
      <div className="space-y-6 animate-fade-in">
        <div>
          <h1 className="font-display text-2xl font-bold">Messages</h1>
          <p className="text-muted-foreground">Communicate with parents and admin</p>
        </div>

        {user && (
          <MessagingInterface
            currentUserId={user.id}
            currentUserRole="teacher"
          />
        )}
      </div>
    </DashboardLayout>
  );
}
