import { createClient } from '@supabase/supabase-js';
import { env } from '@/lib/config';

let client;

export function getAdminClient() {
  if (!client) {
    client = createClient(env.supabaseUrl, env.supabaseServiceRoleKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false
      }
    });
  }
  return client;
}
