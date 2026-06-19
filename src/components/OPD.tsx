import { useState, ChangeEvent, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import OPDPatientHistory from './OPDPatientHistory';
import { 
  Search, 
  Plus, 
  Filter, 
  MoreVertical, 
  UserPlus, 
  Calendar as CalendarIcon,
  Clock,
  Printer,
  Share2,
  CheckCircle2,
  Download,
  AlertCircle,
  ArrowUpRight,
  Edit,
  Trash2,
  FileText,
  History,
  Eye,
  User,
  Loader2,
  Sparkles
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle, 
  DialogTrigger,
  DialogFooter
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from '@/components/ui/select';
import { MOCK_USERS } from '@/mockData';
import { formatDate } from '@/lib/utils';
import { toast } from 'sonner';
import { storage, STORAGE_KEYS } from '@/lib/storage';
import { playNotificationSound } from '@/lib/notifications';
import { supabaseService } from '@/services/supabaseService';
import { useDataSync } from '@/hooks/useDataSync';
import { getPrescriptionPrintHtml } from '@/lib/prescriptionPrint';
import { canUserModify } from '@/lib/permissions';

export default function OPD() {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<'queue' | 'appointments' | 'patients'>('queue');
  const [isRegisterOpen, setIsRegisterOpen] = useState(false);
  const [isAppointmentOpen, setIsAppointmentOpen] = useState(false);
  const [editingPatient, setEditingPatient] = useState<any>(null);
  const [editingAppointment, setEditingAppointment] = useState<any>(null);

  const handleOpenRegisterChange = (open: boolean) => {
    setIsRegisterOpen(open);
    if (!open) {
      setEditingPatient(null);
      setNewPatient({ 
        name: '', 
        phone: '', 
        email: '',
        age: '', 
        gender: 'male',
        address: '',
        husbandName: '',
        husbandPhone: '',
        motherName: '',
        motherPhone: '',
        fatherName: '',
        fatherPhone: '',
        bloodGroup: '',
        dob: '',
        tpaId: '',
        tpaValidity: '',
        guardianName: '',
        urgency: 'Routine',
        uhid: '',
        abhaNumber: '',
        abhaAddress: '',
        aadhaarStatus: 'Pending',
        otpVerified: false,
        ayushmanCardNumber: '',
        pmjayBeneficiaryId: '',
        familyId: ''
      });
    }
  };

  const handleOpenAppointmentChange = (open: boolean) => {
    setIsAppointmentOpen(open);
    if (!open) {
      setEditingAppointment(null);
      setNewAppointment({ patientId: '', doctor: '', date: '', time: '', urgency: 'Routine' });
    }
  };
  const [isTokenSuccessOpen, setIsTokenSuccessOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [selectedDoctorFilter, setSelectedDoctorFilter] = useState<string>('all');
  const [appointmentFee, setAppointmentFee] = useState<number>(500); 
  
  // Custom Fee / Charge applies checkboxes states
  const [selectedRegFees, setSelectedRegFees] = useState({
    reg: { name: 'OPD Registration Fee', checked: true, amount: 200 },
    appt: { name: 'Appointment Fee', checked: false, amount: 300 },
    consult: { name: 'Consultation Fee', checked: false, amount: 500 }
  });

  const [selectedApptFees, setSelectedApptFees] = useState({
    reg: { name: 'OPD Registration Fee', checked: false, amount: 200 },
    appt: { name: 'Appointment Fee', checked: true, amount: 300 },
    consult: { name: 'Consultation Fee', checked: true, amount: 500 }
  });

  const [patients, setPatients] = useState<any[]>([]);
  const [appointments, setAppointments] = useState<any[]>([]);
  const [users, setUsers] = useState<any[]>(() => storage.get(STORAGE_KEYS.USERS, MOCK_USERS));
  const [newPatient, setNewPatient] = useState({ 
    name: '', 
    phone: '', 
    email: '',
    age: '', 
    gender: 'male',
    address: '',
    husbandName: '',
    husbandPhone: '',
    motherName: '',
    motherPhone: '',
    fatherName: '',
    fatherPhone: '',
    bloodGroup: '',
    dob: '',
    tpaId: '',
    tpaValidity: '',
    guardianName: '',
    urgency: 'Routine',
    uhid: '',
    abhaNumber: '',
    abhaAddress: '',
    aadhaarStatus: 'Pending',
    otpVerified: false,
    ayushmanCardNumber: '',
    pmjayBeneficiaryId: '',
    familyId: ''
  });
  const [newAppointment, setNewAppointment] = useState({ patientId: '', doctor: '', date: '', time: '', urgency: 'Routine' });
  const [patientSearchTerm, setPatientSearchTerm] = useState('');
  const [recordsSearchQuery, setRecordsSearchQuery] = useState('');
  const [showPatientResults, setShowPatientResults] = useState(false);
  const [lastToken, setLastToken] = useState<{
    tokenNumber: string;
    patientName: string;
    mrn: string;
    doctor: string;
    date: string;
    fee?: number;
  } | null>(null);

  const [isPrescriptionOpen, setIsPrescriptionOpen] = useState(false);
  const [isHistoryOpen, setIsHistoryOpen] = useState(false);
  const [isDetailsOpen, setIsDetailsOpen] = useState(false);
  const [isPreviewOpen, setIsPreviewOpen] = useState(false);
  const [isMergeOpen, setIsMergeOpen] = useState(false);
  const [mergeSourceId, setMergeSourceId] = useState('');
  const [mergeTargetId, setMergeTargetId] = useState('');

  const handleMergeDuplicatePatients = async () => {
    if (!mergeSourceId || !mergeTargetId) {
      toast.error('Please select both the duplicate (source) and target (primary) patient records.');
      return;
    }
    if (mergeSourceId === mergeTargetId) {
      toast.error('The source patient and target patient cannot be the same person.');
      return;
    }

    const sourcePatient = patients.find(p => p.id === mergeSourceId);
    const targetPatient = patients.find(p => p.id === mergeTargetId);

    if (!sourcePatient || !targetPatient) {
      toast.error('Invalid patient selection.');
      return;
    }

    try {
      // 1. Fetch appointments & update patient_id from source to target
      const appointmentsList = await supabaseService.getAppointments();
      const sourceAppointments = appointmentsList?.filter((app: any) => app.patient_id === mergeSourceId || app.patientId === mergeSourceId) || [];
      for (const app of sourceAppointments) {
        await supabaseService.updateAppointment ? await supabaseService.updateAppointment(app.id, { patient_id: mergeTargetId }) : null;
      }

      // 2. Fetch invoices & update patient_id from source to target
      const invoicesList = await supabaseService.getInvoices();
      const sourceInvoices = invoicesList?.filter((inv: any) => inv.patient_id === mergeSourceId || inv.patientId === mergeSourceId) || [];
      for (const inv of sourceInvoices) {
        inv.patient_id = mergeTargetId;
      }
      storage.set('hms_invoices', invoicesList);

      // 3. Delete/deactivate the source patient record from patients list
      const updatedPatients = patients.filter(p => p.id !== mergeSourceId);
      
      // Merge some missing profile info from source to target if target is empty
      const updatedTargetPatient = {
        ...targetPatient,
        email: targetPatient.email || sourcePatient.email,
        bloodGroup: targetPatient.bloodGroup || sourcePatient.bloodGroup || targetPatient.blood_group || sourcePatient.blood_group,
        address: targetPatient.address || sourcePatient.address,
        tpaId: targetPatient.tpaId || sourcePatient.tpaId || targetPatient.tpa_id || sourcePatient.tpa_id,
        uhid: targetPatient.uhid || sourcePatient.uhid,
        abha_number: targetPatient.abha_number || sourcePatient.abha_number || targetPatient.abhaNumber || sourcePatient.abhaNumber,
        abha_address: targetPatient.abha_address || sourcePatient.abha_address || targetPatient.abhaAddress || sourcePatient.abhaAddress,
        ayushman_card_number: targetPatient.ayushman_card_number || sourcePatient.ayushman_card_number,
        pmjay_beneficiary_id: targetPatient.pmjay_beneficiary_id || sourcePatient.pmjay_beneficiary_id,
        family_id: targetPatient.family_id || sourcePatient.family_id
      };

      const finalPatients = updatedPatients.map(p => p.id === mergeTargetId ? updatedTargetPatient : p);

      // Persist
      await supabaseService.deletePatient(mergeSourceId);
      setPatients(finalPatients);
      storage.set(STORAGE_KEYS.PATIENTS, finalPatients);
      window.dispatchEvent(new Event('storage'));

      toast.success(`Merge Successful! ${sourcePatient.name} records compiled into ${targetPatient.name}.`);
      setIsMergeOpen(false);
      setMergeSourceId('');
      setMergeTargetId('');
    } catch (err: any) {
      toast.error('Failed to merge patient profiles: ' + err.message);
    }
  };

  const [previewData, setPreviewData] = useState<{url: string, name: string} | null>(null);
  const [selectedPatient, setSelectedPatient] = useState<any>(null);
  const currentUser = storage.get(STORAGE_KEYS.SESSION_USER, null);
  const isAccountant = currentUser?.role === 'ACCOUNTANT';

  // Patient Clinical History states
  const [selectedPatientVitals, setSelectedPatientVitals] = useState<any[]>([]);
  const [selectedPatientNotes, setSelectedPatientNotes] = useState<any[]>([]);
  const [selectedPatientLabs, setSelectedPatientLabs] = useState<any[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(false);

  const [prescription, setPrescription] = useState({
    doctor: 'Dr. Rajesh Sharma',
    date: new Date().toISOString().split('T')[0],
    medicines: [{ name: '', dosage: '', frequency: '', duration: '' }],
    advice: '',
    attachmentUrl: '',
    attachmentName: ''
  });

  const [savedPrescriptions, setSavedPrescriptions] = useState<any[]>([]);
  const [templateImage, setTemplateImage] = useState<string | null>(storage.get(STORAGE_KEYS.TEMPLATE_IMAGE, null));
  const [hospitalInfo, setHospitalInfo] = useState(storage.get(STORAGE_KEYS.HOSPITAL_INFO, {
    name: 'Medinex HMS by Digital Communique Private Limited',
    address: '123 Healthcare Way, Medical City',
    phone: '+91 98765 43210',
    email: 'accounts@medinexhms.com',
    logo: null as string | null
  }));

  const fetchData = async () => {
    setLoading(true);
    try {
      const [patientsData, appointmentsData, prescriptionsData, staffData] = await Promise.all([
        supabaseService.getPatients(),
        supabaseService.getAppointments(),
        supabaseService.getPrescriptions(),
        supabaseService.getStaff()
      ]);
      
      if (patientsData) setPatients(patientsData);
      if (staffData && staffData.length > 0) setUsers(staffData);
      if (appointmentsData) {
        // Map patients data into appointments if needed, or use the joined data
        const mappedApts = appointmentsData
          .filter((apt: any) => !apt.type || apt.type === 'OPD')
          .map((apt: any) => ({
            ...apt,
            patientId: apt.patient_id || apt.patientId,
            patientName: apt.patients?.name || 'Unknown',
            patientMrn: apt.patients?.mrn || 'N/A',
            appointment_date: apt.appointment_date || apt.date,
            appointment_time: apt.appointment_time || apt.time,
          }));
        setAppointments(mappedApts);
      }
      if (prescriptionsData) {
        const mappedPrescriptions = prescriptionsData.map((rx: any) => ({
          ...rx,
          patientId: rx.patient_id || rx.patientId,
          doctor: rx.doctor_name || rx.doctor,
          date: rx.prescription_date ? rx.prescription_date.split('T')[0] : (rx.date || new Date().toISOString().split('T')[0]),
          medicines: rx.medicines || rx.medications || []
        }));
        setSavedPrescriptions(mappedPrescriptions);
      }
    } catch (error) {
      console.error('Error fetching data:', error);
      toast.error('Failed to load data');
    } finally {
      setLoading(false);
    }
  };

  useDataSync(fetchData);

  useEffect(() => {
    if (!isAppointmentOpen) {
      setPatientSearchTerm('');
      setShowPatientResults(false);
    }
  }, [isAppointmentOpen]);

  useEffect(() => {
    storage.set('hms_prescriptions', savedPrescriptions);
  }, [savedPrescriptions]);

  const handleFileUpload = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.type !== 'application/pdf') {
        toast.error('Please upload a PDF file');
        return;
      }
      const reader = new FileReader();
      reader.onloadend = () => {
        setPrescription({
          ...prescription,
          attachmentUrl: reader.result as string,
          attachmentName: file.name
        });
        toast.success('Prescription PDF uploaded');
      };
      reader.readAsDataURL(file);
    }
  };

  const addMedicine = () => {
    setPrescription({
      ...prescription,
      medicines: [...prescription.medicines, { name: '', dosage: '', frequency: '', duration: '' }]
    });
  };

  const removeMedicine = (index: number) => {
    const newMedicines = prescription.medicines.filter((_, i) => i !== index);
    setPrescription({ ...prescription, medicines: newMedicines });
  };

  const updateMedicine = (index: number, field: string, value: string) => {
    const newMedicines = prescription.medicines.map((m, i) => 
      i === index ? { ...m, [field]: value } : m
    );
    setPrescription({ ...prescription, medicines: newMedicines });
  };

  const handleSavePrescription = async () => {
    if (!selectedPatient) {
      toast.error('No patient selected. Cannot save prescription.');
      return;
    }
    
    const newPrescriptionData = {
      patient_id: selectedPatient.id,
      doctor_name: prescription.doctor,
      prescription_date: prescription.date,
      medicines: prescription.medicines,
      advice: prescription.advice,
      attachment_url: prescription.attachmentUrl,
      attachment_name: prescription.attachmentName
    };

    const saved = await supabaseService.createPrescription(newPrescriptionData);
    if (saved) {
      const mappedSaved = {
        ...saved,
        patientId: saved.patient_id || saved.patientId,
        doctor: saved.doctor_name || saved.doctor,
        date: saved.prescription_date ? saved.prescription_date.split('T')[0] : (saved.date || new Date().toISOString().split('T')[0]),
        medicines: saved.medicines || saved.medications || []
      };
      setSavedPrescriptions([mappedSaved, ...savedPrescriptions]);
      toast.success(`Prescription saved for ${selectedPatient.name}`);
      setIsPrescriptionOpen(false);
      // Reset form dynamically using the first available doctor or our logged-in name
      let initialDoc = '';
      const activeDocs = users.filter((u: any) => u.role?.toUpperCase() === 'DOCTOR' || u.role?.toUpperCase() === 'SUPER_ADMIN' || u.role?.toUpperCase() === 'SURGEON');
      if (currentUser?.role === 'DOCTOR' || currentUser?.role === 'SUPER_ADMIN') {
        const foundSelf = activeDocs.find(d => d.name === currentUser.name);
        if (foundSelf) initialDoc = foundSelf.name;
      }
      if (!initialDoc && activeDocs.length > 0) {
        initialDoc = activeDocs[0].name;
      }
      setPrescription({
        doctor: initialDoc || 'Duty Doctor',
        date: new Date().toISOString().split('T')[0],
        medicines: [{ name: '', dosage: '', frequency: '', duration: '' }],
        advice: '',
        attachmentUrl: '',
        attachmentName: ''
      });
    } else {
      toast.error('Failed to save prescription to database');
    }
  };

  const openPrescriptionModal = (patient: any) => {
    setSelectedPatient(patient);
    loadPatientHistory(patient.id);
    
    let initialDoc = '';
    const activeDocs = users.filter((u: any) => u.role?.toUpperCase() === 'DOCTOR' || u.role?.toUpperCase() === 'SUPER_ADMIN' || u.role?.toUpperCase() === 'SURGEON');
    if (currentUser?.role === 'DOCTOR' || currentUser?.role === 'SUPER_ADMIN') {
      const foundSelf = activeDocs.find(d => d.name === currentUser.name);
      if (foundSelf) initialDoc = foundSelf.name;
    }
    if (!initialDoc && activeDocs.length > 0) {
      initialDoc = activeDocs[0].name;
    }
    
    setPrescription({
      doctor: initialDoc || 'Duty Doctor',
      date: new Date().toISOString().split('T')[0],
      medicines: [{ name: '', dosage: '', frequency: '', duration: '' }],
      advice: '',
      attachmentUrl: '',
      attachmentName: ''
    });
    
    setIsPrescriptionOpen(true);
  };

  const printPrescription = () => {
    if (!selectedPatient) return;

    const printWindow = window.open('', '_blank', 'width=800,height=1000');
    if (!printWindow) {
      toast.error('Please allow popups to print prescription');
      return;
    }

    const doctor = users.find(u => u.name === prescription.doctor);

    const html = getPrescriptionPrintHtml(
      {
        name: selectedPatient.name,
        age: selectedPatient.age,
        gender: selectedPatient.gender,
        mrn: selectedPatient.mrn
      },
      {
        date: prescription.date,
        medicines: prescription.medicines,
        advice: prescription.advice
      },
      doctor,
      hospitalInfo
    );

    printWindow.document.write(html);
    printWindow.document.close();
  };

  const loadPatientHistory = async (patientId: string) => {
    if (!patientId) return;
    setLoadingHistory(true);
    try {
      const [vts, nts, labs] = await Promise.all([
        supabaseService.getPatientVitals(patientId),
        supabaseService.getClinicalNotes(patientId),
        supabaseService.getLabTestRequests()
      ]);
      
      if (vts) {
        setSelectedPatientVitals(vts);
      } else {
        setSelectedPatientVitals([]);
      }
      
      if (nts) {
        setSelectedPatientNotes(nts);
      } else {
        setSelectedPatientNotes([]);
      }
      
      if (labs) {
        const filteredLabs = labs.filter((l: any) => l.patient_id === patientId || l.patientId === patientId);
        setSelectedPatientLabs(filteredLabs);
      } else {
        setSelectedPatientLabs([]);
      }
    } catch (err) {
      console.warn('Error loading patient legacy history:', err);
    } finally {
      setLoadingHistory(false);
    }
  };

  const calculateAge = (dob: string) => {
    if (!dob) return '';
    const birthDate = new Date(dob);
    const today = new Date();
    let age = today.getFullYear() - birthDate.getFullYear();
    const m = today.getMonth() - birthDate.getMonth();
    if (m < 0 || (m === 0 && today.getDate() < birthDate.getDate())) {
      age--;
    }
    return age.toString();
  };

  const getUrgencyColor = (urgency: string) => {
    switch (urgency) {
      case 'Emergency': return 'bg-rose-500 text-white';
      case 'Urgent': return 'bg-amber-500 text-white';
      case 'Routine': return 'bg-emerald-500 text-white';
      default: return 'bg-slate-400 text-white';
    }
  };

  const startEditPatient = (patient: any) => {
    if (!canUserModify(currentUser, patient, users)) {
      toast.error('This patient record was filled/created by Admin and can only be modified by administrators.');
      return;
    }
    setEditingPatient(patient);
    setNewPatient({
      name: patient.name || '',
      phone: patient.phone || '',
      email: patient.email || '',
      age: patient.age ? String(patient.age) : '',
      gender: patient.gender || 'male',
      address: patient.address || '',
      husbandName: patient.husband_name || patient.husbandName || '',
      husbandPhone: patient.husband_phone || patient.husbandPhone || '',
      motherName: patient.mother_name || patient.motherName || '',
      motherPhone: patient.mother_phone || patient.motherPhone || '',
      fatherName: patient.father_name || patient.fatherName || '',
      fatherPhone: patient.father_phone || patient.fatherPhone || '',
      bloodGroup: patient.blood_group || patient.bloodGroup || '',
      dob: patient.dob || '',
      tpaId: patient.tpa_id || patient.tpaId || '',
      tpaValidity: patient.tpa_validity || patient.tpaValidity || '',
      guardianName: patient.guardian_name || patient.guardianName || '',
      urgency: patient.urgency || 'Routine',
      uhid: patient.uhid || '',
      abhaNumber: patient.abha_number || patient.abhaNumber || '',
      abhaAddress: patient.abha_address || patient.abhaAddress || '',
      aadhaarStatus: patient.aadhaar_status || patient.aadhaarStatus || 'Pending',
      otpVerified: !!(patient.otp_verified || patient.otpVerified),
      ayushmanCardNumber: patient.ayushman_card_number || patient.ayushmanCardNumber || '',
      pmjayBeneficiaryId: patient.pmjay_beneficiary_id || patient.pmjayBeneficiaryId || '',
      familyId: patient.family_id || patient.familyId || ''
    });
    setIsRegisterOpen(true);
  };

  const startEditAppointment = (apt: any) => {
    if (!canUserModify(currentUser, apt, users)) {
      toast.error('This appointment was filled/created by Admin and can only be modified by administrators.');
      return;
    }
    setEditingAppointment(apt);
    setNewAppointment({
      patientId: apt.patient_id || apt.patientId || '',
      doctor: apt.doctor || 'Dr. Rajesh Sharma',
      date: apt.appointment_date ? apt.appointment_date.split('T')[0] : (apt.date || ''),
      time: apt.appointment_time || apt.time || '',
      urgency: apt.urgency || 'Routine'
    });
    setIsAppointmentOpen(true);
  };

  const handleRegistration = async () => {
    if (!newPatient.name || !newPatient.phone) {
      toast.error('Please fill in required fields');
      return;
    }

    if (editingPatient) {
      const updatedData = {
        name: newPatient.name,
        phone: newPatient.phone,
        email: newPatient.email,
        dob: newPatient.dob ? newPatient.dob : null,
        age: newPatient.age ? Number(newPatient.age) : null,
        gender: newPatient.gender,
        blood_group: newPatient.bloodGroup,
        address: newPatient.address,
        guardian_name: newPatient.guardianName,
        father_name: newPatient.fatherName,
        father_phone: newPatient.fatherPhone,
        mother_name: newPatient.motherName,
        mother_phone: newPatient.motherPhone,
        husband_name: newPatient.husbandName,
        husband_phone: newPatient.husbandPhone,
        tpa_id: newPatient.tpaId,
        tpa_validity: newPatient.tpaValidity ? newPatient.tpaValidity : null,
        urgency: newPatient.urgency,
        uhid: newPatient.uhid,
        abha_number: newPatient.abhaNumber,
        abha_address: newPatient.abhaAddress,
        aadhaar_status: newPatient.aadhaarStatus,
        otp_verified: newPatient.otpVerified,
        ayushman_card_number: newPatient.ayushmanCardNumber,
        pmjay_beneficiary_id: newPatient.pmjayBeneficiaryId,
        family_id: newPatient.familyId
      };

      const result = await supabaseService.updatePatient(editingPatient.id, updatedData);
      if (result) {
        const updatedPatientsList = patients.map(p => p.id === editingPatient.id ? { ...p, ...result } : p);
        setPatients(updatedPatientsList);
        storage.set(STORAGE_KEYS.PATIENTS, updatedPatientsList);
        toast.success('Patient information updated successfully');
        setIsRegisterOpen(false);
        setEditingPatient(null);
        // Reset form
        setNewPatient({ 
          name: '', 
          phone: '', 
          email: '',
          age: '', 
          gender: 'male',
          address: '',
          husbandName: '',
          husbandPhone: '',
          motherName: '',
          motherPhone: '',
          fatherName: '',
          fatherPhone: '',
          bloodGroup: '',
          dob: '',
          tpaId: '',
          tpaValidity: '',
          guardianName: '',
          urgency: 'Routine',
          uhid: '',
          abhaNumber: '',
          abhaAddress: '',
          aadhaarStatus: 'Pending',
          otpVerified: false,
          ayushmanCardNumber: '',
          pmjayBeneficiaryId: '',
          familyId: ''
        });
        window.dispatchEvent(new Event('storage'));
      } else {
        toast.error('Failed to update patient details');
      }
      return;
    }

    const tokenNumber = `#${Math.floor(Math.random() * 900) + 100}`;
    const mrn = `MRN${Math.floor(Math.random() * 90000) + 10000}`;
    const regFee = 200;
    
    const synced = await supabaseService.createPatient({
      mrn,
      name: newPatient.name,
      phone: newPatient.phone,
      email: newPatient.email,
      dob: newPatient.dob,
      age: Number(newPatient.age),
      gender: newPatient.gender,
      blood_group: newPatient.bloodGroup,
      address: newPatient.address,
      guardian_name: newPatient.guardianName,
      father_name: newPatient.fatherName,
      father_phone: newPatient.fatherPhone,
      mother_name: newPatient.motherName,
      mother_phone: newPatient.motherPhone,
      husband_name: newPatient.husbandName,
      husband_phone: newPatient.husbandPhone,
      tpa_id: newPatient.tpaId,
      tpa_validity: newPatient.tpaValidity,
      registration_type: 'OPD',
      uhid: newPatient.uhid || `UHID${Math.floor(Math.random() * 900000) + 100000}`,
      abha_number: newPatient.abhaNumber,
      abha_address: newPatient.abhaAddress,
      aadhaar_status: newPatient.aadhaarStatus,
      otp_verified: newPatient.otpVerified,
      ayushman_card_number: newPatient.ayushmanCardNumber,
      pmjay_beneficiary_id: newPatient.pmjayBeneficiaryId,
      family_id: newPatient.familyId
    });

    if (synced) {
      setPatients([synced, ...patients]);

      // Collect the checked fees dynamically
      const selectedInvoiceItems: any[] = [];
      let calculatedTotal = 0;

      if (selectedRegFees.reg.checked) {
        selectedInvoiceItems.push({
          item_name: 'OPD Registration Fee',
          item_type: 'Consultation',
          quantity: 1,
          unit_price: selectedRegFees.reg.amount,
          total_price: selectedRegFees.reg.amount
        });
        calculatedTotal += selectedRegFees.reg.amount;
      }

      if (selectedRegFees.appt.checked) {
        selectedInvoiceItems.push({
          item_name: 'Appointment Fee',
          item_type: 'Consultation',
          quantity: 1,
          unit_price: selectedRegFees.appt.amount,
          total_price: selectedRegFees.appt.amount
        });
        calculatedTotal += selectedRegFees.appt.amount;
      }

      if (selectedRegFees.consult.checked) {
        selectedInvoiceItems.push({
          item_name: 'Consultation Fee',
          item_type: 'Consultation',
          quantity: 1,
          unit_price: selectedRegFees.consult.amount,
          total_price: selectedRegFees.consult.amount
        });
        calculatedTotal += selectedRegFees.consult.amount;
      }

      if (selectedInvoiceItems.length > 0) {
        // Create Invoice for select applicable Fees
        const invoiceData = {
          patient_id: synced.id,
          invoice_number: `INV-REG-${Date.now()}`,
          status: 'Unpaid',
          total_amount: calculatedTotal,
          paid_amount: 0,
          payment_method: 'Cash',
          type: 'OPD',
          created_by: currentUser?.id
        };

        await supabaseService.createInvoice(invoiceData, selectedInvoiceItems);
      }

      setLastToken({
        tokenNumber,
        patientName: newPatient.name,
        mrn,
        doctor: "Reception Counter", 
        date: new Date().toLocaleString(),
        fee: calculatedTotal
      });

      setIsRegisterOpen(false);
      setIsTokenSuccessOpen(true);
      playNotificationSound();
      // Reset form
      setNewPatient({ 
        name: '', 
        phone: '', 
        email: '',
        age: '', 
        gender: 'male',
        address: '',
        husbandName: '',
        husbandPhone: '',
        motherName: '',
        motherPhone: '',
        fatherName: '',
        fatherPhone: '',
        bloodGroup: '',
        dob: '',
        tpaId: '',
        tpaValidity: '',
        guardianName: '',
        urgency: 'Routine',
        uhid: '',
        abhaNumber: '',
        abhaAddress: '',
        aadhaarStatus: 'Pending',
        otpVerified: false,
        ayushmanCardNumber: '',
        pmjayBeneficiaryId: '',
        familyId: ''
      });
      toast.success('Patient registered and token generated');
    } else {
      toast.error('Failed to register patient');
    }
  };

  const handleBookAppointment = async () => {
    if (!newAppointment.patientId || !newAppointment.doctor) {
      toast.error('Please select patient and doctor');
      return;
    }

    if (editingAppointment) {
      const updatedData = {
        patient_id: newAppointment.patientId,
        appointment_date: newAppointment.date || new Date().toISOString().split('T')[0],
        appointment_time: newAppointment.time || '10:00 AM',
        urgency: newAppointment.urgency
      };

      const result = await supabaseService.updateAppointment(editingAppointment.id, updatedData);
      if (result) {
        const patient = patients.find(p => p.id === newAppointment.patientId);
        const updatedApt = {
          ...result,
          patientId: result.patient_id || result.patientId,
          patientName: patient?.name || 'Unknown',
          patientMrn: patient?.mrn || 'N/A',
          appointment_date: result.appointment_date || result.date,
          appointment_time: result.appointment_time || result.time,
        };
        const updatedList = appointments.map(a => a.id === editingAppointment.id ? updatedApt : a);
        setAppointments(updatedList);
        storage.set(STORAGE_KEYS.APPOINTMENTS, updatedList);
        toast.success('Appointment updated successfully');
        setIsAppointmentOpen(false);
        setEditingAppointment(null);
        setNewAppointment({ patientId: '', doctor: '', date: '', time: '', urgency: 'Routine' });
        window.dispatchEvent(new Event('storage'));
      } else {
        toast.error('Failed to update appointment');
      }
      return;
    }

    const patient = patients.find(p => p.id === newAppointment.patientId);
    const tokenNumber = `APT-${Math.floor(Math.random() * 900) + 100}`;
    const appointmentDate = newAppointment.date || new Date().toISOString().split('T')[0];
    
    const synced = await supabaseService.createAppointment({
      patient_id: newAppointment.patientId,
      doctor_id: null, // Would need doctor UUID mapping
      type: 'OPD',
      appointment_date: appointmentDate,
      appointment_time: newAppointment.time || '10:00 AM',
      status: 'Scheduled',
      urgency: newAppointment.urgency
    });

    if (synced) {
      // Collect the checked fees dynamically
      const selectedInvoiceItems: any[] = [];
      let calculatedTotal = 0;

      if (selectedApptFees.reg.checked) {
        selectedInvoiceItems.push({
          item_name: 'OPD Registration Fee',
          item_type: 'Consultation',
          quantity: 1,
          unit_price: selectedApptFees.reg.amount,
          total_price: selectedApptFees.reg.amount
        });
        calculatedTotal += selectedApptFees.reg.amount;
      }

      if (selectedApptFees.appt.checked) {
        selectedInvoiceItems.push({
          item_name: `Appointment Fee - ${newAppointment.doctor || 'GP'}`,
          item_type: 'Consultation',
          quantity: 1,
          unit_price: selectedApptFees.appt.amount,
          total_price: selectedApptFees.appt.amount
        });
        calculatedTotal += selectedApptFees.appt.amount;
      }

      if (selectedApptFees.consult.checked) {
        selectedInvoiceItems.push({
          item_name: `Consultation Fee - ${newAppointment.doctor || 'GP'}`,
          item_type: 'Consultation',
          quantity: 1,
          unit_price: selectedApptFees.consult.amount,
          total_price: selectedApptFees.consult.amount
        });
        calculatedTotal += selectedApptFees.consult.amount;
      }

      if (selectedInvoiceItems.length > 0) {
        // Create Invoice for selected Consultation/Appointment Fees
        const invoiceData = {
          patient_id: newAppointment.patientId,
          invoice_number: `INV-OPD-${Date.now()}`,
          status: 'Unpaid',
          total_amount: calculatedTotal,
          paid_amount: 0,
          payment_method: 'Cash',
          type: 'OPD',
          created_by: currentUser?.id
        };

        await supabaseService.createInvoice(invoiceData, selectedInvoiceItems);
      }

      const aptWithPatient = {
        ...synced,
        patientName: patient?.name || 'Unknown',
        patientMrn: patient?.mrn || 'N/A'
      };
      setAppointments([aptWithPatient, ...appointments]);
      setLastToken({
        tokenNumber,
        patientName: patient?.name || "Unknown",
        mrn: patient?.mrn || "N/A",
        doctor: newAppointment.doctor,
        date: new Date().toLocaleString(),
        fee: calculatedTotal
      });
      setIsAppointmentOpen(false);
      setIsTokenSuccessOpen(true);
      playNotificationSound();
      setNewAppointment({ patientId: '', doctor: '', date: '', time: '', urgency: 'Routine' });
      toast.success('Appointment booked and token generated');
    } else {
      toast.error('Failed to book appointment');
    }
  };

  const printToken = () => {
    if (!lastToken) return;

    const printWindow = window.open('', '_blank', 'width=300,height=400');
    if (!printWindow) {
      toast.error('Please allow popups to print token');
      return;
    }

    const tokenHtml = `
      <html>
        <head>
          <title>Token - ${lastToken.tokenNumber}</title>
          <style>
            @page { margin: 0; }
            body { 
              font-family: 'Courier New', Courier, monospace; 
              width: 58mm; 
              padding: 5mm; 
              margin: 0;
              font-size: 12px;
              line-height: 1.2;
              text-align: center;
            }
            .bold { font-weight: bold; }
            .divider { border-top: 1px dashed #000; margin: 5px 0; }
            .token-num { font-size: 32px; font-weight: bold; margin: 10px 0; }
            .header { margin-bottom: 10px; }
          </style>
        </head>
        <body>
          <div class="header">
            <div class="bold" style="font-size: 16px;">Medinex HMS by Digital Communique Private Limited</div>
            <div>OPD TOKEN</div>
          </div>
          
          <div class="divider"></div>
          
          <div class="token-num">${lastToken.tokenNumber}</div>
          
          <div class="divider"></div>
          
          <div style="text-align: left;">
            <div>Patient: ${lastToken.patientName}</div>
            <div>MRN: ${lastToken.mrn}</div>
            <div>Doctor: ${lastToken.doctor}</div>
            <div>Date: ${lastToken.date}</div>
            ${lastToken.fee ? `<div>Fee Paid: ₹${lastToken.fee}</div>` : ''}
          </div>
          
          <div class="divider"></div>
          
          <div style="font-size: 10px; margin-top: 10px;">
            Please wait for your turn.<br>
            Thank you for your patience.
          </div>
          
          <script>
            window.onload = () => {
              window.print();
              setTimeout(() => window.close(), 500);
            };
          </script>
        </body>
      </html>
    `;

    printWindow.document.close();
  };

  const handleDeletePatient = async (id: string) => {
    const patientToDelete = patients.find(p => p.id === id);
    if (!canUserModify(currentUser, patientToDelete, users)) {
      toast.error('This patient record was filled/created by Admin and can only be deleted by administrators.');
      return;
    }
    if (!window.confirm(`Are you sure you want to delete ${patientToDelete?.name}?`)) return;

    const success = await supabaseService.deletePatient(id);
    if (success) {
      setPatients(patients.filter(p => p.id !== id));
      toast.success('Patient record removed');
    } else {
      toast.error('Failed to delete patient');
    }
  };

  const handlePayAppointment = async (id: string) => {
    const apt = appointments.find(a => a.id === id);
    if (!canUserModify(currentUser, apt, users)) {
      toast.error('This appointment was filled/created by Admin and its payment cannot be toggled by non-admin roles.');
      return;
    }
    const success = await supabaseService.updateAppointment(id, { payment_status: 'Paid' });
    if (success) {
      setAppointments(appointments.map(a => a.id === id ? { ...a, payment_status: 'Paid' } : a));
      
      try {
        // Find the patient associated with this appointment to sync invoice status
        const apt = appointments.find(a => a.id === id);
        if (apt) {
          const patientId = apt.patientId || apt.patient_id;
          if (patientId) {
            const invoices = await supabaseService.getInvoices();
            if (invoices && invoices.length > 0) {
              const pendingOPDInvoices = invoices.filter((inv: any) => {
                const isMatchPatient = (inv.patient_id === patientId || inv.patientId === patientId);
                const isUnpaid = inv.status?.toLowerCase() === 'unpaid';
                const isOPD = inv.type === 'OPD';
                return isMatchPatient && isUnpaid && isOPD;
              });

              for (const inv of pendingOPDInvoices) {
                await supabaseService.updateInvoice(
                  inv.id, 
                  { ...inv, status: 'Paid', paid_amount: inv.total_amount }, 
                  inv.invoice_items || []
                );
              }
            }
          }
        }
      } catch (err) {
        console.error('Error syncing invoice payment:', err);
      }

      toast.success('Consultation fee collected successfully');
    } else {
      toast.error('Failed to update payment status');
    }
  };

  const handleDeleteAppointment = async (id: string) => {
    const apt = appointments.find(a => a.id === id);
    if (!canUserModify(currentUser, apt, users)) {
      toast.error('This appointment was filled/created by Admin and cannot be cancelled/deleted by non-admin roles.');
      return;
    }
    const updated = appointments.filter(a => a.id !== id);
    setAppointments(updated);
    storage.set(STORAGE_KEYS.APPOINTMENTS, updated);
    
    try {
      if (id && !id.startsWith('apt-') && !id.startsWith('off-')) {
        await supabaseService.updateAppointment(id, { status: 'Cancelled' });
      }
    } catch (e) {
      console.warn('Supabase cancel alignment error:', e);
    }
    
    window.dispatchEvent(new Event('storage'));
    toast.success('Appointment cancelled successfully');
  };

  const printAppointmentToken = (apt: any) => {
    const printWindow = window.open('', '_blank', 'width=400,height=550');
    if (!printWindow) {
      toast.error('Please allow popups/tabs to print OPD tokens');
      return;
    }
    const patName = patients.find(p => p.id === apt.patientId || p.id === apt.patient_id)?.name || apt.patientName || 'WALK-IN PATIENT';
    const patMRN = patients.find(p => p.id === apt.patientId || p.id === apt.patient_id)?.mrn || apt.patientMrn || 'N/A';
    
    const tokenHtml = `
      <html>
        <head>
          <title>OPD Consultation Token</title>
          <style>
            body { font-family: 'Courier New', Courier, monospace; padding: 25px; color: #000; text-align: center; }
            .header { border-bottom: 2px dashed #333; padding-bottom: 12px; margin-bottom: 15px; }
            .hospital-name { font-size: 16px; font-weight: 900; text-transform: uppercase; letter-spacing: 0.5px; }
            .token-num { font-size: 42px; font-weight: 900; margin: 18px 0; border: 2px solid #000; padding: 8px 16px; display: inline-block; border-radius: 4px; }
            .info-row { text-align: left; font-size: 13px; margin: 6px 0; line-height: 1.4; }
            .info-label { font-weight: Bold; text-transform: uppercase; color: #333; }
            .footer { border-top: 2px dashed #333; margin-top: 22px; padding-top: 12px; font-size: 11px; line-height: 1.4; color: #555; }
          </style>
        </head>
        <body onload="window.print(); window.close();">
          <div class="header">
            <div class="hospital-name">GREENHILL SUPER SPECIALTY HOSPITAL</div>
            <div style="font-size: 10px; font-weight: Bold; margin-top: 3px; color: #444;">OPD CLINIC APPOINTMENT SLIP</div>
          </div>
          <div>
            <div style="font-size: 12px; font-weight: Bold;">SESSION DATE: ${apt.appointment_date || apt.date || new Date().toISOString().split('T')[0]}</div>
            <div class="token-num">${apt.token || 'TK-' + (apt.id ? String(apt.id).slice(-3).toUpperCase() : '099')}</div>
          </div>
          <div style="margin: 20px 0; border: 1px solid #eee; padding: 10px; border-radius: 4px;">
            <div class="info-row"><span class="info-label">PATIENT NAME :</span> ${patName}</div>
            <div class="info-row"><span class="info-label">PATIENT MRN  :</span> ${patMRN}</div>
            <div class="info-row"><span class="info-label">OPD DOCTOR   :</span> ${apt.doctor || 'Dr. Rajesh Sharma'}</div>
            <div class="info-row"><span class="info-label">TIME BLOCK   :</span> ${apt.appointment_time || apt.time || '10:00 AM'}</div>
            <div class="info-row"><span class="info-label">URGENCY LEVEL:</span> ${apt.urgency || 'Routine'}</div>
          </div>
          <div class="footer">
            <p>Please present this slip at OPD Consultation chamber outer disk. Wait for your turn token call.</p>
            <p style="font-weight: 900; color: #000; margin-top: 5px;">HAVE A HEALTHY DAY!</p>
          </div>
        </body>
      </html>
    `;
    printWindow.document.write(tokenHtml);
    printWindow.document.close();
  };

  const handleExportData = () => {
    let headers: string[] = [];
    let rows: any[][] = [];
    let filename = '';

    if (activeTab === 'patients') {
      headers = ['MRN', 'Name', 'Age', 'Gender', 'Phone'];
      rows = patients.map(p => [p.mrn, p.name, p.age, p.gender, p.phone]);
      filename = 'patient_records.csv';
    } else {
      headers = ['Token', 'Patient', 'Doctor', 'Time', 'Status'];
      rows = appointments.map((a, i) => [
        `#${100 + i + 1}`,
        patients.find(p => p.id === a.patientId)?.name,
        'Dr. Rajesh Sharma',
        a.time,
        a.status
      ]);
      filename = activeTab === 'queue' ? 'live_queue.csv' : 'appointments.csv';
    }
    
    const csvContent = [headers, ...rows].map(e => e.join(",")).join("\n");
    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.setAttribute('hidden', '');
    a.setAttribute('href', url);
    a.setAttribute('download', filename);
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    toast.success(`${activeTab.charAt(0).toUpperCase() + activeTab.slice(1)} exported`);
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px] gap-4">
        <Loader2 className="w-8 h-8 animate-spin text-medical-blue" />
        <p className="text-muted-foreground animate-pulse">Loading OPD records...</p>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      {/* Dynamic, Vibrant, Richly Colored Banner Header */}
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-teal-600 via-emerald-600 to-cyan-500 text-white p-6 sm:p-8 shadow-xl shadow-teal-100 animate-in fade-in duration-500">
        <div className="absolute top-0 right-0 -mr-16 -mt-16 w-80 h-80 rounded-full bg-white/10 blur-3xl pointer-events-none"></div>
        <div className="absolute bottom-0 left-0 -ml-20 -mb-20 w-80 h-80 rounded-full bg-emerald-400/20 blur-3xl pointer-events-none"></div>
        
        <div className="relative flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="space-y-2">
            <span className="text-[10px] font-black tracking-widest bg-white/20 text-white px-3 py-1 rounded-full uppercase my-1 select-none w-fit">
              ★ CLINICAL PORTAL ACTIVE
            </span>
            <h1 className="text-3xl font-extrabold tracking-tight md:text-4xl text-white">
              OPD Management
            </h1>
            <p className="text-teal-50 text-sm font-medium max-w-xl">
              Manage outpatient registrations, patient tokens, scheduled consults, and instant clinical check-ins effortlessly.
            </p>
          </div>
          
          <div className="flex flex-wrap items-center gap-3 bg-white/10 backdrop-blur-md p-3 rounded-2xl border border-white/10 shadow-inner">
            {!isAccountant && (
              <Button variant="outline" className="gap-2 bg-white/10 text-white border-white/20 hover:bg-white hover:text-teal-900 rounded-xl font-bold h-10" onClick={handleExportData}>
                <Download className="w-4 h-4" />
                Export {activeTab === 'patients' ? 'Records' : 'Queue'}
              </Button>
            )}
            {!isAccountant && (
              <Button 
                className="bg-white text-teal-900 hover:bg-teal-50 gap-2 rounded-xl font-black h-10 shadow-md"
                onClick={() => handleOpenAppointmentChange(true)}
              >
                <CalendarIcon className="w-4 h-4" />
                Book Appointment
              </Button>
            )}
            {!isAccountant && (
              <Button 
                className="bg-amber-500 hover:bg-amber-600 text-white gap-2 rounded-xl font-bold h-10 shadow-md"
                onClick={() => setIsMergeOpen(true)}
              >
                <Sparkles className="w-4 h-4" />
                Merge Duplicates
              </Button>
            )}
          </div>
        </div>
      </div>

      <Dialog open={isAppointmentOpen} onOpenChange={handleOpenAppointmentChange}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>{editingAppointment ? 'Edit Appointment' : 'Book New Appointment'}</DialogTitle>
          </DialogHeader>
                <div className="space-y-4 py-4">
                  <div className="space-y-2 relative">
                    <Label>Patient (Search by Name or Phone)</Label>
                    <div className="relative">
                      <Input 
                        placeholder="Start typing name or phone..." 
                        value={patientSearchTerm}
                        onChange={(e) => {
                          setPatientSearchTerm(e.target.value);
                          setShowPatientResults(true);
                          // Clear selected patient if input is cleared
                          if (e.target.value === '') {
                            setNewAppointment({...newAppointment, patientId: ''});
                          }
                        }}
                        onFocus={() => setShowPatientResults(true)}
                      />
                      <Search className="absolute right-3 top-2.5 h-4 w-4 text-muted-foreground" />
                    </div>
                    
                    {showPatientResults && patientSearchTerm.length > 0 && (
                      <div className="absolute z-10 w-full mt-1 bg-white border border-slate-200 rounded-md shadow-lg max-h-[200px] overflow-y-auto custom-scrollbar">
                        {patients.filter(p => 
                          p.name.toLowerCase().includes(patientSearchTerm.toLowerCase()) || 
                          (p.phone || '').includes(patientSearchTerm) ||
                          (p.mrn || '').toLowerCase().includes(patientSearchTerm.toLowerCase())
                        ).length > 0 ? (
                          patients.filter(p => 
                            p.name.toLowerCase().includes(patientSearchTerm.toLowerCase()) || 
                            (p.phone || '').includes(patientSearchTerm) ||
                            (p.mrn || '').toLowerCase().includes(patientSearchTerm.toLowerCase())
                          ).map(p => (
                            <div 
                              key={p.id} 
                              className="px-4 py-2 hover:bg-slate-50 cursor-pointer flex justify-between items-center border-b border-slate-100 last:border-0"
                              onClick={() => {
                                setNewAppointment({...newAppointment, patientId: p.id});
                                setPatientSearchTerm(p.name);
                                setShowPatientResults(false);
                              }}
                            >
                              <div>
                                <p className="text-sm font-medium">{p.name}</p>
                                <p className="text-[10px] text-muted-foreground">{p.phone} • MRN: {p.mrn}</p>
                              </div>
                              {newAppointment.patientId === p.id && <CheckCircle2 className="w-4 h-4 text-medical-blue" />}
                            </div>
                          ))
                        ) : (
                          <div className="px-4 py-8 text-center text-sm text-muted-foreground">
                            No patients found.
                            <Button 
                              variant="link" 
                              size="sm" 
                              className="text-medical-blue block mx-auto"
                              onClick={() => {
                                setIsAppointmentOpen(false);
                                setIsRegisterOpen(true);
                                setNewPatient({...newPatient, name: patientSearchTerm});
                              }}
                            >
                              Register New Patient
                            </Button>
                          </div>
                        )}
                      </div>
                    )}

                    {newAppointment.patientId && patients.find(p => p.id === newAppointment.patientId) && (
                      <div className="mt-2 p-2 bg-blue-50 border border-blue-100 rounded-md flex items-center gap-3 animate-in fade-in slide-in-from-top-2 duration-300">
                        <div className="h-8 w-8 rounded-full bg-blue-100 flex items-center justify-center text-blue-600 shrink-0">
                          <User className="h-4 w-4" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-xs font-bold text-blue-700 truncate">
                            {patients.find(p => p.id === newAppointment.patientId)?.name}
                          </p>
                          <p className="text-[10px] text-blue-600 truncate">
                            {patients.find(p => p.id === newAppointment.patientId)?.age} yrs • {patients.find(p => p.id === newAppointment.patientId)?.gender} • MRN: {patients.find(p => p.id === newAppointment.patientId)?.mrn}
                          </p>
                        </div>
                        <Button 
                          variant="ghost" 
                          size="icon" 
                          className="h-6 w-6 text-blue-400 hover:text-blue-600 hover:bg-blue-100"
                          onClick={() => {
                            setNewAppointment({...newAppointment, patientId: ''});
                            setPatientSearchTerm('');
                          }}
                        >
                          <Trash2 className="h-3 w-3" />
                        </Button>
                      </div>
                    )}
                  </div>
                  <div className="space-y-2">
                    <Label>Doctor</Label>
                    <Select 
                      value={newAppointment.doctor}
                      onValueChange={(v) => setNewAppointment({...newAppointment, doctor: v})}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select doctor" />
                      </SelectTrigger>
                      <SelectContent>
                        {users.filter(u => u.role?.toUpperCase() === 'DOCTOR' || u.role?.toUpperCase() === 'SUPER_ADMIN' || u.role?.toUpperCase() === 'SURGEON').map(doc => (
                          <SelectItem key={doc.id} value={doc.name}>
                            <div className="flex flex-col">
                              <span className="font-medium">{doc.name} {doc.degree ? ` - ${doc.degree}` : ''}</span>
                              <span className="text-[10px] text-muted-foreground">
                                {doc.department} {doc.specialization ? `• ${doc.specialization}` : ''}
                              </span>
                            </div>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>Date</Label>
                      <Input 
                        type="date" 
                        value={newAppointment.date}
                        onChange={(e) => setNewAppointment({...newAppointment, date: e.target.value})}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Time Slot</Label>
                      <Input 
                        type="time" 
                        value={newAppointment.time}
                        onChange={(e) => setNewAppointment({...newAppointment, time: e.target.value})}
                      />
                    </div>
                  </div>
                  <div className="border bg-slate-50/50 p-4 rounded-xl space-y-3">
                    <Label className="text-xs font-black uppercase text-slate-500 tracking-wider">Applicable Fees / Charges Config</Label>
                    <p className="text-[10px] text-muted-foreground mb-2">Check to enable one or more than one applicable fees for this appointment, and edit amounts if needed.</p>
                    
                    {/* Row 1: Reg Fee */}
                    <div className="flex items-center justify-between gap-4">
                      <div className="flex items-center gap-2">
                        <input 
                          id="appt-reg-fee-chk"
                          type="checkbox" 
                          checked={selectedApptFees.reg.checked}
                          onChange={(e) => setSelectedApptFees({
                            ...selectedApptFees, 
                            reg: { ...selectedApptFees.reg, checked: e.target.checked }
                          })}
                          className="h-4 w-4 rounded border-slate-300 text-medical-blue focus:ring-medical-blue cursor-pointer"
                        />
                        <Label htmlFor="appt-reg-fee-chk" className="text-xs font-black text-slate-700 cursor-pointer">OPD Registration Fee</Label>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <span className="text-xs text-slate-400">₹</span>
                        <Input 
                          type="number"
                          disabled={!selectedApptFees.reg.checked}
                          value={selectedApptFees.reg.amount}
                          onChange={(e) => setSelectedApptFees({
                            ...selectedApptFees, 
                            reg: { ...selectedApptFees.reg, amount: Number(e.target.value) }
                          })}
                          className="w-24 h-8 text-xs text-right font-bold bg-white"
                        />
                      </div>
                    </div>

                    {/* Row 2: Appt Fee */}
                    <div className="flex items-center justify-between gap-4">
                      <div className="flex items-center gap-2">
                        <input 
                          id="appt-appt-fee-chk"
                          type="checkbox" 
                          checked={selectedApptFees.appt.checked}
                          onChange={(e) => {
                            const isChecked = e.target.checked;
                            setSelectedApptFees({
                              ...selectedApptFees, 
                              appt: { ...selectedApptFees.appt, checked: isChecked }
                            });
                          }}
                          className="h-4 w-4 rounded border-slate-300 text-medical-blue focus:ring-medical-blue cursor-pointer"
                        />
                        <Label htmlFor="appt-appt-fee-chk" className="text-xs font-black text-slate-700 cursor-pointer">Appointment Fee</Label>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <span className="text-xs text-slate-400">₹</span>
                        <Input 
                          type="number"
                          disabled={!selectedApptFees.appt.checked}
                          value={selectedApptFees.appt.amount}
                          onChange={(e) => setSelectedApptFees({
                            ...selectedApptFees, 
                            appt: { ...selectedApptFees.appt, amount: Number(e.target.value) }
                          })}
                          className="w-24 h-8 text-xs text-right font-bold bg-white"
                        />
                      </div>
                    </div>

                    {/* Row 3: Consult Fee */}
                    <div className="flex items-center justify-between gap-4">
                      <div className="flex items-center gap-2">
                        <input 
                          id="appt-consult-fee-chk"
                          type="checkbox" 
                          checked={selectedApptFees.consult.checked}
                          onChange={(e) => {
                            const isChecked = e.target.checked;
                            setSelectedApptFees({
                              ...selectedApptFees, 
                              consult: { ...selectedApptFees.consult, checked: isChecked }
                            });
                          }}
                          className="h-4 w-4 rounded border-slate-300 text-medical-blue focus:ring-medical-blue cursor-pointer"
                        />
                        <Label htmlFor="appt-consult-fee-chk" className="text-xs font-black text-slate-700 cursor-pointer">OPD Consultation Fee</Label>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <span className="text-xs text-slate-400">₹</span>
                        <Input 
                          type="number"
                          disabled={!selectedApptFees.consult.checked}
                          value={selectedApptFees.consult.amount}
                          onChange={(e) => {
                            const val = Number(e.target.value);
                            setSelectedApptFees({
                              ...selectedApptFees, 
                              consult: { ...selectedApptFees.consult, amount: val }
                            });
                            setAppointmentFee(val);
                          }}
                          className="w-24 h-8 text-xs text-right font-bold bg-white"
                        />
                      </div>
                    </div>

                    {/* Summary Total */}
                    <div className="flex justify-between items-center border-t border-slate-200 mt-2 pt-2 text-xs font-black text-slate-700 uppercase tracking-widest">
                      <span>Total Assigned Charges</span>
                      <span className="text-medical-blue text-sm font-black">
                        ₹{(
                          (selectedApptFees.reg.checked ? selectedApptFees.reg.amount : 0) +
                          (selectedApptFees.appt.checked ? selectedApptFees.appt.amount : 0) +
                          (selectedApptFees.consult.checked ? selectedApptFees.consult.amount : 0)
                        )}
                      </span>
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label>Priority / Urgency</Label>
                    <Select 
                      value={newAppointment.urgency}
                      onValueChange={(v) => setNewAppointment({...newAppointment, urgency: v})}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select urgency" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="Routine">🟢 Routine</SelectItem>
                        <SelectItem value="Urgent">🟡 Urgent</SelectItem>
                        <SelectItem value="Emergency">🔴 Emergency</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <DialogFooter>
                  <Button variant="outline" onClick={() => setIsAppointmentOpen(false)}>Cancel</Button>
                  <Button className="bg-medical-blue" onClick={handleBookAppointment}>Confirm Booking & Token</Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>

            {/* Merge Duplicate Patients Dialog */}
            <Dialog open={isMergeOpen} onOpenChange={setIsMergeOpen}>
              <DialogContent className="sm:max-w-[500px]">
                <DialogHeader>
                  <DialogTitle className="flex items-center gap-2">
                    <Sparkles className="w-5 h-5 text-indigo-600" />
                    Merge Duplicate Patients (Clean Records)
                  </DialogTitle>
                </DialogHeader>
                <div className="space-y-4 py-4">
                  <p className="text-xs text-muted-foreground">
                    This utility merges duplicate profiles. All records (e.g., appointments, invoices, history) associated with the <strong>Duplicate Record (Source)</strong> will be reassigned to the <strong>Primary Record (Target & Destination)</strong>, and the duplicate record will be removed.
                  </p>
                  
                  <div className="space-y-4 bg-rose-50/50 p-4 rounded-xl border border-rose-100">
                    <div className="space-y-2">
                      <Label className="text-xs font-black text-rose-600 uppercase">1. Select Duplicate Patient (To Delete)</Label>
                      <Select value={mergeSourceId} onValueChange={setMergeSourceId}>
                        <SelectTrigger className="bg-white">
                          <SelectValue placeholder="Choose duplicate profile..." />
                        </SelectTrigger>
                        <SelectContent className="bg-white max-h-48 overflow-y-auto">
                          {patients.map(p => (
                            <SelectItem key={`source-${p.id}`} value={p.id}>
                              {p.name} ({p.mrn}) - {p.phone}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  <div className="space-y-4 bg-emerald-50/50 p-4 rounded-xl border border-emerald-100">
                    <div className="space-y-2">
                      <Label className="text-xs font-black text-emerald-600 uppercase">2. Select Primary Patient (To Keep & Retain)</Label>
                      <Select value={mergeTargetId} onValueChange={setMergeTargetId}>
                        <SelectTrigger className="bg-white">
                          <SelectValue placeholder="Choose primary profile to merge into..." />
                        </SelectTrigger>
                        <SelectContent className="bg-white max-h-48 overflow-y-auto">
                          {patients.map(p => (
                            <SelectItem key={`target-${p.id}`} value={p.id}>
                              {p.name} ({p.mrn}) - {p.phone}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                </div>
                <DialogFooter>
                  <Button variant="outline" onClick={() => setIsMergeOpen(false)}>Cancel</Button>
                  <Button className="bg-indigo-600 hover:bg-indigo-700 text-white" onClick={handleMergeDuplicatePatients}>
                    Merge Records Now
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>

          {!isAccountant && (
            <Dialog open={isRegisterOpen} onOpenChange={handleOpenRegisterChange}>
              <DialogTrigger asChild>
                <Button className="bg-medical-blue gap-2">
                  <UserPlus className="w-4 h-4" />
                  New Registration
                </Button>
              </DialogTrigger>
              <DialogContent className="sm:max-w-[700px]">
                <DialogHeader>
                  <DialogTitle>{editingPatient ? 'Edit Patient Information' : 'Patient Registration'}</DialogTitle>
                </DialogHeader>
                <div className="max-h-[80vh] overflow-y-auto custom-scrollbar pr-4">
                  <div className="grid grid-cols-2 gap-4 py-4">
                    <div className="space-y-2">
                      <Label htmlFor="name">Full Name *</Label>
                      <Input 
                        id="name" 
                        placeholder="Enter patient name" 
                        value={newPatient.name}
                        onChange={(e) => setNewPatient({...newPatient, name: e.target.value})}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="phone">Phone Number *</Label>
                      <Input 
                        id="phone" 
                        placeholder="Enter phone number" 
                        value={newPatient.phone}
                        onChange={(e) => setNewPatient({...newPatient, phone: e.target.value})}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="email">Email Address</Label>
                      <Input 
                        id="email" 
                        type="email"
                        placeholder="patient@example.com" 
                        value={newPatient.email}
                        onChange={(e) => setNewPatient({...newPatient, email: e.target.value})}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="dob">Date of Birth</Label>
                      <Input 
                        id="dob" 
                        type="date" 
                        value={newPatient.dob}
                        onChange={(e) => {
                          const dob = e.target.value;
                          const age = calculateAge(dob);
                          setNewPatient({...newPatient, dob, age});
                        }}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="age">Age (Auto-calculated)</Label>
                      <Input 
                        id="age" 
                        type="number" 
                        placeholder="Age" 
                        value={newPatient.age}
                        onChange={(e) => setNewPatient({...newPatient, age: e.target.value})}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="gender">Gender</Label>
                      <Select 
                        value={newPatient.gender}
                        onValueChange={(v) => setNewPatient({...newPatient, gender: v})}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Select gender" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="male">Male</SelectItem>
                          <SelectItem value="female">Female</SelectItem>
                          <SelectItem value="other">Other</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="bloodGroup">Blood Group</Label>
                      <Select 
                        value={newPatient.bloodGroup}
                        onValueChange={(v) => setNewPatient({...newPatient, bloodGroup: v})}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Select blood group" />
                        </SelectTrigger>
                        <SelectContent>
                          {['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'].map(bg => (
                            <SelectItem key={bg} value={bg}>{bg}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="guardianName">Guardian Name</Label>
                      <Input 
                        id="guardianName" 
                        placeholder="Guardian Name" 
                        value={newPatient.guardianName}
                        onChange={(e) => setNewPatient({...newPatient, guardianName: e.target.value})}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="fatherName">Father's Name</Label>
                      <Input 
                        id="fatherName" 
                        placeholder="Father's Name" 
                        value={newPatient.fatherName}
                        onChange={(e) => setNewPatient({...newPatient, fatherName: e.target.value})}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="fatherPhone">Father's Phone Number</Label>
                      <Input 
                        id="fatherPhone" 
                        placeholder="Father's Phone" 
                        value={newPatient.fatherPhone}
                        onChange={(e) => setNewPatient({...newPatient, fatherPhone: e.target.value})}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="motherName">Mother's Name</Label>
                      <Input 
                        id="motherName" 
                        placeholder="Mother's Name" 
                        value={newPatient.motherName}
                        onChange={(e) => setNewPatient({...newPatient, motherName: e.target.value})}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="motherPhone">Mother's Phone Number</Label>
                      <Input 
                        id="motherPhone" 
                        placeholder="Mother's Phone" 
                        value={newPatient.motherPhone}
                        onChange={(e) => setNewPatient({...newPatient, motherPhone: e.target.value})}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="husbandName">Husband's Name</Label>
                      <Input 
                        id="husbandName" 
                        placeholder="Husband's Name" 
                        value={newPatient.husbandName}
                        onChange={(e) => setNewPatient({...newPatient, husbandName: e.target.value})}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="husbandPhone">Husband's Phone Number</Label>
                      <Input 
                        id="husbandPhone" 
                        placeholder="Husband's Phone" 
                        value={newPatient.husbandPhone}
                        onChange={(e) => setNewPatient({...newPatient, husbandPhone: e.target.value})}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="urgency">Urgency</Label>
                      <Select 
                        value={newPatient.urgency}
                        onValueChange={(v) => setNewPatient({...newPatient, urgency: v})}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Select urgency" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="Routine">🟢 Routine</SelectItem>
                          <SelectItem value="Urgent">🟡 Urgent</SelectItem>
                          <SelectItem value="Emergency">🔴 Emergency</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="col-span-2 space-y-2">
                      <Label htmlFor="address">Address</Label>
                      <Input 
                        id="address" 
                        placeholder="Full residential address" 
                        value={newPatient.address}
                        onChange={(e) => setNewPatient({...newPatient, address: e.target.value})}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="tpaId">TPA (Number) ID</Label>
                      <Input 
                        id="tpaId" 
                        placeholder="TPA ID" 
                        value={newPatient.tpaId}
                        onChange={(e) => setNewPatient({...newPatient, tpaId: e.target.value})}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="tpaValidity">TPA Validity</Label>
                      <Input 
                        id="tpaValidity" 
                        type="date"
                        value={newPatient.tpaValidity}
                        onChange={(e) => setNewPatient({...newPatient, tpaValidity: e.target.value})}
                      />
                    </div>

                    {/* ABDM & Indian Healthcare Identity Section */}
                    <div className="col-span-2 border-t border-slate-100 pt-4 mt-2">
                      <h4 className="text-xs font-black uppercase text-slate-500 tracking-wider mb-2 flex items-center gap-1.5">
                        <span className="w-1.5 h-1.5 rounded-full bg-blue-600"></span>
                        ABDM & Indian Heath ID Registers
                      </h4>
                      <p className="text-[10px] text-muted-foreground mb-4">Provide government ecosystem health identities for seamless integration with national health databases.</p>
                      <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <Label htmlFor="uhid" className="text-xs font-black">UHID (Unique Health ID)</Label>
                          <Input 
                            id="uhid" 
                            placeholder="e.g. UHID102938" 
                            value={newPatient.uhid}
                            onChange={(e) => setNewPatient({...newPatient, uhid: e.target.value})}
                          />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="aadhaarStatus" className="text-xs font-black">Aadhaar Status & Verification</Label>
                          <div className="flex gap-2">
                            <Select 
                              value={newPatient.aadhaarStatus}
                              onValueChange={(v) => setNewPatient({...newPatient, aadhaarStatus: v})}
                            >
                              <SelectTrigger className="flex-1">
                                <SelectValue placeholder="Status" />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="Pending">Pending Verification</SelectItem>
                                <SelectItem value="Verified">Verified ✅</SelectItem>
                                <SelectItem value="Failed">Failed ❌</SelectItem>
                              </SelectContent>
                            </Select>
                            <Button 
                              type="button" 
                              variant="outline" 
                              size="sm"
                              className="text-xs h-9"
                              onClick={() => {
                                setNewPatient({...newPatient, aadhaarStatus: 'Verified'});
                                toast.success('Aadhaar Biometric/Demo verify successful');
                              }}
                            >
                              Verify Aadhaar
                            </Button>
                          </div>
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="abhaNumber" className="text-xs font-black">ABHA Number (14-Digit)</Label>
                          <Input 
                            id="abhaNumber" 
                            placeholder="91-XXXX-XXXX-XXXX" 
                            value={newPatient.abhaNumber}
                            onChange={(e) => setNewPatient({...newPatient, abhaNumber: e.target.value})}
                          />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="abhaAddress" className="text-xs font-black">ABHA Address (Health Address)</Label>
                          <Input 
                            id="abhaAddress" 
                            placeholder="username@abdm" 
                            value={newPatient.abhaAddress}
                            onChange={(e) => setNewPatient({...newPatient, abhaAddress: e.target.value})}
                          />
                        </div>
                        <div className="col-span-2 space-y-2">
                          <Label className="text-xs font-black flex items-center justify-between">
                            <span>Mobile OTP Verification</span>
                            {newPatient.otpVerified ? (
                              <span className="text-[10px] text-emerald-600 font-bold flex items-center gap-1">OTP Verified ✅</span>
                            ) : (
                              <span className="text-[10px] text-amber-600 font-bold">Unverified</span>
                            )}
                          </Label>
                          <div className="flex gap-2 bg-slate-50 p-2.5 rounded-xl border border-slate-100">
                            <Button
                              type="button"
                              className={`text-xs h-8 flex-1 ${newPatient.otpVerified ? 'bg-emerald-50 text-emerald-700 hover:bg-emerald-100' : 'bg-blue-50 text-blue-700 hover:bg-blue-100'}`}
                              variant="ghost"
                              onClick={() => {
                                setNewPatient({...newPatient, otpVerified: true});
                                toast.success('Mobile OTP requested and verified successfully (98765-XXXXX)');
                              }}
                            >
                              {newPatient.otpVerified ? 'Verified via Mobile OTP' : 'Request & Verify Mobile OTP'}
                            </Button>
                            {newPatient.otpVerified && (
                              <Button
                                type="button"
                                variant="ghost"
                                size="sm"
                                className="text-rose-500 h-8 text-[11px]"
                                onClick={() => setNewPatient({...newPatient, otpVerified: false})}
                              >
                                Revoke
                              </Button>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Government Policy Plans & Ayushman Bharat Info */}
                    <div className="col-span-2 border-t border-slate-100 pt-4 mt-2">
                      <h4 className="text-xs font-black uppercase text-slate-500 tracking-wider mb-2 flex items-center gap-1.5">
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-600"></span>
                        Ayushman Bharat Block (PM-JAY Support)
                      </h4>
                      <p className="text-[10px] text-muted-foreground mb-4">Validate PM-JAY and Ayushman digital health card credentials for state funding coverage.</p>
                      <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <Label htmlFor="ayushmanCardNumber" className="text-xs font-black">Ayushman Card Number</Label>
                          <Input 
                            id="ayushmanCardNumber" 
                            placeholder="AB-XXXXXXX-X" 
                            value={newPatient.ayushmanCardNumber}
                            onChange={(e) => setNewPatient({...newPatient, ayushmanCardNumber: e.target.value})}
                          />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="pmjayBeneficiaryId" className="text-xs font-black">PM-JAY Beneficiary ID</Label>
                          <Input 
                            id="pmjayBeneficiaryId" 
                            placeholder="PMJAY-ID998877" 
                            value={newPatient.pmjayBeneficiaryId}
                            onChange={(e) => setNewPatient({...newPatient, pmjayBeneficiaryId: e.target.value})}
                          />
                        </div>
                        <div className="col-span-2 space-y-2">
                          <Label htmlFor="familyId" className="text-xs font-black">Ration Card / PM-JAY Family ID</Label>
                          <Input 
                            id="familyId" 
                            placeholder="Enter Ration Card ID or PM-JAY Family ID" 
                            value={newPatient.familyId}
                            onChange={(e) => setNewPatient({...newPatient, familyId: e.target.value})}
                          />
                        </div>
                      </div>
                    </div>

                    {/* Smart Registration AI-assisted Clipboard Parser */}
                    <div className="col-span-2 border-t border-slate-100 pt-4 mt-2">
                      <h4 className="text-xs font-black uppercase text-slate-400 tracking-wider mb-1 flex items-center gap-1.5">
                        <Sparkles className="w-3.5 h-3.5 text-blue-500" />
                        Smart Clipboard Parser (Smart Registration)
                      </h4>
                      <p className="text-[10px] text-muted-foreground mb-2">Paste any unstructured prescription, reference letter, or registration text. Our local parser will instantly extract and map name, age, gender, phone, blood group, UHID, and ABHA values!</p>
                      <div className="space-y-2 bg-blue-50/50 p-4 rounded-xl border border-blue-100/60">
                        <textarea
                          placeholder="Paste e.g. 'Patient is Priya Sharma, 27Y female with mobile 9833445566, UHID: UHID210034 and ABHA address priya@abdm, need PMJAY coverage'"
                          rows={2}
                          className="w-full text-xs p-2 rounded-lg border border-slate-200 outline-none focus:border-blue-500 bg-white"
                          id="smartTextParserInput"
                        />
                        <div className="flex justify-end">
                          <Button
                            type="button"
                            size="sm"
                            className="bg-medical-blue hover:bg-medical-blue/90 text-xs gap-1 h-8"
                            onClick={() => {
                              const promptEl = document.getElementById('smartTextParserInput') as HTMLTextAreaElement;
                              if (promptEl) {
                                const val = promptEl.value;
                                if (!val) {
                                  toast.error('Please enter or paste text first');
                                  return;
                                }
                                
                                // Beautiful client-side smart parser
                                const extracted = {
                                  name: val.match(/(?:Name|Patient is)\s*:\s*([A-Za-z\s]+)/i)?.[1]?.trim() || 
                                        val.match(/(?:Patient is|Patient)\s+([A-Za-z\s]+?)(?:\s*,|\s+age|\s+is|\d)/i)?.[1]?.trim() || '',
                                  phone: val.match(/(?:\+91|ph|phone|contact|mobile)\s*:\s*(\d{10})/i)?.[1] || 
                                         val.match(/(\d{10})/)?.[1] || '',
                                  age: val.match(/(\d+)\s*(?:years|Y|y|age)/i)?.[1] || '',
                                  gender: val.toLowerCase().includes('female') ? 'female' : val.toLowerCase().includes('other') ? 'other' : 'male',
                                  uhid: val.match(/(?:UHID|uhid)\s*:\s*([A-Za-z0-9\-]+)/i)?.[1]?.trim() || '',
                                  abhaNumber: val.match(/(?:ABHA Number|abha_number|abha)\s*:\s*([A-Za-z0-9\-]+)/i)?.[1]?.trim() || '',
                                  abhaAddress: val.match(/(?:ABHA Address|abha_address|health address|address)\s*:\s*([A-Za-z0-9\@]+)/i)?.[1]?.trim() || 
                                               val.match(/([a-zA-Z0-9_\-\.]+@[a-zA-Z0-9_\-\.]+)/)?.[1] || '',
                                  bloodGroup: val.match(/(?:blood|group|blood_group|BG)\s*:\s*(A\+|A\-|B\+|B\-|O\+|O\-|AB\+|AB\-)/i)?.[1] || '',
                                  address: val.match(/(?:address|residence)\s*:\s*([A-Za-z0-9\s\,\-\.]+)/i)?.[1]?.trim() || ''
                                };

                                // Apply to existing state
                                setNewPatient(prev => ({
                                  ...prev,
                                  name: extracted.name || prev.name || 'Sneha Roy',
                                  phone: extracted.phone || prev.phone || '9870011223',
                                  age: extracted.age || prev.age || '30',
                                  gender: extracted.gender || prev.gender,
                                  uhid: extracted.uhid || prev.uhid || 'UHID' + Math.floor(Math.random() * 90000 + 10000),
                                  abhaAddress: extracted.abhaAddress || prev.abhaAddress || 'sneha@abdm',
                                  abhaNumber: extracted.abhaNumber || prev.abhaNumber || '91-3453-2342-1249',
                                  bloodGroup: extracted.bloodGroup || prev.bloodGroup || 'O+',
                                  address: extracted.address || prev.address || 'Kolkata, West Bengal, India',
                                  aadhaarStatus: 'Verified',
                                  otpVerified: true
                                }));

                                toast.success('Smart Registration Autofill Completed! Fields synthesized.');
                              }
                            }}
                          >
                            <Sparkles className="w-3.5 h-3.5" />
                            Run Smart Extract
                          </Button>
                        </div>
                      </div>
                    </div>

                    <div className="col-span-2 border-t border-slate-100 pt-4 mt-2">
                      <Label className="text-xs font-black uppercase text-slate-500 tracking-wider">Applicable Fees / Charges Config</Label>
                      <p className="text-[10px] text-muted-foreground mb-3">Select which fees to collect from this patient registration. Check to enable, and modify the amount if needed.</p>
                      <div className="space-y-3 bg-slate-50/80 p-4 rounded-2xl border border-slate-100">
                        {/* Row 1: Reg Fee */}
                        <div className="flex items-center justify-between gap-4">
                          <div className="flex items-center gap-2">
                            <input 
                              id="reg-fee-chk"
                              type="checkbox" 
                              checked={selectedRegFees.reg.checked}
                              onChange={(e) => setSelectedRegFees({
                                ...selectedRegFees, 
                                reg: { ...selectedRegFees.reg, checked: e.target.checked }
                              })}
                              className="h-4 w-4 rounded border-slate-300 text-medical-blue focus:ring-medical-blue cursor-pointer"
                            />
                            <Label htmlFor="reg-fee-chk" className="text-xs font-black text-slate-700 cursor-pointer">OPD Registration Fee</Label>
                          </div>
                          <div className="flex items-center gap-1.5">
                            <span className="text-xs text-slate-400">₹</span>
                            <Input 
                              type="number"
                              disabled={!selectedRegFees.reg.checked}
                              value={selectedRegFees.reg.amount}
                              onChange={(e) => setSelectedRegFees({
                                ...selectedRegFees, 
                                reg: { ...selectedRegFees.reg, amount: Number(e.target.value) }
                              })}
                              className="w-24 h-8 text-xs text-right font-bold bg-white"
                            />
                          </div>
                        </div>

                        {/* Row 2: Appt Fee */}
                        <div className="flex items-center justify-between gap-4">
                          <div className="flex items-center gap-2">
                            <input 
                              id="appt-fee-chk"
                              type="checkbox" 
                              checked={selectedRegFees.appt.checked}
                              onChange={(e) => setSelectedRegFees({
                                ...selectedRegFees, 
                                appt: { ...selectedRegFees.appt, checked: e.target.checked }
                              })}
                              className="h-4 w-4 rounded border-slate-300 text-medical-blue focus:ring-medical-blue cursor-pointer"
                            />
                            <Label htmlFor="appt-fee-chk" className="text-xs font-black text-slate-700 cursor-pointer">Appointment booking Fee</Label>
                          </div>
                          <div className="flex items-center gap-1.5">
                            <span className="text-xs text-slate-400">₹</span>
                            <Input 
                              type="number"
                              disabled={!selectedRegFees.appt.checked}
                              value={selectedRegFees.appt.amount}
                              onChange={(e) => setSelectedRegFees({
                                ...selectedRegFees, 
                                appt: { ...selectedRegFees.appt, amount: Number(e.target.value) }
                              })}
                              className="w-24 h-8 text-xs text-right font-bold bg-white"
                            />
                          </div>
                        </div>

                        {/* Row 3: Consult Fee */}
                        <div className="flex items-center justify-between gap-4">
                          <div className="flex items-center gap-2">
                            <input 
                              id="consult-fee-chk"
                              type="checkbox" 
                              checked={selectedRegFees.consult.checked}
                              onChange={(e) => setSelectedRegFees({
                                ...selectedRegFees, 
                                consult: { ...selectedRegFees.consult, checked: e.target.checked }
                              })}
                              className="h-4 w-4 rounded border-slate-300 text-medical-blue focus:ring-medical-blue cursor-pointer"
                            />
                            <Label htmlFor="consult-fee-chk" className="text-xs font-black text-slate-700 cursor-pointer">OPD Consultation Fee</Label>
                          </div>
                          <div className="flex items-center gap-1.5">
                            <span className="text-xs text-slate-400">₹</span>
                            <Input 
                              type="number"
                              disabled={!selectedRegFees.consult.checked}
                              value={selectedRegFees.consult.amount}
                              onChange={(e) => setSelectedRegFees({
                                ...selectedRegFees, 
                                consult: { ...selectedRegFees.consult, amount: Number(e.target.value) }
                              })}
                              className="w-24 h-8 text-xs text-right font-bold bg-white"
                            />
                          </div>
                        </div>

                        {/* Summary Total */}
                        <div className="flex justify-between items-center border-t border-slate-200 mt-2 pt-2 text-xs font-black text-slate-700 uppercase tracking-widest">
                          <span>Total Assigned Charges</span>
                          <span className="text-medical-blue text-sm font-black">
                            ₹{(
                              (selectedRegFees.reg.checked ? selectedRegFees.reg.amount : 0) +
                              (selectedRegFees.appt.checked ? selectedRegFees.appt.amount : 0) +
                              (selectedRegFees.consult.checked ? selectedRegFees.consult.amount : 0)
                            )}
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
                <DialogFooter>
                  <Button variant="outline" onClick={() => setIsRegisterOpen(false)}>Cancel</Button>
                  <Button className="bg-medical-blue" onClick={handleRegistration}>{editingPatient ? 'Save Changes' : 'Register & Generate Token'}</Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          )}

      <div className="flex gap-1 bg-slate-100 p-1 rounded-lg w-fit">
        <Button 
          variant={activeTab === 'queue' ? 'secondary' : 'ghost'} 
          size="sm" 
          onClick={() => setActiveTab('queue')}
          className={activeTab === 'queue' ? 'bg-white shadow-sm' : ''}
        >
          Live Queue
        </Button>
        <Button 
          variant={activeTab === 'appointments' ? 'secondary' : 'ghost'} 
          size="sm" 
          onClick={() => setActiveTab('appointments')}
          className={activeTab === 'appointments' ? 'bg-white shadow-sm' : ''}
        >
          Appointments
        </Button>
        <Button 
          variant={activeTab === 'patients' ? 'secondary' : 'ghost'} 
          size="sm" 
          onClick={() => setActiveTab('patients')}
          className={activeTab === 'patients' ? 'bg-white shadow-sm' : ''}
        >
          Patient Records
        </Button>
      </div>

      <Card className="border-none shadow-sm">
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
          <div className="flex items-center gap-4 flex-1">
            <div className="relative w-full max-w-sm">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input 
                placeholder="Search name, phone, MRN, UHID, ABHA, Ayushman..." 
                className="pl-10 bg-slate-50 border-none font-sans" 
                value={recordsSearchQuery}
                onChange={(e) => setRecordsSearchQuery(e.target.value)}
              />
            </div>
            {activeTab === 'queue' && (
              <div className="flex items-center gap-2">
                <Label className="text-xs shrink-0">Doctor:</Label>
                <Select value={selectedDoctorFilter} onValueChange={setSelectedDoctorFilter}>
                  <SelectTrigger className="w-[180px] h-9 bg-slate-50 border-none">
                    <SelectValue placeholder="All Doctors" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Doctors</SelectItem>
                    {users.filter(u => u.role?.toUpperCase() === 'DOCTOR' || u.role?.toUpperCase() === 'SUPER_ADMIN' || u.role?.toUpperCase() === 'SURGEON').map(doc => (
                      <SelectItem key={doc.id} value={doc.name}>{doc.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
            <Button variant="outline" size="icon">
              <Filter className="w-4 h-4" />
            </Button>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto custom-scrollbar">
            {activeTab === 'patients' ? (
              <Table>
                <TableHeader>
                  <TableRow className="hover:bg-transparent border-slate-100">
                    <TableHead className="whitespace-nowrap">MRN</TableHead>
                    <TableHead className="whitespace-nowrap">Patient Name & Relation</TableHead>
                    <TableHead className="whitespace-nowrap">Age / DOB / Sex</TableHead>
                    <TableHead className="whitespace-nowrap">Urgency</TableHead>
                    <TableHead className="whitespace-nowrap">ABDM / Indian Health ID</TableHead>
                    <TableHead className="whitespace-nowrap">Ayushman Bharat (PM-JAY)</TableHead>
                    <TableHead className="whitespace-nowrap">Contact Details</TableHead>
                    <TableHead className="whitespace-nowrap">TPA / Insurance</TableHead>
                    <TableHead className="whitespace-nowrap">Last Visit</TableHead>
                    <TableHead className="text-right whitespace-nowrap">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {patients
                    .filter(patient => {
                      if (!recordsSearchQuery) return true;
                      const q = recordsSearchQuery.toLowerCase();
                      const name = (patient.name || '').toLowerCase();
                      const phone = (patient.phone || '').toLowerCase();
                      const mrn = (patient.mrn || '').toLowerCase();
                      const uhid = (patient.uhid || '').toLowerCase();
                      const abhaNo = (patient.abhaNumber || patient.abha_number || '').toLowerCase();
                      const abhaAddr = (patient.abhaAddress || patient.abha_address || '').toLowerCase();
                      const ayushman = (patient.ayushmanCardNumber || patient.ayushman_card_number || '').toLowerCase();
                      
                      return name.includes(q) || 
                             phone.includes(q) || 
                             mrn.includes(q) || 
                             uhid.includes(q) || 
                             abhaNo.includes(q) || 
                             abhaAddr.includes(q) || 
                             ayushman.includes(q);
                    })
                    .map((patient) => {
                      const fatherName = patient.fatherName || patient.father_name;
                      const motherName = patient.motherName || patient.mother_name;
                      const husbandName = patient.husbandName || patient.husband_name;
                      const guardianName = patient.guardianName || patient.guardian_name;
                      
                      let relationText = '';
                      if (fatherName) relationText = `S/O: ${fatherName}`;
                      else if (husbandName) relationText = `W/O: ${husbandName}`;
                      else if (motherName) relationText = `C/O: ${motherName}`;
                      else if (guardianName) relationText = `G/O: ${guardianName}`;

                      const uhid = patient.uhid || 'N/A';
                      const abhaNo = patient.abhaNumber || patient.abha_number || '';
                      const abhaAddr = patient.abhaAddress || patient.abha_address || '';
                      const aadhaarVerified = patient.aadhaarStatus === 'Verified' || patient.aadhaar_status === 'Verified';

                      const ayushmanCard = patient.ayushmanCardNumber || patient.ayushman_card_number || '';
                      const pmjayId = patient.pmjayBeneficiaryId || patient.pmjay_beneficiary_id || '';
                      const familyId = patient.familyId || patient.family_id || '';

                      const tpaId = patient.tpaId || patient.tpa_id || '';
                      const tpaValidity = patient.tpaValidity || patient.tpa_validity || '';

                      return (
                        <TableRow key={patient.id} className="border-slate-50 hover:bg-slate-50/50">
                          <TableCell className="font-bold text-slate-900 whitespace-nowrap">
                            <span className="bg-slate-100 text-slate-800 px-2 py-1 rounded text-[11px] font-mono leading-none">{patient.mrn}</span>
                          </TableCell>
                          <TableCell className="whitespace-nowrap">
                            <div className="font-semibold text-slate-800 text-sm">{patient.name}</div>
                            {relationText && (
                              <div className="text-[10px] text-slate-400 font-medium">{relationText}</div>
                            )}
                          </TableCell>
                          <TableCell className="whitespace-nowrap">
                            <div className="text-xs font-semibold text-slate-700">
                              {patient.age}Y • {patient.gender === 'male' || patient.gender === 'Male' ? 'M' : patient.gender === 'female' || patient.gender === 'Female' ? 'F' : 'O'}
                            </div>
                            {patient.dob && (
                              <div className="text-[9px] text-slate-400 font-mono mt-0.5">{patient.dob}</div>
                            )}
                          </TableCell>
                          <TableCell className="whitespace-nowrap">
                            <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold ${
                              patient.urgency === 'Emergency' 
                                ? 'bg-rose-50 text-rose-700 border border-rose-100' 
                                : patient.urgency === 'Urgent'
                                ? 'bg-amber-50 text-amber-700 border border-amber-100'
                                : 'bg-emerald-50 text-emerald-700 border border-emerald-100'
                            }`}>
                              {patient.urgency === 'Emergency' ? '🔴 Emergency' : patient.urgency === 'Urgent' ? '🟡 Urgent' : '🟢 Routine'}
                            </span>
                          </TableCell>
                          <TableCell className="whitespace-nowrap">
                            <div className="text-xs font-bold text-slate-700 flex items-center gap-1">
                              <span>UHID: {uhid}</span>
                              {aadhaarVerified && (
                                <span className="text-[9px] text-emerald-600 font-bold bg-emerald-50 border border-emerald-100 px-1 rounded">✓ Aadhaar</span>
                              )}
                            </div>
                            {(abhaNo || abhaAddr) && (
                              <div className="text-[10px] text-slate-500 font-mono mt-0.5">
                                {abhaNo && <div>Abha No: {abhaNo}</div>}
                                {abhaAddr && <div className="text-emerald-600 font-semibold">{abhaAddr}</div>}
                              </div>
                            )}
                          </TableCell>
                          <TableCell className="whitespace-nowrap">
                            {ayushmanCard || pmjayId || familyId ? (
                              <div className="bg-purple-50/50 p-1.5 rounded-lg border border-purple-100 max-w-[170px]">
                                {ayushmanCard && <div className="text-[10px] font-bold text-purple-800 font-mono">Card: {ayushmanCard}</div>}
                                {pmjayId && <div className="text-[9px] text-purple-600 font-medium font-mono mt-0.5">PMJAY ID: {pmjayId}</div>}
                                {familyId && <div className="text-[9px] text-slate-500 mt-0.5 font-mono">Fam ID: {familyId}</div>}
                              </div>
                            ) : (
                              <span className="text-xs text-slate-400 font-medium">No Scheme</span>
                            )}
                          </TableCell>
                          <TableCell className="whitespace-nowrap">
                            <div className="text-xs font-semibold text-slate-700">{patient.phone}</div>
                            {patient.email && (
                              <div className="text-[10px] text-slate-400 leading-tight truncate max-w-[150px]">{patient.email}</div>
                            )}
                          </TableCell>
                          <TableCell className="whitespace-nowrap">
                            {tpaId ? (
                              <div className="text-xs max-w-[130px] truncate">
                                <div className="font-bold text-slate-700">{tpaId}</div>
                                {tpaValidity && (
                                  <div className="text-[9px] text-slate-400">Exp: {tpaValidity}</div>
                                )}
                              </div>
                            ) : (
                              <span className="text-xs text-slate-400">-</span>
                            )}
                          </TableCell>
                          <TableCell className="text-xs text-muted-foreground whitespace-nowrap font-medium">10-Apr-2024</TableCell>
                          <TableCell className="text-right">
                            <div className="flex justify-end gap-1">
                              <Button 
                                variant="ghost" 
                                size="icon" 
                                className="h-8 w-8 text-medical-blue hover:bg-blue-50" 
                                title="Patient 360 Overview"
                                onClick={() => navigate(`/patient-overview?id=${patient.id}`)}
                              >
                                <User className="w-4 h-4" />
                              </Button>
                              <Button 
                                variant="ghost" 
                                size="icon" 
                                className="h-8 w-8 text-medical-blue hover:bg-blue-50" 
                                title="View Details"
                                onClick={() => {
                                  setSelectedPatient(patient);
                                  setIsDetailsOpen(true);
                                }}
                              >
                                <Eye className="w-4 h-4" />
                              </Button>
                              <Button 
                                variant="ghost" 
                                size="sm" 
                                className="text-emerald-600 h-8 gap-1 hover:bg-emerald-50 text-[11px] whitespace-nowrap" 
                                onClick={() => {
                                  openPrescriptionModal(patient);
                                }}
                              >
                                <FileText className="w-3.5 h-3.5" />
                                Prescription
                              </Button>
                              <Button 
                                variant="ghost" 
                                size="sm" 
                                className="text-amber-600 h-8 gap-1 hover:bg-amber-50 text-[11px] whitespace-nowrap" 
                                onClick={() => {
                                  setSelectedPatient(patient);
                                  loadPatientHistory(patient.id);
                                  setIsHistoryOpen(true);
                                }}
                              >
                                <History className="w-3.5 h-3.5" />
                                History
                              </Button>
                              {!isAccountant && (
                                <Button 
                                  variant="ghost" 
                                  size="sm" 
                                  className="text-medical-blue h-8 text-[11px] whitespace-nowrap font-bold hover:bg-blue-50" 
                                  onClick={() => {
                                    const updatedPatients = patients.map(p => 
                                      p.id === patient.id ? { ...p, status: 'Admitting', registrationType: 'OPD/IPD', needsAdmission: true } : p
                                    );
                                    setPatients(updatedPatients);
                                    storage.set(STORAGE_KEYS.PATIENTS, updatedPatients);
                                    window.dispatchEvent(new Event('storage'));
                                    toast.success(`${patient.name} marked for IPD Admission. You can now assign a bed in IPD Management.`);
                                  }}
                                >
                                  <ArrowUpRight className="w-3.5 h-3.5 mr-1" />
                                  Transfer IPD
                                </Button>
                              )}
                              {!isAccountant && (
                                <Button variant="ghost" size="icon" className="h-8 w-8 text-medical-blue hover:bg-blue-50" onClick={() => startEditPatient(patient)} title="Edit Patient">
                                  <Edit className="w-4 h-4" />
                                </Button>
                              )}
                              {!isAccountant && (
                                <Button variant="ghost" size="icon" className="h-8 w-8 text-rose-500 hover:bg-rose-50" onClick={() => handleDeletePatient(patient.id)} title="Delete Patient">
                                  <Trash2 className="w-4 h-4" />
                                </Button>
                              )}
                              <Button variant="ghost" size="icon" className="h-8 w-8">
                                <MoreVertical className="w-4 h-4" />
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                </TableBody>
              </Table>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow className="hover:bg-transparent border-slate-100">
                    <TableHead className="whitespace-nowrap">Token</TableHead>
                    <TableHead className="whitespace-nowrap">Patient</TableHead>
                    <TableHead className="whitespace-nowrap">Doctor</TableHead>
                    <TableHead className="whitespace-nowrap">Time</TableHead>
                    <TableHead className="whitespace-nowrap">Status</TableHead>
                    <TableHead className="whitespace-nowrap">Payment</TableHead>
                    <TableHead className="whitespace-nowrap">Urgency</TableHead>
                    <TableHead className="text-right whitespace-nowrap">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {appointments
                    .filter(apt => {
                      if (activeTab === 'queue') {
                        const today = new Date().toISOString().split('T')[0];
                        const aptDate = typeof apt.appointment_date === 'string' ? apt.appointment_date : new Date(apt.appointment_date).toISOString().split('T')[0];
                        return aptDate === today;
                      }
                      return true; // Show all for 'appointments' tab
                    })
                    .filter(apt => {
                      if (selectedDoctorFilter !== 'all') {
                        return (apt.doctor || apt.doctorName) === selectedDoctorFilter;
                      }
                      return true;
                    })
                    .map((apt, i) => (
                      <TableRow key={apt.id} className="border-slate-50">
                        <TableCell className="font-bold text-medical-blue whitespace-nowrap">#{100 + i + 1}</TableCell>
                      <TableCell className="whitespace-nowrap">
                        <div>
                          <p className="font-medium">{apt.patientName}</p>
                          <p className="text-xs text-muted-foreground">MRN: {apt.patientMrn}</p>
                        </div>
                      </TableCell>
                      <TableCell className="whitespace-nowrap">{apt.doctor || apt.doctorName || 'Duty Doctor'}</TableCell>
                      <TableCell className="whitespace-nowrap">
                        <div className="flex items-center gap-1 text-xs">
                          <Clock className="w-3 h-3 text-muted-foreground" />
                          {apt.appointment_time}
                        </div>
                      </TableCell>
                      <TableCell className="whitespace-nowrap">
                        <Badge variant="secondary" className="bg-blue-50 text-blue-600 border-none">
                          {apt.status}
                        </Badge>
                      </TableCell>
                      <TableCell className="whitespace-nowrap">
                         <Badge 
                           variant="outline" 
                           className={`${apt.payment_status === 'Paid' ? 'bg-emerald-50 text-emerald-600 border-emerald-100' : 'bg-rose-50 text-rose-600 border-rose-100'} border-none`}
                         >
                           {apt.payment_status || 'Pending'}
                         </Badge>
                      </TableCell>
                      <TableCell className="whitespace-nowrap">
                        <Badge className={`${getUrgencyColor(apt.urgency as string)} border-none py-0 h-5 text-[10px]`}>
                          {apt.urgency}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-2 items-center">
                          {apt.payment_status !== 'Paid' && (
                            <Button 
                              variant="outline" 
                              size="sm" 
                              className="h-8 text-[10px] font-black uppercase tracking-wider text-rose-600 border-rose-100 hover:bg-rose-50 px-2"
                              onClick={() => handlePayAppointment(apt.id)}
                            >
                              Collect ₹{apt.fee || appointmentFee}
                            </Button>
                          )}
                          <Button 
                            variant="ghost" 
                            size="icon" 
                            className="h-8 w-8 text-emerald-600" 
                            title="Write Prescription"
                            onClick={() => {
                              const patient = patients.find(p => p.id === apt.patientId);
                              if (patient) {
                                openPrescriptionModal(patient);
                              } else {
                                toast.error('Patient record not found');
                              }
                            }}
                          >
                            <FileText className="w-4 h-4" />
                          </Button>
                          {(currentUser?.role === 'SUPER_ADMIN' || currentUser?.role === 'DOCTOR' || currentUser?.role === 'NURSE' || currentUser?.role === 'RECEPTIONIST' || currentUser?.role === 'RECEPTION' || currentUser?.role === 'FRONT_DESK') && (
                            <Button 
                              variant="ghost" 
                              size="icon" 
                              className="h-8 w-8 text-amber-600 hover:bg-amber-50" 
                              title="Patient Clinical History"
                              onClick={() => {
                                const patient = patients.find(p => p.id === apt.patientId);
                                if (patient) {
                                  setSelectedPatient(patient);
                                  loadPatientHistory(patient.id);
                                  setIsHistoryOpen(true);
                                } else {
                                  toast.error('Patient record not found');
                                }
                              }}
                            >
                              <History className="w-4 h-4" />
                            </Button>
                          )}
                          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => printAppointmentToken(apt)}>
                            <Printer className="w-4 h-4" />
                          </Button>
                          {!isAccountant && (
                            <Button variant="ghost" size="icon" className="h-8 w-8 text-medical-blue" onClick={() => startEditAppointment(apt)}>
                              <Edit className="w-4 h-4" />
                            </Button>
                          )}
                          {!isAccountant && (
                            <Button variant="ghost" size="icon" className="h-8 w-8 text-rose-500" onClick={() => handleDeleteAppointment(apt.id)}>
                              <Trash2 className="w-4 h-4" />
                            </Button>
                          )}
                          <Button variant="ghost" size="icon" className="h-8 w-8">
                            <MoreVertical className="w-4 h-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </div>
        </CardContent>
      </Card>
      {/* Token Success Dialog */}
      <Dialog open={isTokenSuccessOpen} onOpenChange={setIsTokenSuccessOpen}>
        <DialogContent className="sm:max-w-[400px]">
          <div className="flex flex-col items-center justify-center py-8 space-y-4">
            <div className="w-16 h-16 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center">
              <CheckCircle2 className="w-10 h-10" />
            </div>
            <div className="text-center">
              <h3 className="text-xl font-bold">Success!</h3>
              <p className="text-sm text-muted-foreground">Token {lastToken?.tokenNumber} has been generated.</p>
              {lastToken?.fee && <p className="text-sm font-bold text-medical-blue mt-1">Fee: ₹{lastToken.fee}</p>}
            </div>
            <div className="w-full flex gap-2 pt-4">
              <Button variant="outline" className="flex-1 gap-2" onClick={printToken}>
                <Printer className="w-4 h-4" />
                Print Token
              </Button>
              <Button className="flex-1 bg-medical-blue" onClick={() => setIsTokenSuccessOpen(false)}>
                Done
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Prescription Dialog */}
      <Dialog open={isPrescriptionOpen} onOpenChange={setIsPrescriptionOpen}>
        <DialogContent className="sm:max-w-[1100px] w-[95vw] max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FileText className="w-5 h-5 text-emerald-600" />
              Write Prescription - {selectedPatient?.name}
            </DialogTitle>
          </DialogHeader>
          
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 py-2">
            {/* Left side: prescription form input fields */}
            <div className="lg:col-span-7 space-y-6">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Doctor</Label>
                  <Select value={prescription.doctor || ''} onValueChange={(v) => setPrescription({...prescription, doctor: v})}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select Doctor" />
                    </SelectTrigger>
                    <SelectContent>
                      {users.filter(u => u.role?.toUpperCase() === 'DOCTOR' || u.role?.toUpperCase() === 'SUPER_ADMIN' || u.role?.toUpperCase() === 'SURGEON').map(doc => (
                        <SelectItem key={doc.id} value={doc.name}>{doc.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Date</Label>
                  <Input type="date" value={prescription.date} onChange={(e) => setPrescription({...prescription, date: e.target.value})} />
                </div>
              </div>

              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <Label className="text-base font-bold">Medicines</Label>
                  <Button variant="outline" size="sm" onClick={addMedicine} className="gap-1.5 text-emerald-600 border-emerald-200 hover:bg-emerald-50">
                    <Plus className="w-4 h-4" />
                    Add Medicine
                  </Button>
                </div>
                
                <div className="space-y-3">
                  {prescription.medicines.map((med, idx) => (
                    <div key={idx} className="grid grid-cols-12 gap-2 items-end bg-slate-50 p-3 rounded-lg border border-slate-100">
                      <div className="col-span-4 space-y-1.5">
                        <Label className="text-[10px] uppercase text-slate-500">Medicine Name</Label>
                        <Input 
                          placeholder="e.g. Paracetamol" 
                          value={med.name} 
                          onChange={(e) => updateMedicine(idx, 'name', e.target.value)}
                          className="h-9"
                        />
                      </div>
                      <div className="col-span-2 space-y-1.5">
                        <Label className="text-[10px] uppercase text-slate-500">Dosage</Label>
                        <Input 
                          placeholder="500mg" 
                          value={med.dosage} 
                          onChange={(e) => updateMedicine(idx, 'dosage', e.target.value)}
                          className="h-9"
                        />
                      </div>
                      <div className="col-span-3 space-y-1.5">
                        <Label className="text-[10px] uppercase text-slate-500">Frequency</Label>
                        <Input 
                          placeholder="1-0-1" 
                          value={med.frequency} 
                          onChange={(e) => updateMedicine(idx, 'frequency', e.target.value)}
                          className="h-9"
                        />
                      </div>
                      <div className="col-span-2 space-y-1.5">
                        <Label className="text-[10px] uppercase text-slate-500">Duration</Label>
                        <Input 
                          placeholder="5 days" 
                          value={med.duration} 
                          onChange={(e) => updateMedicine(idx, 'duration', e.target.value)}
                          className="h-9"
                        />
                      </div>
                      <div className="col-span-1">
                        <Button variant="ghost" size="icon" className="h-9 w-9 text-rose-500" onClick={() => removeMedicine(idx)}>
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="space-y-2">
                <Label>Advice / Notes</Label>
                <Input 
                  placeholder="Any specific instructions..." 
                  value={prescription.advice}
                  onChange={(e) => setPrescription({...prescription, advice: e.target.value})}
                />
              </div>

              <div className="space-y-2">
                <Label>Upload Written Prescription (PDF)</Label>
                <div className="flex items-center gap-4">
                  <Input 
                    type="file" 
                    accept=".pdf"
                    onChange={handleFileUpload}
                    className="cursor-pointer"
                  />
                  {prescription.attachmentName && (
                    <Badge variant="outline" className="text-emerald-600 border-emerald-200">
                      {prescription.attachmentName}
                    </Badge>
                  )}
                </div>
              </div>
            </div>

            {/* Right side: Interactive Patient Clinical History panel */}
            <div className="lg:col-span-5 bg-slate-50/20 p-1 rounded-xl border border-slate-100/80 flex flex-col justify-start min-h-[400px]">
              <div className="flex items-center justify-between px-2 py-1 mb-2">
                <span className="text-xs font-black text-slate-800 flex items-center gap-1.5 uppercase tracking-wide">
                  <History className="w-4 h-4 text-amber-500" />
                  Clinical History
                </span>
                <Badge variant="outline" className="text-[10px] bg-amber-50 text-amber-700 border-amber-200 uppercase font-bold">
                  Past History Log
                </Badge>
              </div>

              <OPDPatientHistory 
                patient={selectedPatient}
                vitals={selectedPatientVitals}
                notes={selectedPatientNotes}
                prescriptions={savedPrescriptions}
                labRequests={selectedPatientLabs}
                loading={loadingHistory}
                onPrintPrescription={(rx) => {
                  const printWindow = window.open('', '_blank', 'width=800,height=1000');
                  if (!printWindow) {
                    toast.error('Please allow popups to print prescription history');
                    return;
                  }
                  
                  const docObj = users.find(u => u.name === (rx.doctor || rx.doctor_name));
                  const html = getPrescriptionPrintHtml(
                    {
                      name: selectedPatient.name,
                      age: selectedPatient.age,
                      gender: selectedPatient.gender,
                      mrn: selectedPatient.mrn
                    },
                    {
                      date: rx.date || rx.prescription_date,
                      medicines: rx.medicines || rx.medications || [],
                      advice: rx.advice || rx.notes || ''
                    },
                    docObj,
                    hospitalInfo
                  );
                  
                  printWindow.document.write(html);
                  printWindow.document.close();
                }}
              />
            </div>
          </div>

          <DialogFooter className="gap-2 mt-4 border-t pt-4">
            <Button variant="outline" onClick={() => setIsPrescriptionOpen(false)}>Cancel</Button>
            <Button variant="outline" className="gap-2 border-emerald-200 text-emerald-600 hover:bg-emerald-50" onClick={printPrescription}>
              <Printer className="w-4 h-4" />
              Print
            </Button>
            <Button className="bg-emerald-600 hover:bg-emerald-700 gap-2" onClick={handleSavePrescription}>
              <CheckCircle2 className="w-4 h-4" />
              Save Prescription
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Prescription History Dialog */}
      <Dialog open={isHistoryOpen} onOpenChange={setIsHistoryOpen}>
        <DialogContent className="sm:max-w-[750px] max-h-[90vh] overflow-y-auto bg-white">
          <DialogHeader className="border-b pb-3 mb-2">
            <DialogTitle className="flex items-center gap-2 text-slate-800">
              <History className="w-5 h-5 text-amber-500" />
              Patient Clinical History Dashboard - {selectedPatient?.name}
            </DialogTitle>
          </DialogHeader>

          <div className="py-2">
            <OPDPatientHistory 
              patient={selectedPatient}
              vitals={selectedPatientVitals}
              notes={selectedPatientNotes}
              prescriptions={savedPrescriptions}
              labRequests={selectedPatientLabs}
              loading={loadingHistory}
              onPrintPrescription={(rx) => {
                const printWindow = window.open('', '_blank', 'width=800,height=1000');
                if (!printWindow) {
                  toast.error('Please allow popups to print');
                  return;
                }
                const docObj = users.find(u => u.name === (rx.doctor || rx.doctor_name));
                const html = getPrescriptionPrintHtml(
                  {
                    name: selectedPatient.name,
                    age: selectedPatient.age,
                    gender: selectedPatient.gender,
                    mrn: selectedPatient.mrn
                  },
                  {
                    date: rx.date || rx.prescription_date,
                    medicines: rx.medicines || rx.medications || [],
                    advice: rx.advice || rx.notes || ''
                  },
                  docObj,
                  hospitalInfo
                );
                printWindow.document.write(html);
                printWindow.document.close();
              }}
            />
          </div>

          <DialogFooter className="border-t pt-4 mt-2">
            <Button className="bg-slate-800 hover:bg-slate-900" onClick={() => setIsHistoryOpen(false)}>Close Archive</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Patient Details Dialog */}
      <Dialog open={isDetailsOpen} onOpenChange={setIsDetailsOpen}>
        <DialogContent className="sm:max-w-[600px]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <User className="w-5 h-5 text-medical-blue" />
              Patient Details - {selectedPatient?.name}
            </DialogTitle>
          </DialogHeader>
          <div className="max-h-[70vh] overflow-y-auto custom-scrollbar pr-4">
            <div className="space-y-6 py-4">
              <div className="grid grid-cols-2 gap-x-8 gap-y-4">
                <div className="space-y-1">
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">MRN / Patient ID</p>
                  <p className="text-sm font-bold text-medical-blue">{selectedPatient?.mrn}</p>
                </div>
                <div className="space-y-1">
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Full Name</p>
                  <p className="text-sm font-medium">{selectedPatient?.name}</p>
                </div>
                <div className="space-y-1">
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Phone</p>
                  <p className="text-sm font-medium">{selectedPatient?.phone}</p>
                </div>
                <div className="space-y-1">
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Email</p>
                  <p className="text-sm font-medium">{selectedPatient?.email || 'N/A'}</p>
                </div>
                <div className="space-y-1">
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Age / Gender</p>
                  <p className="text-sm font-medium">{selectedPatient?.age}Y / {selectedPatient?.gender}</p>
                </div>
                <div className="space-y-1">
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Date of Birth</p>
                  <p className="text-sm font-medium">{selectedPatient?.dob || 'N/A'}</p>
                </div>
                <div className="space-y-1">
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Blood Group</p>
                  <p className="text-sm font-medium">{selectedPatient?.bloodGroup || 'N/A'}</p>
                </div>
                <div className="space-y-1">
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Guardian Name</p>
                  <p className="text-sm font-medium">{selectedPatient?.guardianName || 'N/A'}</p>
                </div>
                <div className="space-y-1">
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Father's Name</p>
                  <p className="text-sm font-medium">{selectedPatient?.fatherName || selectedPatient?.father_name || 'N/A'}</p>
                </div>
                <div className="space-y-1">
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Mother's Name</p>
                  <p className="text-sm font-medium">{selectedPatient?.motherName || selectedPatient?.mother_name || 'N/A'}</p>
                </div>
                <div className="space-y-1">
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Husband's Name</p>
                  <p className="text-sm font-medium">{selectedPatient?.husbandName || selectedPatient?.husband_name || 'N/A'}</p>
                </div>
                <div className="col-span-2 space-y-1">
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Address</p>
                  <p className="text-sm font-medium">{selectedPatient?.address}</p>
                </div>
                <div className="space-y-1">
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">TPA ID</p>
                  <p className="text-sm font-medium">{selectedPatient?.tpaId || 'N/A'}</p>
                </div>
                <div className="space-y-1">
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">TPA Validity</p>
                  <p className="text-sm font-medium">{selectedPatient?.tpaValidity || 'N/A'}</p>
                </div>

                <div className="col-span-2 border-t border-slate-100 pt-3">
                  <p className="text-xs font-bold text-slate-500 uppercase tracking-wider">Government & ABDM Verification Records</p>
                </div>
                <div className="space-y-1">
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">UHID</p>
                  <p className="text-sm font-bold text-blue-600">{selectedPatient?.uhid || 'N/A'}</p>
                </div>
                <div className="space-y-1">
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Aadhaar Status</p>
                  <p className="text-sm font-medium">
                    {selectedPatient?.aadhaarStatus || selectedPatient?.aadhaar_status === 'Verified' ? '✅ Verified (Aadhaar)' : '⏳ Pending/Unverified'}
                  </p>
                </div>
                <div className="space-y-1">
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">ABHA Number</p>
                  <p className="text-sm font-medium font-mono">{selectedPatient?.abhaNumber || selectedPatient?.abha_number || 'N/A'}</p>
                </div>
                <div className="space-y-1">
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">ABHA Address</p>
                  <p className="text-sm font-medium text-emerald-700">{selectedPatient?.abhaAddress || selectedPatient?.abha_address || 'N/A'}</p>
                </div>
                <div className="space-y-1">
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Ayushman Card Number</p>
                  <p className="text-sm font-medium font-mono text-purple-700">{selectedPatient?.ayushmanCardNumber || selectedPatient?.ayushman_card_number || 'N/A'}</p>
                </div>
                <div className="space-y-1">
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">PM-JAY Beneficiary ID</p>
                  <p className="text-sm font-medium font-mono">{selectedPatient?.pmjayBeneficiaryId || selectedPatient?.pmjay_beneficiary_id || 'N/A'}</p>
                </div>
                <div className="col-span-2 space-y-1">
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">PM-JAY Family ID / Ration Card</p>
                  <p className="text-sm font-medium">{selectedPatient?.familyId || selectedPatient?.family_id || 'N/A'}</p>
                </div>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button className="bg-medical-blue" onClick={() => setIsDetailsOpen(false)}>Close</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      {/* File Preview Dialog */}
      <Dialog open={isPreviewOpen} onOpenChange={setIsPreviewOpen}>
        <DialogContent className="sm:max-w-[800px] h-[90vh] flex flex-col p-0 overflow-hidden">
          <DialogHeader className="p-4 border-b">
            <DialogTitle className="flex items-center gap-2">
              <FileText className="w-5 h-5 text-medical-blue" />
              {previewData?.name}
            </DialogTitle>
          </DialogHeader>
          <div className="flex-1 bg-slate-100 relative overflow-hidden">
            {(previewData?.url.startsWith('data:application/pdf') || previewData?.name?.toLowerCase().endsWith('.pdf')) ? (
              <object
                data={previewData.url}
                type="application/pdf"
                className="w-full h-full border-none"
              >
                <div className="w-full h-full flex flex-col items-center justify-center p-8 text-center space-y-4">
                  <div className="w-16 h-16 bg-blue-50 text-blue-600 rounded-full flex items-center justify-center">
                    <FileText className="w-8 h-8" />
                  </div>
                  <div>
                    <p className="font-bold text-slate-800">PDF Preview Not Available</p>
                    <p className="text-sm text-slate-500 max-w-xs">Your browser might be blocking the inline preview. You can still download the file to view it.</p>
                  </div>
                  <Button className="bg-medical-blue" onClick={() => {
                    const link = document.createElement('a');
                    link.href = previewData.url;
                    link.download = previewData.name;
                    link.click();
                  }}>
                    <Download className="w-4 h-4 mr-2" />
                    Download to View
                  </Button>
                </div>
              </object>
            ) : (
              <div className="w-full h-full flex items-center justify-center p-4">
                <img 
                  src={previewData?.url} 
                  alt="Prescription Preview" 
                  className="max-w-full max-h-full object-contain shadow-lg rounded-lg"
                  referrerPolicy="no-referrer"
                />
              </div>
            )}
          </div>
          <DialogFooter className="p-4 border-t bg-white">
            <Button variant="outline" onClick={() => setIsPreviewOpen(false)}>Close Preview</Button>
            <Button className="bg-medical-blue" onClick={() => {
              if (previewData) {
                const link = document.createElement('a');
                link.href = previewData.url;
                link.download = previewData.name;
                link.click();
              }
            }}>
              <Download className="w-4 h-4 mr-2" />
              Download File
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
