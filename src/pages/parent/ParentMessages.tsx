import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import DashboardLayout from '@/components/layouts/DashboardLayout';
import { Loader2 } from 'lucide-react';
import { parentSidebarItems } from '@/config/parentSidebar';
import MessagingInterface from '@/components/messaging/MessagingInterface';

export default function ParentMessages() {
  const { user, userRole, loading } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (!loading && (!user || userRole !== 'parent')) {
      navigate('/auth');
    }
  }, [user, userRole, loading, navigate]);

  if (loading) {
    return (
      <DashboardLayout sidebarItems={parentSidebarItems} roleColor="parent">
        <div className="flex items-center justify-center py-20"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout sidebarItems={parentSidebarItems} roleColor="parent">
      <div className="space-y-6 animate-fade-in">
        <div>
          <h1 className="font-display text-2xl font-bold">Messages</h1>
          <p className="text-muted-foreground">Chat with your child's teachers</p>
        </div>

        {user && (
          <MessagingInterface
            currentUserId={user.id}
            currentUserRole="parent"
          />
        )}
      </div>
    </DashboardLayout>
  );
}
