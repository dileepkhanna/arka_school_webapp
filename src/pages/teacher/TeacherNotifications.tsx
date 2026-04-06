import DashboardLayout from '@/components/layouts/DashboardLayout';
import { getTeacherSidebarItems } from '@/config/teacherSidebar';
import { useTeacherSidebar } from '@/hooks/useTeacherSidebar';
import NotificationsPage from '@/components/notifications/NotificationsPage';

export default function TeacherNotifications() {
  const sidebarItems = useTeacherSidebar();
  return (
    <DashboardLayout sidebarItems={sidebarItems} roleColor="teacher">
      <NotificationsPage />
    </DashboardLayout>
  );
}
