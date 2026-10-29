import { Session } from '@supabase/supabase-js';
import { createContext, ReactNode, useContext, useEffect, useState } from 'react';

import { supabase } from '@/lib/supabase';

type AuthContextValue = {
  /** False until the stored session has been read. */
  ready: boolean;
  session: Session | null;
  /** Login is only required when a Supabase project is configured. */
  required: boolean;
  sendCode: (email: string) => Promise<void>;
  verifyCode: (email: string, code: string) => Promise<void>;
  signOut: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

function requireClient() {
  if (!supabase) throw new Error('Supabase가 설정되지 않았습니다.');
  return supabase;
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [ready, setReady] = useState(!supabase);

  useEffect(() => {
    if (!supabase) return;
    supabase.auth
      .getSession()
      .then(({ data }) => setSession(data.session))
      .finally(() => setReady(true));
    const { data } = supabase.auth.onAuthStateChange((_event, next) => setSession(next));
    return () => data.subscription.unsubscribe();
  }, []);

  const sendCode = async (email: string) => {
    const { error } = await requireClient().auth.signInWithOtp({ email, options: { shouldCreateUser: true } });
    if (error) throw error;
  };

  const verifyCode = async (email: string, code: string) => {
    const { error } = await requireClient().auth.verifyOtp({ email, token: code, type: 'email' });
    if (error) throw error;
  };

  const signOut = async () => {
    await supabase?.auth.signOut();
  };

  return (
    <AuthContext.Provider value={{ ready, session, required: Boolean(supabase), sendCode, verifyCode, signOut }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider');
  return ctx;
}
