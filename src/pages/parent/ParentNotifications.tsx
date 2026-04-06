import DashboardLayout from '@/components/layouts/DashboardLayout';
import { parentSidebarItems } from '@/config/parentSidebar';
import NotificationsPage from '@/components/notifications/NotificationsPage';

export default function ParentNotifications() {
  return (
    <DashboardLayout sidebarItems={parentSidebarItems} roleColor="parent">
      <NotificationsPage />
    </DashboardLayout>
  );
}
