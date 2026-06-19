import { supabase, broadcastDataMutation, isSupabaseConfigured } from '../lib/supabase';
import { toast } from 'sonner';
import { storage, STORAGE_KEYS } from '../lib/storage';
import { DEFAULT_PHARMACY_SETTINGS } from '../lib/pharmacyInvoicePrint';
import { 
  MOCK_PRESCRIPTIONS, 
  MOCK_NURSE_SHIFTS, 
  MOCK_THEATRES,
  MOCK_PATIENTS,
  MOCK_BEDS,
  MOCK_APPOINTMENTS,
  MOCK_BILLING,
  MOCK_INVENTORY,
  MOCK_OPERATION_RECORDS,
  MOCK_NURSING_TASKS,
  MOCK_PATIENT_VITALS,
  MOCK_LAB_TESTS,
  MOCK_USERS
} from '../mockData';

// --- UUID VALIDATION AND CLEANING HELPERS ---
function isUuid(val: any): boolean {
  if (typeof val !== 'string') return false;
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(val);
}

function cleanUuidFields(payload: any) {
  if (!payload || typeof payload !== 'object') return payload;
  const cleaned = { ...payload };
  const fields = [
    'doctor_id', 'nurse_id', 'issued_by', 'recorded_by', 'author_id',
    'surgeon_id', 'anesthetist_id', 'user_id', 'requested_by', 'performed_by',
    'head_id', 'incoming_nurse_id', 'outgoing_nurse_id', 'patient_id',
    'id', 'invoice_id', 'item_id', 'bed_id', 'admission_id', 'test_id', 'group_id', 'mother_id'
  ];
  for (const field of fields) {
    if (field in cleaned) {
      const val = cleaned[field];
      if (val !== undefined && val !== null && val !== '') {
        if (!isUuid(val)) {
          if (field === 'id') {
            delete cleaned.id;
          } else {
            cleaned[field] = null;
          }
        }
      }
    }
  }
  return cleaned;
}

// --- SCHEMA NORMALIZATION HELPERS ---
function cleanAppointmentForPostgres(apt: any) {
  if (!apt) return apt;
  const cleaned = { ...apt };
  
  // Encode 'type' inside 'urgency' if type is specified and not the standard OPD/General
  if (cleaned.type && cleaned.type !== 'OPD') {
    cleaned.urgency = `${cleaned.urgency || 'Routine'} [${cleaned.type}]`;
  }
  
  // list of actual columns in supabase_schema.sql
  const validColumns = [
    'id', 'patient_id', 'doctor_id', 'appointment_date', 'appointment_time',
    'token_number', 'urgency', 'status', 'fee', 'payment_status', 'created_at', 'updated_at'
  ];
  const result: any = {};
  for (const col of validColumns) {
    if (col in cleaned) {
      result[col] = cleaned[col];
    }
  }
  return cleanUuidFields(result);
}

function mapAppointmentFromPostgres(apt: any) {
  if (!apt) return apt;
  const mapped = { ...apt };
  let type = 'OPD';
  let urgency = apt.urgency || 'Routine';
  if (urgency.includes('[') && urgency.includes(']')) {
    const parts = urgency.split('[');
    urgency = parts[0].trim();
    type = parts[1].replace(']', '').trim();
  }
  mapped.type = type;
  mapped.urgency = urgency;

  if (!mapped.patients) {
    const patientsList = storage.get(STORAGE_KEYS.PATIENTS, MOCK_PATIENTS);
    const pid = mapped.patient_id || mapped.patientId;
    const p = patientsList.find((p_item: any) => p_item.id === pid || p_item.mrn === pid);
    if (p) {
      mapped.patients = { name: p.name, mrn: p.mrn, age: p.age, gender: p.gender };
    }
  }
  return mapped;
}

function cleanInvoiceForPostgres(inv: any) {
  if (!inv) return inv;
  const cleaned = { ...inv };
  
  // auto generate unique invoice number if missing
  if (!cleaned.invoice_number) {
    cleaned.invoice_number = `INV-POS-${Date.now()}-${Math.floor(1000 + Math.random() * 9000)}`;
  }
  
  // map legacy / fallback names to supabase schema names
  if ('status' in cleaned && !('payment_status' in cleaned)) {
    cleaned.payment_status = cleaned.status;
  }
  if ('created_by' in cleaned && !('issued_by' in cleaned)) {
    cleaned.issued_by = cleaned.created_by;
  }
  
  // calculate payable_amount if missing
  if (!('payable_amount' in cleaned)) {
    const total = Number(cleaned.total_amount) || 0;
    const discount = Number(cleaned.discount_amount) || 0;
    const tax = Number(cleaned.tax_amount) || 0;
    cleaned.payable_amount = (total - discount) + tax;
  }
  
  // list of actual columns in supabase_schema.sql
  const validColumns = [
    'id', 'patient_id', 'invoice_number', 'total_amount', 'discount_amount',
    'tax_amount', 'payable_amount', 'paid_amount', 'payment_status', 'payment_method',
    'tpa_approval_status', 'issued_by', 'created_at', 'updated_at'
  ];
  
  const result: any = {};
  for (const col of validColumns) {
    if (col in cleaned) {
      result[col] = cleaned[col];
    }
  }
  return cleanUuidFields(result);
}

function mapInvoiceFromPostgres(inv: any) {
  if (!inv) return inv;
  const mapped = {
    ...inv,
    status: inv.payment_status || 'Unpaid',
    created_by: inv.issued_by
  };

  if (!mapped.patients) {
    const patientsList = storage.get(STORAGE_KEYS.PATIENTS, MOCK_PATIENTS);
    const pid = mapped.patient_id || mapped.patientId;
    const p = patientsList.find((p_item: any) => p_item.id === pid || p_item.mrn === p_item.id || p_item.mrn === pid);
    if (p) {
      mapped.patients = { name: p.name, mrn: p.mrn, phone: p.phone, email: p.email };
    }
  }
  return mapped;
}

function cleanInvoiceItemForPostgres(item: any) {
  if (!item) return item;
  const cleaned = { ...item };
  
  // map legacy / fallback names to supabase schema names
  if ('item_name' in cleaned && !('description' in cleaned)) {
    cleaned.description = cleaned.item_name;
  }
  if ('item_type' in cleaned && !('category' in cleaned)) {
    cleaned.category = cleaned.item_type;
  }
  
  // list of actual columns in supabase_schema.sql
  const validColumns = [
    'id', 'invoice_id', 'description', 'quantity', 'unit_price', 'total_price',
    'tax_percentage', 'category', 'source_type', 'source_id'
  ];
  
  const result: any = {};
  for (const col of validColumns) {
    if (col in cleaned) {
      result[col] = cleaned[col];
    }
  }
  return cleanUuidFields(result);
}

function mapInvoiceItemFromPostgres(item: any) {
  if (!item) return item;
  return {
    ...item,
    item_name: item.description,
    item_type: item.category
  };
}

function cleanPharmacyItemForPostgres(item: any) {
  if (!item) return item;
  const cleaned = { ...item };

  if ('stock' in cleaned && !('stock_quantity' in cleaned)) {
    cleaned.stock_quantity = cleaned.stock;
  }
  if ('stock_quantity' in cleaned && !('stock' in cleaned)) {
    cleaned.stock = cleaned.stock_quantity;
  }

  if ('selling_price' in cleaned && !('sale_price' in cleaned)) {
    cleaned.sale_price = cleaned.selling_price;
  }
  if ('sale_price' in cleaned && !('selling_price' in cleaned)) {
    cleaned.selling_price = cleaned.sale_price;
  }

  if ('min_stock_level' in cleaned && !('reorder_level' in cleaned)) {
    cleaned.reorder_level = cleaned.min_stock_level;
  }
  if ('reorder_level' in cleaned && !('min_stock_level' in cleaned)) {
    cleaned.min_stock_level = cleaned.reorder_level;
  }

  return cleanUuidFields(cleaned);
}

function mapPharmacyItemFromPostgres(item: any) {
  if (!item) return item;
  
  // Try to enrich with locally saved loose sale properties if they exist
  let is_loose_sale_enabled = item.is_loose_sale_enabled;
  let units_per_strip = item.units_per_strip;
  let loose_selling_price = item.loose_selling_price;
  let loose_stock = item.loose_stock;
  
  try {
    const key = `loose_config_${item.id || item.name}`;
    const localConfigStr = localStorage.getItem(key);
    if (localConfigStr) {
      const localConfig = JSON.parse(localConfigStr);
      if (is_loose_sale_enabled === undefined && localConfig.is_loose_sale_enabled !== undefined) {
        is_loose_sale_enabled = localConfig.is_loose_sale_enabled;
      }
      if (units_per_strip === undefined && localConfig.units_per_strip !== undefined) {
        units_per_strip = localConfig.units_per_strip;
      }
      if (loose_selling_price === undefined && localConfig.loose_selling_price !== undefined) {
        loose_selling_price = localConfig.loose_selling_price;
      }
      if (loose_stock === undefined && localConfig.loose_stock !== undefined) {
        loose_stock = localConfig.loose_stock;
      }
    }
  } catch (e) {
    console.warn("Error restoring local loose sale config", e);
  }

  return {
    ...item,
    stock: item.stock !== undefined ? item.stock : (item.stock_quantity !== undefined ? item.stock_quantity : 0),
    stock_quantity: item.stock_quantity !== undefined ? item.stock_quantity : (item.stock !== undefined ? item.stock : 0),
    selling_price: item.selling_price !== undefined ? item.selling_price : (item.sale_price !== undefined ? item.sale_price : 0),
    sale_price: item.sale_price !== undefined ? item.sale_price : (item.selling_price !== undefined ? item.selling_price : 0),
    min_stock_level: item.min_stock_level !== undefined ? item.min_stock_level : (item.reorder_level !== undefined ? item.reorder_level : 10),
    reorder_level: item.reorder_level !== undefined ? item.reorder_level : (item.min_stock_level !== undefined ? item.min_stock_level : 10),
    is_loose_sale_enabled: is_loose_sale_enabled !== undefined ? is_loose_sale_enabled : false,
    units_per_strip: units_per_strip !== undefined ? units_per_strip : 10,
    loose_selling_price: loose_selling_price !== undefined ? loose_selling_price : 0,
    loose_stock: loose_stock !== undefined ? loose_stock : 0
  };
}

function mapOTScheduleFromPostgres(row: any) {
  if (!row) return row;
  const patientId = row.patientId || row.patient_id;
  const theatreId = row.theatreId || row.room_id || row.ot_rooms_id;
  const surgeonId = row.surgeonId || row.surgeon_id;
  const operationName = row.operationName || row.operation_name || row.procedure_name || '';
  const date = row.date || row.scheduled_date || row.surgery_date;
  const startTime = row.startTime || row.start_time || row.scheduled_time || row.surgery_time;
  
  return {
    ...row,
    patientId,
    patient_id: patientId,
    theatreId,
    room_id: theatreId,
    ot_rooms_id: theatreId,
    theatre_id: theatreId,
    surgeonId,
    surgeon_id: surgeonId,
    operationName,
    operation_name: operationName,
    procedure_name: operationName,
    date,
    scheduled_date: date,
    surgery_date: date,
    startTime,
    start_time: startTime,
    scheduled_time: startTime,
    surgery_time: startTime,
    status: row.status || 'Scheduled',
    notes: row.notes || '',
    documents: row.documents || []
  };
}

function cleanOTScheduleForPostgres(sch: any) {
  if (!sch) return sch;
  const dateVal = sch.date || sch.scheduled_date || sch.surgery_date || null;
  const timeVal = sch.time || sch.startTime || sch.scheduled_time || sch.surgery_time || null;
  const theatreVal = sch.theatreId || sch.room_id || sch.ot_rooms_id || null;
  const nameVal = sch.operationName || sch.operation_name || sch.procedure_name || null;
  return cleanUuidFields({
    patient_id: sch.patientId || sch.patient_id,
    room_id: theatreVal,
    ot_rooms_id: theatreVal,
    surgeon_id: sch.surgeonId || sch.surgeon_id || null,
    operation_name: nameVal,
    procedure_name: nameVal,
    scheduled_date: dateVal,
    surgery_date: dateVal,
    scheduled_time: timeVal,
    surgery_time: timeVal,
    status: sch.status || 'Scheduled',
    notes: sch.notes || null
  });
}

function cleanVitalsForPostgres(vitals: any) {
  if (!vitals) return vitals;
  const cleaned = { ...vitals };
  
  if ('patientId' in cleaned && !('patient_id' in cleaned)) {
    cleaned.patient_id = cleaned.patientId;
  }
  
  if ('bp' in cleaned && !('blood_pressure' in cleaned)) {
    cleaned.blood_pressure = cleaned.bp;
  }
  if ('blood_pressure' in cleaned && !('bp' in cleaned)) {
    cleaned.bp = cleaned.blood_pressure;
  }
  
  let tempVal = cleaned.temp !== undefined ? cleaned.temp : cleaned.temperature;
  if (tempVal !== undefined && tempVal !== '') {
    if (typeof tempVal === 'string') {
      const numericMatch = tempVal.match(/[\d.]+/);
      if (numericMatch) {
        tempVal = parseFloat(numericMatch[0]);
      } else {
        tempVal = parseFloat(tempVal) || null;
      }
    }
    cleaned.temperature = tempVal;
    cleaned.temp = tempVal;
  }

  if ('pulse' in cleaned && cleaned.pulse !== '' && cleaned.pulse !== null && cleaned.pulse !== undefined) {
    cleaned.pulse = parseInt(cleaned.pulse, 10);
  }

  let rrVal = cleaned.respiration !== undefined ? cleaned.respiration : cleaned.rr;
  if (rrVal !== undefined && rrVal !== '' && rrVal !== null) {
    rrVal = parseInt(rrVal, 10);
    cleaned.respiration = rrVal;
    cleaned.rr = rrVal;
  }

  if ('spo2' in cleaned && cleaned.spo2 !== '' && cleaned.spo2 !== null && cleaned.spo2 !== undefined) {
    cleaned.spo2 = parseInt(cleaned.spo2, 10);
  }
  if ('weight' in cleaned && cleaned.weight !== '' && cleaned.weight !== null && cleaned.weight !== undefined) {
    cleaned.weight = parseFloat(cleaned.weight);
  }

  if ('timestamp' in cleaned && !('recorded_at' in cleaned)) {
    cleaned.recorded_at = cleaned.timestamp;
  }
  if ('lastUpdated' in cleaned && !('recorded_at' in cleaned)) {
    cleaned.recorded_at = cleaned.lastUpdated;
  }

  const validColumns = [
    'id', 'patient_id', 'recorded_by', 'temperature', 'temp', 'blood_pressure', 'bp',
    'pulse', 'respiration', 'rr', 'spo2', 'weight', 'recorded_at', 'updated_at'
  ];

  const result: any = {};
  for (const col of validColumns) {
    if (col in cleaned && cleaned[col] !== undefined) {
      result[col] = cleaned[col];
    }
  }
  return cleanUuidFields(result);
}

function mapVitalsFromPostgres(vitals: any) {
  if (!vitals) return vitals;
  let tempString = '';
  const tempVal = vitals.temperature !== null && vitals.temperature !== undefined 
    ? vitals.temperature 
    : vitals.temp;
  if (tempVal !== null && tempVal !== undefined) {
    tempString = String(tempVal);
  }
  
  const mapped = {
    ...vitals,
    patientId: vitals.patient_id,
    bp: vitals.blood_pressure || vitals.bp || '',
    pulse: vitals.pulse || 0,
    temp: tempString,
    spo2: vitals.spo2 || 0,
    rr: vitals.respiration !== null && vitals.respiration !== undefined ? vitals.respiration : (vitals.rr || 0),
    respiration: vitals.respiration !== null && vitals.respiration !== undefined ? vitals.respiration : (vitals.rr || 0),
    lastUpdated: vitals.recorded_at,
    timestamp: vitals.recorded_at
  };
  return mapped;
}

async function selfHealingQuery(action: 'insert' | 'update', table: string, payload: any, id?: string) {
  let attempt = 0;
  const maxAttempts = 10;
  let currentPayload = Array.isArray(payload) ? { ...payload[0] } : { ...payload };

  while (attempt < maxAttempts) {
    try {
      if (action === 'insert') {
        const { data, error } = await supabase
          .from(table)
          .insert([currentPayload])
          .select();
        
        if (error) throw error;
        return data;
      } else {
        const { data, error } = await supabase
          .from(table)
          .update(currentPayload)
          .eq('id', id!)
          .select();
        
        if (error) throw error;
        return data;
      }
    } catch (error: any) {
      console.warn(`Self-healing query attempt ${attempt + 1} failed for ${table}:`, error.message);
      
      const errMsg = error.message || '';
      const match = errMsg.match(/Could not find the '([^']+)'/) ||
                    errMsg.match(/column '([^']+)'/) ||
                    errMsg.match(/column "([^"]+)"/);
      
      if (match && match[1]) {
        const missingKey = match[1];
        console.log(`Detected missing database column '${missingKey}' inside ${table} table. Stripping it and retrying query...`);
        delete currentPayload[missingKey];
        attempt++;
      } else {
        throw error;
      }
    }
  }
  throw new Error(`Self-healing query exceeded max retries of ${maxAttempts} for ${table} table.`);
}

export function normalizePatient(p: any) {
  if (!p) return p;
  const isNeedsAdmission = p.needs_admission === true || p.needsAdmission === true || p.status?.toLowerCase() === 'admitting';
  const regType = p.registration_type || p.registrationType || 'OPD';
  return {
    ...p,
    needsAdmission: isNeedsAdmission,
    needs_admission: isNeedsAdmission,
    registrationType: regType,
    registration_type: regType
  };
}

export function normalizeBed(b: any) {
  if (!b) return b;
  const num = b.bed_number || b.number || b.id || '';
  const bType = b.bed_type || b.type || 'General';
  const pId = b.patient_id || b.patientId || null;
  
  // Normalize status to 'Available', 'Occupied' etc.
  let bStatus = b.status || 'Available';
  if (bStatus.toLowerCase() === 'available') bStatus = 'Available';
  else if (bStatus.toLowerCase() === 'occupied') bStatus = 'Occupied';
  else {
    // Capitalize first letter
    bStatus = bStatus.charAt(0).toUpperCase() + bStatus.slice(1).toLowerCase();
  }

  return {
    ...b,
    bed_number: num,
    number: num,
    bed_type: bType,
    type: bType,
    patient_id: pId,
    patientId: pId,
    status: bStatus
  };
}

export function normalizeDischargeSummary(d: any) {
  if (!d) return d;
  return {
    ...d,
    id: d.id,
    admissionId: d.admission_id || d.admissionId,
    admission_id: d.admission_id || d.admissionId,
    patientId: d.patient_id || d.patientId,
    patient_id: d.patient_id || d.patientId,
    dischargeType: d.discharge_type || d.dischargeType || 'Routine / Improved',
    discharge_type: d.discharge_type || d.dischargeType || 'Routine / Improved',
    followUpDate: d.follow_up_date || d.followUpDate || '',
    follow_up_date: d.follow_up_date || d.followUpDate || '',
    medications: d.medications || '',
    clinicalSummary: d.clinical_summary || d.clinicalSummary || '',
    dischargeDate: d.discharge_date || d.dischargeDate || new Date().toISOString(),
    discharge_date: d.discharge_date || d.dischargeDate || new Date().toISOString(),
    dischargeBy: d.discharge_by || d.dischargeBy || 'Dr. Rajesh Sharma',
    discharge_by: d.discharge_by || d.dischargeBy || 'Dr. Rajesh Sharma',
    admissionDate: d.admission_date || d.admissionDate || '',
    admission_date: d.admission_date || d.admissionDate || ''
  };
}

