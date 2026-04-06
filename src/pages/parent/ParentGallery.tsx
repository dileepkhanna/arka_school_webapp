import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import DashboardLayout from '@/components/layouts/DashboardLayout';
import { parentSidebarItems } from '@/config/parentSidebar';
import { BackButton } from '@/components/ui/back-button';
import { Loader2 } from 'lucide-react';
import GalleryView from '@/components/gallery/GalleryView';

export default function ParentGallery() {
  const { user, userRole, loading } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (!loading && (!user || userRole !== 'parent')) navigate('/auth');
  }, [user, userRole, loading, navigate]);

  if (loading) return (
    <DashboardLayout sidebarItems={parentSidebarItems} roleColor="parent">
      <div className="flex items-center justify-center py-20"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>
    </DashboardLayout>
  );

  return (
    <DashboardLayout sidebarItems={parentSidebarItems} roleColor="parent">
      <div className="space-y-6 animate-fade-in">
        <BackButton to="/parent" />
        <div>
          <h1 className="font-display text-2xl font-bold">Gallery</h1>
          <p className="text-muted-foreground text-sm">View school photo gallery</p>
        </div>
        <GalleryView />
      </div>
    </DashboardLayout>
  );
}
