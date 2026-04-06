import { useState, useEffect, createContext, useContext, ReactNode } from 'react';
import { apiClient, ApiUser, ApiError, getStoredToken, setStoredToken } from '@/lib/apiClient';

type UserRole = 'admin' | 'teacher' | 'parent' | null;

interface AuthContextType {
  user: ApiUser | null;
  session: { session: { access_token: string } } | null;
  userRole: UserRole;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<{ error: Error | null }>;
  signUp: (email: string, password: string, fullName: string) => Promise<{ error: Error | null }>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<ApiUser | null>(null);
  const [session, setSession] = useState<{ session: { access_token: string } } | null>(null);
  const [userRole, setUserRole] = useState<UserRole>(null);
  const [loading, setLoading] = useState(true);

  const hydrateUserFromApi = async () => {
    try {
      const response = await apiClient.get<{ user: ApiUser }>('/auth/me');
      setUser(response.user);
      setUserRole((response.user.role?.role ?? null) as UserRole);
    } catch (error) {
      // Only clear token on 401 (Unauthenticated) errors
      // For other errors (network issues, 500, etc.), keep the token
      if (error instanceof ApiError && error.status === 401) {
        setStoredToken(null);
        setUser(null);
        setUserRole(null);
      }
      // For other errors, just log and keep the user logged in
      console.warn('Failed to hydrate user, but keeping session:', error);
    }
  };

  useEffect(() => {
    const token = getStoredToken();

    if (!token) {
      setLoading(false);
      return;
    }

    setSession({ session: { access_token: token } });
    hydrateUserFromApi().finally(() => {
      setLoading(false);
    });
  }, []);

  const signIn = async (email: string, password: string) => {
    try {
      const response = await apiClient.post<{ token: string; user: ApiUser }>('/auth/login', { email, password });

      setStoredToken(response.token);
      setSession({ session: { access_token: response.token } });
      setUser(response.user);
      setUserRole((response.user.role?.role ?? null) as UserRole);

      return { error: null };
    } catch (error) {
      return { error: error as Error };
    }
  };

  const signUp = async (email: string, password: string, fullName: string) => {
    try {
      const response = await apiClient.post<{ token: string; user: ApiUser }>('/auth/register', {
        email,
        password,
        full_name: fullName,
      });

      setStoredToken(response.token);
      setSession({ session: { access_token: response.token } });
      setUser(response.user);
      setUserRole((response.user.role?.role ?? null) as UserRole);

      return { error: null };
    } catch (error) {
      return { error: error as Error };
    }
  };

  const signOut = async () => {
    try {
      await apiClient.post('/auth/logout');
    } finally {
      setStoredToken(null);
      setUser(null);
      setSession(null);
      setUserRole(null);
      setLoading(false);
    }
  };

  useEffect(() => {
    const onStorage = (event: StorageEvent) => {
      if (event.key === 'ase_api_token' && !event.newValue) {
        setUser(null);
        setSession(null);
        setUserRole(null);
        setLoading(false);
      }
    };

    window.addEventListener('storage', onStorage);

    return () => window.removeEventListener('storage', onStorage);
  }, []);

  return (
    <AuthContext.Provider value={{ user, session, userRole, loading, signIn, signUp, signOut }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