const rawSupabaseService = {
  // Patients
  getPatients: async () => {
    try {
      const { data, error } = await supabase
        .from('patients')
        .select('*')
        .order('created_at', { ascending: false });
      
      if (error) throw error;
      return (data || []).map(normalizePatient);
    } catch (error: any) {
      console.warn('Error fetching patients, falling back to local storage:', error.message);
      return (storage.get(STORAGE_KEYS.PATIENTS, MOCK_PATIENTS) || []).map(normalizePatient);
    }
  },

  createPatient: async (patient: any) => {
    try {
      const { data, error } = await supabase
        .from('patients')
        .insert([cleanUuidFields(patient)])
        .select();
      
      if (error) throw error;
      return normalizePatient(data[0]);
    } catch (error: any) {
      console.warn('Handling local fallback for create patient:', error.message);
      const list = storage.get(STORAGE_KEYS.PATIENTS, MOCK_PATIENTS);
      const newPatient = normalizePatient({
        ...patient,
        id: patient.id || 'pat-' + Date.now(),
        mrn: patient.mrn || 'MRN-' + Math.floor(100000 + Math.random() * 900000),
        status: patient.status || 'Active',
        created_at: patient.created_at || new Date().toISOString()
      });
      list.unshift(newPatient);
      storage.set(STORAGE_KEYS.PATIENTS, list);
      broadcastDataMutation('patients', 'insert');
      return newPatient;
    }
  },

  updatePatient: async (id: string, updates: any) => {
    try {
      const { data, error } = await supabase
        .from('patients')
        .update(updates)
        .eq('id', id)
        .select();
      
      if (error) throw error;
      return normalizePatient(data[0]);
    } catch (error: any) {
      console.warn('Handling local fallback for update patient:', error.message);
      const list = storage.get(STORAGE_KEYS.PATIENTS, MOCK_PATIENTS);
      const target = list.find((p: any) => p.id === id);
      const updatedItem: any = normalizePatient({
        ...(target || {}),
        ...updates
      });
      const updated = list.map((p: any) => p.id === id ? updatedItem : p);
      storage.set(STORAGE_KEYS.PATIENTS, updated);
      broadcastDataMutation('patients', 'update');
      return updatedItem;
    }
  },

  deletePatient: async (id: string) => {
    try {
      const { error } = await supabase
        .from('patients')
        .delete()
        .eq('id', id);
      
      if (error) throw error;
      return true;
    } catch (error: any) {
      console.error('Error deleting patient:', error.message);
      return false;
    }
  },

  // Appointments
  getAppointments: async () => {
    try {
      const { data, error } = await supabase
        .from('appointments')
        .select('*, patients(name, mrn, age, gender)')
        .order('appointment_date', { ascending: true });
      
      if (error) throw error;
      return (data || []).map(mapAppointmentFromPostgres);
    } catch (error: any) {
      console.warn('Error fetching appointments, falling back to local storage:', error.message);
      return (storage.get(STORAGE_KEYS.APPOINTMENTS, MOCK_APPOINTMENTS) || []).map(mapAppointmentFromPostgres);
    }
  },

  createAppointment: async (appointment: any) => {
    try {
      const dbApt = cleanAppointmentForPostgres(appointment);
      const { data, error } = await supabase
        .from('appointments')
        .insert([dbApt])
        .select();
      
      if (error) throw error;
      const createdObj = mapAppointmentFromPostgres(data[0]);
      
      try {
        if (createdObj) {
          const aptType = (createdObj.type || '').toUpperCase();
          if (aptType === 'LAB' || aptType === 'LABORATORY') {
            await supabaseService.createLabTestRequest({
              patient_id: createdObj.patient_id || createdObj.patientId,
              test_name: 'Complete Blood Count (CBC) [From Appointment]',
              status: 'Ordered',
              reference_range: '12.0 - 17.0 g/dL',
              unit: 'g/dL',
              urgency: createdObj.urgency || 'routine'
            });
          } else if (aptType === 'RADIOLOGY') {
            await supabaseService.createRadiologyRecord({
              patient_id: createdObj.patient_id || createdObj.patientId,
              test_name: 'Chest X-Ray [From Appointment]',
              status: 'Ordered',
              urgency: createdObj.urgency || 'routine',
              result_notes: ''
            });
          }
        }
      } catch (e: any) {
        console.warn('Silent failure mapping appointment to diagnostic order:', e.message);
      }

      return createdObj;
    } catch (error: any) {
      console.warn('Error creating appointment, falling back to local storage:', error.message);
      const list = storage.get(STORAGE_KEYS.APPOINTMENTS, MOCK_APPOINTMENTS);
      const newApt = mapAppointmentFromPostgres({
        ...appointment,
        id: appointment.id || 'apt-' + Date.now(),
        token_number: appointment.token_number || Math.floor(1 + Math.random() * 100),
        status: appointment.status || 'Confirmed',
        created_at: new Date().toISOString()
      });
      list.unshift(newApt);
      storage.set(STORAGE_KEYS.APPOINTMENTS, list);
      return newApt;
    }
  },

  updateAppointment: async (id: string, updates: any) => {
    try {
      const dbUpdates = cleanAppointmentForPostgres(updates);
      const { data, error } = await supabase
        .from('appointments')
        .update(dbUpdates)
        .eq('id', id)
        .select();
      
      if (error) throw error;
      return mapAppointmentFromPostgres(data[0]);
    } catch (error: any) {
      console.warn('Error updating appointment, falling back to local storage:', error.message);
      const list = storage.get(STORAGE_KEYS.APPOINTMENTS, MOCK_APPOINTMENTS);
      const target = list.find((a: any) => a.id === id);
      const updatedItem = mapAppointmentFromPostgres({
        ...(target || {}),
        ...updates
      });
      const updated = list.map((a: any) => a.id === id ? updatedItem : a);
      storage.set(STORAGE_KEYS.APPOINTMENTS, updated);
      return updatedItem;
    }
  },

  // Prescriptions
  getPrescriptions: async (patientId?: string) => {
    try {
      let query = supabase
        .from('prescriptions')
        .select('*, patients(name, mrn)');
      
      if (patientId) {
        query = query.eq('patient_id', patientId);
      }
      
      const { data, error } = await query.order('created_at', { ascending: false });
      
      if (error) throw error;
      return data;
    } catch (error: any) {
      console.warn('Handling local fallback for prescriptions:', error.message);
      let localData = storage.get(STORAGE_KEYS.PRESCRIPTIONS, MOCK_PRESCRIPTIONS);
      if (patientId) {
        localData = localData.filter((rx: any) => rx.patientId === patientId || rx.patient_id === patientId);
      }
      return localData;
    }
  },

  createPrescription: async (prescription: any) => {
    try {
      const { data, error } = await supabase
        .from('prescriptions')
        .insert([cleanUuidFields(prescription)])
        .select();
      
      if (error) throw error;
      return data[0];
    } catch (error: any) {
      console.warn('Handling local fallback for create prescription:', error.message);
      const localData = storage.get(STORAGE_KEYS.PRESCRIPTIONS, MOCK_PRESCRIPTIONS);
      const newRx = { 
        ...prescription, 
        id: prescription.id || 'rx-' + Math.random().toString(36).substring(2, 9), 
        created_at: new Date().toISOString() 
      };
      localData.unshift(newRx);
      storage.set(STORAGE_KEYS.PRESCRIPTIONS, localData);
      return newRx;
    }
  },

  // Invoices / Billing
  getInvoices: async () => {
    try {
      const { data, error } = await supabase
        .from('invoices')
        .select('*, patients(name, mrn, phone, email), invoice_items(*)')
        .order('created_at', { ascending: false });
      
      if (error) throw error;
      if (data) {
        return data.map((inv: any) => {
          const mappedInv = mapInvoiceFromPostgres(inv);
          if (inv.invoice_items) {
            mappedInv.invoice_items = inv.invoice_items.map(mapInvoiceItemFromPostgres);
          }
          return mappedInv;
        });
      }
      return data;
    } catch (error: any) {
      console.warn('Error fetching invoices, falling back to local storage:', error.message);
      const val = storage.get(STORAGE_KEYS.BILLING, MOCK_BILLING);
      return (val || []).map((inv: any) => {
        const mappedInv = mapInvoiceFromPostgres(inv);
        if (inv.invoice_items) {
          mappedInv.invoice_items = inv.invoice_items.map(mapInvoiceItemFromPostgres);
        }
        return mappedInv;
      });
    }
  },

  createInvoice: async (invoice: any, items: any[]) => {
    try {
      const dbInv = cleanInvoiceForPostgres(invoice);
      const { data: invData, error: invError } = await supabase
        .from('invoices')
        .insert([dbInv])
        .select();
      
      if (invError) throw invError;
      
      const invoiceId = invData[0].id;
      const itemsToInsert = items.map(item => {
        const dbItem = cleanInvoiceItemForPostgres(item);
        return { ...dbItem, invoice_id: invoiceId };
      });
      
      const { error: itemsError } = await supabase
        .from('invoice_items')
        .insert(itemsToInsert);
      
      if (itemsError) throw itemsError;
      
      const syncedInv = mapInvoiceFromPostgres(invData[0]);
      // Fetch items back with their generated IDs and back-map to sync properly with frontend cache
      const { data: syncedItems } = await supabase
        .from('invoice_items')
        .select('*')
        .eq('invoice_id', invoiceId);
      
      syncedInv.invoice_items = (syncedItems || []).map(mapInvoiceItemFromPostgres);
      return syncedInv;
    } catch (error: any) {
      console.warn('Error creating invoice, falling back to local storage:', error.message);
      const list = storage.get(STORAGE_KEYS.BILLING, MOCK_BILLING) || [];
      const invoiceId = invoice.id || 'inv-' + Date.now();
      const newItems = items.map(item => ({
        ...mapInvoiceItemFromPostgres(cleanInvoiceItemForPostgres(item)),
        id: item.id || 'inv-item-' + Math.random().toString(36).substring(2, 9),
        invoice_id: invoiceId
      }));
      const newInv = {
        ...mapInvoiceFromPostgres(cleanInvoiceForPostgres(invoice)),
        id: invoiceId,
        invoice_items: newItems,
        created_at: invoice.created_at || new Date().toISOString()
      };
      list.unshift(newInv);
      storage.set(STORAGE_KEYS.BILLING, list);
      return newInv;
    }
  },

  updateInvoice: async (id: string, invoice: any, items: any[]) => {
    try {
      const dbInv = cleanInvoiceForPostgres(invoice);
      delete dbInv.invoice_items;
      delete dbInv.patients;

      const { data: invData, error: invError } = await supabase
        .from('invoices')
        .update(dbInv)
        .eq('id', id)
        .select();
      
      if (invError) throw invError;
      
      const { error: deleteError } = await supabase
        .from('invoice_items')
        .delete()
        .eq('invoice_id', id);
        
      if (deleteError) throw deleteError;

      if (items && items.length > 0) {
        const itemsToInsert = items.map(item => {
          const dbItem = cleanInvoiceItemForPostgres(item);
          return { ...dbItem, invoice_id: id };
        });
        
        const { error: itemsError } = await supabase
          .from('invoice_items')
          .insert(itemsToInsert);
        
        if (itemsError) throw itemsError;
      }
      
      const syncedInv = mapInvoiceFromPostgres(invData[0]);
      const { data: syncedItems } = await supabase
        .from('invoice_items')
        .select('*')
        .eq('invoice_id', id);
      
      syncedInv.invoice_items = (syncedItems || []).map(mapInvoiceItemFromPostgres);
      return syncedInv;
    } catch (error: any) {
      console.warn('Error updating invoice, falling back to local storage:', error.message);
      const list = storage.get(STORAGE_KEYS.BILLING, MOCK_BILLING) || [];
      const target = list.find((inv: any) => inv.id === id);
      const newItems = items.map(item => ({
        ...mapInvoiceItemFromPostgres(cleanInvoiceItemForPostgres(item)),
        id: item.id || 'inv-item-' + Math.random().toString(36).substring(2, 9),
        invoice_id: id
      }));
      const updatedInv = {
        ...(target || {}),
        ...mapInvoiceFromPostgres(cleanInvoiceForPostgres(invoice)),
        id,
        invoice_items: newItems,
        updated_at: new Date().toISOString()
      };
      const updated = list.map((inv: any) => inv.id === id ? updatedInv : inv);
      storage.set(STORAGE_KEYS.BILLING, updated);
      return updatedInv;
    }
  },

  deleteInvoice: async (id: string) => {
    try {
      const { error } = await supabase
        .from('invoices')
        .delete()
        .eq('id', id);
      
      if (error) throw error;
      return true;
    } catch (error: any) {
      console.warn('Error deleting invoice, falling back to local storage:', error.message);
      const list = storage.get(STORAGE_KEYS.BILLING, MOCK_BILLING) || [];
      const filtered = list.filter((inv: any) => inv.id !== id);
      storage.set(STORAGE_KEYS.BILLING, filtered);
      return true;
    }
  },

  // Lab Tests & Orders
  getLabTests: async () => {
    try {
      const { data, error } = await supabase
        .from('lab_tests')
        .select('*')
        .order('name', { ascending: true });
      
      if (error) throw error;
      return data;
    } catch (error: any) {
      console.error('Error fetching lab tests:', error.message);
      return null;
    }
  },

  getLabTestRequests: async () => {
    try {
      const { data, error } = await supabase
        .from('test_requests')
        .select('*, patients(name, mrn, age, gender, phone), profiles:requested_by(name)')
        .order('requested_at', { ascending: false });
      
      if (error) throw error;
      return data;
    } catch (error: any) {
      console.error('Error fetching lab test requests:', error.message);
      return null;
    }
  },

  createLabTestRequest: async (request: any) => {
    try {
      const dbRequest: any = {};
      const validKeys = [
        'id', 'patient_id', 'test_id', 'requested_by', 'status', 'results',
        'report_url', 'requested_at', 'completed_at', 'test_name',
        'reference_range', 'unit', 'urgency', 'result_value', 'clinical_notes', 'findings'
      ];
      for (const key of validKeys) {
        if (request[key] !== undefined) {
          dbRequest[key] = request[key];
        }
      }

      const { data, error } = await supabase
        .from('test_requests')
        .insert([dbRequest])
        .select();
      
      if (error) throw error;
      return data[0];
    } catch (error: any) {
      console.warn('Handling local fallback for create lab test request:', error.message);
      const list = storage.get(STORAGE_KEYS.LAB_TEST_ORDERS, []);
      const newRecord = {
        ...request,
        id: request.id || 'lab-' + Math.random().toString(36).substring(2, 9),
        requested_at: request.requested_at || new Date().toISOString()
      };
      list.unshift(newRecord);
      storage.set(STORAGE_KEYS.LAB_TEST_ORDERS, list);
      return newRecord;
    }
  },

  updateLabTestRequest: async (id: string, updates: any) => {
    try {
      const cleanUpdates = { ...updates };
      delete cleanUpdates.updated_at;
      if (cleanUpdates.status === 'Completed' && !cleanUpdates.completed_at) {
        cleanUpdates.completed_at = new Date().toISOString();
      }

      const dbUpdates: any = {};
      const validKeys = [
        'patient_id', 'test_id', 'requested_by', 'status', 'results',
        'report_url', 'requested_at', 'completed_at', 'test_name',
        'reference_range', 'unit', 'urgency', 'result_value', 'clinical_notes', 'findings'
      ];
      for (const key of validKeys) {
        if (cleanUpdates[key] !== undefined) {
          dbUpdates[key] = cleanUpdates[key];
        }
      }

      const { data, error } = await supabase
        .from('test_requests')
        .update(dbUpdates)
        .eq('id', id)
        .select();
      
      if (error) throw error;
      return data[0];
    } catch (error: any) {
      console.error('Error updating lab test request:', error.message);
      return null;
    }
  },

  deleteLabTestRequest: async (id: string) => {
    try {
      const { error } = await supabase
        .from('test_requests')
        .delete()
        .eq('id', id);
      
      if (error) throw error;
      return true;
    } catch (error: any) {
      console.error('Error deleting lab test request:', error.message);
      return false;
    }
  },

  // Radiology
  getRadiologyRecords: async () => {
    try {
      const { data, error } = await supabase
        .from('radiology_records')
        .select('*, patients(name, mrn), profiles:requested_by(name)')
        .order('requested_at', { ascending: false });
      
      if (error) throw error;
      return data;
    } catch (error: any) {
      console.warn('Handling local fallback for radiology records:', error.message);
      return storage.get('hms_radiology_records', []);
    }
  },

  createRadiologyRecord: async (record: any) => {
    try {
      const cleanRecord = { ...record };
      if ('result_value' in cleanRecord) {
        cleanRecord.result_notes = cleanRecord.result_value;
        delete cleanRecord.result_value;
      }
      delete cleanRecord.reference_range;
      delete cleanRecord.unit;

      const { data, error } = await supabase
        .from('radiology_records')
        .insert([cleanRecord])
        .select();
      
      if (error) throw error;
      return data[0];
    } catch (error: any) {
      console.warn('Handling local fallback for create radiology record:', error.message);
      const list = storage.get('hms_radiology_records', []);
      const newRecord = {
        ...record,
        id: record.id || 'rad-' + Math.random().toString(36).substring(2, 9),
        requested_at: record.requested_at || new Date().toISOString()
      };
      list.unshift(newRecord);
      storage.set('hms_radiology_records', list);
      return newRecord;
    }
  },

  updateRadiologyRecord: async (id: string, updates: any) => {
    try {
      const cleanUpdates = { ...updates };
      if ('result_value' in cleanUpdates) {
        cleanUpdates.result_notes = cleanUpdates.result_value;
        delete cleanUpdates.result_value;
      }
      delete cleanUpdates.reference_range;
      delete cleanUpdates.unit;

      const { data, error } = await supabase
        .from('radiology_records')
        .update(cleanUpdates)
        .eq('id', id)
        .select();
      
      if (error) throw error;
      return data[0];
    } catch (error: any) {
      console.warn('Handling local fallback for update radiology record:', error.message);
      const list = storage.get('hms_radiology_records', []);
      const updatedList = list.map((item: any) => {
        if (item.id === id) {
          return { ...item, ...updates };
        }
        return item;
      });
      storage.set('hms_radiology_records', updatedList);
      return updatedList.find((item: any) => item.id === id) || null;
    }
  },

  // Hospital Info
  getHospitalInfo: async () => {
    try {
      const { data, error } = await supabase
        .from('hospital_info')
        .select('*')
        .single();
      
      if (error && error.code !== 'PGRST116') throw error;
      return data || {
        name: 'Medicare Multispeciality Hospital',
        address: '123 Health Ave, Medical District, New Delhi, India 110001',
        phone: '+91 11 2345 6789',
        email: 'info@medicarehospital.com',
        website: 'www.medicarehospital.com'
      };
    } catch (error: any) {
      console.error('Error fetching hospital info:', error.message);
      return null;
    }
  },

  // Pharmacy Settings
  getPharmacySettings: async () => {
    try {
      const { data, error } = await supabase
        .from('pharmacy_settings')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(1);
      
      if (error && error.code !== 'PGRST116') throw error;
      if (data && data.length > 0) {
        const row = data[0];
        return {
          logoUrl: row.logo_url || '',
          pharmacyName: row.pharmacy_name || '',
          address: row.address || '',
          phone: row.phone || '',
          tagline: row.tagline || '',
          gstin: row.gstin || '',
          bankName: row.bank_name || '',
          bankBranch: row.bank_branch || '',
          bankAccNo: row.bank_acc_no || '',
          bankIfsc: row.bank_ifsc || '',
          upiId: row.upi_id || '',
          termsAndConditions: row.terms_and_conditions || [],
          additionalFooter: row.additional_footer || ''
        };
      }
      
      // If table has empty rows, automatically populate and save default/cached settings to Supabase
      const localSettings = storage.get('hms_pharmacy_settings', DEFAULT_PHARMACY_SETTINGS);
      const dbPayload = {
        logo_url: localSettings.logoUrl,
        pharmacy_name: localSettings.pharmacyName,
        address: localSettings.address,
        phone: localSettings.phone,
        tagline: localSettings.tagline,
        gstin: localSettings.gstin,
        bank_name: localSettings.bankName,
        bank_branch: localSettings.bankBranch,
        bank_acc_no: localSettings.bankAccNo,
        bank_ifsc: localSettings.bankIfsc,
        upi_id: localSettings.upiId,
        terms_and_conditions: localSettings.termsAndConditions,
        additional_footer: localSettings.additionalFooter
      };
      
      const { data: inserted, error: insertError } = await supabase
        .from('pharmacy_settings')
        .insert([dbPayload])
        .select();
        
      if (insertError) {
        console.warn('Fallback silent insert default pharmacy settings error:', insertError.message);
        return localSettings;
      }
      
      if (inserted && inserted.length > 0) {
        const row = inserted[0];
        return {
          logoUrl: row.logo_url || '',
          pharmacyName: row.pharmacy_name || '',
          address: row.address || '',
          phone: row.phone || '',
          tagline: row.tagline || '',
          gstin: row.gstin || '',
          bankName: row.bank_name || '',
          bankBranch: row.bank_branch || '',
          bankAccNo: row.bank_acc_no || '',
          bankIfsc: row.bank_ifsc || '',
          upiId: row.upi_id || '',
          termsAndConditions: row.terms_and_conditions || [],
          additionalFooter: row.additional_footer || ''
        };
      }
      
      return localSettings;
    } catch (error: any) {
      console.error('Error fetching pharmacy settings:', error.message);
      return storage.get('hms_pharmacy_settings', DEFAULT_PHARMACY_SETTINGS);
    }
  },

  updatePharmacySettings: async (settings: any) => {
    try {
      const dbPayload = {
        logo_url: settings.logoUrl,
        pharmacy_name: settings.pharmacyName,
        address: settings.address,
        phone: settings.phone,
        tagline: settings.tagline,
        gstin: settings.gstin,
        bank_name: settings.bankName,
        bank_branch: settings.bankBranch,
        bank_acc_no: settings.bankAccNo,
        bank_ifsc: settings.bankIfsc,
        upi_id: settings.upiId,
        terms_and_conditions: settings.termsAndConditions,
        additional_footer: settings.additionalFooter
      };

      const { data: existing, error: checkError } = await supabase
        .from('pharmacy_settings')
        .select('id')
        .limit(1);
      
      if (checkError) throw checkError;

      let result;
      if (existing && existing.length > 0) {
        const id = existing[0].id;
        const { data, error } = await supabase
          .from('pharmacy_settings')
          .update(dbPayload)
          .eq('id', id)
          .select();
        if (error) throw error;
        result = data;
      } else {
        const { data, error } = await supabase
          .from('pharmacy_settings')
          .insert([dbPayload])
          .select();
        if (error) throw error;
        result = data;
      }

      if (result && result[0]) {
        const row = result[0];
        return {
          id: row.id,
          logoUrl: row.logo_url || '',
          pharmacyName: row.pharmacy_name || '',
          address: row.address || '',
          phone: row.phone || '',
          tagline: row.tagline || '',
          gstin: row.gstin || '',
          bankName: row.bank_name || '',
          bankBranch: row.bank_branch || '',
          bankAccNo: row.bank_acc_no || '',
          bankIfsc: row.bank_ifsc || '',
          upiId: row.upi_id || '',
          termsAndConditions: row.terms_and_conditions || [],
          additionalFooter: row.additional_footer || ''
        };
      }
      return settings;
    } catch (error: any) {
      console.error('Error updating pharmacy settings:', error.message);
      return null;
    }
  },

  // Staff / Profiles
  decodeStaffPassword: (staffMember: any) => {
    if (!staffMember) return staffMember;
    const match = staffMember.degree?.match(/\[pwd:(.*?)\]/);
    if (match) {
      staffMember.password = match[1];
      staffMember.degree = staffMember.degree.replace(/\[pwd:(.*?)\]/, '').trim();
    }
    return staffMember;
  },

  // --- ABDM & PM-JAY INTEGRATED DATABASE OPERATIONS ---
  getAbdmLinks: async () => {
    try {
      const { data, error } = await supabase
        .from('patients_abdm_link')
        .select('*, patients(name, mrn, phone, gender, age)');
      if (error) throw error;
      return data || [];
    } catch (e: any) {
      console.warn('Fallback to local for ABDM Links:', e.message);
      return storage.get('hms_abdm_links', []);
    }
  },

  createAbdmLink: async (payload: any) => {
    try {
      const { data, error } = await supabase
        .from('patients_abdm_link')
        .insert([payload])
        .select();
      if (error) throw error;
      broadcastDataMutation('patients_abdm_link', 'insert');
      return data?.[0] || null;
    } catch (e: any) {
      console.warn('Fallback to local for create ABDM Link:', e.message);
      const list = storage.get('hms_abdm_links', []);
      const newItem = { ...payload, id: payload.id || 'link-' + Date.now() };
      list.unshift(newItem);
      storage.set('hms_abdm_links', list);
      return newItem;
    }
  },

  updateAbdmLink: async (id: string, updates: any) => {
    try {
      const { data, error } = await supabase
        .from('patients_abdm_link')
        .update(updates)
        .eq('id', id)
        .select();
      if (error) throw error;
      broadcastDataMutation('patients_abdm_link', 'update');
      return data?.[0] || null;
    } catch (e: any) {
      console.warn('Fallback to local for update ABDM Link:', e.message);
      const list = storage.get('hms_abdm_links', []);
      const updated = list.map((item: any) => item.id === id ? { ...item, ...updates } : item);
      storage.set('hms_abdm_links', updated);
      return updated.find((item: any) => item.id === id) || null;
    }
  },

  getHprPractitioners: async () => {
    try {
      const { data, error } = await supabase
        .from('hpr_practitioners')
        .select('*, profiles(name)');
      if (error) throw error;
      return data?.map((row: any) => ({
        hprId: row.hpr_id,
        name: row.profiles?.name || row.qualification,
        registrationNumber: row.registration_number,
        qualification: row.qualification,
        specialization: row.specialization,
        status: row.status,
        id: row.id,
        doctor_id: row.doctor_id
      })) || [];
    } catch (e: any) {
      console.warn('Fallback to local for HPR Practitioners:', e.message);
      const savedHpr = localStorage.getItem('hms_abdm_hpr_docs');
      return savedHpr ? JSON.parse(savedHpr) : [];
    }
  },

  createHprPractitioner: async (payload: any) => {
    try {
      const dbPayload = {
        doctor_id: payload.doctor_id || null,
        hpr_id: payload.hprId || payload.hpr_id,
        qualification: payload.qualification,
        registration_number: payload.registrationNumber || payload.registration_number,
        specialization: payload.specialization,
        status: payload.status || 'Active_HPR'
      };
      const { data, error } = await supabase
        .from('hpr_practitioners')
        .insert([dbPayload])
        .select();
      if (error) throw error;
      broadcastDataMutation('hpr_practitioners', 'insert');
      return data?.[0] || null;
    } catch (e: any) {
      console.warn('Fallback to local for create HPR practitioner:', e.message);
      const savedHpr = JSON.parse(localStorage.getItem('hms_abdm_hpr_docs') || '[]');
      savedHpr.unshift(payload);
      localStorage.setItem('hms_abdm_hpr_docs', JSON.stringify(savedHpr));
      return payload;
    }
  },

  getHfrFacilities: async () => {
    try {
      const { data, error } = await supabase
        .from('hfr_facility_sync')
        .select('*');
      if (error) throw error;
      return data?.map((row: any) => ({
        hfrId: row.hfr_id,
        name: row.name,
        ownership: row.ownership,
        nabhStatus: row.nabh_status,
        state: row.state,
        abdmGatewayStatus: row.abdm_gateway_status,
        hipId: row.hip_id,
        hiuId: row.hiu_id,
        updatedAt: row.updated_at
      })) || [];
    } catch (e: any) {
      console.warn('Fallback to local for HFR Facilities:', e.message);
      const saved = localStorage.getItem('hms_abdm_hfr_facilities');
      return saved ? JSON.parse(saved) : [];
    }
  },

  updateHfrFacility: async (hfrId: string, updates: any) => {
    try {
      const dbPayload = {
        name: updates.name,
        ownership: updates.ownership,
        nabh_status: updates.nabhStatus || updates.nabh_status,
        state: updates.state,
        abdm_gateway_status: updates.abdmGatewayStatus || updates.abdm_gateway_status,
        hip_id: updates.hipId || updates.hip_id,
        hiu_id: updates.hiuId || updates.hiu_id
      };
      const { data, error } = await supabase
        .from('hfr_facility_sync')
        .update(dbPayload)
        .eq('hfr_id', hfrId)
        .select();
      if (error) throw error;
      broadcastDataMutation('hfr_facility_sync', 'update');
      return data?.[0] || null;
    } catch (e: any) {
      console.warn('Fallback to local for update HFR Facility:', e.message);
      const saved = JSON.parse(localStorage.getItem('hms_abdm_hfr_facilities') || '[]');
      const updated = saved.map((item: any) => (item.hfrId === hfrId || item.hfr_id === hfrId) ? { ...item, ...updates } : item);
      localStorage.setItem('hms_abdm_hfr_facilities', JSON.stringify(updated));
      return updated.find((item: any) => (item.hfrId === hfrId || item.hfr_id === hfrId)) || null;
    }
  },

  getAbdmConsents: async () => {
    try {
      const { data, error } = await supabase
        .from('abdm_consent_requests')
        .select('*, patients(name, mrn)');
      if (error) throw error;
      return data?.map((row: any) => ({
        id: row.id,
        patientId: row.patient_id,
        patientName: row.patients?.name || 'Unknown Patient',
        abhaAddress: row.abha_address,
        purpose: row.purpose,
        hiuId: row.hiu_id,
        hipId: row.hip_id,
        consentExpiry: row.consent_expiry,
        status: row.status,
        healthTypes: row.health_types,
        dateRequested: row.created_at,
        signatureStatus: row.signature_status
      })) || [];
    } catch (e: any) {
      console.warn('Fallback to local for ABDM Consents:', e.message);
      const saved = localStorage.getItem('hms_abdm_consents');
      return saved ? JSON.parse(saved) : [];
    }
  },

  createAbdmConsent: async (payload: any) => {
    try {
      const dbPayload = {
        patient_id: payload.patientId || null,
        abha_address: payload.abhaAddress,
        purpose: payload.purpose,
        hiu_id: payload.hiuId,
        hip_id: payload.hipId,
        consent_expiry: payload.consentExpiry,
        status: payload.status || 'Requested',
        health_types: payload.healthTypes || [],
        signature_status: payload.signatureStatus || 'Unsigned'
      };
      const { data, error } = await supabase
        .from('abdm_consent_requests')
        .insert([dbPayload])
        .select();
      if (error) throw error;
      broadcastDataMutation('abdm_consent_requests', 'insert');
      return data?.[0] || null;
    } catch (e: any) {
      console.warn('Fallback to local for create ABDM Consent:', e.message);
      const saved = JSON.parse(localStorage.getItem('hms_abdm_consents') || '[]');
      saved.unshift(payload);
      localStorage.setItem('hms_abdm_consents', JSON.stringify(saved));
      return payload;
    }
  },

  updateAbdmConsent: async (id: string, updates: any) => {
    try {
      const dbPayload: any = {};
      if (updates.status) dbPayload.status = updates.status;
      if (updates.signatureStatus) dbPayload.signature_status = updates.signatureStatus;
      dbPayload.updated_at = new Date().toISOString();

      const { data, error } = await supabase
        .from('abdm_consent_requests')
        .update(dbPayload)
        .eq('id', id)
        .select();
      if (error) throw error;
      broadcastDataMutation('abdm_consent_requests', 'update');
      return data?.[0] || null;
    } catch (e: any) {
      console.warn('Fallback to local for update ABDM Consent:', e.message);
      const saved = JSON.parse(localStorage.getItem('hms_abdm_consents') || '[]');
      const updated = saved.map((item: any) => item.id === id ? { ...item, ...updates } : item);
      localStorage.setItem('hms_abdm_consents', JSON.stringify(updated));
      return updated.find((item: any) => item.id === id) || null;
    }
  },

  getPmjayClaims: async () => {
    try {
      const { data, error } = await supabase
        .from('pmjay_claims')
        .select('*, patients(name, mrn)');
      if (error) throw error;
      return data?.map((row: any) => ({
        id: row.id,
        patientId: row.patient_id,
        patientName: row.patients?.name || 'Unknown Patient',
        ayushmanCardNo: row.ayushman_card_number,
        beneficiaryId: row.beneficiary_id,
        packageName: row.package_name,
        packageCode: row.package_code,
        amount: Number(row.claim_amount),
        status: row.status,
        preAuthNo: row.pre_auth_number,
        dateFiled: row.date_filed,
        sachisReconciliationStatus: row.sachis_reconciliation_status
      })) || [];
    } catch (e: any) {
      console.warn('Fallback to local for PM-JAY Claims:', e.message);
      const saved = localStorage.getItem('hms_pmjay_claims');
      return saved ? JSON.parse(saved) : [];
    }
  },

  createPmjayClaim: async (payload: any) => {
    try {
      const dbPayload = {
        patient_id: payload.patientId || null,
        ayushman_card_number: payload.ayushmanCardNo || payload.ayushman_card_number,
        beneficiary_id: payload.beneficiaryId || payload.beneficiary_id,
        package_name: payload.packageName || payload.package_name,
        package_code: payload.packageCode || payload.package_code,
        claim_amount: payload.amount || payload.claim_amount,
        status: payload.status || 'Submitted',
        pre_auth_number: payload.preAuthNo || payload.pre_auth_number || null,
        sachis_reconciliation_status: payload.sachisReconciliationStatus || payload.sachis_reconciliation_status || 'Pending'
      };
      const { data, error } = await supabase
        .from('pmjay_claims')
        .insert([dbPayload])
        .select();
      if (error) throw error;
      broadcastDataMutation('pmjay_claims', 'insert');
      return data?.[0] || null;
    } catch (e: any) {
      console.warn('Fallback to local for create PM-JAY Claim:', e.message);
      const saved = JSON.parse(localStorage.getItem('hms_pmjay_claims') || '[]');
      saved.unshift(payload);
      localStorage.setItem('hms_pmjay_claims', JSON.stringify(saved));
      return payload;
    }
  },

  updatePmjayClaim: async (id: string, updates: any) => {
    try {
      const dbPayload: any = {};
      if ('status' in updates) dbPayload.status = updates.status;
      if ('preAuthNo' in updates) dbPayload.pre_auth_number = updates.preAuthNo || updates.pre_auth_number;
      if ('sachisReconciliationStatus' in updates) dbPayload.sachis_reconciliation_status = updates.sachisReconciliationStatus || updates.sachis_reconciliation_status;

      const { data, error } = await supabase
        .from('pmjay_claims')
        .update(dbPayload)
        .eq('id', id)
        .select();
      if (error) throw error;
      broadcastDataMutation('pmjay_claims', 'update');
      return data?.[0] || null;
    } catch (e: any) {
      console.warn('Fallback to local for update PM-JAY Claim:', e.message);
      const saved = JSON.parse(localStorage.getItem('hms_pmjay_claims') || '[]');
      const updated = saved.map((item: any) => item.id === id ? { ...item, ...updates } : item);
      localStorage.setItem('hms_pmjay_claims', JSON.stringify(updated));
      return updated.find((item: any) => item.id === id) || null;
    }
  },

  getAbdmAuditLogs: async () => {
    try {
      const { data, error } = await supabase
        .from('abdm_compliance_audit_logs')
        .select('*')
        .order('timestamp', { ascending: false });
      if (error) throw error;
      return data?.map((row: any) => ({
        id: row.id,
        timestamp: row.timestamp,
        userId: row.user_id,
        userRole: row.user_role,
        action: row.action,
        module: row.module,
        status: row.status,
        ipAddress: row.ip_address,
        details: row.details
      })) || [];
    } catch (e: any) {
      console.warn('Fallback to local for ABDM Audit Logs:', e.message);
      const saved = localStorage.getItem('hms_abdm_audit_logs');
      return saved ? JSON.parse(saved) : [];
    }
  },

  createAbdmAuditLog: async (payload: any) => {
    try {
      const dbPayload = {
        user_id: payload.userId || payload.user_id,
        user_role: payload.userRole || payload.user_role,
        action: payload.action,
        module: payload.module,
        status: payload.status || 'SUCCESS',
        ip_address: payload.ipAddress || payload.ip_address || '127.0.0.1',
        details: payload.details
      };
      const { data, error } = await supabase
        .from('abdm_compliance_audit_logs')
        .insert([dbPayload])
        .select();
      if (error) throw error;
      return data?.[0] || null;
    } catch (e: any) {
      console.warn('Fallback to local for create ABDM Audit Log:', e.message);
      const saved = JSON.parse(localStorage.getItem('hms_abdm_audit_logs') || '[]');
      saved.unshift({ ...payload, id: payload.id || 'log-' + Date.now(), timestamp: payload.timestamp || new Date().toISOString() });
      localStorage.setItem('hms_abdm_audit_logs', JSON.stringify(saved));
      return payload;
    }
  },

  encodeStaffPassword: (staffMember: any) => {
    if (!staffMember) return staffMember;
    const dbStaff = { ...staffMember };
    if (dbStaff.password) {
      const cleanDegree = (dbStaff.degree || '').replace(/\[pwd:(.*?)\]/, '').trim();
      dbStaff.degree = `${cleanDegree} [pwd:${dbStaff.password}]`.trim();
      delete dbStaff.password;
    }
    return dbStaff;
  },

  getStaff: async () => {
    try {
      const { data, error } = await supabase
        .from('staff')
        .select('*')
        .order('name', { ascending: true });
      
      const decodeHelper = (list: any[]) => {
        return list.map((p: any) => {
          const item = {
            ...p,
            avatar: p.avatar_url || p.avatar
          };
          // Decode password
          const match = item.degree?.match(/\[pwd:(.*?)\]/);
          if (match) {
            item.password = match[1];
            item.degree = item.degree.replace(/\[pwd:(.*?)\]/, '').trim();
          }
          return item;
        });
      };

      if (error) {
        if (error.code === 'PGRST116' || error.message?.toLowerCase().includes('does not exist')) {
          // Fallback to profiles table
          const { data: pData, error: pError } = await supabase
            .from('profiles')
            .select('*')
            .order('name', { ascending: true });
          if (pError) throw pError;
          const mapped = decodeHelper(pData || []);
          storage.set(STORAGE_KEYS.USERS, mapped);
          return mapped;
        }
        throw error;
      }
      const mapped = decodeHelper(data || []);
      storage.set(STORAGE_KEYS.USERS, mapped);
      return mapped;
    } catch (error: any) {
      console.warn('Error fetching staff, falling back to local storage:', error.message);
      return storage.get(STORAGE_KEYS.USERS, MOCK_USERS);
    }
  },

  createStaff: async (profile: any) => {
    try {
      const encodedProfile = rawSupabaseService.encodeStaffPassword(profile);
      const dbProfile = { ...encodedProfile };
      if ('avatar' in dbProfile) {
        dbProfile.avatar_url = dbProfile.avatar;
        delete dbProfile.avatar;
      }
      
      // Normalize roles to prevent CHECK constraint violations on profiles table
      if (dbProfile.role) {
        const r = dbProfile.role.toUpperCase().trim();
        if (r === 'RECEPTION' || r === 'RECEPTION_STAFF') {
          dbProfile.role = 'RECEPTIONIST';
        } else if (r === 'LAB_STAFF' || r === 'LAB_STAFF_MEMBER') {
          dbProfile.role = 'LAB_TECHNICIAN';
        } else {
          dbProfile.role = r;
        }
      }
      
      if (!dbProfile.id) {
        dbProfile.id = typeof crypto !== 'undefined' && crypto.randomUUID 
          ? crypto.randomUUID() 
          : '3f6c8d1a-4b9e-4e8c-8d1a-' + Math.random().toString(36).substring(2, 14).padEnd(12, '0');
      }

      let created: any = null;
      const { data, error } = await supabase
        .from('staff')
        .insert([dbProfile])
        .select();
      
      if (error) {
        if (error.message?.toLowerCase().includes('does not exist')) {
          // Fallback to inserting into profiles
          const { data: pData, error: pError } = await supabase
            .from('profiles')
            .insert([dbProfile])
            .select();
          if (pError) throw pError;
          created = pData[0];
        } else {
          throw error;
        }
      } else {
        created = data[0];
      }
      
      const rawResult = {
        ...created,
        avatar: created.avatar_url || created.avatar
      };
      
      const result = rawSupabaseService.decodeStaffPassword(rawResult);

      // Sync to local storage
      const existing = storage.get(STORAGE_KEYS.USERS, MOCK_USERS);
      storage.set(STORAGE_KEYS.USERS, [...existing, result]);

      return result;
    } catch (error: any) {
      console.error('Error creating staff:', error.message);
      // Even if database fails, write to local storage to enable local operations
      const dbProfile = { ...profile };
      const fallbackId = dbProfile.id || 'u-' + Date.now();
      const result = {
        ...dbProfile,
        id: fallbackId,
        avatar: dbProfile.avatar || `https://api.dicebear.com/7.x/avataaars/svg?seed=${dbProfile.name}`
      };
      const existing = storage.get(STORAGE_KEYS.USERS, MOCK_USERS);
      storage.set(STORAGE_KEYS.USERS, [...existing, result]);
      return result;
    }
  },

  updateStaff: async (id: string, updates: any) => {
    try {
      const encodedUpdates = rawSupabaseService.encodeStaffPassword(updates);
      const dbUpdates = { ...encodedUpdates };
      if ('avatar' in dbUpdates) {
        dbUpdates.avatar_url = dbUpdates.avatar;
        delete dbUpdates.avatar;
      }
      
      // Normalize roles to prevent CHECK constraint violations on profiles table
      if (dbUpdates.role) {
        const r = dbUpdates.role.toUpperCase().trim();
        if (r === 'RECEPTION' || r === 'RECEPTION_STAFF') {
          dbUpdates.role = 'RECEPTIONIST';
        } else if (r === 'LAB_STAFF' || r === 'LAB_STAFF_MEMBER') {
          dbUpdates.role = 'LAB_TECHNICIAN';
        } else {
          dbUpdates.role = r;
        }
      }

      let updated: any = null;
      const { data, error } = await supabase
        .from('staff')
        .update(dbUpdates)
        .eq('id', id)
        .select();
      
      if (error) {
        if (error.message?.toLowerCase().includes('does not exist')) {
          // Fallback to updating profiles
          const { data: pData, error: pError } = await supabase
            .from('profiles')
            .update(dbUpdates)
            .eq('id', id)
            .select();
          if (pError) throw pError;
          updated = pData[0];
        } else {
          throw error;
        }
      } else {
        updated = data[0];
      }
      
      const rawResult = {
        ...updated,
        avatar: updated.avatar_url || updated.avatar
      };
      
      const result = rawSupabaseService.decodeStaffPassword(rawResult);

      // Sync to local storage
      const existing = storage.get(STORAGE_KEYS.USERS, MOCK_USERS);
      const updatedList = existing.map((u: any) => u.id === id ? { ...u, ...result } : u);
      storage.set(STORAGE_KEYS.USERS, updatedList);

      return result;
    } catch (error: any) {
      console.error('Error updating staff:', error.message);
      // Fallback
      const existing = storage.get(STORAGE_KEYS.USERS, MOCK_USERS);
      const updatedList = existing.map((u: any) => u.id === id ? { ...u, ...updates } : u);
      storage.set(STORAGE_KEYS.USERS, updatedList);
      return { id, ...updates };
    }
  },

  deleteStaff: async (id: string) => {
    try {
      const { error } = await supabase
        .from('staff')
        .delete()
        .eq('id', id);
      
      if (error) {
        if (error.message?.toLowerCase().includes('does not exist')) {
          // Fallback to deleting from profiles
          const { error: pError } = await supabase
            .from('profiles')
            .delete()
            .eq('id', id);
          if (pError) throw pError;
        } else {
          throw error;
        }
      }

      // Sync to local storage
      const existing = storage.get(STORAGE_KEYS.USERS, MOCK_USERS);
      const filtered = existing.filter((u: any) => u.id !== id);
      storage.set(STORAGE_KEYS.USERS, filtered);

      return true;
    } catch (error: any) {
      console.error('Error deleting staff:', error.message);
      // Fallback
      const existing = storage.get(STORAGE_KEYS.USERS, MOCK_USERS);
      const filtered = existing.filter((u: any) => u.id !== id);
      storage.set(STORAGE_KEYS.USERS, filtered);
      return true;
    }
  },

  // Departments
  getDepartments: async () => {
    try {
      const { data, error } = await supabase
        .from('departments')
        .select('*')
        .order('name', { ascending: true });
      
      if (error) throw error;
      return data;
    } catch (error: any) {
      console.warn('Error fetching departments, falling back to local storage:', error.message);
      return storage.get('hms_settings_departments', ['General Medicine', 'Orthopedics', 'Pediatrics', 'Gynaecology', 'Cardiology', 'Pathology', 'Radiology', 'Accounts']).map((name: string, index: number) => ({
        id: `dept-${index}`,
        name,
        description: ''
      }));
    }
  },

  createDepartment: async (name: string, description: string = '') => {
    try {
      const { data, error } = await supabase
        .from('departments')
        .insert([{ name, description }])
        .select();
      
      if (error) throw error;
      return data[0];
    } catch (error: any) {
      console.error('Error creating department:', error.message);
      // Fallback for local storage
      const depts = storage.get('hms_settings_departments', ['General Medicine', 'Orthopedics', 'Pediatrics', 'Gynaecology', 'Cardiology', 'Pathology', 'Radiology', 'Accounts']);
      if (!depts.includes(name)) {
        depts.push(name);
        storage.set('hms_settings_departments', depts);
      }
      return { id: `dept-${Date.now()}`, name, description };
    }
  },

  deleteDepartment: async (name: string) => {
    try {
      const { error } = await supabase
        .from('departments')
        .delete()
        .eq('name', name);
      
      if (error) throw error;
      return true;
    } catch (error: any) {
      console.error('Error deleting department:', error.message);
      const depts = storage.get('hms_settings_departments', ['General Medicine', 'Orthopedics', 'Pediatrics', 'Gynaecology', 'Cardiology', 'Pathology', 'Radiology', 'Accounts']);
      const filtered = depts.filter((d: string) => d !== name);
      storage.set('hms_settings_departments', filtered);
      return true;
    }
  },

  // Specialties
  getSpecialties: async () => {
    try {
      const { data, error } = await supabase
        .from('specialties')
        .select('*')
        .order('name', { ascending: true });
      
      if (error) throw error;
      return data;
    } catch (error: any) {
      console.warn('Error fetching specialties, falling back to local storage:', error.message);
      return storage.get('hms_settings_specialties', ['Surgery', 'Consultation', 'Emergency', 'Diagnostics']).map((name: string, index: number) => ({
        id: `spec-${index}`,
        name,
        description: ''
      }));
    }
  },

  createSpecialty: async (name: string, description: string = '') => {
    try {
      const { data, error } = await supabase
        .from('specialties')
        .insert([{ name, description }])
        .select();
      
      if (error) throw error;
      return data[0];
    } catch (error: any) {
      console.error('Error creating specialty:', error.message);
      const specs = storage.get('hms_settings_specialties', ['Surgery', 'Consultation', 'Emergency', 'Diagnostics']);
      if (!specs.includes(name)) {
        specs.push(name);
        storage.set('hms_settings_specialties', specs);
      }
      return { id: `spec-${Date.now()}`, name, description };
    }
  },

  deleteSpecialty: async (name: string) => {
    try {
      const { error } = await supabase
        .from('specialties')
        .delete()
        .eq('name', name);
      
      if (error) throw error;
      return true;
    } catch (error: any) {
      console.error('Error deleting specialty:', error.message);
      const specs = storage.get('hms_settings_specialties', ['Surgery', 'Consultation', 'Emergency', 'Diagnostics']);
      const filtered = specs.filter((s: string) => s !== name);
      storage.set('hms_settings_specialties', filtered);
      return true;
    }
  },

  // Maternity
  getDeliveries: async () => {
    try {
      const { data, error } = await supabase
        .from('maternity_deliveries')
        .select('*, patients(name, mrn), profiles:surgeon_id(name)')
        .order('delivery_date', { ascending: false });
      
      if (error) throw error;
      return data;
    } catch (error: any) {
      console.warn('Handling local fallback for deliveries:', error.message);
      const list = storage.get('hms_maternity_deliveries', []);
      const patients = storage.get('hms_patients', []);
      const enriched = list.map((item: any) => {
        const pt = patients.find((p: any) => p.id === item.patient_id);
        return {
          ...item,
          patients: pt ? { name: pt.name, mrn: pt.mrn } : { name: 'Unknown Mother', mrn: 'MRN-???' }
        };
      });
      return enriched;
    }
  },

  createDelivery: async (delivery: any) => {
    try {
      const { data, error } = await supabase
        .from('maternity_deliveries')
        .insert([delivery])
        .select();
      
      if (error) throw error;
      return data[0];
    } catch (error: any) {
      console.warn('Handling local fallback for create delivery:', error.message);
      const list = storage.get('hms_maternity_deliveries', []);
      const newD = {
        ...delivery,
        id: 'del-' + Math.random().toString(36).substring(2, 9),
        created_at: new Date().toISOString()
      };
      list.unshift(newD);
      storage.set('hms_maternity_deliveries', list);

      let weight = 3.2;
      let gender = 'male';
      const notes = delivery.notes || '';
      const weightMatch = notes.match(/weight:\s*([0-9.]+)/i);
      const genderMatch = notes.match(/gender:\s*(\w+)/i);
      if (weightMatch) weight = parseFloat(weightMatch[1]);
      if (genderMatch) gender = genderMatch[1].toLowerCase();

      const newborns = storage.get('hms_maternity_newborns', []);
      const newBaby = {
        id: 'newborn-' + Math.random().toString(36).substring(2, 9),
        mother_id: delivery.patient_id,
        birth_weight: weight,
        gender: gender.charAt(0).toUpperCase() + gender.slice(1),
        birth_date_time: (delivery.delivery_date && delivery.delivery_time) 
          ? `${delivery.delivery_date}T${delivery.delivery_time}` 
          : new Date().toISOString(),
        created_at: new Date().toISOString()
      };
      newborns.unshift(newBaby);
      storage.set('hms_maternity_newborns', newborns);

      return newD;
    }
  },

  getNewborns: async () => {
    try {
      const { data, error } = await supabase
        .from('maternity_newborns')
        .select('*, patients:mother_id(name, mrn)')
        .order('birth_date_time', { ascending: false });
      
      if (error) throw error;
      return data;
    } catch (error: any) {
      console.warn('Handling local fallback for newborns:', error.message);
      const list = storage.get('hms_maternity_newborns', []);
      const patients = storage.get('hms_patients', []);
      const enriched = list.map((item: any) => {
        const pt = patients.find((p: any) => p.id === item.mother_id);
        return {
          ...item,
          patients: pt ? { name: pt.name, mrn: pt.mrn } : { name: 'Unknown', mrn: '' }
        };
      });
      return enriched;
    }
  },

  deleteDelivery: async (id: string) => {
    try {
      const { error } = await supabase
        .from('maternity_deliveries')
        .delete()
        .eq('id', id);
      if (error) throw error;
      return true;
    } catch (error: any) {
      console.warn('Handling local fallback for delete delivery:', error.message);
      const list = storage.get('hms_maternity_deliveries', []);
      const filtered = list.filter((item: any) => item.id !== id);
      storage.set('hms_maternity_deliveries', filtered);
      return true;
    }
  },

  updateDelivery: async (id: string, updates: any) => {
    try {
      const { data, error } = await supabase
        .from('maternity_deliveries')
        .update(updates)
        .eq('id', id)
        .select();
      if (error) throw error;
      return data[0];
    } catch (error: any) {
      console.warn('Handling local fallback for update delivery:', error.message);
      const list = storage.get('hms_maternity_deliveries', []);
      const updated = list.map((item: any) => item.id === id ? { ...item, ...updates } : item);
      storage.set('hms_maternity_deliveries', updated);
      return { id, ...updates };
    }
  },

  deleteNewborn: async (id: string) => {
    try {
      const { error } = await supabase
        .from('maternity_newborns')
        .delete()
        .eq('id', id);
      if (error) throw error;
      return true;
    } catch (error: any) {
      console.warn('Handling local fallback for delete newborn:', error.message);
      const list = storage.get('hms_maternity_newborns', []);
      const filtered = list.filter((item: any) => item.id !== id);
      storage.set('hms_maternity_newborns', filtered);
      return true;
    }
  },

  // OT (Operation Theatre)
  getOTRooms: async () => {
    try {
      const { data, error } = await supabase
        .from('ot_rooms')
        .select('*')
        .order('name', { ascending: true });
      
      if (error) throw error;
      return data;
    } catch (error: any) {
      console.warn('Handling local fallback for OT rooms:', error.message);
      return storage.get('hms_ot_rooms', MOCK_THEATRES);
    }
  },

  getOTSchedules: async () => {
    try {
      const response = await supabase
        .from('ot_schedules')
        .select('*');
      
      if (response.error) throw response.error;
      
      // Sort in memory safely to handle database schema variations (e.g. scheduled_date vs surgery_date)
      const sortedData = (response.data || []).sort((a: any, b: any) => {
        const dateA = a.scheduled_date || a.surgery_date || a.date || '';
        const dateB = b.scheduled_date || b.surgery_date || b.date || '';
        return String(dateA).localeCompare(String(dateB));
      });
      
      return sortedData.map(mapOTScheduleFromPostgres);
    } catch (error: any) {
      console.warn('Handling local fallback for OT schedules:', error.message);
      const fallbackList = storage.get('hms_ot_schedules', []);
      return fallbackList.map(mapOTScheduleFromPostgres);
    }
  },

  createOTSchedule: async (schedule: any) => {
    try {
      const dbSchedule = cleanOTScheduleForPostgres(schedule);
      const { data, error } = await supabase
        .from('ot_schedules')
        .insert([dbSchedule])
        .select();
      
      if (error) {
        if (error.message && (error.message.includes('operation_name') || error.message.includes('schema cache'))) {
          console.warn('Retrying OT schedule insert without operation_name column:', error.message);
          const fallbackDbSchedule = { ...dbSchedule };
          if (fallbackDbSchedule.operation_name && !fallbackDbSchedule.procedure_name) {
            fallbackDbSchedule.procedure_name = fallbackDbSchedule.operation_name;
          }
          delete fallbackDbSchedule.operation_name;
          
          const retryRes = await supabase
            .from('ot_schedules')
            .insert([fallbackDbSchedule])
            .select();
            
          if (!retryRes.error && retryRes.data && retryRes.data[0]) {
            return mapOTScheduleFromPostgres(retryRes.data[0]);
          }
          if (retryRes.error) throw retryRes.error;
        }
        throw error;
      }
      return mapOTScheduleFromPostgres(data[0]);
    } catch (error: any) {
      console.warn('Handling local fallback for create OT schedule:', error.message);
      const list = storage.get('hms_ot_schedules', []);
      const newSchedule = {
        ...schedule,
        id: schedule.id || 'ot-sch-' + Math.random().toString(36).substring(2, 9),
        created_at: new Date().toISOString()
      };
      list.push(newSchedule);
      storage.set('hms_ot_schedules', list);
      return mapOTScheduleFromPostgres(newSchedule);
    }
  },

  deleteOTRecord: async (id: string) => {
    try {
      const { error } = await supabase
        .from('ot_schedules')
        .delete()
        .eq('id', id);
      
      if (error) throw error;
      return true;
    } catch (error: any) {
      console.warn('Handling local fallback for delete OT record:', error.message);
      const list = storage.get('hms_ot_schedules', []);
      const filtered = list.filter((item: any) => item.id !== id);
      storage.set('hms_ot_schedules', filtered);
      return true;
    }
  },

  // Insurance
  getInsuranceClaims: async () => {
    try {
      const { data, error } = await supabase
        .from('insurance_claims')
        .select('*, patients(name, mrn)')
        .order('created_at', { ascending: false });
      
      if (error) throw error;
      return data;
    } catch (error: any) {
      console.warn('Handling local fallback for insurance claims:', error.message);
      return storage.get(STORAGE_KEYS.INSURANCE, []);
    }
  },

  createInsuranceClaim: async (claim: any) => {
    try {
      const { data, error } = await supabase
        .from('insurance_claims')
        .insert([claim])
        .select();
      
      if (error) throw error;
      return data[0];
    } catch (error: any) {
      console.warn('Handling local fallback for create insurance claim:', error.message);
      const claims = storage.get(STORAGE_KEYS.INSURANCE, []);
      const newClaim = { 
        ...claim, 
        id: claim.id || 'claim-' + Math.random().toString(36).substring(2, 9),
        created_at: new Date().toISOString()
      };
      claims.unshift(newClaim);
      storage.set(STORAGE_KEYS.INSURANCE, claims);
      return newClaim;
    }
  },

  deleteInsuranceClaim: async (id: string) => {
    try {
      const { error } = await supabase
        .from('insurance_claims')
        .delete()
        .eq('id', id);
      
      if (error) throw error;
      return true;
    } catch (error: any) {
      console.warn('Handling local fallback for delete insurance claim:', error.message);
      const claims = storage.get(STORAGE_KEYS.INSURANCE, []);
      const filtered = claims.filter((c: any) => c.id !== id);
      storage.set(STORAGE_KEYS.INSURANCE, filtered);
      return true;
    }
  },

  // Nursing Station
  getNursingTasks: async (ward?: string) => {
    try {
      let query = supabase
        .from('nursing_notes')
        .select('*, patients(name, mrn, age, gender)');
      
      if (ward) {
        // Since there's no ward column in nursing_notes usually, 
        // we might need to join with admissions or beds if we want to filter by ward
        // For now, let's just return all notes
      }
      
      const { data, error } = await query.order('created_at', { ascending: false });
      
      if (error) throw error;
      return data;
    } catch (error: any) {
      console.warn('Error fetching nursing tasks, falling back to local storage:', error.message);
      return storage.get(STORAGE_KEYS.NURSING_TASKS, MOCK_NURSING_TASKS);
    }
  },

  getNurseShifts: async () => {
    try {
      const { data, error } = await supabase
        .from('nurse_shifts')
        .select('*')
        .order('created_at', { ascending: false });
      
      if (error) throw error;
      return data;
    } catch (error: any) {
      console.warn('Handling local fallback for nurse shifts:', error.message);
      return storage.get('hms_nurse_shifts', MOCK_NURSE_SHIFTS);
    }
  },

  updateNursingTask: async (id: string, updates: any) => {
    try {
      const { data, error } = await supabase
        .from('nursing_notes')
        .update(updates)
        .eq('id', id)
        .select();
      
      if (error) throw error;
      return data[0];
    } catch (error: any) {
      console.warn('Error updating nursing task, falling back to local storage:', error.message);
      const list = storage.get(STORAGE_KEYS.NURSING_TASKS, MOCK_NURSING_TASKS);
      const target = list.find((t: any) => t.id === id);
      const updatedItem = {
        ...(target || {}),
        ...updates
      };
      const updated = list.map((t: any) => t.id === id ? updatedItem : t);
      storage.set(STORAGE_KEYS.NURSING_TASKS, updated);
      return updatedItem;
    }
  },

  deleteNursingTask: async (id: string) => {
    try {
      const { error } = await supabase
        .from('nursing_notes')
        .delete()
        .eq('id', id);
      
      if (error) throw error;
      return true;
    } catch (error: any) {
      console.warn('Error deleting nursing task, falling back to local storage:', error.message);
      const list = storage.get(STORAGE_KEYS.NURSING_TASKS, MOCK_NURSING_TASKS);
      const filtered = list.filter((t: any) => t.id !== id);
      storage.set(STORAGE_KEYS.NURSING_TASKS, filtered);
      return true;
    }
  },

  createNursingTask: async (task: any) => {
    try {
      const { data, error } = await supabase
        .from('nursing_notes')
        .insert([task])
        .select();
      
      if (error) throw error;
      return data[0];
    } catch (error: any) {
      console.warn('Error creating nursing task, falling back to local storage:', error.message);
      const list = storage.get(STORAGE_KEYS.NURSING_TASKS, MOCK_NURSING_TASKS);
      const newTask = {
        ...task,
        id: task.id || 'nt-' + Date.now(),
        created_at: new Date().toISOString()
      };
      list.unshift(newTask);
      storage.set(STORAGE_KEYS.NURSING_TASKS, list);
      return newTask;
    }
  },

  getNursingHandovers: async (ward?: string) => {
    try {
      let query = supabase
        .from('nursing_handovers')
        .select('*, outgoing_nurse:outgoing_nurse_id(name), incoming_nurse:incoming_nurse_id(name)');
      
      if (ward) {
        query = query.eq('ward', ward);
      }
      
      const { data, error } = await query.order('created_at', { ascending: false });
      
      if (error) throw error;
      return data;
    } catch (error: any) {
      console.warn('Error fetching handovers, falling back to local storage:', error.message);
      return storage.get('hms_nursing_handovers', []);
    }
  },

  createNursingHandover: async (handover: any) => {
    try {
      const { data, error } = await supabase
        .from('nursing_handovers')
        .insert([handover])
        .select();
      
      if (error) throw error;
      return data[0];
    } catch (error: any) {
      console.warn('Error creating handover, falling back to local storage:', error.message);
      const list = storage.get('hms_nursing_handovers', []);
      const newH = {
        ...handover,
        id: handover.id || 'hnd-' + Date.now(),
        created_at: new Date().toISOString()
      };
      list.unshift(newH);
      storage.set('hms_nursing_handovers', list);
      return newH;
    }
  },

  // Expenses
  getExpenses: async () => {
    try {
      const { data, error } = await supabase
        .from('expenses')
        .select('*')
        .order('expense_date', { ascending: false });
      
      if (error) throw error;
      return data;
    } catch (error: any) {
      console.warn('Error fetching expenses, falling back to local storage:', error.message);
      const defaultExpenses = [
        {
          id: 'exp-1',
          expense_date: new Date().toISOString().split('T')[0],
          category: 'Utilities',
          description: 'Monthly electricity bill',
          amount: 14500,
          status: 'Paid',
          created_by: 'u2'
        },
        {
          id: 'exp-2',
          expense_date: new Date(Date.now() - 86400000).toISOString().split('T')[0],
          category: 'Medical Supplies',
          description: 'Surgical gloves & syringes batch',
          amount: 32000,
          status: 'Paid',
          created_by: 'u-accounts'
        },
        {
          id: 'exp-3',
          expense_date: new Date(Date.now() - 3 * 86400000).toISOString().split('T')[0],
          category: 'Salaries',
          description: 'Part-time nursing staff payout',
          amount: 75000,
          status: 'Paid',
          created_by: 'u2'
        }
      ];
      return storage.get(STORAGE_KEYS.EXPENSES, defaultExpenses);
    }
  },

  createExpense: async (expense: any) => {
    try {
      const { data, error } = await supabase
        .from('expenses')
        .insert([expense])
        .select();
      
      if (error) throw error;
      return data[0];
    } catch (error: any) {
      console.warn('Error creating expense, falling back to local storage:', error.message);
      const defaultExpenses = [
        {
          id: 'exp-1',
          expense_date: new Date().toISOString().split('T')[0],
          category: 'Utilities',
          description: 'Monthly electricity bill',
          amount: 14500,
          status: 'Paid',
          created_by: 'u2'
        },
        {
          id: 'exp-2',
          expense_date: new Date(Date.now() - 86400000).toISOString().split('T')[0],
          category: 'Medical Supplies',
          description: 'Surgical gloves & syringes batch',
          amount: 32000,
          status: 'Paid',
          created_by: 'u-accounts'
        },
        {
          id: 'exp-3',
          expense_date: new Date(Date.now() - 3 * 86400000).toISOString().split('T')[0],
          category: 'Salaries',
          description: 'Part-time nursing staff payout',
          amount: 75000,
          status: 'Paid',
          created_by: 'u2'
        }
      ];
      const list = storage.get(STORAGE_KEYS.EXPENSES, defaultExpenses);
      const newExp = {
        ...expense,
        id: expense.id || 'exp-' + Date.now(),
        expense_date: expense.expense_date || new Date().toISOString().split('T')[0],
        status: expense.status || 'Paid',
        created_at: new Date().toISOString()
      };
      list.unshift(newExp);
      storage.set(STORAGE_KEYS.EXPENSES, list);
      return newExp;
    }
  },

  deleteExpense: async (id: string) => {
    try {
      const { error } = await supabase
        .from('expenses')
        .delete()
        .eq('id', id);
      
      if (error) throw error;
      return true;
    } catch (error: any) {
      console.warn('Error deleting expense, falling back to local storage:', error.message);
      const defaultExpenses = [
        {
          id: 'exp-1',
          expense_date: new Date().toISOString().split('T')[0],
          category: 'Utilities',
          description: 'Monthly electricity bill',
          amount: 14500,
          status: 'Paid',
          created_by: 'u2'
        },
        {
          id: 'exp-2',
          expense_date: new Date(Date.now() - 86400000).toISOString().split('T')[0],
          category: 'Medical Supplies',
          description: 'Surgical gloves & syringes batch',
          amount: 32000,
          status: 'Paid',
          created_by: 'u-accounts'
        },
        {
          id: 'exp-3',
          expense_date: new Date(Date.now() - 3 * 86400000).toISOString().split('T')[0],
          category: 'Salaries',
          description: 'Part-time nursing staff payout',
          amount: 75000,
          status: 'Paid',
          created_by: 'u2'
        }
      ];
      const list = storage.get(STORAGE_KEYS.EXPENSES, defaultExpenses);
      const filtered = list.filter((e: any) => e.id !== id);
      storage.set(STORAGE_KEYS.EXPENSES, filtered);
      return true;
    }
  },

  updateExpense: async (id: string, updates: any) => {
    try {
      const { data, error } = await supabase
        .from('expenses')
        .update(updates)
        .eq('id', id)
        .select();
      
      if (error) throw error;
      return data[0];
    } catch (error: any) {
      console.warn('Error updating expense, falling back to local storage:', error.message);
      const defaultExpenses = [
        {
          id: 'exp-1',
          expense_date: new Date().toISOString().split('T')[0],
          category: 'Utilities',
          description: 'Monthly electricity bill',
          amount: 14500,
          status: 'Paid',
          created_by: 'u2'
        },
        {
          id: 'exp-2',
          expense_date: new Date(Date.now() - 86400000).toISOString().split('T')[0],
          category: 'Medical Supplies',
          description: 'Surgical gloves & syringes batch',
          amount: 32000,
          status: 'Paid',
          created_by: 'u-accounts'
        },
        {
          id: 'exp-3',
          expense_date: new Date(Date.now() - 3 * 86400000).toISOString().split('T')[0],
          category: 'Salaries',
          description: 'Part-time nursing staff payout',
          amount: 75000,
          status: 'Paid',
          created_by: 'u2'
        }
      ];
      const list = storage.get(STORAGE_KEYS.EXPENSES, defaultExpenses);
      const target = list.find((e: any) => e.id === id);
      const updatedItem = {
        ...(target || {}),
        ...updates
      };
      const updated = list.map((e: any) => e.id === id ? updatedItem : e);
      storage.set(STORAGE_KEYS.EXPENSES, updated);
      return updatedItem;
    }
  },

  // Beds
  getBeds: async () => {
    try {
      const { data, error } = await supabase
        .from('beds')
        .select('*')
        .order('bed_number', { ascending: true });
      
      if (error) throw error;
      return (data || []).map(normalizeBed);
    } catch (error: any) {
      console.warn('Error fetching beds, falling back to local storage:', error.message);
      return (storage.get(STORAGE_KEYS.BEDS, MOCK_BEDS) || []).map(normalizeBed);
    }
  },

  createBed: async (bed: any) => {
    try {
      const { data, error } = await supabase
        .from('beds')
        .insert([bed])
        .select();
      
      if (error) throw error;
      return normalizeBed(data[0]);
    } catch (error: any) {
      console.warn('Handling local fallback for create bed:', error.message);
      const list = storage.get(STORAGE_KEYS.BEDS, MOCK_BEDS);
      const newBedItem = normalizeBed({
        id: 'bed-' + Date.now(),
        bed_number: bed.bed_number || bed.number,
        number: bed.bed_number || bed.number,
        ward: bed.ward,
        bed_type: bed.bed_type || bed.type || 'General',
        type: bed.bed_type || bed.type || 'General',
        status: bed.status || 'Available'
      });
      list.push(newBedItem);
      storage.set(STORAGE_KEYS.BEDS, list);
      return newBedItem;
    }
  },

  updateBedStatus: async (id: string, status: string, patientId?: string | null) => {
    try {
      const { data, error } = await supabase
        .from('beds')
        .update({ status, patient_id: patientId })
        .eq('id', id)
        .select();
      
      if (error) throw error;
      return normalizeBed(data[0]);
    } catch (error: any) {
      console.warn('Handling local fallback for update bed status:', error.message);
      const list = storage.get(STORAGE_KEYS.BEDS, MOCK_BEDS);
      const target = list.find((b: any) => b.id === id);
      const updatedItem: any = normalizeBed({
        ...(target || {}),
        id,
        status,
        patient_id: patientId || null,
        patientId: patientId || null
      });
      const updated = list.map((b: any) => b.id === id ? updatedItem : b);
      if (!target && id) {
        updated.push(updatedItem);
      }
      storage.set(STORAGE_KEYS.BEDS, updated);
      return updatedItem;
    }
  },

  deleteBed: async (id: string) => {
    try {
      const { error } = await supabase
        .from('beds')
        .delete()
        .eq('id', id);
      
      if (error) throw error;
      return true;
    } catch (error: any) {
      console.error('Error deleting bed:', error.message);
      return false;
    }
  },

  // Admissions
  getAdmissions: async () => {
    try {
      const { data, error } = await supabase
        .from('admissions')
        .select('*')
        .order('admission_date', { ascending: false });
      
      if (error) throw error;
      return data?.map((a: any) => ({
        ...a,
        urgency: a.urgency || a.reason || 'Routine',
        reason: a.reason || '',
        diagnosis: a.diagnosis || a.reason || ''
      })) || [];
    } catch (error: any) {
      console.warn('Handling local fallback for admissions:', error.message);
      return storage.get('hms_admissions', []);
    }
  },

  createAdmission: async (admission: any) => {
    try {
      const dbAdmission = {
        ...admission,
        reason: admission.reason || admission.diagnosis || admission.urgency || 'Routine'
      };
      
      const data = await selfHealingQuery('insert', 'admissions', dbAdmission);
      if (data && data[0]) {
        const a = data[0];
        return {
          ...a,
          urgency: a.urgency || a.reason || 'Routine',
          reason: a.reason || '',
          diagnosis: a.diagnosis || a.reason || ''
        };
      }
      return null;
    } catch (error: any) {
      console.warn('Database admission creation error, falling back to local cache:', error.message);
      const list = storage.get('hms_admissions', []);
      const newD = {
        ...admission,
        id: admission.id || 'adm-' + Math.random().toString(36).substring(2, 9),
        admission_date: admission.admission_date || new Date().toISOString(),
        created_at: new Date().toISOString(),
        status: admission.status || 'Admitted'
      };
      list.unshift(newD);
      storage.set('hms_admissions', list);
      return newD;
    }
  },

  dischargePatient: async (admissionId: string, dischargeDate: string) => {
    try {
      const { data, error } = await supabase
        .from('admissions')
        .update({ status: 'Discharged', discharge_date: dischargeDate })
        .eq('id', admissionId)
        .select();
      
      if (error) throw error;
      return data[0];
    } catch (error: any) {
      console.warn('Handling local fallback for discharge patient:', error.message);
      const list = storage.get('hms_admissions', []);
      const updated = list.map((item: any) => {
        if (item.id === admissionId) {
          return { ...item, status: 'Discharged', discharge_date: dischargeDate };
        }
        return item;
      });
      storage.set('hms_admissions', updated);
      return updated.find((item: any) => item.id === admissionId) || null;
    }
  },

  getDischargeSummaries: async () => {
    try {
      const { data, error } = await supabase
        .from('discharge_summaries')
        .select('*')
        .order('discharge_date', { ascending: false });
      
      if (error) throw error;
      return data?.map(normalizeDischargeSummary) || [];
    } catch (error: any) {
      console.warn('Handling local fallback for discharge summaries:', error.message);
      return (storage.get('hms_discharge_summaries', []) || []).map(normalizeDischargeSummary);
    }
  },

  createDischargeSummary: async (summary: any) => {
    try {
      const dbSummary: any = {
        admission_id: summary.admissionId || summary.admission_id || null,
        patient_id: summary.patientId || summary.patient_id,
        discharge_type: summary.dischargeType || summary.discharge_type || 'Routine / Improved',
        follow_up_date: summary.followUpDate || summary.follow_up_date || null,
        medications: summary.medications || '',
        clinical_summary: summary.clinicalSummary || summary.clinical_summary || '',
        discharge_date: summary.dischargeDate || summary.discharge_date || new Date().toISOString(),
        discharge_by: summary.dischargeBy || summary.discharge_by || 'Dr. Rajesh Sharma'
      };
      
      if (summary.admissionDate || summary.admission_date) {
        dbSummary.admission_date = summary.admissionDate || summary.admission_date;
      }
      
      const data = await selfHealingQuery('insert', 'discharge_summaries', dbSummary);
      if (data && data[0]) {
        return normalizeDischargeSummary({
          ...summary,
          ...data[0]
        });
      }
      return null;
    } catch (error: any) {
      console.warn('Database discharge summary creation error, falling back to local cache:', error.message);
      const list = storage.get('hms_discharge_summaries', []);
      const newD = normalizeDischargeSummary({
        ...summary,
        id: summary.id || 'sum-' + Date.now(),
        dischargeDate: summary.dischargeDate || new Date().toISOString(),
        created_at: new Date().toISOString()
      });
      list.unshift(newD);
      storage.set('hms_discharge_summaries', list);
      return newD;
    }
  },

  // Vitals
  getPatientVitals: async (patientId?: string) => {
    try {
      let query = supabase
        .from('patient_vitals')
        .select('*');
      
      if (patientId) {
        query = query.eq('patient_id', patientId);
      }

      const { data, error } = await query.order('recorded_at', { ascending: false });
      
      if (error) throw error;
      return (data || []).map(mapVitalsFromPostgres);
    } catch (error: any) {
      console.warn('Error fetching vitals, falling back to local storage:', error.message);
      let localData = storage.get(STORAGE_KEYS.PATIENT_VITALS, MOCK_PATIENT_VITALS) || [];
      if (patientId) {
        localData = localData.filter((v: any) => v.patientId === patientId || v.patient_id === patientId);
      }
      return localData.map(mapVitalsFromPostgres);
    }
  },

  updateVitals: async (vitals: any) => {
    try {
      const dbVitals = cleanVitalsForPostgres(vitals);
      const data = await selfHealingQuery('insert', 'patient_vitals', dbVitals);
      return mapVitalsFromPostgres(data[0]);
    } catch (error: any) {
      console.warn('Error updating vitals, falling back to local storage:', error.message);
      const list = storage.get(STORAGE_KEYS.PATIENT_VITALS, MOCK_PATIENT_VITALS) || [];
      const newVital = mapVitalsFromPostgres({
        ...vitals,
        id: vitals.id || 'vital-' + Date.now(),
        recorded_at: vitals.recorded_at || vitals.lastUpdated || vitals.timestamp || new Date().toISOString()
      });
      list.unshift(newVital);
      storage.set(STORAGE_KEYS.PATIENT_VITALS, list);
      broadcastDataMutation('patient_vitals', 'insert');
      return newVital;
    }
  },

  // Clinical Notes
  getClinicalNotes: async (patientId: string) => {
    try {
      const { data, error } = await supabase
        .from('clinical_notes')
        .select('*, profiles(name)')
        .eq('patient_id', patientId)
        .order('created_at', { ascending: false });
      
      if (error) throw error;
      return data;
    } catch (error: any) {
      console.error('Error fetching clinical notes:', error.message);
      return null;
    }
  },

  createClinicalNote: async (note: any) => {
    try {
      const { data, error } = await supabase
        .from('clinical_notes')
        .insert([cleanUuidFields(note)])
        .select();
      
      if (error) throw error;
      return data[0];
    } catch (error: any) {
      console.warn('Handling local fallback for create clinical note:', error.message);
      const list = storage.get('hms_clinical_notes', []);
      const newNote = {
        ...note,
        id: 'note-' + Math.random().toString(36).substring(2, 9),
        created_at: new Date().toISOString()
      };
      list.unshift(newNote);
      storage.set('hms_clinical_notes', list);
      return newNote;
    }
  },

  deleteClinicalNote: async (id: string) => {
    try {
      const { error } = await supabase
        .from('clinical_notes')
        .delete()
        .eq('id', id);
      
      if (error) throw error;
      return true;
    } catch (error: any) {
      console.error('Error deleting clinical note:', error.message);
      const list = storage.get('hms_clinical_notes', []);
      const filtered = list.filter((n: any) => n.id !== id);
      storage.set('hms_clinical_notes', filtered);
      return true;
    }
  },

  // Pharmacy
  logInventoryTransaction: async (transaction: any) => {
    try {
      const { data, error } = await supabase
        .from('inventory_transactions')
        .insert([cleanUuidFields(transaction)])
        .select();
      
      if (error) throw error;
      return data[0];
    } catch (error: any) {
      console.error('Error logging inventory transaction:', error.message);
      return null;
    }
  },

  getPharmacyItems: async () => {
    try {
      const { data, error } = await supabase
        .from('pharmacy_items')
        .select('*')
        .order('name', { ascending: true });
      
      if (error) throw error;
      return (data || []).map(mapPharmacyItemFromPostgres);
    } catch (error: any) {
      console.error('Error fetching pharmacy items:', error.message);
      return null;
    }
  },

  createPharmacyItem: async (item: any) => {
    try {
      const dbItem = cleanPharmacyItemForPostgres(item);
      const data = await selfHealingQuery('insert', 'pharmacy_items', dbItem);
      
      const created = data && data[0] ? data[0] : item;
      if (created) {
        try {
          const config = {
            is_loose_sale_enabled: item.is_loose_sale_enabled,
            units_per_strip: item.units_per_strip === undefined ? 10 : item.units_per_strip,
            loose_selling_price: item.loose_selling_price === undefined ? 0 : item.loose_selling_price,
            loose_stock: item.loose_stock === undefined ? 0 : item.loose_stock
          };
          localStorage.setItem(`loose_config_${created.id || created.name}`, JSON.stringify(config));
        } catch (e) {}
      }
      
      return mapPharmacyItemFromPostgres(created);
    } catch (error: any) {
      console.error('Error creating pharmacy item:', error.message);
      return null;
    }
  },

  updatePharmacyItem: async (id: string, updates: any) => {
    try {
      // Save updates locally before database query in case database strips them
      try {
        const key = `loose_config_${id}`;
        const existingStr = localStorage.getItem(key);
        const existing = existingStr ? JSON.parse(existingStr) : {};
        const newConfig = {
          ...existing,
          ...(updates.is_loose_sale_enabled !== undefined ? { is_loose_sale_enabled: updates.is_loose_sale_enabled } : {}),
          ...(updates.units_per_strip !== undefined ? { units_per_strip: updates.units_per_strip } : {}),
          ...(updates.loose_selling_price !== undefined ? { loose_selling_price: updates.loose_selling_price } : {}),
          ...(updates.loose_stock !== undefined ? { loose_stock: updates.loose_stock } : {})
        };
        localStorage.setItem(key, JSON.stringify(newConfig));
      } catch (e) {}

      const dbUpdates = cleanPharmacyItemForPostgres(updates);
      const data = await selfHealingQuery('update', 'pharmacy_items', dbUpdates, id);
      return mapPharmacyItemFromPostgres(data && data[0] ? data[0] : { id, ...updates });
    } catch (error: any) {
      console.error('Error updating pharmacy item:', error.message);
      return null;
    }
  },

  deletePharmacyItem: async (id: string) => {
    try {
      const { error } = await supabase
        .from('pharmacy_items')
        .delete()
        .eq('id', id);
      
      if (error) throw error;
      return true;
    } catch (error: any) {
      console.error('Error deleting pharmacy item:', error.message);
      return false;
    }
  },

  // Dashboard Stats
  getDashboardStats: async () => {
    try {
      // Get counts and data from various tables in parallel
      const [patientRes, appointmentRes, admissionRes, revenueRes] = await Promise.all([
        supabase.from('patients').select('*', { count: 'exact', head: true }),
        supabase.from('appointments').select('*', { count: 'exact', head: true }),
        supabase.from('admissions').select('*', { count: 'exact', head: true }),
        supabase.from('invoices').select('paid_amount')
      ]);

      const patientCount = patientRes.count || 0;
      const appointmentCount = appointmentRes.count || 0;
      const admissionCount = admissionRes.count || 0;
      const revenueData = revenueRes.data || [];
      const totalRevenue = revenueData.reduce((sum, inv) => sum + (Number(inv.paid_amount) || 0), 0);

      return {
        patientCount,
        appointmentCount,
        admissionCount,
        totalRevenue
      };
    } catch (error: any) {
      console.error('Error fetching dashboard stats:', error.message);
      return null;
    }
  }
};

