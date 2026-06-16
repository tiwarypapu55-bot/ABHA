import { useState, useEffect } from 'react';
import { 
  QrCode, 
  Printer, 
  Download, 
  Users, 
  CheckCircle, 
  Clock, 
  UserPlus, 
  Smartphone, 
  ArrowRight,
  ClipboardList,
  Sparkles,
  Ticket,
  ExternalLink
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';
import { storage } from '@/lib/storage';
import { supabaseService } from '@/services/supabaseService';

interface ScanShareToken {
  id: string;
  tokenNo: string;
  patientName: string;
  abhaAddress: string;
  phone: string;
  gender: string;
  age: number;
  timeShare: string;
  department: string;
  assignedDoctor: string;
  status: 'In Queue' | 'Called' | 'Completed';
}

const DEFAULT_TOKENS: ScanShareToken[] = [
  {
    id: 'tok-1',
    tokenNo: 'SSD-042',
    patientName: 'Anil Kumar Trivedi',
    abhaAddress: 'anil.trivedi@sbx',
    phone: '9883920192',
    gender: 'Male',
    age: 42,
    timeShare: new Date(Date.now() - 300000).toISOString(),
    department: 'General Medicine',
    assignedDoctor: 'Dr. Rajesh Sharma',
    status: 'In Queue'
  },
  {
    id: 'tok-2',
    tokenNo: 'SSD-041',
    patientName: 'Sushma Swaraj Joshi',
    abhaAddress: 'sushma.joshi@sbx',
    phone: '7729384910',
    gender: 'Female',
    age: 31,
    timeShare: new Date(Date.now() - 1200000).toISOString(),
    department: 'Gynaecology & Obstetrics',
    assignedDoctor: 'Dr. Anjali Gupta',
    status: 'Called'
  },
  {
    id: 'tok-3',
    tokenNo: 'SSD-040',
    patientName: 'Karan Manoj Rawat',
    abhaAddress: 'karan.rawat@sbx',
    phone: '8229304910',
    gender: 'Male',
    age: 23,
    timeShare: new Date(Date.now() - 3600000).toISOString(),
    department: 'Paediatrics',
    assignedDoctor: 'Dr. Rajesh Sharma',
    status: 'Completed'
  }
];

export default function AbdmScanShare() {
  const [tokens, setTokens] = useState<ScanShareToken[]>([]);
  const [selectedTokenToPrint, setSelectedTokenToPrint] = useState<ScanShareToken | null>(null);
  const [isPrintModalOpen, setIsPrintModalOpen] = useState(false);
  const [isSimulating, setIsSimulating] = useState(false);

  useEffect(() => {
    const saved = localStorage.getItem('hms_abdm_scan_share_tokens');
    if (saved) {
      setTokens(JSON.parse(saved));
    } else {
      localStorage.setItem('hms_abdm_scan_share_tokens', JSON.stringify(DEFAULT_TOKENS));
      setTokens(DEFAULT_TOKENS);
    }
  }, []);

  const saveTokens = (updatedList: ScanShareToken[]) => {
    setTokens(updatedList);
    localStorage.setItem('hms_abdm_scan_share_tokens', JSON.stringify(updatedList));
    window.dispatchEvent(new CustomEvent('hms-abdm-sync'));
  };

  const doctorList = [
    { name: 'Dr. Rajesh Sharma', dept: 'General Medicine' },
    { name: 'Dr. Anjali Gupta', dept: 'Gynaecology & Obstetrics' },
    { name: 'Dr. Sandeep Singh', dept: 'Paediatrics' }
  ];

  const [selectedSimDoctor, setSelectedSimDoctor] = useState(doctorList[0].name);

  // Patient Scan Simulation
  const handleSimulateScan = () => {
    setIsSimulating(true);
    
    setTimeout(async () => {
      const names = ['Harsh Vardhan Prasad', 'Radhika Soni', 'Gopal Krishnan Pillai', 'Priyanka Sen', 'Debashish Banerjee'];
      const abhas = ['harsh.v@sbx', 'radhika.soni@sbx', 'gopal.pillai@sbx', 'priyanka@sbx', 'debashish.b@sbx'];
      const phoneRandom = `9${Math.floor(100000000 + Math.random() * 900000000)}`;
      const selectedIndex = Math.floor(Math.random() * names.length);
      const chosenGender = Math.random() > 0.4 ? 'Male' : 'Female';
      const chosenAge = Math.floor(18 + Math.random() * 60);
      
      const nextSequence = 43 + (tokens.length - 3);
      const tokenNo = `SSD-0${nextSequence}`;
      
      const matchedDoctor = doctorList.find(d => d.name === selectedSimDoctor) || doctorList[0];

      const newScanResult: ScanShareToken = {
        id: 'tok-' + Date.now(),
        tokenNo,
        patientName: names[selectedIndex],
        abhaAddress: abhas[selectedIndex],
        phone: phoneRandom,
        gender: chosenGender,
        age: chosenAge,
        timeShare: new Date().toISOString(),
        department: matchedDoctor.dept,
        assignedDoctor: matchedDoctor.name,
        status: 'In Queue'
      };

      const updated = [newScanResult, ...tokens];
      saveTokens(updated);

      // Registers inside shared patients Database so it links cleanly with other components
      const patientToAdd = {
        name: newScanResult.patientName,
        phone: newScanResult.phone,
        age: newScanResult.age,
        gender: newScanResult.gender.toLowerCase(),
        address: 'Ashiyana Main Rd, Sector H, Lucknow - 226012',
        mrn: `MRN${Math.floor(Math.random() * 90000) + 10000}`,
        status: 'Active',
        registration_type: 'Scan_and_Share',
        tpaId: `99-3829-1928-${Math.floor(10 + Math.random() * 90)}`, // Simulate ABHA ID
        tpaValidity: newScanResult.abhaAddress
      };

      try {
        const result = await supabaseService.createPatient(patientToAdd);
        if (result) {
          // Push consultation appointment straight in
          await supabaseService.createAppointment({
            patient_id: result.id,
            doctor_id: null,
            type: 'OPD',
            appointment_date: new Date().toISOString().split('T')[0],
            appointment_time: new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }),
            status: 'Scheduled',
            urgency: 'Routine'
          });

          // Sync event trigger
          window.dispatchEvent(new CustomEvent('supabase-data-sync', { 
            detail: { table: 'patients', action: 'insert' } 
          }));
        }
      } catch (err) {
        console.warn('Fallback registering patient in local storage state:', err);
      }

      // Add audit log
      const auditLog = {
        id: 'log-' + Date.now(),
        timestamp: new Date().toISOString(),
        userId: 'abdm_gateway',
        userRole: 'Gateway',
        action: 'Scan & Share Decrypt Consent Token',
        module: 'SCAN_SHARE' as const,
        status: 'SUCCESS' as const,
        ipAddress: '23.49.204.33',
        details: `Auto-registered patient ${newScanResult.patientName} via ABDM profile scan - Token ${tokenNo}`
      };
      const currentLogs = JSON.parse(localStorage.getItem('hms_abdm_audit_logs') || '[]');
      currentLogs.unshift(auditLog);
      localStorage.setItem('hms_abdm_audit_logs', JSON.stringify(currentLogs));

      // Notification hook
      const smsLog = {
        id: 'nt-' + Date.now(),
        timestamp: new Date().toISOString(),
        patientName: newScanResult.patientName,
        channel: 'WhatsApp' as const,
        recipient: newScanResult.phone,
        content: `Namaste, you have scanned successfully at Global Hospital! Token Issued: ${tokenNo}. Department: ${newScanResult.department}. Wait time approximate: 10 mins.`,
        status: 'Delivered' as const
      };
      const currentNotifs = JSON.parse(localStorage.getItem('hms_abdm_notifications') || '[]');
      currentNotifs.unshift(smsLog);
      localStorage.setItem('hms_abdm_notifications', JSON.stringify(currentNotifs));

      setSelectedTokenToPrint(newScanResult);
      setIsPrintModalOpen(true);
      setIsSimulating(false);
      toast.success(`Patient scan accepted! ABDM Token ${tokenNo} dispatched.`);
    }, 1500);
  };

  const handleUpdateStatus = (id: string, newStatus: 'In Queue' | 'Called' | 'Completed') => {
    const updated = tokens.map(tok => tok.id === id ? { ...tok, status: newStatus } : tok);
    saveTokens(updated);
    toast.info(`Updated status of token to "${newStatus}"`);
  };

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
      
      {/* Printable Hosp Board QR Panel */}
      <Card className="shadow-sm border-slate-100 bg-white">
        <CardHeader className="pb-3 border-b border-slate-50">
          <CardTitle className="text-sm font-bold text-slate-800 flex items-center gap-2">
            <QrCode className="w-5.5 h-5.5 text-medical-blue" />
            Hospital Counter QR Portal
          </CardTitle>
          <CardDescription className="text-xs">Counter #1 - OPD Rapid Registration Screen</CardDescription>
        </CardHeader>
        <CardContent className="pt-6 flex flex-col items-center justify-center text-center">
          <div className="bg-slate-50 p-4 border rounded-3xl relative flex items-center justify-center w-52 h-52">
            {/* Mock government style QR poster */}
            <div className="absolute top-2 w-[90%] flex justify-between items-center px-1 text-[8px] font-bold text-slate-400">
              <span>NDHM SANDBOX</span>
              <span>v2.0 COMPLIANT</span>
            </div>
            
            {/* Visual representation of ABDM scan and share card */}
            <div className="text-slate-800 flex flex-col items-center">
              <QrCode className="w-40 h-40 text-blue-900" strokeWidth={1} />
              <div className="w-2.5 h-2.5 bg-emerald-500 rounded-full animate-ping absolute"></div>
            </div>

            <div className="absolute bottom-2 w-[90%] text-center text-[7px] text-teal-700 font-extrabold uppercase">
              SCAN QR FROM ABHA APP TO SHARE
            </div>
          </div>

          <h4 className="text-md font-bold text-slate-800 mt-4 leading-none uppercase">Global Hospital Counter</h4>
          <p className="text-[10px] text-muted-foreground mt-1">Scan to pull demographics within seconds</p>

          <div className="flex gap-2 mt-4 w-full">
            <Button variant="outline" size="sm" className="flex-1 text-xs" onClick={() => toast.success('QR Code download started!')}>
              <Download className="w-3.5 h-3.5 mr-1" />
              Download JPG
            </Button>
            <Button variant="outline" size="sm" className="flex-1 text-xs" onClick={() => toast.success('Sending print command to thermal desk...')}>
              <Printer className="w-3.5 h-3.5 mr-1" />
              Print Signage
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Simulator and Recent Scan Tokens */}
      <div className="md:col-span-2 space-y-6">
        
        {/* Simulation Control Block */}
        <Card className="shadow-sm border-indigo-200 bg-indigo-50/25">
          <CardHeader className="pb-2 flex flex-row items-center justify-between">
            <div>
              <CardTitle className="text-xs font-bold text-indigo-900 uppercase tracking-widest flex items-center gap-1.5">
                <Sparkles className="w-4 h-4 text-indigo-600" />
                ABDM Mobile Application Simulation Desk
              </CardTitle>
              <CardDescription className="text-xs text-indigo-700">Simulate a patient scanning counter QR and pushing demographics from their phone app.</CardDescription>
            </div>
          </CardHeader>
          <CardContent className="pt-3">
            <div className="flex flex-wrap items-end gap-3">
              <div className="space-y-1.5 flex-1 min-w-[200px]">
                <Label className="text-[10px]">Select Hospital Clinic / Department to Route Patient</Label>
                <Select value={selectedSimDoctor || doctorList[0].name} onValueChange={setSelectedSimDoctor}>
                  <SelectTrigger className="bg-white">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {doctorList.map((doc) => (
                      <SelectItem key={doc.name} value={doc.name}>
                        {doc.name} ({doc.dept})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <Button 
                onClick={handleSimulateScan} 
                disabled={isSimulating}
                className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold h-10 px-5 text-xs"
              >
                {isSimulating ? (
                  <>Scanning health locker...</>
                ) : (
                  <>
                    <Smartphone className="w-4 h-4 mr-1.5" />
                    Push Simulator Scan Payload
                    <ArrowRight className="w-3.5 h-3.5 ml-1" />
                  </>
                )}
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Scan & Share Active Token Queue */}
        <Card className="shadow-sm border-slate-100 bg-white">
          <CardHeader className="pb-3 border-b flex flex-row items-center justify-between">
            <div>
              <CardTitle className="text-sm font-bold text-slate-800 flex items-center gap-2">
                <ClipboardList className="w-4.5 h-4.5 text-emerald-600" />
                Outpatient Scan & Share Active Token List
              </CardTitle>
              <CardDescription className="text-xs">Self registration tokens compiled today</CardDescription>
            </div>
            <span className="text-xs bg-emerald-50 text-emerald-700 border border-emerald-100 px-3 py-1 font-bold rounded-full">
              {tokens.length} Active
            </span>
          </CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableHeader className="bg-slate-50/70">
                <TableRow>
                  <TableHead className="text-[10px] font-bold text-slate-400 py-2">Token No</TableHead>
                  <TableHead className="text-[10px] font-bold text-slate-400 py-2">Patient Name & ABHA</TableHead>
                  <TableHead className="text-[10px] font-bold text-slate-400 py-2">Department Route</TableHead>
                  <TableHead className="text-[10px] font-bold text-slate-400 py-2">Contact</TableHead>
                  <TableHead className="text-[10px] font-bold text-slate-400 py-2">Roster status</TableHead>
                  <TableHead className="text-[10px] font-bold text-slate-400 py-2 text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {tokens.map((tok) => (
                  <TableRow key={tok.id} className="hover:bg-slate-50/50 text-xs">
                    <TableCell className="font-mono font-black text-indigo-700">{tok.tokenNo}</TableCell>
                    <TableCell>
                      <p className="font-bold text-slate-700">{tok.patientName}</p>
                      <p className="text-[9px] text-teal-600 font-mono">{tok.abhaAddress} • {tok.age} Y/O ({tok.gender})</p>
                    </TableCell>
                    <TableCell>
                      <p className="font-semibold text-slate-700">{tok.department}</p>
                      <p className="text-[9px] text-slate-400">{tok.assignedDoctor}</p>
                    </TableCell>
                    <TableCell className="text-slate-500 font-mono text-[10px]">{tok.phone}</TableCell>
                    <TableCell>
                      <Select 
                        value={tok.status || 'In Queue'} 
                        onValueChange={(v: any) => handleUpdateStatus(tok.id, v)}
                      >
                        <SelectTrigger className="h-7 w-28 text-[10px] font-semibold bg-slate-50 border">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent className="text-[10px]">
                          <SelectItem value="In Queue">In Queue</SelectItem>
                          <SelectItem value="Called">Called Desk</SelectItem>
                          <SelectItem value="Completed">Completed</SelectItem>
                        </SelectContent>
                      </Select>
                    </TableCell>
                    <TableCell className="text-right">
                      <Button variant="ghost" size="icon" className="h-8 w-8 text-slate-500" onClick={() => {
                        setSelectedTokenToPrint(tok);
                        setIsPrintModalOpen(true);
                      }}>
                        <Printer className="w-3.5 h-3.5" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>

      {/* Printable OPD Slip Overlay Modal */}
      {isPrintModalOpen && selectedTokenToPrint && (
        <div className="fixed inset-0 bg-slate-900/60 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl border border-slate-100 shadow-2xl p-6 max-w-sm w-full space-y-6">
            <div className="border border-dashed border-slate-300 rounded-2xl p-5 space-y-4 bg-slate-50/50">
              
              {/* Slip Header */}
              <div className="text-center pb-2 border-b border-slate-200">
                <span className="text-[9px] bg-indigo-150 text-indigo-800 font-black px-2 py-0.5 rounded-full uppercase">
                  Scan & Share OPD Ticket
                </span>
                <h3 className="font-black text-slate-800 text-sm mt-2 uppercase tracking-wide">GLOBAL HOSPITAL & MATERNITY</h3>
                <p className="text-[8px] text-slate-400 font-mono mt-0.5">Lucknow, UP • HFR-UP-10294-A</p>
              </div>

              {/* Token Display */}
              <div className="text-center py-2 bg-indigo-55 rounded-xl border border-indigo-100">
                <p className="text-[9px] text-slate-400 font-bold uppercase tracking-wider">QUEUE TOKEN NUMBER</p>
                <h1 className="text-3xl font-black text-indigo-900 tracking-wider font-mono my-1">{selectedTokenToPrint.tokenNo}</h1>
                <p className="text-[8px] text-emerald-600 font-extrabold flex items-center justify-center gap-1">
                  ● Roster: Routine OPD Consultation
                </p>
              </div>

              {/* Details Segment */}
              <div className="space-y-1.5 text-xs">
                <div className="flex justify-between">
                  <span className="text-slate-400 font-semibold uppercase text-[8px]">Patient Name:</span>
                  <span className="font-bold text-slate-700">{selectedTokenToPrint.patientName}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400 font-semibold uppercase text-[8px]">ABHA Identity:</span>
                  <span className="font-mono font-bold text-teal-600 text-[10px]">{selectedTokenToPrint.abhaAddress}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400 font-semibold uppercase text-[8px]">Route Clinic:</span>
                  <span className="font-bold text-slate-700">{selectedTokenToPrint.department}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400 font-semibold uppercase text-[8px]">Attending Doctor:</span>
                  <span className="font-bold text-slate-700">{selectedTokenToPrint.assignedDoctor}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400 font-semibold uppercase text-[8px]">Issued At:</span>
                  <span className="font-mono text-slate-500 text-[10px]">
                    {new Date(selectedTokenToPrint.timeShare).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </span>
                </div>
              </div>

              <div className="text-center border-t border-slate-200 pt-3">
                <p className="text-[7px] text-slate-400 max-w-xs mx-auto">
                  Scan & Share allows direct record loading. No paperwork needed. Please proceed to the clinic waiting lounge.
                </p>
              </div>
            </div>

            <div className="flex gap-2">
              <Button variant="outline" className="flex-1 text-xs" onClick={() => setIsPrintModalOpen(false)}>Close</Button>
              <Button className="bg-indigo-600 hover:bg-indigo-700 text-white flex-1 text-xs font-bold" onClick={() => {
                toast.success('Ticket dispatched to Counter standard printer!');
                setIsPrintModalOpen(false);
              }}>
                <Printer className="w-3.5 h-3.5 mr-1" />
                Print Thermal
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
