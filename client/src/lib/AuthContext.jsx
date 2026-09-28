import { createContext, useContext, useEffect, useState } from 'react';
import { supabase } from './supabase.js';

const AuthContext = createContext(null);

function formatUser(u, session) {
  if (!u) return null;
  const displayName = u.user_metadata?.full_name || u.user_metadata?.name || u.email?.split('@')[0] || 'Citizen';
  const photoURL = u.user_metadata?.avatar_url || u.user_metadata?.picture || null;
  return {
    ...u,
    uid: u.id,
    id: u.id,
    displayName,
    photoURL,
    getIdToken: async () => session?.access_token ?? (await supabase.auth.getSession()).data.session?.access_token ?? null,
  };
}

export function AuthProvider({ children }) {
  const [user, setUser] = useState(undefined); // undefined = loading, null = logged out
  const [isAdmin, setIsAdmin] = useState(false);

  useEffect(() => {
    // Get the current session on mount
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      setUser(formatUser(session?.user ?? null, session));
      if (session?.user) {
        const { data } = await supabase
          .from('profiles')
          .select('is_admin')
          .eq('id', session.user.id)
          .maybeSingle();
        setIsAdmin(data?.is_admin === true);
      } else {
        setIsAdmin(false);
      }
    });

    // Listen for auth state changes (login, logout, token refresh)
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (_event, session) => {
      const formatted = formatUser(session?.user ?? null, session);
      setUser(formatted);

      // Upsert user profile and read back is_admin in a single query
      if (session?.user) {
        const { data: profile } = await supabase.from('profiles').upsert({
          id:           session.user.id,
          display_name: session.user.user_metadata?.full_name ?? session.user.email,
          photo_url:    session.user.user_metadata?.avatar_url ?? null,
          email:        session.user.email,
        }, { onConflict: 'id' }).select('is_admin').maybeSingle();

        setIsAdmin(profile?.is_admin === true);
      } else {
        setIsAdmin(false);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  // Triggers the Google OAuth popup via Supabase Auth
  const signInWithGoogle = () =>
    supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: window.location.origin },
    });

  const logout = () => {
    setIsAdmin(false);
    return supabase.auth.signOut();
  };

  // Helper: get the current session's access token for API calls
  const getToken = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    return session?.access_token ?? null;
  };

  return (
    <AuthContext.Provider value={{ user, isAdmin, signInWithGoogle, logout, getToken }}>
      {children}
    </AuthContext.Provider>
  );
}

// eslint-disable-next-line react-refresh/only-export-components
export function useAuth() {
  const ctx = useContext(AuthContext);
  if (ctx === null) throw new Error('useAuth must be used inside <AuthProvider>');
  return ctx;
}
