import { useState } from 'react';
import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import DashboardLayout from '@/components/layouts/DashboardLayout';
import { adminSidebarItems } from '@/config/adminSidebar';
import { BackButton } from '@/components/ui/back-button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { RotateCcw, Calendar, Loader2 } from 'lucide-react';
import ExamCyclesTab from '@/components/exam-cycles/ExamCyclesTab';
import WeeklyExamsTab from '@/components/exam-cycles/WeeklyExamsTab';

export default function ExamCyclesManagement() {
  const { user, userRole, loading } = useAuth();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState('cycles');

  useEffect(() => {
    if (!loading && (!user || userRole !== 'admin')) navigate('/auth');
  }, [user, userRole, loading, navigate]);

  if (loading) {
    return <div className="min-h-screen flex items-center justify-center"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>;
  }

  return (
    <DashboardLayout sidebarItems={adminSidebarItems} roleColor="admin">
      <div className="space-y-6 animate-fade-in">
        <BackButton to="/admin" />
        <div>
          <h1 className="font-display text-2xl font-bold">Exam Cycles & Weekly Exams</h1>
          <p className="text-muted-foreground">Manage exam cycles and weekly exams</p>
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="cycles" className="flex items-center gap-1.5">
              <RotateCcw className="h-4 w-4" />Exam Cycles
            </TabsTrigger>
            <TabsTrigger value="weekly" className="flex items-center gap-1.5">
              <Calendar className="h-4 w-4" />Weekly Exams
            </TabsTrigger>
          </TabsList>

          <TabsContent value="cycles" className="mt-4">
            <ExamCyclesTab />
          </TabsContent>
          <TabsContent value="weekly" className="mt-4">
            <WeeklyExamsTab />
          </TabsContent>
        </Tabs>
      </div>
    </DashboardLayout>
  );
}