// Intercept and wrap for automatic real-time sync broadcast, connection timeout safety, and robust offline fallback!
let lastToastTime = 0;
const toastSlowConnection = () => {
  const now = Date.now();
  if (now - lastToastTime > 15000) {
    lastToastTime = now;
    toast.info('Live server response delayed. Switched to high-speed local database.', {
      description: 'The app remains fully functional. Your updates will sync locally.',
      duration: 5000,
    });
  }
};

const cacheConfig: Record<string, { storageKey: string; defaultVal: any }> = {
  getPatients: { storageKey: STORAGE_KEYS.PATIENTS, defaultVal: MOCK_PATIENTS },
  getAppointments: { storageKey: STORAGE_KEYS.APPOINTMENTS, defaultVal: MOCK_APPOINTMENTS },
  getPrescriptions: { storageKey: STORAGE_KEYS.PRESCRIPTIONS, defaultVal: MOCK_PRESCRIPTIONS },
  getInvoices: { storageKey: STORAGE_KEYS.BILLING, defaultVal: MOCK_BILLING },
  getLabTests: { storageKey: STORAGE_KEYS.LAB_RATES, defaultVal: MOCK_LAB_TESTS },
  getLabTestRequests: { storageKey: STORAGE_KEYS.LAB_TEST_ORDERS, defaultVal: [] },
  getRadiologyRecords: { storageKey: STORAGE_KEYS.RADIOLOGY_FILES, defaultVal: [] },
  getHospitalInfo: { storageKey: STORAGE_KEYS.HOSPITAL_INFO, defaultVal: { name: 'CureLine Medical Center', address: '456 Healthcare Blvd, Central City', phone: '+1 (555) 987-6543', email: 'contact@cureline.com', tax_no: 'TX-99887766', registration_no: 'REG-55443322' } },
  getStaff: { storageKey: STORAGE_KEYS.USERS, defaultVal: MOCK_USERS },
  getDeliveries: { storageKey: 'hms_maternity_deliveries', defaultVal: [] },
  getNewborns: { storageKey: 'hms_maternity_newborns', defaultVal: [] },
  getOTRooms: { storageKey: 'hms_ot_rooms', defaultVal: MOCK_THEATRES },
  getOTSchedules: { storageKey: 'hms_ot_schedules', defaultVal: MOCK_OPERATION_RECORDS },
  getInsuranceClaims: { storageKey: STORAGE_KEYS.INSURANCE, defaultVal: [] },
  getNursingTasks: { storageKey: STORAGE_KEYS.NURSING_TASKS, defaultVal: MOCK_NURSING_TASKS },
  getNurseShifts: { storageKey: 'hms_nurse_shifts', defaultVal: MOCK_NURSE_SHIFTS },
  getNursingHandovers: { storageKey: 'hms_nursing_handovers', defaultVal: [] },
  getExpenses: { storageKey: STORAGE_KEYS.EXPENSES, defaultVal: [] },
  getBeds: { storageKey: STORAGE_KEYS.BEDS, defaultVal: MOCK_BEDS },
  getAdmissions: { storageKey: 'hms_admissions', defaultVal: [] },
  getDischargeSummaries: { storageKey: 'hms_discharge_summaries', defaultVal: [] },
  getPatientVitals: { storageKey: STORAGE_KEYS.PATIENT_VITALS, defaultVal: MOCK_PATIENT_VITALS },
  getClinicalNotes: { storageKey: 'hms_clinical_notes', defaultVal: [] },
  getPharmacyItems: { storageKey: STORAGE_KEYS.INVENTORY, defaultVal: MOCK_INVENTORY },
  getPharmacySettings: { storageKey: 'hms_pharmacy_settings', defaultVal: DEFAULT_PHARMACY_SETTINGS },
  getAbdmLinks: { storageKey: 'hms_abdm_links', defaultVal: [] },
  getHprPractitioners: { storageKey: 'hms_abdm_hpr_docs', defaultVal: [] },
  getAbdmConsents: { storageKey: 'hms_abdm_consents', defaultVal: [] },
  getPmjayClaims: { storageKey: 'hms_pmjay_claims', defaultVal: [] },
  getAbdmAuditLogs: { storageKey: 'hms_abdm_audit_logs', defaultVal: [] },
};

