import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { apiClient } from '@/lib/apiClient';
import DashboardLayout from '@/components/layouts/DashboardLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Loader2, User, GraduationCap, Phone, MapPin, Calendar, Droplet, AlertCircle } from 'lucide-react';
import AttendanceSummary from '@/components/AttendanceSummary';
import { parentSidebarItems } from '@/config/parentSidebar';

interface ChildData {
  id: string;
  full_name: string;
  admission_number: string;
  photo_url: string | null;
  status: string | null;
  date_of_birth: string | null;
  blood_group: string | null;
  address: string | null;
  parent_name: string | null;
  parent_phone: string | null;
  emergency_contact: string | null;
  emergency_contact_name: string | null;
  classes: { name: string; section: string } | null;
}

interface ParentChildrenResponse {
  children: ChildData[];
}

export default function ParentChild() {
  const { user, userRole, loading } = useAuth();
  const navigate = useNavigate();
  const [children, setChildren] = useState<ChildData[]>([]);
  const [loadingData, setLoadingData] = useState(true);

  useEffect(() => {
    if (!loading && (!user || userRole !== 'parent')) {
      navigate('/auth');
    }
  }, [user, userRole, loading, navigate]);

  useEffect(() => {
    async function fetchChildren() {
      if (!user) return;
      setLoadingData(true);

      try {
        const data = await apiClient.get<ParentChildrenResponse>('/parent/children-data');
        setChildren(data.children || []);
      } catch (error) {
        console.error('Error loading parent children data:', error);
        setChildren([]);
      } finally {
        setLoadingData(false);
      }
    }
    fetchChildren();
  }, [user]);

  if (loading) {
    return <div className="min-h-screen flex items-center justify-center"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>;
  }

  const isLoadingContent = loadingData;

  return (
    <DashboardLayout sidebarItems={parentSidebarItems} roleColor="parent">
      {isLoadingContent ? (
        <div className="flex items-center justify-center py-20"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>
      ) : (
        <div className="space-y-6 animate-fade-in">
          <div>
            <h1 className="font-display text-2xl font-bold">My Child</h1>
            <p className="text-muted-foreground">View your child's complete profile</p>
          </div>

          {children.length === 0 ? (
            <Card className="card-elevated">
              <CardContent className="py-12 text-center">
                <User className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                <p className="text-muted-foreground">No children linked to your account.</p>
              </CardContent>
            </Card>
          ) : (
            children.map((child) => (
              <div key={child.id} className="space-y-4">
                <Card className="card-elevated">
                  <CardContent className="pt-6">
                    <div className="flex flex-col md:flex-row gap-6">
                      <div className="flex flex-col items-center">
                        <Avatar className="h-32 w-32 ring-4 ring-accent/20">
                          <AvatarImage src={child.photo_url || ''} />
                          <AvatarFallback className="gradient-parent text-white text-3xl">
                            {child.full_name.split(' ').map(n => n[0]).join('').slice(0, 2)}
                          </AvatarFallback>
                        </Avatar>
                        <Badge className="mt-3" variant={child.status === 'active' ? 'default' : 'secondary'}>
                          {child.status || 'Active'}
                        </Badge>
                      </div>

                      <div className="flex-1 grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="space-y-3">
                          <div>
                            <p className="text-xs text-muted-foreground">Full Name</p>
                            <p className="font-semibold">{child.full_name}</p>
                          </div>
                          <div>
                            <p className="text-xs text-muted-foreground">Admission Number</p>
                            <Badge variant="outline"><GraduationCap className="h-3 w-3 mr-1" />{child.admission_number}</Badge>
                          </div>
                          <div>
                            <p className="text-xs text-muted-foreground">Class</p>
                            <p className="font-medium">{child.classes ? (child.classes.section ? `${child.classes.name} - ${child.classes.section}` : child.classes.name) : 'Not assigned'}</p>
                          </div>
                          <div>
                            <p className="text-xs text-muted-foreground flex items-center gap-1"><Calendar className="h-3 w-3" />Date of Birth</p>
                            <p className="font-medium">{child.date_of_birth ? new Date(child.date_of_birth).toLocaleDateString() : '-'}</p>
                          </div>
                        </div>

                        <div className="space-y-3">
                          <div>
                            <p className="text-xs text-muted-foreground flex items-center gap-1"><Droplet className="h-3 w-3" />Blood Group</p>
                            <p className="font-medium">{child.blood_group || '-'}</p>
                          </div>
                          <div>
                            <p className="text-xs text-muted-foreground flex items-center gap-1"><MapPin className="h-3 w-3" />Address</p>
                            <p className="font-medium text-sm">{child.address || '-'}</p>
                          </div>
                          <div>
                            <p className="text-xs text-muted-foreground flex items-center gap-1"><Phone className="h-3 w-3" />Parent Contact</p>
                            <p className="font-medium">{child.parent_phone || '-'}</p>
                          </div>
                          <div>
                            <p className="text-xs text-muted-foreground flex items-center gap-1"><AlertCircle className="h-3 w-3" />Emergency Contact</p>
                            <p className="font-medium">{child.emergency_contact_name} - {child.emergency_contact || '-'}</p>
                          </div>
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                <AttendanceSummary studentId={child.id} />
              </div>
            ))
          )}
        </div>
      )}
    </DashboardLayout>
  );
}
