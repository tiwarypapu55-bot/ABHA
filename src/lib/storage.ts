
export function isLiveEnvironment(): boolean {
  if (typeof window === 'undefined') return false;
  const hostname = window.location.hostname;
  if (!hostname || hostname === 'localhost' || hostname === '127.0.0.1') return false;
  if (hostname.includes('ais-dev') || hostname.includes('ais-pre')) return false;
  return true;
}

function isSupabaseConfig(): boolean {
  try {
    const getCleanItem = (key: string): string | null => {
      if (typeof window === 'undefined') return null;
      const val = localStorage.getItem(key);
      if (!val || typeof val !== 'string') return null;
      const trimmed = val.trim();
      if (trimmed === '' || trimmed === 'null' || trimmed === 'undefined' || trimmed.includes('placeholder') || trimmed === 'placeholder-key') {
        return null;
      }
      return trimmed;
    };

    const cleanEnvVal = (val: any): string | null => {
      if (!val || typeof val !== 'string') return null;
      const trimmed = val.trim();
      if (trimmed === '' || trimmed === 'null' || trimmed === 'undefined' || trimmed.includes('placeholder') || trimmed === 'placeholder-key') {
        return null;
      }
      return trimmed;
    };

    const url = getCleanItem('hms_supabase_url') || cleanEnvVal(import.meta.env.VITE_SUPABASE_URL) || 'https://nlyfngpitxuqtczeqjaw.supabase.co';
    const key = getCleanItem('hms_supabase_anon_key') || cleanEnvVal(import.meta.env.VITE_SUPABASE_ANON_KEY) || 'sb_publishable_q0e5J5_yWRYl_KHS7U6HhA_zbTpGZdC';

    if (url && key && 
        url.startsWith('https://') && 
        url !== 'https://placeholder.supabase.co' && 
        !url.includes('placeholder')) {
      return true;
    }
  } catch (e) {}
  return false;
}

function isMockId(id: any): boolean {
  if (!id || typeof id !== 'string') return false;
  return /^(p|a|bill|i|rx|ot|op|ns|nt)\d+$/.test(id);
}

function sanitizeStorageValue(key: string, val: any): any {
  if (!val) return val;
  
  if (!(isLiveEnvironment() || isSupabaseConfig())) {
    return val;
  }
  
  // Clean beds association
  if (key === 'hms_beds' && Array.isArray(val)) {
    return val.map((bed: any) => ({
      ...bed,
      status: 'Available',
      patientId: undefined,
      patient_id: undefined
    }));
  }

  // Clean OT Room associations
  if (key === 'hms_ot_rooms' && Array.isArray(val)) {
    return val.map((room: any) => ({
      ...room,
      status: 'Available'
    }));
  }
  
  // Under live or configured Supabase, strip mock transaction/patient items
  if (Array.isArray(val)) {
    return val.filter((item: any) => {
      if (!item) return false;
      if (item.id && isMockId(item.id)) return false;
      if (item.cat_id && isMockId(item.cat_id)) return false;
      if (item.subcat_id && isMockId(item.subcat_id)) return false;
      if (item.unit_id && isMockId(item.unit_id)) return false;
      if (item.patientId && isMockId(item.patientId)) return false;
      if (item.patient_id && isMockId(item.patient_id)) return false;
      if (item.pat_id && isMockId(item.pat_id)) return false;
      return true;
    });
  }
  
  if (typeof val === 'object') {
    if (val.id && isMockId(val.id)) return null;
    if (val.patientId && isMockId(val.patientId)) return null;
    if (val.patient_id && isMockId(val.patient_id)) return null;
  }
  
  return val;
}

export const storage = {
  get: <T>(key: string, defaultValue: T): T => {
    try {
      const item = localStorage.getItem(key);
      const parsed = item ? JSON.parse(item) : defaultValue;
      return sanitizeStorageValue(key, parsed) as T;
    } catch (error) {
      console.error(`Error reading storage key "${key}":`, error);
      return sanitizeStorageValue(key, defaultValue) as T;
    }
  },
  set: <T>(key: string, value: T): void => {
    try {
      localStorage.setItem(key, JSON.stringify(value));
    } catch (error) {
      console.error(`Error writing storage key "${key}":`, error);
    }
  },
  remove: (key: string): void => {
    try {
      localStorage.removeItem(key);
    } catch (error) {
      console.error(`Error removing storage key "${key}":`, error);
    }
  },
  clear: (): void => {
    try {
      localStorage.clear();
    } catch (error) {
      console.error("Error clearing storage:", error);
    }
  }
};

export const STORAGE_KEYS = {
  PATIENTS: 'hms_patients',
  APPOINTMENTS: 'hms_appointments',
  BILLING: 'hms_billing',
  LAB_BILLS: 'hms_lab_bills',
  INVENTORY: 'hms_inventory',
  EXPENSES: 'hms_expenses',
  INSURANCE: 'hms_insurance',
  NURSING_TASKS: 'hms_nursing_tasks',
  BEDS: 'hms_beds',
  PHARMACY_BILLS: 'hms_pharmacy_billing',
  PRESCRIPTIONS: 'hms_prescriptions',
  TEMPLATE_IMAGE: 'hms_template_image',
  BED_RATES: 'hms_bed_rates',
  OT_RATES: 'hms_ot_rates',
  LAB_RATES: 'hms_lab_rates',
  MATERIAL_RATES: 'hms_material_rates',
  HOSPITAL_INFO: 'hms_hospital_info',
  USERS: 'hms_users',
  AUDIT_LOGS: 'hms_audit_logs',
  SESSION_USER: 'hms_session_user',
  AUTH_STATUS: 'hms_auth_status',
  LAB_TEST_ORDERS: 'hms_lab_test_orders',
  EXTERNAL_REPORTS: 'hms_external_reports',
  RADIOLOGY_FILES: 'hms_radiology_files',
  PATIENT_VITALS: 'hms_patient_vitals',
  TAX_SLABS: 'hms_tax_slabs',
};