function updateLocalCacheOnMutation(key: string, args: any[], result: any) {
  if (!result) return;
  const k = key.toLowerCase();
  
  try {
    if (key.startsWith('create') || key.startsWith('add') || key.startsWith('record') || key === 'updateVitals') {
      if (k.includes('patient')) {
        const list = storage.get(STORAGE_KEYS.PATIENTS, MOCK_PATIENTS);
        const filtered = list.filter((p: any) => p.id !== result.id && p.mrn !== result.mrn);
        filtered.unshift(result);
        storage.set(STORAGE_KEYS.PATIENTS, filtered);
      } else if (k.includes('staff') || k.includes('profile')) {
        const list = storage.get(STORAGE_KEYS.USERS, MOCK_USERS);
        const filtered = list.filter((u: any) => u.id !== result.id);
        filtered.unshift(result);
        storage.set(STORAGE_KEYS.USERS, filtered);
      } else if (k.includes('appointment')) {
        const list = storage.get(STORAGE_KEYS.APPOINTMENTS, MOCK_APPOINTMENTS);
        const filtered = list.filter((a: any) => a.id !== result.id);
        filtered.push(result);
        storage.set(STORAGE_KEYS.APPOINTMENTS, filtered);
      } else if (k.includes('prescription')) {
        const list = storage.get(STORAGE_KEYS.PRESCRIPTIONS, MOCK_PRESCRIPTIONS);
        const filtered = list.filter((p: any) => p.id !== result.id);
        filtered.unshift(result);
        storage.set(STORAGE_KEYS.PRESCRIPTIONS, filtered);
      } else if (k.includes('invoice')) {
        const list = storage.get(STORAGE_KEYS.BILLING, MOCK_BILLING);
        const filtered = list.filter((i: any) => i.id !== result.id);
        filtered.unshift(result);
        storage.set(STORAGE_KEYS.BILLING, filtered);
      } else if (k.includes('admission')) {
        const list = storage.get('hms_admissions', []);
        const filtered = list.filter((a: any) => a.id !== result.id);
        filtered.unshift(result);
        storage.set('hms_admissions', filtered);
      } else if (k.includes('discharge')) {
        const list = storage.get('hms_discharge_summaries', []);
        const filtered = list.filter((d: any) => d.id !== result.id);
        filtered.unshift(result);
        storage.set('hms_discharge_summaries', filtered);
      } else if (k.includes('vital')) {
        const list = storage.get(STORAGE_KEYS.PATIENT_VITALS, MOCK_PATIENT_VITALS);
        const filtered = list.filter((v: any) => v.id !== result.id);
        filtered.unshift(result);
        storage.set(STORAGE_KEYS.PATIENT_VITALS, filtered);
      } else if (k.includes('note')) {
        const list = storage.get('hms_clinical_notes', []);
        const filtered = list.filter((n: any) => n.id !== result.id);
        filtered.unshift(result);
        storage.set('hms_clinical_notes', filtered);
      } else if (k.includes('bed')) {
        const list = storage.get(STORAGE_KEYS.BEDS, MOCK_BEDS);
        const filtered = list.filter((b: any) => b.id !== result.id);
        filtered.push(result);
        storage.set(STORAGE_KEYS.BEDS, filtered);
      } else if (k.includes('ot_room') || k.includes('otroom')) {
        const list = storage.get('hms_ot_rooms', MOCK_THEATRES);
        const filtered = list.filter((r: any) => r.id !== result.id);
        filtered.push(result);
        storage.set('hms_ot_rooms', filtered);
      } else if (k.includes('otschedule') || k.includes('schedule')) {
        const list = storage.get('hms_ot_schedules', MOCK_OPERATION_RECORDS);
        const filtered = list.filter((s: any) => s.id !== result.id);
        filtered.unshift(result);
        storage.set('hms_ot_schedules', filtered);
      } else if (k.includes('shift')) {
        const list = storage.get('hms_nurse_shifts', MOCK_NURSE_SHIFTS);
        const filtered = list.filter((s: any) => s.id !== result.id);
        filtered.push(result);
        storage.set('hms_nurse_shifts', filtered);
      } else if (k.includes('handover')) {
        const list = storage.get('hms_nursing_handovers', []);
        const filtered = list.filter((h: any) => h.id !== result.id);
        filtered.unshift(result);
        storage.set('hms_nursing_handovers', filtered);
      } else if (k.includes('delivery')) {
        const list = storage.get('hms_maternity_deliveries', []);
        const filtered = list.filter((d: any) => d.id !== result.id);
        filtered.unshift(result);
        storage.set('hms_maternity_deliveries', filtered);
      } else if (k.includes('newborn')) {
        const list = storage.get('hms_maternity_newborns', []);
        const filtered = list.filter((n: any) => n.id !== result.id);
        filtered.unshift(result);
        storage.set('hms_maternity_newborns', filtered);
      } else if (k.includes('expense')) {
        const list = storage.get(STORAGE_KEYS.EXPENSES, []);
        const filtered = list.filter((e: any) => e.id !== result.id);
        filtered.unshift(result);
        storage.set(STORAGE_KEYS.EXPENSES, filtered);
      } else if (k.includes('claim')) {
        const list = storage.get(STORAGE_KEYS.INSURANCE, []);
        const filtered = list.filter((c: any) => c.id !== result.id);
        filtered.unshift(result);
        storage.set(STORAGE_KEYS.INSURANCE, filtered);
      } else if (k.includes('test') || k.includes('request')) {
        const list = storage.get(STORAGE_KEYS.LAB_TEST_ORDERS, []);
        const filtered = list.filter((t: any) => t.id !== result.id);
        filtered.unshift(result);
        storage.set(STORAGE_KEYS.LAB_TEST_ORDERS, filtered);
      } else if (k.includes('pharmacy') || k.includes('inventory')) {
        const list = storage.get(STORAGE_KEYS.INVENTORY, MOCK_INVENTORY);
        const filtered = list.filter((p: any) => p.id !== result.id);
        filtered.unshift(result);
        storage.set(STORAGE_KEYS.INVENTORY, filtered);
      }
    } else if (key.startsWith('update')) {
      const id = args[0];
      if (k.includes('pharmacysettings')) {
        storage.set('hms_pharmacy_settings', result);
      } else if (k.includes('invoice')) {
        const list = storage.get(STORAGE_KEYS.BILLING, MOCK_BILLING);
        const updated = list.map((i: any) => i.id === id ? { ...i, ...result } : i);
        storage.set(STORAGE_KEYS.BILLING, updated);

        if (result && result.invoice_items) {
          const itemsList = storage.get('hms_invoice_items', []);
          const filteredItems = itemsList.filter((it: any) => it.invoice_id !== id);
          const formattedItems = result.invoice_items.map((it: any) => ({
            ...it,
            invoice_id: id
          }));
          storage.set('hms_invoice_items', [...formattedItems, ...filteredItems]);
        }
      } else if (k.includes('staff') || k.includes('profile')) {
        const list = storage.get(STORAGE_KEYS.USERS, MOCK_USERS);
        const updated = list.map((u: any) => u.id === id ? { ...u, ...result } : u);
        storage.set(STORAGE_KEYS.USERS, updated);
      } else if (k.includes('bed')) {
        const list = storage.get(STORAGE_KEYS.BEDS, MOCK_BEDS);
        const updated = list.map((b: any) => b.id === result.id ? result : b);
        storage.set(STORAGE_KEYS.BEDS, updated);
      } else if (k.includes('patient')) {
        const list = storage.get(STORAGE_KEYS.PATIENTS, MOCK_PATIENTS);
        const updated = list.map((p: any) => p.id === result.id ? result : p);
        storage.set(STORAGE_KEYS.PATIENTS, updated);
      } else if (k.includes('appointment')) {
        const list = storage.get(STORAGE_KEYS.APPOINTMENTS, MOCK_APPOINTMENTS);
        const updated = list.map((p: any) => p.id === result.id ? result : p);
        storage.set(STORAGE_KEYS.APPOINTMENTS, updated);
      } else if (k.includes('admission')) {
        const list = storage.get('hms_admissions', []);
        const updated = list.map((p: any) => p.id === result.id ? result : p);
        storage.set('hms_admissions', updated);
      } else if (k.includes('pharmacy') || k.includes('inventory')) {
        const list = storage.get(STORAGE_KEYS.INVENTORY, MOCK_INVENTORY);
        const updated = list.map((p: any) => p.id === result.id ? result : p);
        storage.set(STORAGE_KEYS.INVENTORY, updated);
      } else if (k.includes('test') || k.includes('request')) {
        const list = storage.get(STORAGE_KEYS.LAB_TEST_ORDERS, []);
        const updated = list.map((t: any) => t.id === id ? { ...t, ...result } : t);
        storage.set(STORAGE_KEYS.LAB_TEST_ORDERS, updated);
      } else if (k.includes('radiology')) {
        const list = storage.get(STORAGE_KEYS.RADIOLOGY_FILES, []);
        const updated = list.map((r: any) => r.id === id ? { ...r, ...result } : r);
        storage.set(STORAGE_KEYS.RADIOLOGY_FILES, updated);
      }
    } else if (key.startsWith('delete')) {
      const id = args[0];
      if (k.includes('invoice')) {
        const list = storage.get(STORAGE_KEYS.BILLING, MOCK_BILLING);
        const filtered = list.filter((i: any) => i.id !== id);
        storage.set(STORAGE_KEYS.BILLING, filtered);
        
        const itemsList = storage.get('hms_invoice_items', []);
        const filteredItems = itemsList.filter((it: any) => it.invoice_id !== id);
        storage.set('hms_invoice_items', filteredItems);
      } else if (k.includes('patient')) {
        const list = storage.get(STORAGE_KEYS.PATIENTS, MOCK_PATIENTS);
        const filtered = list.filter((p: any) => p.id !== id);
        storage.set(STORAGE_KEYS.PATIENTS, filtered);
      } else if (k.includes('appointment')) {
        const list = storage.get(STORAGE_KEYS.APPOINTMENTS, MOCK_APPOINTMENTS);
        const filtered = list.filter((a: any) => a.id !== id);
        storage.set(STORAGE_KEYS.APPOINTMENTS, filtered);
      } else if (k.includes('bed')) {
        const list = storage.get(STORAGE_KEYS.BEDS, MOCK_BEDS);
        const filtered = list.filter((b: any) => b.id !== id);
        storage.set(STORAGE_KEYS.BEDS, filtered);
      } else if (k.includes('admission')) {
        const list = storage.get('hms_admissions', []);
        const filtered = list.filter((a: any) => a.id !== id);
        storage.set('hms_admissions', filtered);
      } else if (k.includes('prescription')) {
        const list = storage.get(STORAGE_KEYS.PRESCRIPTIONS, MOCK_PRESCRIPTIONS);
        const filtered = list.filter((p: any) => p.id !== id);
        storage.set(STORAGE_KEYS.PRESCRIPTIONS, filtered);
      } else if (k.includes('vital')) {
        const list = storage.get(STORAGE_KEYS.PATIENT_VITALS, MOCK_PATIENT_VITALS);
        const filtered = list.filter((v: any) => v.id !== id);
        storage.set(STORAGE_KEYS.PATIENT_VITALS, filtered);
      } else if (k.includes('note')) {
        const list = storage.get('hms_clinical_notes', []);
        const filtered = list.filter((n: any) => n.id !== id);
        storage.set('hms_clinical_notes', filtered);
      } else if (k.includes('expense')) {
        const list = storage.get(STORAGE_KEYS.EXPENSES, []);
        const filtered = list.filter((e: any) => e.id !== id);
        storage.set(STORAGE_KEYS.EXPENSES, filtered);
      } else if (k.includes('claim')) {
        const list = storage.get(STORAGE_KEYS.INSURANCE, []);
        const filtered = list.filter((c: any) => c.id !== id);
        storage.set(STORAGE_KEYS.INSURANCE, filtered);
      } else if (k.includes('schedule') || k.includes('ot_schedule')) {
        const list = storage.get('hms_ot_schedules', MOCK_OPERATION_RECORDS);
        const filtered = list.filter((s: any) => s.id !== id);
        storage.set('hms_ot_schedules', filtered);
      } else if (k.includes('delivery')) {
        const list = storage.get('hms_maternity_deliveries', []);
        const filtered = list.filter((d: any) => d.id !== id);
        storage.set('hms_maternity_deliveries', filtered);
      } else if (k.includes('newborn')) {
        const list = storage.get('hms_maternity_newborns', []);
        const filtered = list.filter((n: any) => n.id !== id);
        storage.set('hms_maternity_newborns', filtered);
      } else if (k.includes('shift')) {
        const list = storage.get('hms_nurse_shifts', MOCK_NURSE_SHIFTS);
        const filtered = list.filter((s: any) => s.id !== id);
        storage.set('hms_nurse_shifts', filtered);
      } else if (k.includes('pharmacy') || k.includes('inventory')) {
        const list = storage.get(STORAGE_KEYS.INVENTORY, MOCK_INVENTORY);
        const filtered = list.filter((p: any) => p.id !== id);
        storage.set(STORAGE_KEYS.INVENTORY, filtered);
      }
    }
  } catch (err) {
    console.warn('Error updating local cache on mutation:', err);
  }
}

