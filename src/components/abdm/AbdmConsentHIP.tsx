import { useState, useEffect } from 'react';
import { 
  FileText, 
  ShieldCheck, 
  Clock, 
  CheckCircle, 
  AlertCircle, 
  Send, 
  RefreshCw, 
  Unlock, 
  Lock, 
  Calendar, 
  Eye, 
  Signature, 
  ShieldCheckIcon,
  Search,
  Sparkles,
  Upload,
  ArrowRight
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';
import { ConsentRequest } from './types';
import { supabaseService } from '@/services/supabaseService';

const INITIAL_CONSENTS: ConsentRequest[] = [
  {
    id: 'con-101',
    patientId: 'mrn-sam',
    patientName: 'Sandeep Kumar Saxena',
    abhaAddress: 'sandeep@sbx',
    purpose: 'Direct Clinical Care',
    hiuId: 'IN-HIU-2949-GH',
    hipId: 'IN-HIP-2949-GH',
    consentExpiry: new Date(Date.now() + 86400000 * 5).toISOString().split('T')[0],
    status: 'Approved',
    healthTypes: ['Prescriptions', 'Diagnostic Reports'],
    dateRequested: new Date(Date.now() - 3600000 * 2).toISOString(),
    signatureStatus: 'Verified'
  },
  {
    id: 'con-102',
    patientId: 'mrn-meera',
    patientName: 'Meera Devi',
    abhaAddress: 'meera.devi@sbx',
    purpose: 'Consultation Referrals',
    hiuId: 'IN-HIU-2949-GH',
    hipId: 'IN-HIP-7731-SC',
    consentExpiry: new Date(Date.now() - 86400000).toISOString().split('T')[0],
    status: 'Expired',
    healthTypes: ['Prescriptions', 'Discharge Summary'],
    dateRequested: new Date(Date.now() - 86400000 * 2).toISOString(),
    signatureStatus: 'Unsigned'
  },
  {
    id: 'con-103',
    patientId: 'mrn-raj',
    patientName: 'Ramesh Chander Gupta',
    abhaAddress: 'ramesh.gupta@sbx',
    purpose: 'Care Coordination',
    hiuId: 'IN-HIU-2949-GH',
    hipId: 'IN-HIP-2949-GH',
    consentExpiry: new Date(Date.now() + 86400000 * 10).toISOString().split('T')[0],
    status: 'Requested',
    healthTypes: ['Prescriptions', 'Diagnostic Reports', 'Discharge Summary'],
    dateRequested: new Date().toISOString(),
    signatureStatus: 'Unsigned'
  }
];

const HEALTH_RECORDS_MOCK = [
  {
    id: 'rx-201',
    patientName: 'Sandeep Kumar Saxena',
    abhaAddress: 'sandeep@sbx',
    date: '2026-06-12',
    type: 'Prescription',
    facility: 'Global Hospital Clinic',
    doctor: 'Dr. Rajesh Sharma',
    details: 'Tab Paracetamol 650mg TDS x 3 days, Tab Amoxicillin 500mg BD x 5 days.',
    signed: true
  },
  {
    id: 'lab-202',
    patientName: 'Sandeep Kumar Saxena',
    abhaAddress: 'sandeep@sbx',
    date: '2026-06-13',
    type: 'Diagnostic Report',
    facility: 'Global Advanced Labs',
    doctor: 'Lab Executive',
    details: 'Complete Blood Count: Hemoglobin 14.2 g/dL (Normal), WBC 8,500/uL (Normal).',
    signed: true
  },
  {
    id: 'dc-203',
    patientName: 'Sandeep Kumar Saxena',
    abhaAddress: 'sandeep@sbx',
    date: '2026-06-14',
    type: 'Discharge Summary',
    facility: 'Global Maternity & ICU Unit',
    doctor: 'Dr. Anjali Gupta',
    details: 'Admitted for acute gastroenteritis. Managed with IV hydration. Discharged stable on oral medication.',
    signed: false
  }
];

export default function AbdmConsentHIP() {
  const [consents, setConsents] = useState<ConsentRequest[]>([]);
  const [records, setRecords] = useState<any[]>(() => {
    const saved = localStorage.getItem('hms_abdm_hip_records');
    if (saved) return JSON.parse(saved);
    localStorage.setItem('hms_abdm_hip_records', JSON.stringify(HEALTH_RECORDS_MOCK));
    return HEALTH_RECORDS_MOCK;
  });

  const saveRecords = (updatedRecords: any[]) => {
    setRecords(updatedRecords);
    localStorage.setItem('hms_abdm_hip_records', JSON.stringify(updatedRecords));
    window.dispatchEvent(new CustomEvent('hms-abdm-sync'));
  };

  // Clinical record form states
  const [newDocPatient, setNewDocPatient] = useState('');
  const [newDocAbha, setNewDocAbha] = useState('');
  const [newDocType, setNewDocType] = useState('Prescription');
  const [newDocDoctor, setNewDocDoctor] = useState('Dr. Rajesh Sharma');
  const [newDocFacility, setNewDocFacility] = useState('Global Hospital Clinic');
  const [newDocDetails, setNewDocDetails] = useState('');
  const [activeHiuTab, setActiveHiuTab] = useState<'view' | 'create'>('view');
  
  // Consent form state
  const [patientSearch, setPatientSearch] = useState('');
  const [abhaIdSelected, setAbhaIdSelected] = useState('');
  const [selectedPurpose, setSelectedPurpose] = useState('Direct Clinical Care');
  const [selectedExpiry, setSelectedExpiry] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() + 7);
    return d.toISOString().split('T')[0];
  });
  
  const [selectedTypes, setSelectedTypes] = useState<string[]>(['Prescriptions']);

  // Digital signature validation states
  const [signingDocId, setSigningDocId] = useState<string | null>(null);
  const [signingPin, setSigningPin] = useState('');
  const [isSigning, setIsSigning] = useState(false);

  useEffect(() => {
    const loadData = async () => {
      const fetched = await supabaseService.getAbdmConsents();
      if (fetched && fetched.length > 0) {
        setConsents(fetched);
      } else {
        // Seed default consents in DB first
        for (const item of INITIAL_CONSENTS) {
          await supabaseService.createAbdmConsent(item);
        }
        const refreshed = await supabaseService.getAbdmConsents();
        setConsents(refreshed);
      }
    };
    loadData();
  }, []);

  const handleCreateRequest = async () => {
    if (!patientSearch || !abhaIdSelected) {
      toast.error('Please input patient name and ABHA Address');
      return;
    }

    const newReq = {
      abhaAddress: abhaIdSelected.includes('@') ? abhaIdSelected : `${abhaIdSelected}@sbx`,
      purpose: selectedPurpose,
      hiuId: 'IN-HIU-2949-GH',
      hipId: 'IN-HIP-2949-GH',
      consentExpiry: selectedExpiry,
      status: 'Requested',
      healthTypes: selectedTypes,
      signatureStatus: 'Unsigned'
    };

    const created = await supabaseService.createAbdmConsent(newReq);
    const refreshed = await supabaseService.getAbdmConsents();
    setConsents(refreshed);

    // Audit trace in database
    const auditItem = {
      userId: 'u_dr_sharma',
      userRole: 'Doctor',
      action: 'Consent Request Dispatched',
      module: 'CONSENT' as const,
      status: 'SUCCESS' as const,
      ipAddress: '192.168.1.144',
      details: `Created record transfer request payload for ${patientSearch} (${newReq.abhaAddress})`
    };
    await supabaseService.createAbdmAuditLog(auditItem);

    toast.success('Consent request transmitted to patient central NDHM app!');
    setPatientSearch('');
    setAbhaIdSelected('');
  };

  // Simulated validation/approval from Patient side
  const handleSimulateApprove = async (id: string) => {
    await supabaseService.updateAbdmConsent(id, {
      status: 'Approved',
      signatureStatus: 'Verified'
    });
    
    const refreshed = await supabaseService.getAbdmConsents();
    setConsents(refreshed);

    // Audit logs inside DB
    const auditItem = {
      userId: 'patient_mhealth',
      userRole: 'Patient Locker',
      action: 'Consent Approved Cryptographically',
      module: 'CONSENT' as const,
      status: 'SUCCESS' as const,
      ipAddress: '55.32.19.40',
      details: `Consent ID ${id} granted by patient. Encrypted handshake token generated.`
    };
    await supabaseService.createAbdmAuditLog(auditItem);

    toast.success('Patient verified the request on their mobile health wallet! Access key unlocked.');
  };

  const handleSimulateRevoke = async (id: string) => {
    await supabaseService.updateAbdmConsent(id, { status: 'Revoked' });
    const refreshed = await supabaseService.getAbdmConsents();
    setConsents(refreshed);
    toast.error('Consent key has been immediately revoked by the patient.');
  };

  // Mock cryptographic digital signature for clinical files
  const handleTriggerSign = (id: string) => {
    setSigningDocId(id);
    setSigningPin('');
  };

  const handleConfirmSignature = () => {
    if (signingPin !== '1234') {
      toast.error('Invalid Secure Doctor PIN code. Type "1234" to simulate key authorization.');
      return;
    }

    setIsSigning(true);
    setTimeout(async () => {
      const updated = records.map(rec => {
        if (rec.id === signingDocId) {
          return { ...rec, signed: true };
        }
        return rec;
      });
      saveRecords(updated);
      setIsSigning(false);
      setSigningDocId(null);
      toast.success('Prescription sealed with Doctor HPR Cryptographic Key! (SHA-256 Verified)');

      // Log dispatch
      const auditItem = {
        userId: 'u_dr_sharma',
        userRole: 'Doctor',
        action: 'EMR File Cryptographic Sign',
        module: 'EMR' as const,
        status: 'SUCCESS' as const,
        ipAddress: '192.168.1.144',
        details: `Signed clinical report ${signingDocId} with doctor smart credentials`
      };
      await supabaseService.createAbdmAuditLog(auditItem);
    }, 1200);
  };

  const handleCreateDocument = () => {
    if (!newDocPatient || !newDocAbha || !newDocDetails) {
      toast.error('All health document creation form fields are required!');
      return;
    }
    const cleanAbha = newDocAbha.includes('@') ? newDocAbha.trim() : `${newDocAbha.trim()}@sbx`;
    const newDoc = {
      id: 'doc-' + Date.now(),
      patientName: newDocPatient.trim(),
      abhaAddress: cleanAbha,
      date: new Date().toISOString().split('T')[0],
      type: newDocType,
      facility: newDocFacility,
      doctor: newDocDoctor,
      details: newDocDetails.trim(),
      signed: false
    };
    const updated = [newDoc, ...records];
    saveRecords(updated);
    
    // Save audit log
    const auditItem = {
      id: 'log-' + Date.now(),
      timestamp: new Date().toISOString(),
      userId: 'u_dr_sharma',
      userRole: 'Doctor',
      action: 'Health Document Created (HIP)',
      module: 'EMR' as const,
      status: 'SUCCESS' as const,
      ipAddress: '192.168.1.144',
      details: `Created unsigned ${newDocType} clinical document for patient ${newDoc.patientName}.`
    };
    const currentLogs = JSON.parse(localStorage.getItem('hms_abdm_audit_logs') || '[]');
    currentLogs.unshift(auditItem);
    localStorage.setItem('hms_abdm_audit_logs', JSON.stringify(currentLogs));

    toast.success(`New ${newDocType} clinical document generated successfully! Ready for Cryptographic Signing.`);
    setNewDocPatient('');
    setNewDocAbha('');
    setNewDocDetails('');
    setActiveHiuTab('view');
  };

  const toggleDataType = (type: string) => {
    if (selectedTypes.includes(type)) {
      setSelectedTypes(selectedTypes.filter(t => t !== type));
    } else {
      setSelectedTypes([...selectedTypes, type]);
    }
  };

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Create Request Segment */}
        <Card className="shadow-sm border-slate-100 bg-white">
          <CardHeader className="pb-3 border-b border-slate-50">
            <CardTitle className="text-sm font-bold text-slate-800 flex items-center gap-2">
              <Send className="w-4 h-4 text-medical-blue" />
              Initiate New Consent request
            </CardTitle>
            <CardDescription className="text-[11px]">Request medical record timeline access from patient</CardDescription>
          </CardHeader>
          <CardContent className="pt-4 space-y-4">
            
            <div className="space-y-1">
              <Label htmlFor="c-pname" className="text-xs">Patient Full Name</Label>
              <Input 
                id="c-pname" 
                placeholder="e.g. Ramesh Chander" 
                value={patientSearch || ''}
                onChange={(e) => setPatientSearch(e.target.value)}
              />
            </div>

            <div className="space-y-1">
              <Label htmlFor="c-abha" className="text-xs">Patient ABHA Address ID</Label>
              <div className="flex">
                <Input 
                  id="c-abha" 
                  placeholder="e.g. ramesh.gupta" 
                  value={abhaIdSelected || ''} 
                  className="rounded-r-none"
                  onChange={(e) => setAbhaIdSelected(e.target.value)}
                />
                <span className="bg-slate-100 border border-l-0 text-slate-500 font-bold px-3 py-2 text-xs rounded-r-lg">
                  @sbx
                </span>
              </div>
            </div>

            <div className="space-y-1">
              <Label className="text-xs">Purpose of Records Query</Label>
              <Select value={selectedPurpose || 'Direct Clinical Care'} onValueChange={setSelectedPurpose}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="text-xs">
                  <SelectItem value="Direct Clinical Care">Direct Clinical Care</SelectItem>
                  <SelectItem value="Consultation Referrals">Consultation Referrals</SelectItem>
                  <SelectItem value="Care Coordination">Care Coordination</SelectItem>
                  <SelectItem value="Emergency Response">Emergency Trauma Care</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1">
              <Label className="text-xs">Consent Lifespan Expiry</Label>
              <Input 
                type="date" 
                value={selectedExpiry || ''} 
                onChange={(e) => setSelectedExpiry(e.target.value)}
              />
            </div>

            {/* Requested Health Typologies */}
            <div className="space-y-2">
              <Label className="text-xs">Requested Health Record Columns</Label>
              <div className="flex flex-wrap gap-1.5 pt-1">
                {['Prescriptions', 'Diagnostic Reports', 'Discharge Summary'].map((type) => {
                  const active = selectedTypes.includes(type);
                  return (
                    <button 
                      key={type}
                      type="button"
                      onClick={() => toggleDataType(type)}
                      className={`text-[10px] font-bold px-2.5 py-1 rounded-full border transition-all ${
                        active 
                          ? 'bg-medical-blue border-medical-blue text-white' 
                          : 'bg-slate-50 hover:bg-slate-100 border-slate-200 text-slate-600'
                      }`}
                    >
                      {type}
                    </button>
                  );
                })}
              </div>
            </div>

            <Button onClick={handleCreateRequest} className="w-full bg-medical-blue hover:bg-medical-blue/95 font-bold text-xs pt-2">
              Transmit Consent Handshake
              <Send className="w-3.5 h-3.5 ml-1.5" />
            </Button>
          </CardContent>
        </Card>

        {/* Consent Registry Monitor & Approver Simulator */}
        <Card className="shadow-sm border-slate-100 bg-white lg:col-span-2">
          <CardHeader className="pb-3 border-b border-slate-50 flex flex-row items-center justify-between">
            <div>
              <CardTitle className="text-sm font-bold text-slate-800 flex items-center gap-2">
                <ShieldCheckIcon className="w-4.5 h-4.5 text-emerald-600" />
                ABDM Active Consent Registry & Approver
              </CardTitle>
              <CardDescription className="text-xs">Monitor permission tokens and simulate patient approvals</CardDescription>
            </div>
            <span className="text-[10px] bg-indigo-50 text-indigo-700 font-extrabold px-2.5 py-1 rounded-full border border-indigo-100 uppercase">
              ABDM Sandbox
            </span>
          </CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableHeader className="bg-slate-50/70">
                <TableRow>
                  <TableHead className="text-[10px] font-bold text-slate-400 py-2">Patient Details</TableHead>
                  <TableHead className="text-[10px] font-bold text-slate-400 py-2">Purpose</TableHead>
                  <TableHead className="text-[10px] font-bold text-slate-400 py-2">Requested Fields</TableHead>
                  <TableHead className="text-[10px] font-bold text-slate-400 py-2">Verification Key</TableHead>
                  <TableHead className="text-[10px] font-bold text-slate-400 py-2">Expires</TableHead>
                  <TableHead className="text-[10px] font-bold text-slate-400 py-2 text-right">Gate Operations</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {consents.map((c) => (
                  <TableRow key={c.id} className="hover:bg-slate-50/50 text-xs">
                    <TableCell>
                      <p className="font-bold text-slate-700">{c.patientName}</p>
                      <p className="text-[9px] text-teal-600 font-mono">{c.abhaAddress}</p>
                    </TableCell>
                    <TableCell className="font-medium text-slate-600">{c.purpose}</TableCell>
                    <TableCell>
                      <div className="flex flex-wrap gap-1 max-w-[150px]">
                        {c.healthTypes.map((t) => (
                          <span key={t} className="text-[8px] bg-slate-100 text-slate-600 px-1 py-0.2 rounded font-semibold whitespace-nowrap">
                            {t}
                          </span>
                        ))}
                      </div>
                    </TableCell>
                    <TableCell>
                      {c.status === 'Approved' ? (
                        <span className="text-[9px] text-emerald-700 font-bold bg-emerald-50 px-1.5 py-0.5 rounded border border-emerald-200 uppercase flex items-center gap-1 w-fit">
                          <Unlock className="w-2.5 h-2.5" /> Approved
                        </span>
                      ) : c.status === 'Requested' ? (
                        <span className="text-[9px] text-yellow-700 font-bold bg-yellow-50 px-1.5 py-0.5 rounded border border-yellow-200 uppercase flex items-center gap-1 w-fit">
                          <Lock className="w-2.5 h-2.5" /> Pending
                        </span>
                      ) : (
                        <span className="text-[9px] text-slate-400 font-semibold bg-slate-100 px-1.5 py-0.5 rounded uppercase flex items-center gap-1 w-fit">
                          <AlertCircle className="w-2.5 h-2.5" /> {c.status}
                        </span>
                      )}
                    </TableCell>
                    <TableCell className="font-mono text-[10px] text-slate-400">{c.consentExpiry}</TableCell>
                    <TableCell className="text-right">
                      {c.status === 'Requested' && (
                        <div className="flex justify-end gap-1.5">
                          <Button 
                            className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-[10px] h-7 px-2.5 rounded-lg"
                            onClick={() => handleSimulateApprove(c.id)}
                            size="xs"
                          >
                            Simulate Approve
                          </Button>
                        </div>
                      )}
                      {c.status === 'Approved' && (
                        <Button 
                          variant="outline" 
                          className="text-rose-500 border-rose-200 hover:bg-rose-50 font-bold text-[10px] h-7 px-2.5"
                          onClick={() => handleSimulateRevoke(c.id)}
                          size="xs"
                        >
                          Revoke Access
                        </Button>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>

      {/* Health Records Exchange Viewer (HIU Roster Context & HIP record generation) */}
      <Card className="shadow-sm border-slate-100 bg-white">
        <CardHeader className="pb-2 border-b">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <CardTitle className="text-sm font-bold text-slate-800 flex items-center gap-2">
                <FileText className="w-4.5 h-4.5 text-indigo-600" />
                HIP & HIU Health Information Exchange Node
              </CardTitle>
              <CardDescription className="text-xs">
                As HIP, generate electronic medical records and seal documents. As HIU, pull patient clinical document streams under approved consents.
              </CardDescription>
            </div>
            <div className="flex gap-1">
              <Button 
                variant={activeHiuTab === 'view' ? 'secondary' : 'ghost'} 
                size="sm" 
                className="h-7 text-[10.5px] font-bold px-3 rounded-lg"
                onClick={() => setActiveHiuTab('view')}
              >
                Document Timeline View (HIU)
              </Button>
              <Button 
                variant={activeHiuTab === 'create' ? 'secondary' : 'ghost'} 
                size="sm" 
                className="h-7 text-[10.5px] font-bold px-3 rounded-lg bg-indigo-50/50 hover:bg-slate-150 text-indigo-700"
                onClick={() => setActiveHiuTab('create')}
              >
                + Create Health Record (HIP)
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {activeHiuTab === 'view' && (
            <Table>
              <TableHeader className="bg-slate-50/70">
                <TableRow>
                  <TableHead className="text-[10px] font-bold text-slate-400 py-2">Document Type</TableHead>
                  <TableHead className="text-[10px] font-bold text-slate-400 py-2">Patient name</TableHead>
                  <TableHead className="text-[10px] font-bold text-slate-400 py-2">Clinician / Facility</TableHead>
                  <TableHead className="text-[10px] font-bold text-slate-400 py-2">Logged Clinical Details</TableHead>
                  <TableHead className="text-[10px] font-bold text-slate-400 py-2">Date</TableHead>
                  <TableHead className="text-[10px] font-bold text-slate-400 py-2">Crypto Sign</TableHead>
                  <TableHead className="text-[10px] font-bold text-slate-400 py-2 text-right">HFR Action</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {records.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center py-8 text-slate-450 text-xs font-semibold">
                      No health records exist in sandbox currently. Click "+ Create Health Record" to generate one.
                    </TableCell>
                  </TableRow>
                ) : (
                  records.map((rec) => (
                    <TableRow key={rec.id} className="hover:bg-slate-50/50 text-xs">
                      <TableCell>
                        <span className={`text-[9px] font-bold px-2 py-0.5 rounded-full uppercase ${
                          rec.type === 'Prescription' 
                            ? 'bg-blue-50 text-blue-700 border border-blue-100'
                            : rec.type === 'Diagnostic Report' || rec.type === 'Lab Report'
                            ? 'bg-purple-50 text-purple-700 border border-purple-100'
                            : 'bg-green-50 text-green-700 border border-green-100'
                        }`}>
                          {rec.type}
                        </span>
                      </TableCell>
                      <TableCell>
                        <p className="font-bold text-slate-700">{rec.patientName}</p>
                        <p className="text-[9px] text-teal-600 font-mono">{rec.abhaAddress}</p>
                      </TableCell>
                      <TableCell>
                        <p className="font-semibold text-slate-700">{rec.doctor}</p>
                        <p className="text-[9px] text-slate-400">{rec.facility}</p>
                      </TableCell>
                      <TableCell className="text-slate-500 font-semibold max-w-sm truncate">{rec.details}</TableCell>
                      <TableCell className="font-mono text-slate-400 text-[10px]">{rec.date}</TableCell>
                      <TableCell>
                        {rec.signed ? (
                          <span className="text-[9px] text-emerald-700 font-bold bg-emerald-50 px-1.5 py-0.5 rounded-sm border border-emerald-200 font-mono tracking-wider">
                            SHA_256_SEALED
                          </span>
                        ) : (
                          <span className="text-[9px] text-slate-400 font-medium bg-slate-100 px-1.5 py-0.5 rounded-sm">
                            UNSIGNED
                          </span>
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        {!rec.signed ? (
                          <Button 
                            onClick={() => handleTriggerSign(rec.id)} 
                            className="bg-indigo-65 text-indigo-700 hover:bg-indigo-100 font-bold border border-indigo-200 text-[10px] h-7 px-3.5"
                            size="xs"
                          >
                            <Signature className="w-3 h-3 mr-1" />
                            Apply e-Sign
                          </Button>
                        ) : (
                          <Button 
                            variant="ghost" 
                            size="icon" 
                            className="h-8 w-8 text-emerald-600"
                            onClick={() => {
                              toast.success('Document SHA-256 integrity report verified! No tampering detected.');
                            }}
                          >
                            <ShieldCheck className="w-4 h-4" />
                          </Button>
                        )}
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          )}

          {activeHiuTab === 'create' && (
            <div className="p-5 space-y-4 animate-fade-in text-xs">
              <div className="bg-slate-50 border p-3 rounded-xl">
                <p className="font-bold text-slate-800 text-[11px] mb-1">HIP System Integration Node</p>
                <p className="text-[10.5px] text-slate-500 leading-relaxed">
                  Generate health record documents directly into the local EMR. These files represent verified clinical reports that are indexed centrally, allowing consenting Health Information Users (HIU) to request and fetch them down the line. Use the seal option to apply digital signatures.
                </p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1">
                  <Label className="text-[10.5px] font-bold text-slate-700">Patient Full Name</Label>
                  <Input 
                    placeholder="e.g. Ramesh Giri" 
                    value={newDocPatient || ''} 
                    onChange={(e) => setNewDocPatient(e.target.value)}
                    className="h-8.5 text-xs bg-slate-50/50"
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-[10.5px] font-bold text-slate-700">Patient ABHA Id/Address</Label>
                  <div className="flex">
                    <Input 
                      placeholder="e.g. rameshgiri" 
                      value={newDocAbha || ''} 
                      onChange={(e) => setNewDocAbha(e.target.value)}
                      className="h-8.5 text-xs rounded-r-none bg-slate-50/50"
                    />
                    <span className="bg-slate-100 border border-l-0 text-slate-500 font-bold px-3 py-2 text-xs rounded-r-lg justify-center items-center flex shrink-0">
                      @sbx
                    </span>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="space-y-1">
                  <Label className="text-[10.5px] font-bold text-slate-700">Document Type</Label>
                  <Select value={newDocType || 'Prescription'} onValueChange={setNewDocType}>
                    <SelectTrigger className="h-8.5 text-xs bg-slate-50/50">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="text-xs">
                      <SelectItem value="Prescription">Prescription Record</SelectItem>
                      <SelectItem value="Diagnostic Report">Diagnostic Lab Report</SelectItem>
                      <SelectItem value="Discharge Summary">Discharge Summary</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-1">
                  <Label className="text-[10.5px] font-bold text-slate-700">Attending Clinician (HPR Registry)</Label>
                  <Select value={newDocDoctor || 'Dr. Rajesh Sharma'} onValueChange={setNewDocDoctor}>
                    <SelectTrigger className="h-8.5 text-xs bg-slate-50/50">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="text-xs">
                      <SelectItem value="Dr. Rajesh Sharma">Dr. Rajesh Sharma (HPR-12002)</SelectItem>
                      <SelectItem value="Dr. Anjali Gupta">Dr. Anjali Gupta (HPR-28401)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-1">
                  <Label className="text-[10.5px] font-bold text-slate-700">Originating Facility (HFR Registry)</Label>
                  <Select value={newDocFacility || 'Medinex HMS'} onValueChange={setNewDocFacility}>
                    <SelectTrigger className="h-8.5 text-xs bg-slate-50/50">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="text-xs">
                      <SelectItem value="Medinex HMS">Medinex HMS</SelectItem>
                      <SelectItem value="Sitaram Memoir Clinic">SITARAM MEMORIAL CLINIC</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="space-y-1">
                <Label className="text-[10.5px] font-bold text-slate-700">Logged Clinical Parameters, Diagnosis & Medicine Notes</Label>
                <textarea 
                  placeholder="Type vitals (e.g. BP: 120/80, Pulse: 72), clinical diagnosis, prescriptions, or procedures."
                  value={newDocDetails || ''}
                  onChange={(e) => setNewDocDetails(e.target.value)}
                  className="min-h-[75px] w-full text-xs bg-slate-50/50 border border-slate-200 rounded-lg p-2.5 outline-none focus:border-indigo-500 transition-colors"
                />
              </div>

              <Button onClick={handleCreateDocument} className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-bold h-9 text-xs rounded-xl">
                Commit & Dispatch Document to Patient Health Repository (HIP)
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Digital Signature Pin Capture Popup */}
      {signingDocId && (
        <div className="fixed inset-0 bg-slate-900/60 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl p-6 max-w-sm w-full space-y-4 border border-slate-150 shadow-2xl text-center">
            <Signature className="w-12 h-12 text-indigo-600 mx-auto animate-pulse" />
            <div>
              <h3 className="font-bold text-slate-800 text-sm">Doctor Cryptographic Sign (HPR Seal)</h3>
              <p className="text-[11px] text-slate-500 mt-1">
                Authenticate with your 4-digit professional practitioner pin linked with health registries.
              </p>
            </div>
            
            <div className="space-y-1 max-w-[180px] mx-auto">
              <Input 
                id="doc-pin" 
                maxLength={4} 
                type="password" 
                placeholder="PIN PIN PIN" 
                className="text-center font-bold tracking-widest text-lg h-9" 
                value={signingPin}
                onChange={(e) => setSigningPin(e.target.value)}
              />
              <span className="text-[9px] font-bold text-amber-600 bg-amber-50 px-1.5 py-0.5 rounded block">
                Type "1234" to pass
              </span>
            </div>

            <div className="flex gap-2 pt-2">
              <Button variant="outline" className="flex-1 text-xs h-9" onClick={() => setSigningDocId(null)}>Cancel</Button>
              <Button className="bg-indigo-600 hover:bg-indigo-700 text-white flex-1 text-xs font-bold h-9" onClick={handleConfirmSignature} disabled={isSigning}>
                {isSigning ? 'Verifying HSM Key...' : 'Sealed File'}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
