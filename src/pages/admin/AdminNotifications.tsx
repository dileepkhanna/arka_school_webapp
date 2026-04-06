import DashboardLayout from '@/components/layouts/DashboardLayout';
import { adminSidebarItems } from '@/config/adminSidebar';
import NotificationsPage from '@/components/notifications/NotificationsPage';

export default function AdminNotifications() {
  return (
    <DashboardLayout sidebarItems={adminSidebarItems} roleColor="admin">
      <NotificationsPage />
    </DashboardLayout>
  );
}
