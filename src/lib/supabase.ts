import { createClient } from '@supabase/supabase-js';

const getCleanStorageItem = (key: string): string | null => {
  if (typeof window === 'undefined') return null;
  const val = localStorage.getItem(key);
  if (!val || typeof val !== 'string') return null;
  const trimmed = val.trim();
  if (trimmed === '' || trimmed === 'null' || trimmed === 'undefined' || trimmed.includes('placeholder') || trimmed === 'placeholder-key') {
    return null;
  }
  return trimmed;
};

const cleanValue = (val: any): string | null => {
  if (!val || typeof val !== 'string') return null;
  const trimmed = val.trim();
  if (trimmed === '' || trimmed === 'null' || trimmed === 'undefined' || trimmed.includes('placeholder') || trimmed === 'placeholder-key') {
    return null;
  }
  return trimmed;
};

const rawSupabaseUrl = getCleanStorageItem('hms_supabase_url') || cleanValue(import.meta.env.VITE_SUPABASE_URL) || 'https://nlyfngpitxuqtczeqjaw.supabase.co';
const supabaseAnonKey = getCleanStorageItem('hms_supabase_anon_key') || cleanValue(import.meta.env.VITE_SUPABASE_ANON_KEY) || 'sb_publishable_q0e5J5_yWRYl_KHS7U6HhA_zbTpGZdC';

const isValidUrl = (url: any): boolean => {
  if (!url || typeof url !== 'string') return false;
  const trimmed = url.trim();
  return trimmed.startsWith('http://') || trimmed.startsWith('https://');
};

export const isSupabaseConfigured = !!(
  rawSupabaseUrl && 
  supabaseAnonKey && 
  isValidUrl(rawSupabaseUrl) &&
  rawSupabaseUrl !== 'https://placeholder.supabase.co' && 
  !rawSupabaseUrl.includes('placeholder')
);

if (!isSupabaseConfigured) {
  console.warn('Supabase credentials missing or invalid. Persistent database features will be disabled. Please set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY in your environment, or configure them in Settings > Database Setup.');
}

const supabaseUrl = isValidUrl(rawSupabaseUrl) ? rawSupabaseUrl.trim() : 'https://placeholder.supabase.co';
const supabaseKey = supabaseAnonKey && typeof supabaseAnonKey === 'string' && supabaseAnonKey.trim() !== '' ? supabaseAnonKey.trim() : 'placeholder-key';

export const supabase = createClient(
  supabaseUrl,
  supabaseKey
);

// Helper function to sanitize dates before inserting or updating in Postgres
export function sanitizeDates(obj: any): any {
  if (obj === null || obj === undefined) return obj;
  if (Array.isArray(obj)) {
    return obj.map(sanitizeDates);
  }
  if (typeof obj === 'object') {
    const cleaned: any = {};
    for (const [key, value] of Object.entries(obj)) {
      const keyLower = key.toLowerCase();
      const isDateKey = keyLower === 'dob' || 
                        keyLower === 'tpa_validity' || 
                        keyLower === 'expiry_date' || 
                        keyLower === 'claim_date' || 
                        keyLower === 'expense_date' || 
                        keyLower === 'surgery_date' || 
                        keyLower === 'scheduled_date' || 
                        keyLower === 'delivery_date' || 
                        keyLower === 'birth_date_time' ||
                        keyLower.includes('date') || 
                        keyLower.includes('time') || 
                        keyLower.endsWith('_at') ||
                        keyLower.endsWith('at') ||
                        keyLower === 'birth_date_time';
                        
      if (isDateKey) {
        if (value === null || value === undefined || 
            (typeof value === 'string' && (
              value.trim() === '' || 
              value.trim() === '""' || 
              value.trim() === "''" || 
              value.trim() === 'null' || 
              value.trim() === 'undefined' || 
              value.trim() === '"' || 
              value.trim() === "'" ||
              value.trim().replace(/^"|"$/g, '').trim() === '' ||
              value.trim().replace(/^'|'$/g, '').trim() === ''
            ))
        ) {
          cleaned[key] = null;
        } else if (typeof value === 'string') {
          // Strip any outer quotes that might be enclosing the date value
          const stripped = value.trim().replace(/^"|"$/g, '').replace(/^'|'$/g, '').trim();
          cleaned[key] = stripped === '' ? null : stripped;
        } else {
          cleaned[key] = value;
        }
      } else if (keyLower === 'age' && (value === '' || value === null || value === undefined)) {
        // Handle age as null when empty
        cleaned[key] = null;
      } else if (typeof value === 'object') {
        cleaned[key] = sanitizeDates(value);
      } else {
        cleaned[key] = value;
      }
    }
    return cleaned;
  }
  return obj;
}

// Decorator pattern on SupabaseClient.from to intercept and sanitize dates globally
const originalFrom = (supabase as any).from.bind(supabase);
(supabase as any).from = function (table: string) {
  const queryBuilder = originalFrom(table);
  const originalInsert = queryBuilder.insert.bind(queryBuilder);
  const originalUpdate = queryBuilder.update.bind(queryBuilder);

  queryBuilder.insert = function (values: any, options?: any) {
    return originalInsert(sanitizeDates(values), options);
  };

  queryBuilder.update = function (values: any, options?: any) {
    return originalUpdate(sanitizeDates(values), options);
  };

  return queryBuilder;
};

// Setup dynamic real-time synchronization between devices (mobile, desktop, multiple tabs)
const SYNC_CHANNEL_NAME = 'hospital-db-sync';

// Initialize a shared broadcast channel
export const syncChannel = supabase.channel(SYNC_CHANNEL_NAME);

// Function to notify other devices/tabs of a data mutation
export function broadcastDataMutation(table: string, action: 'insert' | 'update' | 'delete' | 'sync') {
  try {
    syncChannel.send({
      type: 'broadcast',
      event: 'data-changed',
      payload: { table, action, senderId: window.name || 'device-' + Math.random().toString(36).substring(2, 11), timestamp: Date.now() }
    });
    // Trigger a local storage/custom event so the originating device updates immediately too
    window.dispatchEvent(new CustomEvent('supabase-data-sync', { detail: { table, action, local: true } }));
  } catch (err) {
    console.warn('Failed to broadcast sync mutation:', err);
  }
}

// Subscribe to real-time client-to-client sync signals
syncChannel
  .on('broadcast', { event: 'data-changed' }, (payload) => {
    console.log('Realtime broadcast synchronization signal received:', payload);
    // Notify React components locally
    window.dispatchEvent(new CustomEvent('supabase-data-sync', { detail: payload }));
  })
  .subscribe((status) => {
    if (status === 'SUBSCRIBED') {
      console.log('Successfully subscribed to client-to-client real-time synchronization channel.');
    }
  });

// Also attempt to listen to real-time Postgres DB Changes directly from Supabase (server-authoritative backup)
supabase
  .channel('postgres-db-changes')
  .on('postgres_changes', { event: '*', schema: 'public' }, (payload) => {
    console.log('Realtime DB event received from Postgres:', payload);
    window.dispatchEvent(new CustomEvent('supabase-data-sync', { detail: payload }));
  })
  .subscribe((status) => {
    if (status === 'SUBSCRIBED') {
      console.log('Successfully subscribed to Postgres database real-time replication changes.');
    }
  });
