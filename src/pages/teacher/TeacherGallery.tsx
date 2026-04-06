import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import DashboardLayout from '@/components/layouts/DashboardLayout';
import { BackButton } from '@/components/ui/back-button';
import { Loader2 } from 'lucide-react';
import { useTeacherSidebar } from '@/hooks/useTeacherSidebar';
import GalleryView from '@/components/gallery/GalleryView';

export default function TeacherGallery() {
  const { user, userRole, loading } = useAuth();
  const navigate = useNavigate();
  const sidebarItems = useTeacherSidebar();

  useEffect(() => {
    if (!loading && (!user || userRole !== 'teacher')) navigate('/auth');
  }, [user, userRole, loading, navigate]);

  if (loading) return <div className="min-h-screen flex items-center justify-center"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>;

  return (
    <DashboardLayout sidebarItems={sidebarItems} roleColor="teacher">
      <div className="space-y-6 animate-fade-in">
        <BackButton to="/teacher" />
        <div>
          <h1 className="font-display text-2xl font-bold">Gallery</h1>
          <p className="text-muted-foreground text-sm">View school photo gallery</p>
        </div>
        <GalleryView />
      </div>
    </DashboardLayout>
  );
}
