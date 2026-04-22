import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { Users, Shield, BookOpen, Loader2, GraduationCap } from 'lucide-react';

export default function Index() {
  const { user, userRole, loading } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (!loading && user && userRole) {
      navigate(`/${userRole}`);
    }
  }, [user, userRole, loading, navigate]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-muted/30">
      {/* Hero Section */}
      <div className="relative overflow-hidden">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-primary/5 via-transparent to-transparent" />
        
        <div className="container mx-auto px-4 py-16 lg:py-24 relative">
          <div className="max-w-3xl mx-auto text-center animate-fade-in">
             <div className="inline-flex items-center justify-center mb-8 h-24 w-24 rounded-2xl bg-primary/10">
              <GraduationCap className="h-12 w-12 text-primary" />
            </div>
            
            <h1 className="font-display text-4xl lg:text-5xl font-bold text-foreground mb-6">
              Welcome to <span className="text-gradient">SmartEduConnect</span>
            </h1>
            
            <p className="text-lg text-muted-foreground mb-8 max-w-2xl mx-auto">
              A comprehensive school management system designed to streamline administration, 
              enhance teaching, and keep parents connected with their child's education.
            </p>
            
            <Button 
              size="lg" 
              className="gradient-primary text-lg px-8 py-6 shadow-glow hover:shadow-xl transition-all"
              onClick={() => navigate('/auth')}
            >
              Get Started
            </Button>
          </div>

          {/* Feature Cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mt-16 max-w-4xl mx-auto">
            {[
              {
                icon: <Shield className="h-8 w-8" />,
                title: 'For Administrators',
                description: 'Complete control over teachers, students, classes, fees, and school operations.',
                gradient: 'gradient-admin',
              },
              {
                icon: <BookOpen className="h-8 w-8" />,
                title: 'For Teachers',
                description: 'Manage classes, attendance, homework, exams, and communicate with parents.',
                gradient: 'gradient-teacher',
              },
              {
                icon: <Users className="h-8 w-8" />,
                title: 'For Parents',
                description: 'Track your child\'s attendance, grades, homework, and stay updated with announcements.',
                gradient: 'gradient-parent',
              },
            ].map((feature, index) => (
              <div
                key={index}
                className="card-elevated p-6 text-center animate-slide-up"
                style={{ animationDelay: `${index * 0.1}s` }}
              >
                <div className={`w-16 h-16 rounded-2xl ${feature.gradient} flex items-center justify-center mx-auto mb-4 text-white shadow-md`}>
                  {feature.icon}
                </div>
                <h3 className="font-display text-lg font-semibold mb-2">{feature.title}</h3>
                <p className="text-sm text-muted-foreground">{feature.description}</p>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Footer */}
      <footer className="border-t py-8 mt-auto">
        <div className="container mx-auto px-4 text-center text-sm text-muted-foreground">
          <p className="mb-2">
            © 2026 SmartEduConnect. All rights reserved. Designed and Developed by{' '}
            <a 
              href="https://www.asetechnologies.in/" 
              target="_blank" 
              rel="noopener noreferrer"
              className="hover:text-primary transition-colors"
            >
              AseTechnologies
            </a>.
          </p>
          <p className="space-x-4">
            <button
              onClick={() => navigate('/terms-and-conditions')}
              className="hover:text-primary transition-colors"
            >
              Terms and Conditions
            </button>
            <span>•</span>
            <button
              onClick={() => navigate('/privacy-policy')}
              className="hover:text-primary transition-colors"
            >
              Privacy Policy
            </button>
          </p>
        </div>
      </footer>
    </div>
  );
}