function executeOfflineMutation(key: string, args: any[]): any {
  const k = key.toLowerCase();
  
  try {
    if (key.startsWith('create') || key.startsWith('add') || key.startsWith('record') || key === 'updateVitals') {
      const item = args[0] || {};
      if (!item.id) {
        item.id = 'off-' + Math.random().toString(36).substring(2, 9);
      }
      if (!item.created_at) {
        item.created_at = new Date().toISOString();
      }

      if (k.includes('patient')) {
        const list = storage.get(STORAGE_KEYS.PATIENTS, MOCK_PATIENTS);
        list.unshift(item);
        storage.set(STORAGE_KEYS.PATIENTS, list);
      } else if (k.includes('appointment')) {
        const list = storage.get(STORAGE_KEYS.APPOINTMENTS, MOCK_APPOINTMENTS);
        list.push(item);
        storage.set(STORAGE_KEYS.APPOINTMENTS, list);
        
        try {
          const aptType = (item.type || '').toUpperCase();
          if (aptType === 'LAB' || aptType === 'LABORATORY') {
            const labList = storage.get(STORAGE_KEYS.LAB_TEST_ORDERS, []);
            labList.unshift({
              id: 'off-req-' + Math.random().toString(36).substring(2, 9),
              patient_id: item.patient_id || item.patientId,
              test_name: 'Complete Blood Count (CBC) [From Appointment]',
              status: 'Ordered',
              reference_range: '12.0 - 17.0 g/dL',
              unit: 'g/dL',
              urgency: item.urgency || 'routine',
              requested_at: new Date().toISOString()
            });
            storage.set(STORAGE_KEYS.LAB_TEST_ORDERS, labList);
            broadcastDataMutation('test_requests', 'insert');
          } else if (aptType === 'RADIOLOGY') {
            const radList = storage.get(STORAGE_KEYS.RADIOLOGY_FILES, []);
            radList.unshift({
              id: 'off-rad-' + Math.random().toString(36).substring(2, 9),
              patient_id: item.patient_id || item.patientId,
              test_name: 'Chest X-Ray [From Appointment]',
              status: 'Ordered',
              urgency: item.urgency || 'routine',
              requested_at: new Date().toISOString()
            });
            storage.set(STORAGE_KEYS.RADIOLOGY_FILES, radList);
            broadcastDataMutation('radiology_records', 'insert');
          }
        } catch (e: any) {
          console.warn('Silent local fallback appointment mapping failure:', e.message);
        }
      } else if (k.includes('prescription')) {
        const list = storage.get(STORAGE_KEYS.PRESCRIPTIONS, MOCK_PRESCRIPTIONS);
        list.unshift(item);
        storage.set(STORAGE_KEYS.PRESCRIPTIONS, list);
      } else if (k.includes('invoice')) {
        const list = storage.get(STORAGE_KEYS.BILLING, MOCK_BILLING);
        list.unshift(item);
        storage.set(STORAGE_KEYS.BILLING, list);
        if (args[1]) {
          const itemsList = storage.get('hms_invoice_items', []);
          const formattedItems = args[1].map((it: any) => ({ ...it, id: 'item-' + Math.random(), invoice_id: item.id }));
          storage.set('hms_invoice_items', [...formattedItems, ...itemsList]);
        }
      } else if (k.includes('admission')) {
        const list = storage.get('hms_admissions', []);
        list.unshift(item);
        storage.set('hms_admissions', list);
      } else if (k.includes('vital')) {
        const list = storage.get(STORAGE_KEYS.PATIENT_VITALS, MOCK_PATIENT_VITALS);
        list.unshift(item);
        storage.set(STORAGE_KEYS.PATIENT_VITALS, list);
      } else if (k.includes('note')) {
        const list = storage.get('hms_clinical_notes', []);
        list.unshift(item);
        storage.set('hms_clinical_notes', list);
      } else if (k.includes('otschedule') || k.includes('schedule')) {
        const list = storage.get('hms_ot_schedules', MOCK_OPERATION_RECORDS);
        list.unshift(item);
        storage.set('hms_ot_schedules', list);
      } else if (k.includes('claim')) {
        const list = storage.get(STORAGE_KEYS.INSURANCE, []);
        list.unshift(item);
        storage.set(STORAGE_KEYS.INSURANCE, list);
      } else if (k.includes('expense')) {
        const list = storage.get(STORAGE_KEYS.EXPENSES, []);
        list.unshift(item);
        storage.set(STORAGE_KEYS.EXPENSES, list);
      } else if (k.includes('test') || k.includes('request')) {
        const list = storage.get(STORAGE_KEYS.LAB_TEST_ORDERS, []);
        list.unshift(item);
        storage.set(STORAGE_KEYS.LAB_TEST_ORDERS, list);
      } else if (k.includes('delivery')) {
        const list = storage.get('hms_maternity_deliveries', []);
        list.unshift(item);
        storage.set('hms_maternity_deliveries', list);
      } else if (k.includes('newborn')) {
        const list = storage.get('hms_maternity_newborns', []);
        list.unshift(item);
        storage.set('hms_maternity_newborns', list);
      } else if (k.includes('bed')) {
        const list = storage.get(STORAGE_KEYS.BEDS, MOCK_BEDS);
        list.push(item);
        storage.set(STORAGE_KEYS.BEDS, list);
      } else if (k.includes('ot_room') || k.includes('otroom')) {
        const list = storage.get('hms_ot_rooms', MOCK_THEATRES);
        list.push(item);
        storage.set('hms_ot_rooms', list);
      } else if (k.includes('shift')) {
        const list = storage.get('hms_nurse_shifts', MOCK_NURSE_SHIFTS);
        list.push(item);
        storage.set('hms_nurse_shifts', list);
      } else if (k.includes('handover')) {
        const list = storage.get('hms_nursing_handovers', []);
        list.unshift(item);
        storage.set('hms_nursing_handovers', list);
      } else if (k.includes('staff') || k.includes('profile')) {
        const list = storage.get(STORAGE_KEYS.USERS, MOCK_USERS);
        list.unshift(item);
        storage.set(STORAGE_KEYS.USERS, list);
      } else if (k === 'loginventorytransaction') {
        const list = storage.get('hms_inventory_transactions', []);
        list.unshift(item);
        storage.set('hms_inventory_transactions', list);
      } else if (k.includes('pharmacy') || k.includes('inventory')) {
        const list = storage.get(STORAGE_KEYS.INVENTORY, MOCK_INVENTORY);
        list.unshift(item);
        storage.set(STORAGE_KEYS.INVENTORY, list);
      }
      
      let concept = 'general';
      if (k.includes('patient')) concept = 'patients';
      else if (k.includes('appointment')) concept = 'appointments';
      else if (k.includes('bed')) concept = 'beds';
      else if (k.includes('staff') || k.includes('profile')) concept = 'profiles';
      broadcastDataMutation(concept, 'insert');
      return item;
    }

    if (key.startsWith('update')) {
      const id = args[0];
      const updates = args[1] || {};

      let concept = 'general';
      if (k.includes('patient')) concept = 'patients';
      else if (k.includes('appointment')) concept = 'appointments';
      else if (k.includes('invoice')) concept = 'billing';
      else if (k.includes('bed')) concept = 'beds';
      else if (k.includes('admission')) concept = 'admissions';
      else if (k.includes('staff') || k.includes('profile')) concept = 'profiles';
      else if (k.includes('pharmacy') || k.includes('inventory')) concept = 'pharmacy_items';

      if (k.includes('invoice')) {
        const list = storage.get(STORAGE_KEYS.BILLING, MOCK_BILLING);
        const index = list.findIndex((i: any) => i.id === id);
        let updatedBill = null;
        if (index !== -1) {
          list[index] = { ...list[index], ...updates };
          if (args[2]) {
            const itemsList = storage.get('hms_invoice_items', []);
            const filteredItems = itemsList.filter((it: any) => it.invoice_id !== id);
            const formattedItems = args[2].map((it: any) => ({
              ...it,
              id: it.id || 'item-' + Math.random(),
              invoice_id: id
            }));
            storage.set('hms_invoice_items', [...formattedItems, ...filteredItems]);
            (list[index] as any).invoice_items = formattedItems;
          }
          storage.set(STORAGE_KEYS.BILLING, list);
          broadcastDataMutation('billing', 'update');
          updatedBill = list[index];
        } else {
          updatedBill = { id, ...updates };
        }
        return updatedBill;
      }

      if (k === 'updatebedstatus') {
        const status = args[1];
        const patientId = args[2];
        const list = storage.get(STORAGE_KEYS.BEDS, MOCK_BEDS);
        const updated = list.map((b: any) => {
          if (b.id === id) {
            return { 
              ...b, 
              status, 
              patient_id: patientId, 
              patientId: patientId 
            };
          }
          return b;
        });
        storage.set(STORAGE_KEYS.BEDS, updated);
        broadcastDataMutation('beds', 'update');
        return updated.find((b: any) => b.id === id);
      }

      if (k.includes('bed')) {
        const list = storage.get(STORAGE_KEYS.BEDS, MOCK_BEDS);
        const updated = list.map((b: any) => {
          if (b.id === id) {
            return { ...b, ...updates };
          }
          return b;
        });
        storage.set(STORAGE_KEYS.BEDS, updated);
        broadcastDataMutation('beds', 'update');
        return updated.find((b: any) => b.id === id) || { id, ...updates };
      }

      if (k.includes('patient')) {
        const list = storage.get(STORAGE_KEYS.PATIENTS, MOCK_PATIENTS);
        const index = list.findIndex((p: any) => p.id === id);
        if (index !== -1) {
          list[index] = { ...list[index], ...updates };
          storage.set(STORAGE_KEYS.PATIENTS, list);
          broadcastDataMutation('patients', 'update');
          return list[index];
        }
      }

      if (k.includes('appointment')) {
        const list = storage.get(STORAGE_KEYS.APPOINTMENTS, MOCK_APPOINTMENTS);
        const index = list.findIndex((a: any) => a.id === id);
        if (index !== -1) {
          list[index] = { ...list[index], ...updates };
          storage.set(STORAGE_KEYS.APPOINTMENTS, list);
          broadcastDataMutation('appointments', 'update');
          return list[index];
        }
      }

      if (k.includes('admission')) {
        const list = storage.get('hms_admissions', []);
        const index = list.findIndex((a: any) => a.id === id);
        if (index !== -1) {
          list[index] = { ...list[index], ...updates };
          storage.set('hms_admissions', list);
          broadcastDataMutation('admissions', 'update');
          return list[index];
        }
      }

      if (k.includes('staff') || k.includes('profile')) {
        const list = storage.get(STORAGE_KEYS.USERS, MOCK_USERS);
        const index = list.findIndex((u: any) => u.id === id);
        if (index !== -1) {
          list[index] = { ...list[index], ...updates };
          storage.set(STORAGE_KEYS.USERS, list);
          broadcastDataMutation('profiles', 'update');
          return list[index];
        }
      }

      if (k.includes('pharmacy') || k.includes('inventory')) {
        const list = storage.get(STORAGE_KEYS.INVENTORY, MOCK_INVENTORY);
        const index = list.findIndex((p: any) => p.id === id);
        if (index !== -1) {
          list[index] = { ...list[index], ...updates };
          storage.set(STORAGE_KEYS.INVENTORY, list);
          broadcastDataMutation('pharmacy_items', 'update');
          return list[index];
        }
      }

      if (k.includes('test') || k.includes('request')) {
        const list = storage.get(STORAGE_KEYS.LAB_TEST_ORDERS, []);
        const index = list.findIndex((r: any) => r.id === id);
        if (index !== -1) {
          list[index] = { ...list[index], ...updates };
          storage.set(STORAGE_KEYS.LAB_TEST_ORDERS, list);
          broadcastDataMutation('test_requests', 'update');
          return list[index];
        }
      }

      if (k.includes('expense')) {
        const list = storage.get(STORAGE_KEYS.EXPENSES, []);
        const index = list.findIndex((e: any) => e.id === id);
        if (index !== -1) {
          list[index] = { ...list[index], ...updates };
          storage.set(STORAGE_KEYS.EXPENSES, list);
          broadcastDataMutation('expenses', 'update');
          return list[index];
        }
      }
      
      broadcastDataMutation(concept, 'update');
      return { id, ...updates };
    }

    if (key.startsWith('delete')) {
      const id = args[0];
      if (k.includes('invoice')) {
        const list = storage.get(STORAGE_KEYS.BILLING, MOCK_BILLING);
        const filtered = list.filter((i: any) => i.id !== id);
        storage.set(STORAGE_KEYS.BILLING, filtered);
        
        const itemsList = storage.get('hms_invoice_items', []);
        const filteredItems = itemsList.filter((it: any) => it.invoice_id !== id);
        storage.set('hms_invoice_items', filteredItems);
        broadcastDataMutation('billing', 'delete');
      } else if (k.includes('patient')) {
        const list = storage.get(STORAGE_KEYS.PATIENTS, MOCK_PATIENTS);
        const filtered = list.filter((p: any) => p.id !== id);
        storage.set(STORAGE_KEYS.PATIENTS, filtered);
        broadcastDataMutation('patients', 'delete');
      } else if (k.includes('appointment')) {
        const list = storage.get(STORAGE_KEYS.APPOINTMENTS, MOCK_APPOINTMENTS);
        const filtered = list.filter((a: any) => a.id !== id);
        storage.set(STORAGE_KEYS.APPOINTMENTS, filtered);
        broadcastDataMutation('appointments', 'delete');
      } else if (k.includes('bed')) {
        const list = storage.get(STORAGE_KEYS.BEDS, MOCK_BEDS);
        const filtered = list.filter((b: any) => b.id !== id);
        storage.set(STORAGE_KEYS.BEDS, filtered);
        broadcastDataMutation('beds', 'delete');
      } else if (k.includes('admission')) {
        const list = storage.get('hms_admissions', []);
        const filtered = list.filter((a: any) => a.id !== id);
        storage.set('hms_admissions', filtered);
        broadcastDataMutation('admissions', 'delete');
      } else if (k.includes('prescription')) {
        const list = storage.get(STORAGE_KEYS.PRESCRIPTIONS, MOCK_PRESCRIPTIONS);
        const filtered = list.filter((p: any) => p.id !== id);
        storage.set(STORAGE_KEYS.PRESCRIPTIONS, filtered);
        broadcastDataMutation('prescriptions', 'delete');
      } else if (k.includes('vital')) {
        const list = storage.get(STORAGE_KEYS.PATIENT_VITALS, MOCK_PATIENT_VITALS);
        const filtered = list.filter((v: any) => v.id !== id);
        storage.set(STORAGE_KEYS.PATIENT_VITALS, filtered);
        broadcastDataMutation('patient_vitals', 'delete');
      } else if (k.includes('note')) {
        const list = storage.get('hms_clinical_notes', []);
        const filtered = list.filter((n: any) => n.id !== id);
        storage.set('hms_clinical_notes', filtered);
        broadcastDataMutation('nursing_notes', 'delete');
      } else if (k.includes('expense')) {
        const list = storage.get(STORAGE_KEYS.EXPENSES, []);
        const filtered = list.filter((e: any) => e.id !== id);
        storage.set(STORAGE_KEYS.EXPENSES, filtered);
        broadcastDataMutation('expenses', 'delete');
      } else if (k.includes('claim')) {
        const list = storage.get(STORAGE_KEYS.INSURANCE, []);
        const filtered = list.filter((c: any) => c.id !== id);
        storage.set(STORAGE_KEYS.INSURANCE, filtered);
        broadcastDataMutation('insurance_claims', 'delete');
      } else if (k.includes('schedule') || k.includes('ot_schedule')) {
        const list = storage.get('hms_ot_schedules', MOCK_OPERATION_RECORDS);
        const filtered = list.filter((s: any) => s.id !== id);
        storage.set('hms_ot_schedules', filtered);
        broadcastDataMutation('ot_schedules', 'delete');
      } else if (k.includes('delivery')) {
        const list = storage.get('hms_maternity_deliveries', []);
        const filtered = list.filter((d: any) => d.id !== id);
        storage.set('hms_maternity_deliveries', filtered);
        broadcastDataMutation('deliveries', 'delete');
      } else if (k.includes('newborn')) {
        const list = storage.get('hms_maternity_newborns', []);
        const filtered = list.filter((n: any) => n.id !== id);
        storage.set('hms_maternity_newborns', filtered);
        broadcastDataMutation('newborns', 'delete');
      } else if (k.includes('shift')) {
        const list = storage.get('hms_nurse_shifts', MOCK_NURSE_SHIFTS);
        const filtered = list.filter((s: any) => s.id !== id);
        storage.set('hms_nurse_shifts', filtered);
        broadcastDataMutation('nurse_shifts', 'delete');
      } else if (k.includes('staff') || k.includes('profile')) {
        const list = storage.get(STORAGE_KEYS.USERS, MOCK_USERS);
        const filtered = list.filter((u: any) => u.id !== id);
        storage.set(STORAGE_KEYS.USERS, filtered);
        broadcastDataMutation('profiles', 'delete');
      } else if (k.includes('pharmacy') || k.includes('inventory')) {
        const list = storage.get(STORAGE_KEYS.INVENTORY, MOCK_INVENTORY);
        const filtered = list.filter((p: any) => p.id !== id);
        storage.set(STORAGE_KEYS.INVENTORY, filtered);
        broadcastDataMutation('pharmacy_items', 'delete');
      } else if (k.includes('test') || k.includes('request')) {
        const list = storage.get(STORAGE_KEYS.LAB_TEST_ORDERS, []);
        const filtered = list.filter((r: any) => r.id !== id);
        storage.set(STORAGE_KEYS.LAB_TEST_ORDERS, filtered);
        broadcastDataMutation('test_requests', 'delete');
      }
      return true;
    }
  } catch (err) {
    console.warn('Error in offline mutation:', err);
  }

  return true;
}

