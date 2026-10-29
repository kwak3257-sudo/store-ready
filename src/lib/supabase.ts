import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient, SupabaseClient } from '@supabase/supabase-js';

const url = process.env.EXPO_PUBLIC_SUPABASE_URL;
const publishableKey = process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

// Web pre-rendering runs this module in Node, where AsyncStorage has no window to use.
const isServerRender = typeof window === 'undefined';

/**
 * Null when the app runs without a Supabase project (local-only mode):
 * login and AI generation are then unavailable, everything else still works.
 */
export const supabase: SupabaseClient | null =
  url && publishableKey
    ? createClient(url, publishableKey, {
        auth: {
          storage: isServerRender ? undefined : AsyncStorage,
          autoRefreshToken: !isServerRender,
          persistSession: !isServerRender,
          detectSessionInUrl: false,
        },
      })
    : null;
