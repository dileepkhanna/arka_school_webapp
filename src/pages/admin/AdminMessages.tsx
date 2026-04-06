import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import DashboardLayout from '@/components/layouts/DashboardLayout';
import { Loader2 } from 'lucide-react';
import { adminSidebarItems } from '@/config/adminSidebar';
import MessagingInterface from '@/components/messaging/MessagingInterface';

export default function AdminMessages() {
  const { user, userRole, loading } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (!loading && (!user || userRole !== 'admin')) {
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
    <DashboardLayout sidebarItems={adminSidebarItems} roleColor="admin">
      <div className="space-y-6 animate-fade-in">
        <div>
          <h1 className="font-display text-2xl font-bold">Messages</h1>
          <p className="text-muted-foreground">Communicate with parents and staff</p>
        </div>

        {user && (
          <MessagingInterface
            currentUserId={user.id}
            currentUserRole="admin"
          />
        )}
      </div>
    </DashboardLayout>
  );
}