function executeOfflineQuery(key: string, args: any[]): any {
  const config = cacheConfig[key];
  if (config) {
    let cached = storage.get(config.storageKey, config.defaultVal);
    
    if (key === 'getPrescriptions' && args[0]) {
      const patientId = args[0];
      cached = cached.filter((rx: any) => rx.patientId === patientId || rx.patient_id === patientId);
    } else if (key === 'getPatientVitals' && args[0]) {
      const patientId = args[0];
      cached = cached.filter((v: any) => v.patientId === patientId || v.patient_id === patientId);
    } else if (key === 'getClinicalNotes' && args[0]) {
      const patientId = args[0];
      cached = cached.filter((n: any) => n.patientId === patientId || n.patient_id === patientId);
    } else if (key === 'getNursingTasks' && args[0]) {
      const ward = args[0];
      cached = cached.filter((t: any) => !ward || t.ward === ward);
    } else if (key === 'getNursingHandovers' && args[0]) {
      const ward = args[0];
      cached = cached.filter((h: any) => !ward || h.ward === ward);
    } else if (key === 'getAppointments') {
      const patientsList = storage.get(STORAGE_KEYS.PATIENTS, MOCK_PATIENTS);
      cached = cached.map((apt: any) => {
        const pid = apt.patient_id || apt.patientId;
        const p = patientsList.find((p_item: any) => p_item.id === pid || p_item.mrn === pid);
        return {
          ...apt,
          patients: p ? { name: p.name, mrn: p.mrn, age: p.age, gender: p.gender } : null,
          appointment_date: apt.appointment_date || apt.date || new Date().toISOString().split('T')[0],
          appointment_time: apt.appointment_time || apt.time || '10:00 AM',
          patient_id: pid,
          doctor_id: apt.doctor_id || apt.doctorId,
          urgency: apt.urgency || 'Routine',
          status: apt.status || 'Scheduled'
        };
      });
    } else if (key === 'getLabTestRequests') {
      const patientsList = storage.get(STORAGE_KEYS.PATIENTS, MOCK_PATIENTS);
      cached = cached.map((req: any) => {
        const pid = req.patient_id || req.patientId;
        const p = patientsList.find((p_item: any) => p_item.id === pid || p_item.mrn === pid);
        return {
          ...req,
          patients: p ? { name: p.name, mrn: p.mrn, age: p.age, gender: p.gender, phone: p.phone } : (req.patients || null),
          patient_id: pid
        };
      });
    } else if (key === 'getRadiologyRecords') {
      const patientsList = storage.get(STORAGE_KEYS.PATIENTS, MOCK_PATIENTS);
      cached = cached.map((rec: any) => {
        const pid = rec.patient_id || rec.patientId;
        const p = patientsList.find((p_item: any) => p_item.id === pid || p_item.mrn === pid);
        return {
          ...rec,
          patients: p ? { name: p.name, mrn: p.mrn, age: p.age, gender: p.gender } : (rec.patients || null),
          patient_id: pid
        };
      });
    } else if (key === 'getPatients') {
      cached = cached.map(normalizePatient);
    } else if (key === 'getBeds') {
      cached = cached.map(normalizeBed);
    } else if (key === 'getDischargeSummaries') {
      cached = cached.map(normalizeDischargeSummary);
    } else if (key === 'getInvoices') {
      const patientsList = storage.get(STORAGE_KEYS.PATIENTS, MOCK_PATIENTS);
      const itemsList = storage.get('hms_invoice_items', []);
      cached = cached.map((inv: any) => {
        const pid = inv.patient_id || inv.patientId;
        const p = patientsList.find((p_item: any) => p_item.id === pid || p_item.mrn === p_item.id || p_item.mrn === pid);
        const relatedItems = itemsList.filter((item: any) => item.invoice_id === inv.id);
        
        const finalItems = relatedItems.length > 0 
          ? relatedItems 
          : (inv.invoice_items || inv.items || []);
          
        const normalizedItems = finalItems.map((item: any) => ({
          id: item.id || 'item-' + Math.random(),
          item_name: item.item_name || item.name || item.description || 'Service/Medicine',
          unit_price: Number(item.unit_price || item.price || item.amount || 0),
          quantity: Number(item.quantity || 1),
          total_price: Number(item.total_price || item.total || item.amount || 0),
          category: item.category || 'OPD'
        }));

        return {
          ...inv,
          patients: p ? { name: p.name, mrn: p.mrn, phone: p.phone, email: p.email } : (inv.patients || null),
          invoice_items: normalizedItems,
          patient_id: pid,
          created_at: inv.created_at || inv.date || new Date().toISOString()
        };
      });
    }
    return cached;
  }
  
  if (key === 'getDashboardStats') {
    const patients = storage.get(STORAGE_KEYS.PATIENTS, MOCK_PATIENTS);
    const appointments = storage.get(STORAGE_KEYS.APPOINTMENTS, MOCK_APPOINTMENTS);
    const bills = storage.get(STORAGE_KEYS.BILLING, MOCK_BILLING);
    const admissions = storage.get('hms_admissions', []);
    const activeAdmissions = admissions.filter((a: any) => a.status === 'Admitted');
    
    const totalRevenue = bills.reduce((sum: number, b: any) => sum + (Number(b.paid_amount) || Number(b.total_amount) || Number(b.total) || 0), 0);
    return {
      patientCount: patients.length,
      appointmentCount: appointments.length,
      admissionCount: activeAdmissions.length || 4,
      totalRevenue
    };
  }
  
  return null;
}

