import { Patient, Appointment, User, Bed, BillingRecord, LabTest, InventoryItem, OperationTheatre, OperationRecord, NursingTask, NurseShift, PatientVitals, Prescription } from './types';

export const MOCK_USERS: User[] = [
  { id: 'u2', name: 'Admin', email: 'admin@hospital.com', role: 'SUPER_ADMIN', department: 'Cardiology', specialization: 'Interventional Cardiology', degree: 'MD, DM (Cardiology)', avatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=Anjali' }
];

export const MOCK_PATIENTS: Patient[] = [
  { id: 'p1', mrn: 'MRN-001', name: 'Amit Patel', age: 28, gender: 'Male', phone: '9876543210', address: 'B-42, Sector 15, Noida', bloodGroup: 'A+', status: 'Active', lastVisit: '2024-03-20', fatherName: 'Rajesh Patel', guardianName: 'Rajesh Patel', dob: '1996-05-15', attendingDoctorId: 'u1' },
  { id: 'p2', mrn: 'MRN-002', name: 'Priya Singh', age: 45, gender: 'Female', phone: '9123456789', address: 'Flat 201, Green View, Mumbai', bloodGroup: 'O-', status: 'High Risk', lastVisit: '2024-03-25', husbandName: 'Vikram Singh', guardianName: 'Vikram Singh', dob: '1979-11-10', attendingDoctorId: 'u2' },
];

export const MOCK_BEDS: Bed[] = [
  { id: 'b1', number: '101', ward: 'General Ward A', type: 'General', status: 'Occupied', patientId: 'p2' },
  { id: 'b2', number: '102', ward: 'General Ward A', type: 'General', status: 'Available' },
  { id: 'b3', number: '201', ward: 'ICU', type: 'ICU', status: 'Available' },
  { id: 'b4', number: 'M1', ward: 'Maternity', type: 'Maternity', status: 'Available' },
];

export const MOCK_APPOINTMENTS: Appointment[] = [
  { id: 'a1', patientId: 'p1', doctorId: 'u1', date: '2024-04-10', time: '10:00 AM', type: 'OPD', status: 'Scheduled' },
];

export const MOCK_BILLING: BillingRecord[] = [
  { id: 'bill1', patientId: 'p1', date: '2026-04-17', items: [{ description: 'Consultation Fee', amount: 500, category: 'OPD' }], totalAmount: 500, paidAmount: 500, status: 'Paid', paymentMode: 'Cash' },
  { id: 'bill2', patientId: 'p2', date: '2026-04-16', items: [{ description: 'Room Charges (Semi-Private)', amount: 3000, category: 'IPD' }], totalAmount: 3000, paidAmount: 3000, status: 'Paid', paymentMode: 'UPI' },
  { id: 'bill3', patientId: 'p1', date: '2026-03-10', items: [{ description: 'Lab Tests', amount: 2500, category: 'Lab' }], totalAmount: 2500, paidAmount: 2500, status: 'Paid', paymentMode: 'Card' },
  { id: 'bill4', patientId: 'p2', date: '2026-01-15', items: [{ description: 'Surgery Fee', amount: 45000, category: 'IPD' }], totalAmount: 45000, paidAmount: 20000, status: 'Partial', paymentMode: 'Cash' },
  { id: 'bill5', patientId: 'p1', date: '2025-11-20', items: [{ description: 'Follow-up', amount: 300, category: 'OPD' }], totalAmount: 300, paidAmount: 300, status: 'Paid', paymentMode: 'UPI' },
];

export const MOCK_INVENTORY: InventoryItem[] = [
  { 
    id: 'i1', 
    name: 'Paracetamol 500mg', 
    category: 'Medicine', 
    stock: 500, 
    unit: 'Tablets', 
    minStockLevel: 100, 
    expiryDate: '2025-12-31',
    mrp: 15.50,
    sellingPrice: 12.00,
    purchasePrice: 8.00,
    taxPercentage: 12,
    hsnCode: '3004',
    rackNumber: 'A-101'
  },
  { 
    id: 'i2', 
    name: 'Amoxicillin 250mg', 
    category: 'Medicine', 
    stock: 50, 
    unit: 'Capsules', 
    minStockLevel: 100, 
    expiryDate: '2024-08-15',
    mrp: 45.00,
    sellingPrice: 40.00,
    purchasePrice: 30.00,
    taxPercentage: 12,
    hsnCode: '3004',
    rackNumber: 'B-202'
  },
  { 
    id: 'i3', 
    name: 'Moxikind-CV 625', 
    category: 'Medicine', 
    stock: 90, 
    unit: 'Strips', 
    minStockLevel: 10, 
    expiryDate: '2025-08-31',
    mrp: 150.00,
    sellingPrice: 120.00,
    purchasePrice: 80.00,
    taxPercentage: 12,
    hsnCode: '3004',
    rackNumber: 'B-902',
    batchNumber: 'B-902',
    composition: 'Amoxicillin + Clavulanic Acid',
    units_per_strip: 10,
    loose_selling_price: 12.00,
    loose_stock: 0,
    is_loose_sale_enabled: true
  },
  {
    id: 'i4',
    name: 'crocin',
    category: 'Medicine',
    stock: 20,
    unit: 'Strips',
    minStockLevel: 10,
    expiryDate: '2030-01-01',
    mrp: 55.00,
    sellingPrice: 52.00,
    purchasePrice: 26.00,
    taxPercentage: 12,
    hsnCode: '3004',
    rackNumber: 'N/A',
    batchNumber: '26',
    composition: 'Amoxicillin + Clavulanic Acid',
    units_per_strip: 10,
    loose_selling_price: 9.00,
    loose_stock: 80,
    is_loose_sale_enabled: true
  },
];

export const MOCK_THEATRES: OperationTheatre[] = [
  { id: 'ot1', name: 'OT-01 (Major)', status: 'Available', type: 'Major' },
  { id: 'ot2', name: 'OT-02 (Cardiac)', status: 'Occupied', type: 'Cardiac' },
  { id: 'ot3', name: 'OT-03 (Minor)', status: 'Maintenance', type: 'Minor' },
];

export const MOCK_OPERATION_RECORDS: OperationRecord[] = [
  {
    id: 'op1',
    patientId: 'p2',
    theatreId: 'ot2',
    surgeonId: 'u1',
    operationName: 'Appendectomy',
    date: '2024-04-11',
    startTime: '09:00 AM',
    status: 'In-Progress',
    documents: [
      { id: 'd1', name: 'Pre-op Consent', url: '#', type: 'Document', uploadedAt: '2024-04-11T08:30:00Z', uploadedBy: 'u1' },
      { id: 'd2', name: 'Initial Incision', url: 'https://picsum.photos/seed/surgery1/800/600', type: 'Photo', uploadedAt: '2024-04-11T09:15:00Z', uploadedBy: 'u1' }
    ]
  }
];

export const MOCK_NURSING_TASKS: NursingTask[] = [
  { id: 'nt1', patientId: 'p1', description: 'Administer Paracetamol', dueTime: '10:00 AM', status: 'Pending', priority: 'High' },
  { id: 'nt2', patientId: 'p2', description: 'Change Dressing', dueTime: '11:30 AM', status: 'Pending', priority: 'Medium' },
];

export const MOCK_NURSE_SHIFTS: NurseShift[] = [
  { id: 'ns1', nurseId: 'u3', shiftType: 'Morning', ward: 'General Ward A', status: 'Active' },
  { id: 'ns2', nurseId: 'u1', shiftType: 'Morning', ward: 'ICU', status: 'Active' },
];

export const MOCK_PATIENT_VITALS: PatientVitals[] = [
  { patientId: 'p1', bp: '120/80', pulse: 78, temp: '98.6°F', spo2: 96, lastUpdated: '2024-04-11T09:00:00Z' },
  { patientId: 'p2', bp: '110/70', pulse: 82, temp: '99.1°F', spo2: 95, lastUpdated: '2024-04-11T09:15:00Z' },
];

export const MOCK_PRESCRIPTIONS: Prescription[] = [
  {
    id: 'rx1',
    patientId: 'p1',
    doctorId: 'u1',
    date: '2024-04-10',
    medicines: [
      { name: 'Paracetamol', dosage: '500mg', frequency: '1-0-1', duration: '5 days' }
    ],
    notes: 'Take after meals'
  }
];

export const MOCK_PHARMACY_BILLING: BillingRecord[] = [
  { 
    id: 'ph-bill1', 
    patientId: 'p1', 
    date: '2026-04-17', 
    items: [
      { description: 'Paracetamol 500mg (10 tabs)', amount: 120, category: 'Pharmacy' },
      { description: 'Cough Syrup', amount: 85, category: 'Pharmacy' }
    ], 
    totalAmount: 205, 
    paidAmount: 205, 
    status: 'Paid', 
    paymentMode: 'UPI' 
  },
  { 
    id: 'ph-bill2', 
    patientId: 'p2', 
    date: '2026-04-10', 
    items: [
      { description: 'Antibiotics Course', amount: 450, category: 'Pharmacy' }
    ], 
    totalAmount: 450, 
    paidAmount: 450, 
    status: 'Paid', 
    paymentMode: 'Cash' 
  },
  { 
    id: 'ph-bill3', 
    patientId: 'walk-in', 
    date: '2026-04-17', 
    items: [
      { description: 'Vitamin C Syrup', amount: 150, category: 'Pharmacy' }
    ], 
    totalAmount: 150, 
    paidAmount: 150, 
    status: 'Paid', 
    paymentMode: 'Cash',
    patientName: 'Sameer Khan',
    patientPhone: '9876543210',
    prescribingDoctor: 'Dr. R.K. Sharma'
  },
];

export const MOCK_LAB_TESTS = [
  { id: 'lt1', name: 'Complete Blood Count (CBC)', category: 'Pathology', price: 450 },
  { id: 'lt2', name: 'Liver Function Test (LFT)', category: 'Pathology', price: 1200 },
  { id: 'lt3', name: 'Kidney Function Test (KFT)', category: 'Pathology', price: 1100 },
  { id: 'lt4', name: 'Blood Sugar (F/PP)', category: 'Pathology', price: 200 },
  { id: 'lt5', name: 'Lipid Profile', category: 'Pathology', price: 850 },
  { id: 'lt6', name: 'Thyroid Profile (T3, T4, TSH)', category: 'Pathology', price: 950 },
  { id: 'lt7', name: 'Chest X-Ray', category: 'Radiology', price: 600 },
  { id: 'lt8', name: 'USG Whole Abdomen', category: 'Radiology', price: 1500 },
  { id: 'lt9', name: 'CT Scan Brain', category: 'Radiology', price: 4500 },
  { id: 'lt10', name: 'MRI Spine', category: 'Radiology', price: 8500 },
];

export const MOCK_BED_RATES = [
  { type: 'General', rate: 1500 },
  { type: 'Semi-Private', rate: 3000 },
  { type: 'Private', rate: 5000 },
  { type: 'ICU', rate: 8000 },
  { type: 'Maternity', rate: 4000 },
];

export const MOCK_OT_RATES = [
  { type: 'Minor', rate: 5000 },
  { type: 'Major', rate: 15000 },
  { type: 'Cardiac', rate: 45000 },
  { type: 'Neuro', rate: 55000 },
];

export const MOCK_MATERIAL_RATES = [
  { name: 'Surgical Gloves', price: 150, category: 'Disposable' },
  { name: 'Syringes (Pack of 10)', price: 100, category: 'Disposable' },
  { name: 'IV Fluid Set', price: 450, category: 'Disposable' },
  { name: 'Cotton / Bandage Kit', price: 200, category: 'Material' },
  { name: 'Disinfectant Solution', price: 350, category: 'Material' },
  { name: 'Catheter Set', price: 850, category: 'Disposable' },
];
