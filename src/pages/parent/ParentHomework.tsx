import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { apiClient } from '@/lib/apiClient';
import DashboardLayout from '@/components/layouts/DashboardLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Loader2, BookOpen, Calendar, FileText, ExternalLink } from 'lucide-react';
import { parentSidebarItems } from '@/config/parentSidebar';
import { Button } from '@/components/ui/button';
import { BackButton } from '@/components/ui/back-button';

interface Homework {
  id: string;
  title: string;
  description: string | null;
  due_date: string;
  attachment_url: string | null;
  subjects: { name: string } | null;
  created_at: string;
}

interface ParentHomeworkResponse {
  homework: Homework[];
}

export default function ParentHomework() {
  const { user, userRole, loading } = useAuth();
  const navigate = useNavigate();
  const [homework, setHomework] = useState<Homework[]>([]);
  const [loadingData, setLoadingData] = useState(true);

  useEffect(() => {
    if (!loading && (!user || userRole !== 'parent')) {
      navigate('/auth');
    }
  }, [user, userRole, loading, navigate]);

  useEffect(() => {
    async function fetchHomework() {
      if (!user) return;
      setLoadingData(true);

      try {
        const data = await apiClient.get<ParentHomeworkResponse>('/parent/homework-data');
        setHomework(data.homework || []);
      } catch (error) {
        console.error('Error loading parent homework:', error);
        setHomework([]);
      } finally {
        setLoadingData(false);
      }
    }
    fetchHomework();
  }, [user]);

  if (loading) {
    return <div className="min-h-screen flex items-center justify-center"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>;
  }

  const isLoadingContent = loadingData;

  const today = new Date().toISOString().split('T')[0];
  const pending = homework.filter(h => h.due_date >= today);
  const past = homework.filter(h => h.due_date < today);

  return (
    <DashboardLayout sidebarItems={parentSidebarItems} roleColor="parent">
      {isLoadingContent ? (
        <div className="flex items-center justify-center py-20"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>
      ) : (
      <div className="space-y-6 animate-fade-in">
        <BackButton to="/parent" />
        <div>
          <h1 className="font-display text-2xl font-bold">Homework</h1>
          <p className="text-muted-foreground">View assigned homework and due dates</p>
        </div>

        {homework.length === 0 ? (
          <Card className="card-elevated">
            <CardContent className="py-12 text-center">
              <BookOpen className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
              <p className="text-muted-foreground">No homework assigned yet.</p>
            </CardContent>
          </Card>
        ) : (
          <>
            {pending.length > 0 && (
              <Card className="card-elevated">
                <CardHeader>
                  <CardTitle className="font-display flex items-center gap-2">
                    <BookOpen className="h-5 w-5 text-primary" />
                    Pending Homework ({pending.length})
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    {pending.map((hw) => {
                      const dueDate = new Date(hw.due_date);
                      const isOverdue = hw.due_date < today;
                      const isToday = hw.due_date === today;
                      
                      return (
                        <div key={hw.id} className="p-4 rounded-xl border bg-card">
                          <div className="flex items-start justify-between gap-4">
                            <div className="flex-1">
                              <div className="flex items-center gap-2 mb-2">
                                <Badge variant="outline" className="capitalize">{hw.subjects?.name || 'General'}</Badge>
                                <Badge className={isToday ? 'bg-yellow-500' : isOverdue ? 'bg-red-500' : 'bg-primary'}>
                                  {isToday ? 'Due Today' : isOverdue ? 'Overdue' : 'Upcoming'}
                                </Badge>
                              </div>
                              <h3 className="font-semibold">{hw.title}</h3>
                              {hw.description && <p className="text-sm text-muted-foreground mt-1">{hw.description}</p>}
                              <div className="flex items-center gap-1 mt-2 text-sm text-muted-foreground">
                                <Calendar className="h-3 w-3" />
                                Due: {dueDate.toLocaleDateString()}
                              </div>
                            </div>
                            {hw.attachment_url && (
                              <Button variant="outline" size="sm" asChild>
                                <a href={hw.attachment_url} target="_blank" rel="noopener noreferrer">
                                  <ExternalLink className="h-4 w-4 mr-1" /> View
                                </a>
                              </Button>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </CardContent>
              </Card>
            )}

            {past.length > 0 && (
              <Card className="card-elevated">
                <CardHeader>
                  <CardTitle className="font-display flex items-center gap-2 text-muted-foreground">
                    <FileText className="h-5 w-5" />
                    Past Homework ({past.length})
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    {past.slice(0, 5).map((hw) => (
                      <div key={hw.id} className="p-3 rounded-lg bg-muted/50 flex items-center justify-between">
                        <div>
                          <p className="font-medium text-sm">{hw.title}</p>
                          <p className="text-xs text-muted-foreground capitalize">{hw.subjects?.name}</p>
                        </div>
                        <Badge variant="secondary">{new Date(hw.due_date).toLocaleDateString()}</Badge>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}
          </>
        )}
      </div>
      )}
    </DashboardLayout>
  );
}
