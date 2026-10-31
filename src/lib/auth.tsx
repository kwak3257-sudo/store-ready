import { FunctionsHttpError, Session } from '@supabase/supabase-js';
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
  /** Deletes the account and all server data. The caller clears what is stored on the phone. */
  deleteAccount: () => Promise<void>;
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

  const deleteAccount = async () => {
    const client = requireClient();
    const { error } = await client.functions.invoke('delete-account', { method: 'POST' });
    if (error) {
      const body =
        error instanceof FunctionsHttpError
          ? ((await (error.context as Response).json().catch(() => null)) as { error?: string } | null)
          : null;
      throw new Error(body?.error ?? '계정을 지우지 못했습니다. 인터넷 연결을 확인하세요.');
    }
    // The account is gone on the server, so only the session on this phone is left to drop.
    await client.auth.signOut({ scope: 'local' });
  };

  return (
    <AuthContext.Provider value={{ ready, session, required: Boolean(supabase), sendCode, verifyCode, signOut, deleteAccount }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider');
  return ctx;
}