let supabaseUnreachable = false;
let connectionCheckPromise: Promise<boolean> | null = null;
let lastCheckTime = 0;
const CHECK_COOLDOWN_MS = 6000; // Cooldown of 6 seconds between connection checks if offline

function isNetworkFailure(err: any): boolean {
  if (!err) return false;
  if (typeof err === 'object' && err.code) return false;
  const msg = (typeof err === 'string' ? err : (err.message || '')).toLowerCase();
  return (
    msg.includes('timeout') ||
    msg.includes('fetch') ||
    msg.includes('network') ||
    msg.includes('unreachable') ||
    msg.includes('failed to connect') ||
    msg.includes('connection refused') ||
    msg.includes('abort')
  );
}

export async function checkConnection(): Promise<boolean> {
  if (!isSupabaseConfigured) return false;
  
  const now = Date.now();
  if (supabaseUnreachable && (now - lastCheckTime < CHECK_COOLDOWN_MS)) {
    return false;
  }
  
  if (connectionCheckPromise) {
    return connectionCheckPromise;
  }
  
  lastCheckTime = now;
  connectionCheckPromise = (async () => {
    try {
      const rawPromise = supabase.from('hospital_info').select('id').limit(1);
      const timeoutPromise = new Promise<never>((_, reject) => {
        setTimeout(() => reject(new Error("Network check timed out")), 1500);
      });
      await Promise.race([rawPromise, timeoutPromise]);
      supabaseUnreachable = false;
      return true;
    } catch (err: any) {
      if (isNetworkFailure(err)) {
        supabaseUnreachable = true;
        return false;
      }
      // If it is a SQL/permission error but not network, it is still reachable!
      supabaseUnreachable = false;
      return true;
    } finally {
      connectionCheckPromise = null;
    }
  })();
  
  return connectionCheckPromise;
}

if (typeof window !== 'undefined') {
  const resetUnreachable = () => {
    supabaseUnreachable = false;
    connectionCheckPromise = null;
  };
  window.addEventListener('storage', resetUnreachable);
  window.addEventListener('supabase-config-change', resetUnreachable);
}

