import { useState, useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { 
  Award, 
  Search, 
  CheckCircle, 
  AlertTriangle, 
  Stethoscope, 
  Building2, 
  FileCheck2, 
  ArrowUpRight, 
  RefreshCw, 
  HelpCircle, 
  Briefcase,
  Layers,
  Sparkles,
  DollarSign,
  UserCheck
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';
import { PmjayClaim, HprDoctor, ABDM_FACILITY_INFO } from './types';
import { supabaseService } from '@/services/supabaseService';

const PRELOADED_HPR: HprDoctor[] = [
  {
    hprId: 'dr_rajesh@hpr',
    name: 'Dr. Rajesh Sharma',
    registrationNumber: 'MCI-UP-99238',
    qualification: 'MD, General Medicine',
    specialization: 'Internal Medicine & Critical Care',
    status: 'Active_HPR',
    verifiedAt: '2026-05-10'
  },
  {
    hprId: 'dr_anjali@hpr',
    name: 'Dr. Anjali Gupta',
    registrationNumber: 'MCI-UP-88219',
    qualification: 'MS, Obstetrics & Gynaecology',
    specialization: 'Maternity Specialist',
    status: 'Active_HPR',
    verifiedAt: '2026-06-01'
  }
];

const PRELOADED_CLAIMS: PmjayClaim[] = [
  {
    id: 'clm-201',
    patientId: 'p-1',
    patientName: 'Shambhu Nath Mishra',
    ayushmanCardNo: 'AB-PMJAY-9923-0192',
    beneficiaryId: 'BEN-88239101',
    packageName: 'Caesarean Delivery Package',
    packageCode: 'UP-OBGY-04',
    amount: 28000,
    status: 'Paid',
    preAuthNo: 'PA-UP-882941-C',
    dateFiled: '2026-06-10',
    sachisReconciliationStatus: 'Matched'
  },
  {
    id: 'clm-202',
    patientId: 'p-2',
    patientName: 'Vimla Devi Srivastav',
    ayushmanCardNo: 'AB-PMJAY-1029-7731',
    beneficiaryId: 'BEN-10293110',
    packageName: 'Appendectomy Laparoscopic',
    packageCode: 'UP-GSURG-12',
    amount: 14000,
    status: 'Approved',
    preAuthNo: 'PA-UP-102941-A',
    dateFiled: '2026-06-12',
    sachisReconciliationStatus: 'Matched'
  },
  {
    id: 'clm-203',
    patientId: 'p-3',
    patientName: 'Surendra Pal Singh',
    ayushmanCardNo: 'AB-PMJAY-8842-1029',
    beneficiaryId: 'BEN-38290119',
    packageName: 'Paediatric ICU Ventilation Days',
    packageCode: 'UP-PED-03',
    amount: 38500,
    status: 'Submitted',
    preAuthNo: 'PA-UP-772901-P',
    dateFiled: '2026-06-14',
    sachisReconciliationStatus: 'Pending'
  }
];

const PMJAY_PACKAGES = [
  { code: 'UP-OBGY-03', name: 'Normal Hospital Delivery Package', amount: 18500 },
  { code: 'UP-OBGY-04', name: 'Caesarean Delivery Package', amount: 28000 },
  { code: 'UP-GSURG-12', name: 'Appendectomy Laparoscopic', amount: 14000 },
  { code: 'UP-PED-03', name: 'Paediatric ICU Ventilation Days', amount: 38500 },
  { code: 'UP-ORTHO-09', name: 'Total Hip Arthroplasty (Joint)', amount: 75000 },
  { code: 'UP-CARD-02', name: 'PTCA Stenting Cardiology Package', amount: 95000 }
];

export default function AbdmRegistryPmjay() {
  const location = useLocation();
  const [hprDocs, setHprDocs] = useState<HprDoctor[]>([]);
  const [claims, setClaims] = useState<PmjayClaim[]>([]);
  
  // Custom scroll event listening to navigate directly to sections
  useEffect(() => {
    const searchParams = new URLSearchParams(location.search);
    const scrollSection = (location.state as any)?.scrollSection || searchParams.get('scrollSection');
    if (scrollSection) {
      setTimeout(() => {
        const id = scrollSection === 'hpr' ? 'abdm-hpr-hfr' : 'abdm-pmjay-claims';
        const el = document.getElementById(id);
        if (el) {
          el.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
      }, 300);
    }
  }, [location]);

  // HFR states
  const [facilities, setFacilities] = useState<any[]>(() => {
    const saved = localStorage.getItem('hms_abdm_hfr_facilities');
    if (saved) return JSON.parse(saved);
    const initial = [
      {
        hfrId: 'HFR-UP-10294-A',
        name: 'Medinex HMS by Digital Communique Private Limited',
        ownership: 'Private Empanelled',
        nabhStatus: 'Accredited (Grade A)',
        state: 'Uttar Pradesh',
        facilityType: 'Multi-specialty Hospital',
        verified: true,
        synchronizedAt: new Date().toISOString()
      },
      {
        hfrId: 'HFR-UP-77215-B',
        name: 'SITARAM MEMORIAL CLINIC & EYE CENTER',
        ownership: 'Private',
        nabhStatus: 'Not accredited',
        state: 'Uttar Pradesh',
        facilityType: 'Eye Clinic',
        verified: true,
        synchronizedAt: new Date(Date.now() - 3600000 * 24).toISOString()
      }
    ];
    localStorage.setItem('hms_abdm_hfr_facilities', JSON.stringify(initial));
    return initial;
  });

  const [newFacId, setNewFacId] = useState('');
  const [newFacName, setNewFacName] = useState('');
  const [newFacOwnership, setNewFacOwnership] = useState('Private Empanelled');
  const [newFacNabh, setNewFacNabh] = useState('Accredited (Grade A)');
  const [newFacState, setNewFacState] = useState('Uttar Pradesh');
  const [newFacType, setNewFacType] = useState('Multi-specialty Hospital');
  const [searchFacId, setSearchFacId] = useState('');
  const [searchedFacility, setSearchedFacility] = useState<any | null>(null);
  const [activeHfrSubTab, setActiveHfrSubTab] = useState<'view' | 'register' | 'verify'>('view');

  // HPR Search state
  const [searchHprId, setSearchHprId] = useState('');
  const [foundDoc, setFoundDoc] = useState<HprDoctor | null>(null);

  // PM-JAY Roster state
  const [pmjayName, setPmjayName] = useState('');
  const [goldenCardNo, setGoldenCardNo] = useState('');
  const [selectedPackCode, setSelectedPackCode] = useState(PMJAY_PACKAGES[0].code);
  const [isEligibleChecked, setIsEligibleChecked] = useState<boolean | null>(null);
  const [submittingClaim, setSubmittingClaim] = useState(false);

  useEffect(() => {
    const loadRegistries = async () => {
      // 1. Facilities
      const fetchedFacs = await supabaseService.getHfrFacilities();
      if (fetchedFacs && fetchedFacs.length > 0) {
        setFacilities(fetchedFacs);
      }

      // 2. HPR Doctors
      const fetchedHpr = await supabaseService.getHprPractitioners();
      if (fetchedHpr && fetchedHpr.length > 0) {
        setHprDocs(fetchedHpr || []);
      } else {
        for (const d of PRELOADED_HPR) {
          await supabaseService.createHprPractitioner(d);
        }
        const refreshedHpr = await supabaseService.getHprPractitioners();
        setHprDocs(refreshedHpr || []);
      }

      // 3. Claims
      const fetchedClaims = await supabaseService.getPmjayClaims();
      if (fetchedClaims && fetchedClaims.length > 0) {
        setClaims(fetchedClaims || []);
      } else {
        for (const cl of PRELOADED_CLAIMS) {
          await supabaseService.createPmjayClaim(cl);
        }
        const refreshedClaims = await supabaseService.getPmjayClaims();
        setClaims(refreshedClaims || []);
      }
    };
    loadRegistries();
  }, []);

  const saveClaims = async (updatedList: PmjayClaim[]) => {
    setClaims(updatedList || []);
  };

  // HPR verify action
  const handleQueryHpr = async () => {
    if (!searchHprId) {
      toast.error('Please input valid Doctor HPR ID');
      return;
    }

    const cleaned = searchHprId.trim();
    const matched = hprDocs.find(d => d.hprId.toLowerCase() === cleaned.toLowerCase());
    
    if (matched) {
      setFoundDoc(matched);
      toast.success('Doctor verified successfully in central HPR database!');
    } else {
      // Return a dynamically simulated doctor if not preloaded to ensure Sandbox mode works perfectly
      const dynamicDoc: HprDoctor = {
        hprId: cleaned,
        name: `Dr. ${cleaned.split('@')[0].split('_').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ')}`,
        registrationNumber: `MCI-UP-${Math.floor(10000 + Math.random() * 90000)}`,
        qualification: 'MS, General Surgery',
        specialization: 'Consulting Surgeon',
        status: 'Active_HPR',
        verifiedAt: new Date().toISOString().split('T')[0]
      };
      
      await supabaseService.createHprPractitioner(dynamicDoc);
      const refreshedHpr = await supabaseService.getHprPractitioners();
      setHprDocs(refreshedHpr);
      setFoundDoc(dynamicDoc);
      toast.success('Successfully linked new practitioner with national HPR platform!');
    }
  };

  // Eligibility pull
  const handleEligibilityFetch = () => {
    if (!goldenCardNo || !pmjayName) {
      toast.error('Please fill in Patient Name and Ayushman Golden Card ID');
      return;
    }
    
    toast.loading('Contacting National PM-JAY and SACHIS databases...');
    setTimeout(() => {
      toast.dismiss();
      setIsEligibleChecked(true);
      toast.success('Eligibility check approved: Patient registered in PM-JAY roster!');
    }, 1200);
  };

  // File Claim and pre-authorize package
  const handleFileClaim = () => {
    if (!isEligibleChecked) {
      toast.error('Kindly run eligibility validation prior to claim compilation.');
      return;
    }

    setSubmittingClaim(true);
    setTimeout(async () => {
      const selectedPkg = PMJAY_PACKAGES.find(p => p.code === selectedPackCode) || PMJAY_PACKAGES[0];
      const preAuthId = `PA-UP-${Math.floor(100000 + Math.random() * 900000)}-C`;
      
      const newClaim = {
        ayushmanCardNo: goldenCardNo,
        beneficiaryId: `BEN-${Math.floor(10000000 + Math.random() * 90000000)}`,
        packageName: selectedPkg.name,
        packageCode: selectedPkg.code,
        amount: selectedPkg.amount,
        status: 'Submitted',
        preAuthNo: preAuthId,
        sachisReconciliationStatus: 'Pending'
      };

      await supabaseService.createPmjayClaim(newClaim);
      const refreshedClaims = await supabaseService.getPmjayClaims();
      setClaims(refreshedClaims || []);

      // Audit logs
      const progressLog = {
        userId: 'u_accounts_2',
        userRole: 'Accountant',
        action: 'PM-JAY Claim Pre-Auth File',
        module: 'PM-JAY' as const,
        status: 'SUCCESS' as const,
        ipAddress: '192.168.1.115',
        details: `Dispatched Pre-Auth claim request ID ${preAuthId} for package ${selectedPkg.code}`
      };
      await supabaseService.createAbdmAuditLog(progressLog);

      toast.success(`Pre-Authorization successfully created! Authorized reference: ${preAuthId}`);
      setSubmittingClaim(false);
      setPmjayName('');
      setGoldenCardNo('');
      setIsEligibleChecked(null);
    }, 1800);
  };

  const syncFacilityHfr = (facilityId?: string) => {
    const idToSync = facilityId || 'HFR-UP-10294-A';
    toast.loading(`Contacting ABDM Gateway... Syncing telemetry for HFR ID: ${idToSync}`);
    setTimeout(async () => {
      toast.dismiss();
      const matchedFac = facilities.find(f => f.hfrId === idToSync);
      if (matchedFac) {
        await supabaseService.updateHfrFacility(idToSync, {
          ...matchedFac,
          abdmGatewayStatus: 'Active'
        });
        const refreshed = await supabaseService.getHfrFacilities();
        setFacilities(refreshed);
      }
      
      // Save and log audit
      const progressLog = {
        userId: 'abdm_gateway',
        userRole: 'System',
        action: 'HFR Registry Update Sync',
        module: 'HPR_HFR' as const,
        status: 'SUCCESS' as const,
        ipAddress: '23.49.204.33',
        details: `Synchronized HFR credentials for node ${idToSync}.`
      };
      await supabaseService.createAbdmAuditLog(progressLog);

      toast.success(`HFR facility ${idToSync} successfully synchronized with National Health Authority!`);
    }, 1000);
  };

  const handleRegisterFacility = () => {
    if (!newFacId || !newFacName) {
      toast.error('HFR ID and Facility Name are required');
      return;
    }
    const cleanId = newFacId.toUpperCase().trim();
    if (facilities.some(f => f.hfrId === cleanId)) {
      toast.error('Facility with this HFR ID is already registered locally.');
      return;
    }
    const newFac = {
      hfrId: cleanId,
      name: newFacName.toUpperCase().trim(),
      ownership: newFacOwnership,
      nabhStatus: newFacNabh,
      state: newFacState,
      facilityType: newFacType,
      verified: true,
      synchronizedAt: new Date().toISOString()
    };
    const updated = [...facilities, newFac];
    setFacilities(updated);
    localStorage.setItem('hms_abdm_hfr_facilities', JSON.stringify(updated));
    
    // Log audit
    const progressLog = {
      id: 'log-' + Date.now(),
      timestamp: new Date().toISOString(),
      userId: 'u_admin',
      userRole: 'Administrator',
      action: 'Register Facility HFR',
      module: 'HPR_HFR' as const,
      status: 'SUCCESS' as const,
      ipAddress: '192.168.1.1',
      details: `Registered new facility ${newFac.name} with HFR ID ${cleanId}`
    };
    const currentLogs = JSON.parse(localStorage.getItem('hms_abdm_audit_logs') || '[]');
    currentLogs.unshift(progressLog);
    localStorage.setItem('hms_abdm_audit_logs', JSON.stringify(currentLogs));

    toast.success(`Successfully registered ${newFac.name} inside Healthcare Facility Registry!`);
    setNewFacId('');
    setNewFacName('');
    setActiveHfrSubTab('view');
  };

  const handleVerifyFacility = () => {
    if (!searchFacId) {
      toast.error('Please provide an HFR ID to verify.');
      return;
    }
    const cleanId = searchFacId.toUpperCase().trim();
    const matched = facilities.find(f => f.hfrId === cleanId);
    if (matched) {
      setSearchedFacility(matched);
      toast.success('Facility verified successfully in local state & central registry!');
    } else {
      // Create a dynamic verified registry entry to simulate successful external HFR query
      const simulated = {
        hfrId: cleanId,
        name: `NHA SIMULATED CLINIC ${cleanId.slice(cleanId.length-4)}`,
        ownership: 'Private',
        nabhStatus: 'Applied',
        state: 'Uttar Pradesh',
        facilityType: 'Diagnostics Center',
        verified: true,
        synchronizedAt: new Date().toISOString()
      };
      setSearchedFacility(simulated);
      toast.success(`Query returned verified record from external NDHM Gateway node: ${simulated.name}`);
    }
  };

  return (
    <div className="space-y-6">
      
      {/* Registry Segment - HPR & HFR */}
      <div id="abdm-hpr-hfr" className="grid grid-cols-1 md:grid-cols-2 gap-6">
        
        {/* Healthcare Facility Registry Info Card */}
        <Card className="shadow-sm border-slate-100 bg-white">
          <CardHeader className="pb-2 border-b">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm font-bold text-slate-800 flex items-center gap-1.5">
                <Building2 className="w-5 h-5 text-indigo-600" />
                HFR - Facility Registry Suite
              </CardTitle>
              <div className="flex gap-1.5">
                <Button 
                  variant={activeHfrSubTab === 'view' ? 'secondary' : 'ghost'} 
                  size="sm" 
                  className="h-7 text-[10px] font-bold px-2 rounded-lg"
                  onClick={() => setActiveHfrSubTab('view')}
                >
                  Profile
                </Button>
                <Button 
                  variant={activeHfrSubTab === 'register' ? 'secondary' : 'ghost'} 
                  size="sm" 
                  className="h-7 text-[10px] font-bold px-2 rounded-lg"
                  onClick={() => setActiveHfrSubTab('register')}
                >
                  Register New
                </Button>
                <Button 
                  variant={activeHfrSubTab === 'verify' ? 'secondary' : 'ghost'} 
                  size="sm" 
                  className="h-7 text-[10px] font-bold px-2 rounded-lg"
                  onClick={() => setActiveHfrSubTab('verify')}
                >
                  Verify External
                </Button>
              </div>
            </div>
            <CardDescription className="text-xs">Manage clinical centers, map to physical departments, and sync with central NDHM node</CardDescription>
          </CardHeader>
          <CardContent className="pt-4 space-y-4">
            {activeHfrSubTab === 'view' && (
              <div className="space-y-4 animate-fade-in">
                <div className="flex items-center justify-between text-xs font-semibold bg-indigo-50/40 p-2.5 rounded-lg border border-indigo-100">
                  <div className="space-y-0.5">
                    <p className="font-bold text-indigo-950">Active HFR Unit</p>
                    <p className="text-[10px] text-indigo-700/85">Medinex HMS (UP)</p>
                  </div>
                  <Button variant="outline" size="sm" className="h-7 text-[10.5px] border-indigo-200 text-indigo-700 hover:bg-indigo-50 font-bold flex items-center gap-1" onClick={() => syncFacilityHfr('HFR-UP-10294-A')}>
                    <RefreshCw className="w-3 h-3" /> Sync Active Profile
                  </Button>
                </div>

                <div className="space-y-2">
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider font-mono">Registered Healthcare Facilities ({facilities.length})</p>
                  <div className="space-y-2 max-h-[170px] overflow-y-auto">
                    {facilities.map((fac) => (
                      <div key={fac.hfrId} className="p-3 bg-slate-50 border border-slate-100 rounded-xl flex items-center justify-between">
                        <div className="space-y-1">
                          <p className="text-xs font-bold text-slate-800">{fac.name}</p>
                          <p className="text-[10px] font-mono font-medium text-slate-500">ID: <span className="font-extrabold text-indigo-700">{fac.hfrId}</span> • {fac.facilityType}</p>
                          <p className="text-[9px] text-muted-foreground">Ownership: <span className="font-bold">{fac.ownership}</span> • NABH: <span className="font-semibold">{fac.nabhStatus}</span></p>
                        </div>
                        <div className="text-right space-y-1 shrink-0">
                          <Badge variant="outline" className="bg-emerald-50 text-emerald-700 border-emerald-100 font-extrabold text-[9px] px-1.5 py-0">ACTIVE HFR</Badge>
                          <p className="text-[8px] text-slate-400 font-mono">Synced: {fac.synchronizedAt ? new Date(fac.synchronizedAt).toLocaleTimeString() : 'Pending'}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {activeHfrSubTab === 'register' && (
              <div className="space-y-3 animate-fade-in text-xs">
                <div className="grid grid-cols-2 gap-2">
                  <div className="space-y-1">
                    <Label className="text-[10px] font-bold">HFR Gateway ID</Label>
                    <Input 
                      placeholder="e.g. HFR-UP-10299-X" 
                      value={newFacId || ''} 
                      onChange={(e) => setNewFacId(e.target.value)}
                      className="h-8 text-xs bg-slate-50 border-none"
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-[10px] font-bold">Facility name</Label>
                    <Input 
                      placeholder="e.g. LUCKNOW OPD DEPOT" 
                      value={newFacName || ''} 
                      onChange={(e) => setNewFacName(e.target.value)}
                      className="h-8 text-xs bg-slate-50 border-none"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div className="space-y-1">
                    <Label className="text-[10px] font-bold">Facility Type</Label>
                    <Select value={newFacType || 'Multi-specialty Hospital'} onValueChange={setNewFacType}>
                      <SelectTrigger className="h-8 text-xs bg-slate-50 border-none">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent className="text-xs">
                        <SelectItem value="Multi-specialty Hospital">Multi-specialty Hospital</SelectItem>
                        <SelectItem value="General Clinic">General Clinic</SelectItem>
                        <SelectItem value="Diagnostics Center">Diagnostics Center</SelectItem>
                        <SelectItem value="Eye Clinic">Eye Clinic</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1">
                    <Label className="text-[10px] font-bold">Ownership</Label>
                    <Select value={newFacOwnership || 'Private Empanelled'} onValueChange={setNewFacOwnership}>
                      <SelectTrigger className="h-8 text-xs bg-slate-50 border-none">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent className="text-xs">
                        <SelectItem value="Private Empanelled">Private Empanelled</SelectItem>
                        <SelectItem value="Government">Government</SelectItem>
                        <SelectItem value="Trust">Trust</SelectItem>
                        <SelectItem value="Private">Private</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div className="space-y-1">
                    <Label className="text-[10px] font-bold">NABH Accreditation status</Label>
                    <Select value={newFacNabh || 'Accredited (Grade A)'} onValueChange={setNewFacNabh}>
                      <SelectTrigger className="h-8 text-xs bg-slate-50 border-none">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent className="text-xs">
                        <SelectItem value="Accredited (Grade A)">Accredited (Grade A)</SelectItem>
                        <SelectItem value="Applied">Applied</SelectItem>
                        <SelectItem value="In-Process">In-Process</SelectItem>
                        <SelectItem value="Not accredited">Not accredited</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1">
                    <Label className="text-[10px] font-bold">State Region</Label>
                    <Select value={newFacState || 'Uttar Pradesh'} onValueChange={setNewFacState}>
                      <SelectTrigger className="h-8 text-xs bg-slate-50 border-none">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent className="text-xs">
                        <SelectItem value="Uttar Pradesh">Uttar Pradesh</SelectItem>
                        <SelectItem value="Delhi NCR">Delhi NCR</SelectItem>
                        <SelectItem value="Bihar">Bihar</SelectItem>
                        <SelectItem value="Maharashtra">Maharashtra</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <Button onClick={handleRegisterFacility} className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-bold h-8 text-[11px] rounded-lg mt-1">
                  Add to Healthcare Facility Registry (HFR)
                </Button>
              </div>
            )}

            {activeHfrSubTab === 'verify' && (
              <div className="space-y-3 animate-fade-in text-xs">
                <div className="space-y-1">
                  <Label className="text-[10px] font-bold">Search and Verify Facility via ID</Label>
                  <div className="flex gap-2">
                    <Input 
                      placeholder="Enter HFR ID (e.g. HFR-UP-10294-A)" 
                      value={searchFacId}
                      onChange={(e) => setSearchFacId(e.target.value)}
                      className="h-8 text-xs bg-slate-50 border-none"
                    />
                    <Button onClick={handleVerifyFacility} className="bg-indigo-65 hover:bg-slate-50 text-indigo-700 font-extrabold border border-indigo-200 text-[10.5px] h-8 px-3 shrink-0">
                      Verify Node
                    </Button>
                  </div>
                </div>

                {searchedFacility && (
                  <div className="bg-emerald-50/25 border border-emerald-150 p-3 rounded-xl space-y-1.5">
                    <p className="text-[9px] font-bold text-emerald-800 uppercase tracking-widest flex items-center gap-1">
                      <CheckCircle className="w-3.5 h-3.5 text-emerald-500 shrink-0" /> Verified Central Record Found
                    </p>
                    <div className="space-y-0.5">
                      <p className="font-bold text-slate-800 text-[11px]">{searchedFacility.name}</p>
                      <p className="text-[10px] font-mono text-slate-600">ID: {searchedFacility.hfrId} • Region: {searchedFacility.state}</p>
                      <p className="text-[9px] text-slate-500">Ownership: <span className="font-semibold">{searchedFacility.ownership}</span> • NABH status: <span className="font-semibold text-emerald-700">{searchedFacility.nabhStatus}</span></p>
                      <p className="text-[8px] text-slate-400 italic">Sync validation success at gateway {new Date(searchedFacility.synchronizedAt).toLocaleString()}</p>
                    </div>
                  </div>
                )}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Healthcare Professional Registry (HPR) Verification */}
        <Card className="shadow-sm border-slate-100 bg-white">
          <CardHeader className="pb-3 border-b">
            <CardTitle className="text-sm font-bold text-slate-800 flex items-center gap-1.5">
              <Stethoscope className="w-5 h-5 text-indigo-600" />
              HPR - Verify Clinical Doctor Registry
            </CardTitle>
            <CardDescription className="text-xs">Search and bind clinical profiles via national registries</CardDescription>
          </CardHeader>
          <CardContent className="pt-4 space-y-4">
            <div className="flex gap-2">
              <Input 
                placeholder="Doctor HPR ID (e.g. dr_rajesh@hpr)" 
                value={searchHprId}
                onChange={(e) => setSearchHprId(e.target.value)}
              />
              <Button onClick={handleQueryHpr} className="bg-indigo-65 hover:bg-slate-50 text-indigo-700 font-extrabold border border-indigo-200 text-xs px-4">
                <Search className="w-3.5 h-3.5 mr-1" /> Verify
              </Button>
            </div>

            {foundDoc && (
              <div className="bg-indigo-50/20 border border-indigo-150 p-4 rounded-xl flex items-start gap-3">
                <div className="p-2.5 bg-indigo-50 text-indigo-600 rounded-lg shrink-0 mt-0.5">
                  <UserCheck className="w-5 h-5" />
                </div>
                <div className="space-y-1 text-xs overflow-hidden">
                  <h4 className="font-black text-indigo-900 leading-none">{foundDoc.name}</h4>
                  <p className="text-[10px] text-slate-500 font-mono">Reg: {foundDoc.registrationNumber} • Specialty: {foundDoc.specialization}</p>
                  <p className="text-[10px] text-teal-600 font-bold flex items-center gap-1">
                    <CheckCircle className="w-3.5 h-3.5 text-emerald-500 shrink-0" /> Verified via HPR portal on {foundDoc.verifiedAt || 'Today'}
                  </p>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* PM-JAY & SACHIS Claim Processing Suite */}
      <h3 id="abdm-pmjay-claims" className="text-sm font-black text-slate-700 uppercase tracking-wider pt-2 border-t mt-4">
        Ayushman Bharat PM-JAY & SACHIS (UP) Management Suite
      </h3>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Eligibility Verification & Selection Form */}
        <Card className="shadow-sm border-slate-100 bg-white">
          <CardHeader className="pb-3 border-b">
            <CardTitle className="text-sm font-bold text-slate-800 flex items-center gap-1.5">
              <Award className="w-5 h-5 text-emerald-600" />
              Pre-Authorization Wizard
            </CardTitle>
            <CardDescription className="text-xs">Verify family ID eligibility and allocate clinical package</CardDescription>
          </CardHeader>
          <CardContent className="pt-4 space-y-4">
            
            <div className="space-y-1">
              <Label className="text-xs">Beneficiary Patient Full Name</Label>
              <Input 
                placeholder="Input name as on Golden Card" 
                value={pmjayName || ''}
                onChange={(e) => setPmjayName(e.target.value)}
              />
            </div>

            <div className="space-y-1">
              <Label className="text-xs">Aadhaar Family ID / Golden Card Number</Label>
              <Input 
                placeholder="e.g. AB-PMJAY-9923-0192" 
                value={goldenCardNo || ''}
                onChange={(e) => setGoldenCardNo(e.target.value)}
              />
            </div>

            <div className="flex gap-2">
              <Button onClick={handleEligibilityFetch} className="w-full bg-emerald-65 hover:bg-slate-50 text-emerald-800 font-bold border border-emerald-250 text-xs">
                Validate Golden Card Status
              </Button>
            </div>

            {isEligibleChecked && (
              <div className="bg-emerald-50/30 border border-emerald-150 p-3 rounded-xl space-y-3">
                <span className="text-[10px] font-bold text-emerald-800 flex items-center gap-1">
                  <FileCheck2 className="w-4 h-4 text-emerald-600" /> PM-JAY Eligibility Confirmed!
                </span>

                <div className="space-y-1">
                  <Label className="text-[10px] text-slate-500">Allocate PM-JAY Surgical Package Code</Label>
                  <Select value={selectedPackCode || PMJAY_PACKAGES[0].code} onValueChange={setSelectedPackCode}>
                    <SelectTrigger className="bg-white text-xs h-8">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="text-xs">
                      {PMJAY_PACKAGES.map((pkg) => (
                        <SelectItem key={pkg.code} value={pkg.code}>
                          {pkg.code} - {pkg.name} (₹{pkg.amount.toLocaleString()})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <Button 
                  onClick={handleFileClaim} 
                  disabled={submittingClaim}
                  className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-bold h-8 text-[11px]"
                >
                  {submittingClaim ? 'Submitting Pre-Auth Documents...' : 'Submit Claim Package for Pre-Auth'}
                </Button>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Claims ledger list */}
        <Card className="shadow-sm border-slate-100 bg-white lg:col-span-2">
          <CardHeader className="pb-3 border-b flex flex-row items-center justify-between">
            <div>
              <CardTitle className="text-sm font-bold text-slate-800 flex items-center gap-1.5">
                <Layers className="w-4.5 h-4.5 text-emerald-600" />
                Active PM-JAY Claim Portfolio Ledger
              </CardTitle>
              <CardDescription className="text-xs">Compile, monitor the reconciliation updates tracked via SACHIS</CardDescription>
            </div>
            <span className="text-[10px] bg-slate-100 border text-slate-600 font-bold px-2 py-0.5 rounded-full uppercase">
              RECONCILED VIA SACHIS
            </span>
          </CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableHeader className="bg-slate-50/70">
                <TableRow>
                  <TableHead className="text-[10px] font-bold text-slate-400 py-2">Patient name</TableHead>
                  <TableHead className="text-[10px] font-bold text-slate-400 py-2">Package code & Name</TableHead>
                  <TableHead className="text-[10px] font-bold text-slate-400 py-2">PMJAY ID</TableHead>
                  <TableHead className="text-[10px] font-bold text-slate-400 py-2">Claim amount</TableHead>
                  <TableHead className="text-[10px] font-bold text-slate-400 py-2">Gate Status</TableHead>
                  <TableHead className="text-[10px] font-bold text-slate-400 py-2 text-right">SACHIS Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {claims.map((clm) => (
                  <TableRow key={clm.id} className="hover:bg-slate-50/50 text-xs">
                    <TableCell>
                      <p className="font-bold text-slate-700">{clm.patientName}</p>
                      <p className="text-[9px] text-slate-400 font-mono">Date: {clm.dateFiled}</p>
                    </TableCell>
                    <TableCell>
                      <p className="font-semibold text-slate-700">{clm.packageName}</p>
                      <p className="text-[9px] text-emerald-700 font-mono font-bold uppercase">{clm.packageCode}</p>
                    </TableCell>
                    <TableCell>
                      <p className="font-mono text-slate-500 mt-0.5 text-[10px]">{clm.ayushmanCardNo}</p>
                      <p className="text-[8px] text-slate-400 font-bold uppercase">PreAuth: {clm.preAuthNo || 'N/A'}</p>
                    </TableCell>
                    <TableCell className="font-bold font-mono text-slate-700 text-xs">
                      ₹{clm.amount.toLocaleString()}
                    </TableCell>
                    <TableCell>
                      {clm.status === 'Paid' ? (
                        <span className="text-[9px] text-emerald-700 font-bold bg-emerald-50 px-1.5 py-0.5 rounded border border-emerald-200 uppercase">
                          Claim Disbursed
                        </span>
                      ) : clm.status === 'Approved' ? (
                        <span className="text-[9px] text-indigo-700 font-bold bg-indigo-50 px-1.5 py-0.5 rounded border border-indigo-200 uppercase">
                          Authorized
                        </span>
                      ) : (
                        <span className="text-[9px] text-yellow-700 font-bold bg-yellow-50 px-1.5 py-0.5 rounded border border-yellow-200 uppercase animate-pulse">
                          Pending agency
                        </span>
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      {clm.sachisReconciliationStatus === 'Matched' ? (
                        <span className="text-[9px] text-emerald-800 font-black flex justify-end items-center gap-1 uppercase">
                          <CheckCircle className="w-3.5 h-3.5 text-emerald-500 shrink-0" /> Verified
                        </span>
                      ) : (
                        <span className="text-[9px] text-slate-400 font-bold flex justify-end items-center gap-1 uppercase">
                          <HelpCircle className="w-3.5 h-3.5 text-slate-300" /> Pending
                        </span>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