const syncWrappedService = {} as any;
for (const [key, value] of Object.entries(rawSupabaseService)) {
  if (typeof value === 'function') {
    const isMutation = 
      key.startsWith('create') || 
      key.startsWith('update') || 
      key.startsWith('delete') || 
      key.startsWith('add') || 
      key.startsWith('record') ||
      key.includes('Insert') ||
      key.includes('Update') ||
      key.includes('Delete');
    
    if (isMutation) {
      syncWrappedService[key] = async function(...args: any[]) {
        const firstArg = args[0];
        let isOfflineId = typeof firstArg === 'string' && !isUuid(firstArg);
        if (!isOfflineId && firstArg && typeof firstArg === 'object') {
          const checkId = firstArg.id || firstArg.patient_id || firstArg.patientId;
          if (typeof checkId === 'string' && checkId !== '' && !isUuid(checkId)) {
            isOfflineId = true;
          }
        }
        const isOnline = !isOfflineId && (await checkConnection());
        if (!isOnline) {
          return executeOfflineMutation(key, args);
        }

        const timeoutPromise = new Promise<never>((_, reject) => {
          setTimeout(() => reject(new Error("Mutation timed out")), 4000);
        });

        try {
          const result = await Promise.race([
            value.apply(this, args),
            timeoutPromise
          ]);
          
          if (result) {
            let concept = 'general';
            const k = key.toLowerCase();
            if (k.includes('patient')) concept = 'patients';
            else if (k.includes('appointment')) concept = 'appointments';
            else if (k.includes('prescription')) concept = 'prescriptions';
            else if (k.includes('invoice')) concept = 'invoices';
            else if (k.includes('expense')) concept = 'expenses';
            else if (k.includes('staff') || k.includes('profile')) concept = 'profiles';
            else if (k.includes('bed')) concept = 'beds';
            else if (k.includes('admission')) concept = 'admissions';
            else if (k.includes('vital')) concept = 'patient_vitals';
            else if (k.includes('note')) concept = 'nursing_notes';
            else if (k.includes('pharmacy')) concept = 'pharmacy_items';
            else if (k.includes('ot') || k.includes('schedule')) concept = 'ot_schedules';
            else if (k.includes('claim')) concept = 'insurance_claims';
            else if (k.includes('test') || k.includes('request')) concept = 'test_requests';

            updateLocalCacheOnMutation(key, args, result);
            
            const action = 
              key.startsWith('create') || key.startsWith('add') ? 'insert' : 
              (key.startsWith('delete') ? 'delete' : 'update');
            
            broadcastDataMutation(concept, action as any);
            return result;
          } else {
            console.warn(`Mutation ${key} returned falsy value (${result}). Executing offline fallback to maintain UI state.`);
            return executeOfflineMutation(key, args);
          }
        } catch (err: any) {
          const msg = (typeof err === 'string' ? err : (err?.message || '')).toLowerCase();
          const isNetworkIssue = isNetworkFailure(err) || msg.includes('timeout') || msg.includes('fetch');
          
          if (isNetworkIssue) {
            console.warn(`[Supabase Mutation Delayed] Mutation ${key} timed out or fell back gracefully to offline state:`, err);
            supabaseUnreachable = true;
            toastSlowConnection();
            return executeOfflineMutation(key, args);
          }
          
          console.error(`[Supabase Error] Mutation ${key} failed:`, err);
          // Real database schema or format issue. Do not mask.
          toast.error(`Database Error: ${err.message || err}`);
          return null;
        }
      };
    } else if (key.startsWith('get')) {
      // It's a query method (getPatients, etc.)
      syncWrappedService[key] = async function(...args: any[]) {
        const isOnline = await checkConnection();
        if (!isOnline) {
          return executeOfflineQuery(key, args);
        }

        const config = cacheConfig[key];
        
        const timeoutPromise = new Promise<never>((_, reject) => {
          setTimeout(() => {
            reject(new Error("Database connection timed out"));
          }, 3500);
        });

        try {
          const result = await Promise.race([
            value.apply(this, args),
            timeoutPromise
          ]);

          let finalResult = result;
          if (finalResult) {
            if (config) {
              const cached = storage.get(config.storageKey, []);
              if (Array.isArray(cached) && Array.isArray(finalResult)) {
                const offlineItems = cached.filter((item: any) => item && item.id && String(item.id).startsWith('off-'));
                if (offlineItems.length > 0) {
                  const existingIds = new Set(finalResult.map((item: any) => item && item.id));
                  const offlineToKeep = offlineItems.filter((item: any) => item && item.id && !existingIds.has(item.id));
                  finalResult = [...offlineToKeep, ...finalResult];
                }
              }
              storage.set(config.storageKey, finalResult);
            }
            return finalResult;
          } else {
            console.warn(`Query ${key} returned falsy value. Falling back to cached local storage defaults representation.`);
            if (config) {
              return executeOfflineQuery(key, args);
            }
            return null;
          }
        } catch (err: any) {
          const msg = (typeof err === 'string' ? err : (err?.message || '')).toLowerCase();
          const isNetworkIssue = isNetworkFailure(err) || msg.includes('timeout') || msg.includes('fetch');
          
          if (isNetworkIssue || config) {
            console.warn(`[Supabase Delayed/Offline Fallback] Query ${key} timed out or fell back gracefully to offline state:`, err);
            if (isNetworkIssue) {
              supabaseUnreachable = true;
              toastSlowConnection();
            }
            if (config) {
              return executeOfflineQuery(key, args);
            }
          }
          
          console.error(`[Supabase Error] Query ${key} failed:`, err);
          // Real database schema or query format issue. Do not mask.
          toast.error(`Database Query Error in ${key}: ${err.message || err}`);
          
          if (key === 'getDashboardStats') {
            const patients = storage.get(STORAGE_KEYS.PATIENTS, MOCK_PATIENTS);
            const appointments = storage.get(STORAGE_KEYS.APPOINTMENTS, MOCK_APPOINTMENTS);
            const bills = storage.get(STORAGE_KEYS.BILLING, MOCK_BILLING);
            const admissions = storage.get('hms_admissions', []);
            const activeAdmissions = admissions.filter((a: any) => a.status === 'Admitted');
            
            const totalRevenue = bills.reduce((sum: number, b: any) => sum + (Number(b.paid_amount) || Number(b.total_amount) || Number(b.total) || 0), 0);
            return {
              patientCount: patients.length,
              appointmentCount: appointments.length,
              admissionCount: activeAdmissions.length || 4,
              totalRevenue
            };
          }
          
          return null;
        }
      };
    } else {
      syncWrappedService[key] = value;
    }
  } else {
    syncWrappedService[key] = value;
  }
}

export const supabaseService = syncWrappedService as typeof rawSupabaseService;

// EXPORTS FOR OFFLINE-TO-ONLINE INTERACTION AND RECONCILIATION
export function getSupabaseUnreachable() {
  return supabaseUnreachable;
}

export function setSupabaseUnreachable(val: boolean) {
  supabaseUnreachable = val;
  if (!val) {
    connectionCheckPromise = null;
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('supabase-config-change'));
    }
  }
}

export async function syncOfflineDataWithSupabase() {
  if (!isSupabaseConfigured) {
    return { success: false, syncCount: 0, errors: ['Supabase is not configured yet.'] };
  }

  // Force connection attempt by resetting the unreachable state
  supabaseUnreachable = false;
  connectionCheckPromise = null;
  let syncCount = 0;
  const errors: string[] = [];

  try {
    // ID mapping to preserve foreign key constraints of offline records (e.g. old temporary IDs linked to patients)
    const idMap: Record<string, string> = {};

    // 1. Sync Patients (Base table)
    const patients = storage.get(STORAGE_KEYS.PATIENTS, []);
    const offlinePatients = patients.filter((p: any) => p.id && String(p.id).startsWith('off-'));
    
    for (const p of offlinePatients) {
      try {
        const patientData = { ...p };
        delete patientData.id; // Let database auto-assign UUID/MRN or keep custom MRN
        
        // Remove virtual fields
        delete patientData.patients;
        
        const { data, error } = await supabase
          .from('patients')
          .insert([patientData])
          .select();
        
        if (error) throw error;
        if (data && data[0]) {
          idMap[p.id] = data[0].id;
          syncCount++;
        }
      } catch (err: any) {
        errors.push(`Patient "${p.name || p.mrn}": ${err.message || JSON.stringify(err)}`);
      }
    }

    // Update patients list locally in-place with database-provided UUIDs so we don't have duplicates
    const updatedPatients = patients.map((p: any) => {
      if (idMap[p.id]) {
        return { ...p, id: idMap[p.id] };
      }
      return p;
    });
    storage.set(STORAGE_KEYS.PATIENTS, updatedPatients);

    // 2. Sync Appointments (Depends on patients)
    const appointments = storage.get(STORAGE_KEYS.APPOINTMENTS, []);
    const offlineAppointments = appointments.filter((a: any) => a.id && String(a.id).startsWith('off-'));
    for (const a of offlineAppointments) {
      try {
        const aptData = { ...a };
        delete aptData.id;
        delete aptData.patients; // Virt/JOIN field
        
        if (idMap[aptData.patient_id]) {
          aptData.patient_id = idMap[aptData.patient_id];
        }

        const dbAptData = cleanAppointmentForPostgres(aptData);
        const { data, error } = await supabase
          .from('appointments')
          .insert([dbAptData])
          .select();

        if (error) throw error;
        if (data && data[0]) {
          idMap[a.id] = data[0].id;
          syncCount++;
        }
      } catch (err: any) {
        errors.push(`Appointment: ${err.message || JSON.stringify(err)}`);
      }
    }
    const updatedAppointments = appointments.map((a: any) => {
      if (idMap[a.id]) return { ...a, id: idMap[a.id] };
      return a;
    });
    storage.set(STORAGE_KEYS.APPOINTMENTS, updatedAppointments);

    // 3. Sync Admissions (Depends on patients)
    const admissions = storage.get('hms_admissions', []);
    const offlineAdmissions = admissions.filter((ad: any) => ad.id && String(ad.id).startsWith('off-'));
    for (const ad of offlineAdmissions) {
      try {
        const adData = { ...ad };
        delete adData.id;
        delete adData.patients;
        
        if (idMap[adData.patient_id]) {
          adData.patient_id = idMap[adData.patient_id];
        }

        const { data, error } = await supabase
          .from('admissions')
          .insert([adData])
          .select();

        if (error) throw error;
        if (data && data[0]) {
          idMap[ad.id] = data[0].id;
          syncCount++;
        }
      } catch (err: any) {
        errors.push(`Admission: ${err.message || JSON.stringify(err)}`);
      }
    }
    const updatedAdmissions = admissions.map((ad: any) => {
      if (idMap[ad.id]) return { ...ad, id: idMap[ad.id] };
      return ad;
    });
    storage.set('hms_admissions', updatedAdmissions);

    // 4. Sync Prescriptions (Depends on patients)
    const prescriptions = storage.get(STORAGE_KEYS.PRESCRIPTIONS, []);
    const offlinePrescriptions = prescriptions.filter((rx: any) => rx.id && String(rx.id).startsWith('off-'));
    for (const rx of offlinePrescriptions) {
      try {
        const rxData = { ...rx };
        delete rxData.id;
        delete rxData.patients;
        
        if (idMap[rxData.patient_id]) {
          rxData.patient_id = idMap[rxData.patient_id];
        }

        const { data, error } = await supabase
          .from('prescriptions')
          .insert([rxData])
          .select();

        if (error) throw error;
        if (data && data[0]) {
          idMap[rx.id] = data[0].id;
          syncCount++;
        }
      } catch (err: any) {
        errors.push(`Prescription: ${err.message || JSON.stringify(err)}`);
      }
    }
    const updatedPrescriptions = prescriptions.map((rx: any) => {
      if (idMap[rx.id]) return { ...rx, id: idMap[rx.id] };
      return rx;
    });
    storage.set(STORAGE_KEYS.PRESCRIPTIONS, updatedPrescriptions);

    // 5. Sync Patient Vitals (Depends on patients)
    const vitals = storage.get(STORAGE_KEYS.PATIENT_VITALS, []);
    const offlineVitals = vitals.filter((v: any) => v.id && String(v.id).startsWith('off-'));
    for (const v of offlineVitals) {
      try {
        const vData = { ...v };
        delete vData.id;
        
        if (idMap[vData.patient_id]) {
          vData.patient_id = idMap[vData.patient_id];
        }

        const dbVData = cleanVitalsForPostgres(vData);
        const { data, error } = await supabase
          .from('patient_vitals')
          .insert([dbVData])
          .select();

        if (error) throw error;
        if (data && data[0]) {
          idMap[v.id] = data[0].id;
          syncCount++;
        }
      } catch (err: any) {
        errors.push(`Patient Vital: ${err.message || JSON.stringify(err)}`);
      }
    }
    const updatedVitals = vitals.map((v: any) => {
      if (idMap[v.id]) return { ...v, id: idMap[v.id] };
      return v;
    });
    storage.set(STORAGE_KEYS.PATIENT_VITALS, updatedVitals);

    // 6. Sync Clinical Notes (Depends on patients)
    const notes = storage.get('hms_clinical_notes', []);
    const offlineNotes = notes.filter((n: any) => n.id && String(n.id).startsWith('off-'));
    for (const n of offlineNotes) {
      try {
        const nData = { ...n };
        delete nData.id;
        
        if (idMap[nData.patient_id]) {
          nData.patient_id = idMap[nData.patient_id];
        }

        const { data, error } = await supabase
          .from('clinical_notes')
          .insert([nData])
          .select();

        if (error) throw error;
        if (data && data[0]) {
          idMap[n.id] = data[0].id;
          syncCount++;
        }
      } catch (err: any) {
        errors.push(`Clinical Note: ${err.message || JSON.stringify(err)}`);
      }
    }
    const updatedNotes = notes.map((n: any) => {
      if (idMap[n.id]) return { ...n, id: idMap[n.id] };
      return n;
    });
    storage.set('hms_clinical_notes', updatedNotes);

    // 7. Sync OT schedules (Depends on patients)
    const otSchedules = storage.get('hms_ot_schedules', []);
    const offlineOtSchedules = otSchedules.filter((s: any) => s.id && String(s.id).startsWith('off-'));
    for (const s of offlineOtSchedules) {
      try {
        const sData = { ...s };
        if (idMap[sData.patient_id]) {
          sData.patient_id = idMap[sData.patient_id];
        } else if (idMap[sData.patientId]) {
          sData.patientId = idMap[sData.patientId];
        }
        
        const cleaned = cleanOTScheduleForPostgres(sData);
        let resData: any[] | null = null;
        let resError: any = null;

        const firstTry = await supabase
          .from('ot_schedules')
          .insert([cleaned])
          .select();

        resData = firstTry.data;
        resError = firstTry.error;

        if (resError) {
          if (resError.message && (resError.message.includes('operation_name') || resError.message.includes('schema cache'))) {
            const fallbackCleaned = { ...cleaned };
            if (fallbackCleaned.operation_name && !fallbackCleaned.procedure_name) {
              fallbackCleaned.procedure_name = fallbackCleaned.operation_name;
            }
            delete fallbackCleaned.operation_name;
            
            const retryRes = await supabase
              .from('ot_schedules')
              .insert([fallbackCleaned])
              .select();
              
            resData = retryRes.data;
            resError = retryRes.error;
          }
        }

        if (resError) throw resError;
        if (resData && resData[0]) {
          idMap[s.id] = resData[0].id;
          syncCount++;
        }
      } catch (err: any) {
        errors.push(`OT Schedule: ${err.message || JSON.stringify(err)}`);
      }
    }
    const updatedOtSchedules = otSchedules.map((s: any) => {
      if (idMap[s.id]) return { ...s, id: idMap[s.id] };
      return s;
    });
    storage.set('hms_ot_schedules', updatedOtSchedules);

    // 8. Sync Invoices / Billing (Depends on patients)
    const invoices = storage.get(STORAGE_KEYS.BILLING, []);
    const offlineInvoices = invoices.filter((inv: any) => inv.id && String(inv.id).startsWith('off-'));
    const invoiceItemsList = storage.get('hms_invoice_items', []);

    for (const inv of offlineInvoices) {
      try {
        const invData = { ...inv };
        delete invData.id;
        delete invData.patients;
        delete invData.invoice_items;
        
        if (idMap[invData.patient_id]) {
          invData.patient_id = idMap[invData.patient_id];
        }

        const dbInvData = cleanInvoiceForPostgres(invData);
        const { data, error } = await supabase
          .from('invoices')
          .insert([dbInvData])
          .select();

        if (error) throw error;
        if (data && data[0]) {
          const newInvoiceId = data[0].id;
          idMap[inv.id] = newInvoiceId;
          syncCount++;

          // Upload any associated items for this invoice
          const relatedItems = invoiceItemsList.filter((it: any) => it.invoice_id === inv.id);
          for (const item of relatedItems) {
            try {
              const itemData = { ...item, invoice_id: newInvoiceId };
              delete itemData.id;
              const dbItemData = cleanInvoiceItemForPostgres(itemData);
              await supabase.from('invoice_items').insert([dbItemData]);
            } catch (itErr) {
              console.warn('Silent item sync failure:', itErr);
            }
          }
        }
      } catch (err: any) {
        errors.push(`Invoice: ${err.message || JSON.stringify(err)}`);
      }
    }
    const updatedInvoices = invoices.map((inv: any) => {
      if (idMap[inv.id]) return { ...inv, id: idMap[inv.id] };
      return inv;
    });
    storage.set(STORAGE_KEYS.BILLING, updatedInvoices);

    // 9. Sync Expenses
    const expenses = storage.get(STORAGE_KEYS.EXPENSES, []);
    const offlineExpenses = expenses.filter((ex: any) => ex.id && String(ex.id).startsWith('off-'));
    for (const ex of offlineExpenses) {
      try {
        const exData = { ...ex };
        delete exData.id;
        
        const { data, error } = await supabase
          .from('expenses')
          .insert([exData])
          .select();

        if (error) throw error;
        if (data && data[0]) {
          idMap[ex.id] = data[0].id;
          syncCount++;
        }
      } catch (err: any) {
        errors.push(`Expense: ${err.message || JSON.stringify(err)}`);
      }
    }
    const updatedExpenses = expenses.map((ex: any) => {
      if (idMap[ex.id]) return { ...ex, id: idMap[ex.id] };
      return ex;
    });
    storage.set(STORAGE_KEYS.EXPENSES, updatedExpenses);

    // 10. Sync Insurance Claims (Depends on patients)
    const claims = storage.get(STORAGE_KEYS.INSURANCE, []);
    const offlineClaims = claims.filter((cl: any) => cl.id && String(cl.id).startsWith('off-'));
    for (const cl of offlineClaims) {
      try {
        const clData = { ...cl };
        delete clData.id;
        delete clData.patients;
        
        if (idMap[clData.patient_id]) {
          clData.patient_id = idMap[clData.patient_id];
        }

        const { data, error } = await supabase
          .from('insurance_claims')
          .insert([clData])
          .select();

        if (error) throw error;
        if (data && data[0]) {
          idMap[cl.id] = data[0].id;
          syncCount++;
        }
      } catch (err: any) {
        errors.push(`Insurance Claim: ${err.message || JSON.stringify(err)}`);
      }
    }
    const updatedClaims = claims.map((cl: any) => {
      if (idMap[cl.id]) return { ...cl, id: idMap[cl.id] };
      return cl;
    });
    storage.set(STORAGE_KEYS.INSURANCE, updatedClaims);

    // 11. Sync Lab requests (Depends on patients)
    const labRequests = storage.get(STORAGE_KEYS.LAB_TEST_ORDERS, []);
    const offlineLabRequests = labRequests.filter((lr: any) => lr.id && String(lr.id).startsWith('off-'));
    for (const lr of offlineLabRequests) {
      try {
        const lrData = { ...lr };
        delete lrData.id;
        delete lrData.patients;
        delete lrData.lab_tests;
        
        if (idMap[lrData.patient_id]) {
          lrData.patient_id = idMap[lrData.patient_id];
        }

        const validKeys = [
          'patient_id', 'test_id', 'requested_by', 'status', 'results',
          'report_url', 'requested_at', 'completed_at', 'test_name',
          'reference_range', 'unit', 'urgency', 'result_value', 'clinical_notes', 'findings'
        ];
        const dbLrData: any = {};
        for (const k of validKeys) {
          if (lrData[k] !== undefined) {
            dbLrData[k] = lrData[k];
          }
        }

        const { data, error } = await supabase
          .from('test_requests')
          .insert([dbLrData])
          .select();

        if (error) throw error;
        if (data && data[0]) {
          idMap[lr.id] = data[0].id;
          syncCount++;
        }
      } catch (err: any) {
        errors.push(`Lab Request: ${err.message || JSON.stringify(err)}`);
      }
    }
    const updatedLabRequests = labRequests.map((lr: any) => {
      if (idMap[lr.id]) return { ...lr, id: idMap[lr.id] };
      return lr;
    });
    storage.set(STORAGE_KEYS.LAB_TEST_ORDERS, updatedLabRequests);

    // 12. Sync Pharmacy Items / Inventory
    const pharmacyItems = storage.get(STORAGE_KEYS.INVENTORY, []);
    const offlinePharmacyItems = pharmacyItems.filter((item: any) => item.id && String(item.id).startsWith('off-'));
    for (const item of offlinePharmacyItems) {
      try {
        const itemData = { ...item };
        delete itemData.id;

        const dbItemData = cleanPharmacyItemForPostgres(itemData);
        const data = await selfHealingQuery('insert', 'pharmacy_items', dbItemData);
        if (data && data[0]) {
          idMap[item.id] = data[0].id;
          syncCount++;
        }
      } catch (err: any) {
        errors.push(`Pharmacy Item: ${err.message || JSON.stringify(err)}`);
      }
    }
    const updatedPharmacyItems = pharmacyItems.map((item: any) => {
      if (idMap[item.id]) {
        return mapPharmacyItemFromPostgres({ ...item, id: idMap[item.id] });
      }
      return item;
    });
    storage.set(STORAGE_KEYS.INVENTORY, updatedPharmacyItems);

    // 13. Sync Staff
    const staffList = storage.get(STORAGE_KEYS.USERS, []);
    const offlineStaffList = staffList.filter((s: any) => s.id && String(s.id).startsWith('off-'));
    for (const s of offlineStaffList) {
      try {
        const staffData = { ...s };
        delete staffData.id;

        const dbResult = await rawSupabaseService.createStaff(staffData);
        if (dbResult && dbResult.id) {
          idMap[s.id] = dbResult.id;
          syncCount++;
        }
      } catch (err: any) {
        errors.push(`Staff: ${err.message || JSON.stringify(err)}`);
      }
    }
    const updatedStaffList = staffList.map((s: any) => {
      if (idMap[s.id]) {
        return {
          ...s,
          id: idMap[s.id],
          avatar: s.avatar_url || s.avatar
        };
      }
      return s;
    });
    storage.set(STORAGE_KEYS.USERS, updatedStaffList);

    // 14. Sync Inventory Transactions
    const txList = storage.get('hms_inventory_transactions', []);
    const offlineTxList = txList.filter((tx: any) => tx.id && String(tx.id).startsWith('off-'));
    for (const tx of offlineTxList) {
      try {
        const txData = { ...tx };
        delete txData.id;
        if (txData.item_id && idMap[txData.item_id]) {
          txData.item_id = idMap[txData.item_id];
        }
        if (txData.performed_by && idMap[txData.performed_by]) {
          txData.performed_by = idMap[txData.performed_by];
        }

        const { error } = await supabase.from('inventory_transactions').insert([txData]);
        if (!error) {
          syncCount++;
        }
      } catch (err: any) {
        errors.push(`Inventory Transaction: ${err.message || JSON.stringify(err)}`);
      }
    }

    // Broadcast synchronization updates to any other connected devices
    broadcastDataMutation('all', 'sync');

    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('supabase-data-sync', { detail: { table: 'all', action: 'sync' } }));
    }

    return {
      success: errors.length === 0,
      syncCount,
      errors
    };

  } catch (err: any) {
    console.error('Offline synchronization failed:', err);
    return { success: false, syncCount, errors: [err.message || JSON.stringify(err)] };
  }
}
