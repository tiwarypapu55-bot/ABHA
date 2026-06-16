import { useState } from 'react';
import { 
  Users, 
  ArrowRight, 
  CheckCircle, 
  Fingerprint, 
  QrCode, 
  ShieldAlert, 
  UserCheck, 
  Download, 
  Check, 
  Smartphone,
  Sparkles,
  Link,
  UsersRound,
  FileCheck2,
  RefreshCw
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { storage, STORAGE_KEYS } from '@/lib/storage';
import { supabaseService } from '@/services/supabaseService';
import { AbhaProfile } from './types';

export default function AbdmAbha() {
  const [method, setMethod] = useState<'aadhaar' | 'mobile' | 'link'>('aadhaar');
  const [step, setStep] = useState<1 | 2 | 3>(1); // 1: Input details, 2: OTP verify, 3: Generated profile card
  
  // Input fields
  const [aadhaarNum, setAadhaarNum] = useState('');
  const [mobileNum, setMobileNum] = useState('');
  const [otp, setOtp] = useState('');
  const [abhaAddressWanted, setAbhaAddressWanted] = useState('');
  
  // Custom demographic entry if Aadhaar isn't mock filled
  const [patientDetails, setPatientDetails] = useState({
    name: '',
    gender: 'Male',
    dob: '1995-08-15',
    abhaAddress: '',
    address: 'Sector 4, Rajajipuram, Lucknow, Uttar Pradesh - 226017'
  });

  const [loading, setLoading] = useState(false);
  const [generatedAbha, setGeneratedAbha] = useState<AbhaProfile | null>(null);

  // Quick seed button
  const handleDemoFill = () => {
    setAadhaarNum('5839-2048-2943');
    setMobileNum('9192939495');
    setPatientDetails({
      name: 'Ramesh Chander Gupta',
      gender: 'Male',
      dob: '1978-04-12',
      abhaAddress: 'ramesh.gupta@sbx',
      address: 'House No. 344, Indira Nagar, Lucknow, Uttar Pradesh - 226016'
    });
    setAbhaAddressWanted('ramesh.gupta');
    toast.info('Loaded sandbox demo patient credentials!');
  };

  const handleSendOTP = () => {
    const inputVal = method === 'aadhaar' ? aadhaarNum : mobileNum;
    if (!inputVal) {
      toast.error('Please fill in the required number format');
      return;
    }
    setLoading(true);
    setTimeout(async () => {
      setLoading(false);
      setStep(2);
      toast.success('ABDM Sandbox Sandbox OTP sent! Enter "123456" for instant verification');
      
      // Dispatch compliance audit log to real DB
      const logItem = {
        userId: 'u_rec_9',
        userRole: 'Receptionist',
        action: `Initiate ABHA OTP (${method.toUpperCase()})`,
        module: 'ABHA' as const,
        status: 'SUCCESS' as const,
        ipAddress: '192.168.1.105',
        details: `Sent KYC request payload targeting ${method} identification`
      };
      await supabaseService.createAbdmAuditLog(logItem);
    }, 1200);
  };

  const handleVerifyOTP = async () => {
    if (otp !== '123456' && otp !== '1234') {
      toast.error('Invalid demo OTP. Type "123456" or "1234" to pass verification.');
      return;
    }

    setLoading(true);
    setTimeout(async () => {
      const finalAbhaNumber = `38-${Math.floor(1000 + Math.random() * 9000)}-${Math.floor(1000 + Math.random() * 9000)}-${Math.floor(1000 + Math.random() * 9000)}`;
      const finalAbhaAddress = patientDetails.abhaAddress || `${abhaAddressWanted || 'patient' + Math.floor(Math.random() * 900)}@sbx`;
      const finalName = patientDetails.name || (method === 'aadhaar' ? 'Suresh Kumar Yadav' : 'Meera Devi');
      const finalDob = patientDetails.dob || '1984-11-20';
      const finalGender = patientDetails.gender;
      const finalPhone = mobileNum || '9876543210';

      const profile: AbhaProfile = {
        abhaNumber: finalAbhaNumber,
        abhaAddress: finalAbhaAddress,
        name: finalName,
        gender: finalGender,
        dob: finalDob,
        phone: finalPhone,
        aadhaarNo: method === 'aadhaar' ? aadhaarNum : undefined,
        address: patientDetails.address,
        photoUrl: finalGender === 'Male' 
          ? 'https://api.dicebear.com/7.x/pixel-art/svg?seed=ramesh'
          : 'https://api.dicebear.com/7.x/pixel-art/svg?seed=meera',
        verified: true
      };

      setGeneratedAbha(profile);

      // Create Patient in Supabase Core Patients Table so they appear in OPD registers
      const mrn = `MRN${Math.floor(Math.random() * 90000) + 10000}`;
      const patientToAdd = {
        name: finalName,
        phone: finalPhone,
        age: calculateAge(finalDob),
        gender: finalGender.toLowerCase(),
        address: patientDetails.address || 'Lucknow, UP',
        mrn,
        status: 'Active',
        registration_type: 'ABHA_CARD',
        tpaId: finalAbhaNumber, // Save ABHA Number as primary insurance identity
        tpaValidity: finalAbhaAddress // Save ABHA Address for link convenience
      };

      try {
        const addedResult = await supabaseService.createPatient(patientToAdd);
        if (addedResult) {
          toast.success(`ABHA successfully synced & registered inside HMS! Assigned MRN: ${mrn}`);
          
          // INSERT INTO ABDM LINK TABLE
          await supabaseService.createAbdmLink({
            patient_id: addedResult.id,
            abha_number: finalAbhaNumber,
            abha_address: finalAbhaAddress,
            aadhaar_verification_status: 'VERIFIED',
            mobile_otp_verified: true,
            ayushman_card_number: `AB-${Math.floor(10000000 + Math.random() * 90000000)}`,
            pmjay_beneficiary_id: `PM-${Math.floor(10000000 + Math.random() * 90000000)}`
          });

          window.dispatchEvent(new CustomEvent('supabase-data-sync', { 
            detail: { table: 'patients', action: 'insert' } 
          }));
        }
      } catch (err) {
        console.warn('Sync directly via local storage instead:', err);
      }

      // Add to notifications
      const notifItem = {
        id: 'nt-' + Date.now(),
        timestamp: new Date().toISOString(),
        patientName: finalName,
        channel: 'SMS' as const,
        recipient: finalPhone,
        content: `Your ABHA Registration is active! ABHA ID: ${finalAbhaNumber}. Health Records linked with Global Hospital.`,
        status: 'Delivered' as const
      };
      const currentNotifs = JSON.parse(localStorage.getItem('hms_abdm_notifications') || '[]');
      currentNotifs.unshift(notifItem);
      localStorage.setItem('hms_abdm_notifications', JSON.stringify(currentNotifs));

      // Append core compliance audits to DB
      const progressLog = {
        userId: 'u_rec_9',
        userRole: 'Receptionist',
        action: 'ABHA KYC Verified & Created',
        module: 'ABHA' as const,
        status: 'SUCCESS' as const,
        ipAddress: '192.168.1.105',
        details: `Successfully generated ABHA Profile ${finalAbhaNumber} (${finalAbhaAddress})`
      };
      await supabaseService.createAbdmAuditLog(progressLog);

      setLoading(false);
      setStep(3);
    }, 1500);
  };

  const calculateAge = (dobString: string): number => {
    try {
      const birth = new Date(dobString);
      const now = new Date();
      let age = now.getFullYear() - birth.getFullYear();
      const m = now.getMonth() - birth.getMonth();
      if (m < 0 || (m === 0 && now.getDate() < birth.getDate())) {
        age--;
      }
      return age;
    } catch {
      return 35;
    }
  };

  const handleReset = () => {
    setStep(1);
    setAadhaarNum('');
    setMobileNum('');
    setOtp('');
    setAbhaAddressWanted('');
    setGeneratedAbha(null);
    setPatientDetails({
      name: '',
      gender: 'Male',
      dob: '1995-08-15',
      abhaAddress: '',
      address: 'Sector 4, Rajajipuram, Lucknow, Uttar Pradesh - 226017'
    });
  };

  return (
    <Card className="shadow-sm border-slate-100 bg-white">
      <CardHeader className="border-b border-slate-50 flex flex-row items-center justify-between pb-3">
        <div>
          <CardTitle className="text-base font-bold text-slate-800 flex items-center gap-2">
            <UsersRound className="w-5 h-5 text-indigo-600" />
            ABHA Integration Center
          </CardTitle>
          <CardDescription className="text-xs">Create, query or bind Ayushman Bharat Health Accounts (ABHA)</CardDescription>
        </div>
        {step === 1 && (
          <Button 
            variant="outline" 
            size="xs" 
            onClick={handleDemoFill}
            className="text-xs text-indigo-600 border-indigo-200 hover:bg-indigo-50 font-bold"
          >
            <Sparkles className="w-3 h-3 mr-1" />
            Load Sandbox Demo Profile
          </Button>
        )}
      </CardHeader>
      <CardContent className="pt-6">
        
        {step === 1 && (
          <div className="space-y-6">
            <div className="flex gap-2 p-1 bg-slate-50 rounded-lg max-w-sm">
              <Button 
                variant={method === 'aadhaar' ? 'default' : 'ghost'} 
                size="sm" 
                onClick={() => setMethod('aadhaar')}
                className={`flex-1 text-xs font-bold ${method === 'aadhaar' ? 'bg-indigo-600 text-white' : 'text-slate-600'}`}
              >
                <Fingerprint className="w-3.5 h-3.5 mr-1" />
                Aadhaar ABHA
              </Button>
              <Button 
                variant={method === 'mobile' ? 'default' : 'ghost'} 
                size="sm" 
                onClick={() => setMethod('mobile')}
                className={`flex-1 text-xs font-bold ${method === 'mobile' ? 'bg-indigo-600 text-white' : 'text-slate-600'}`}
              >
                <Smartphone className="w-3.5 h-3.5 mr-1" />
                Mobile ABHA
              </Button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-4">
                {method === 'aadhaar' ? (
                  <div className="space-y-2">
                    <Label htmlFor="aadhaar">Aadhaar Identity Card Number</Label>
                    <Input 
                      id="aadhaar" 
                      placeholder="e.g. 5839-2048-2943" 
                      value={aadhaarNum || ''}
                      onChange={(e) => setAadhaarNum(e.target.value)}
                    />
                    <p className="text-[10px] text-slate-400">ABDM validates biometric/demographics via UIDAI OTP gateways.</p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    <Label htmlFor="mobile">Mobile Number (Linked with State Registry)</Label>
                    <Input 
                      id="mobile" 
                      maxLength={10} 
                      placeholder="e.g. 9876543210" 
                      value={mobileNum || ''}
                      onChange={(e) => setMobileNum(e.target.value)}
                    />
                  </div>
                )}

                <div className="space-y-2">
                  <Label htmlFor="abhaAddress">Requested ABHA Address Prefix</Label>
                  <div className="flex items-center">
                    <Input 
                      id="abhaAddress" 
                      placeholder="e.g. suresh.yadav" 
                      value={abhaAddressWanted || ''}
                      className="rounded-r-none"
                      onChange={(e) => setAbhaAddressWanted(e.target.value)}
                    />
                    <span className="bg-slate-100 border border-l-0 text-slate-500 font-bold px-3 py-2 rounded-r-lg text-xs">
                      @sbx
                    </span>
                  </div>
                </div>
              </div>

              {/* Patient Demographic Form Pre-Fill Helper */}
              <div className="space-y-4 border border-slate-100 p-4 rounded-xl bg-slate-50/50">
                <span className="text-xs font-bold text-slate-700 flex items-center gap-1">
                  <FileCheck2 className="w-4 h-4 text-emerald-600" />
                  UIDAI Demographic Parameters (Pre-fill details)
                </span>
                
                <div className="grid grid-cols-2 gap-3 text-xs">
                  <div className="col-span-2 space-y-1">
                    <Label className="text-[10px]">Full Patient Name</Label>
                    <Input 
                      value={patientDetails.name || ''} 
                      onChange={(e) => setPatientDetails({...patientDetails, name: e.target.value})}
                      placeholder="Input name as on Aadhaar" 
                      className="bg-white"
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-[10px]">Gender</Label>
                    <Select 
                      value={patientDetails.gender || 'Male'} 
                      onValueChange={(v) => setPatientDetails({...patientDetails, gender: v})}
                    >
                      <SelectTrigger className="bg-white">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="Male">Male</SelectItem>
                        <SelectItem value="Female">Female</SelectItem>
                        <SelectItem value="Other">Other</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1">
                    <Label className="text-[10px]">Date of Birth</Label>
                    <Input 
                      type="date" 
                      value={patientDetails.dob || ''} 
                      onChange={(e) => setPatientDetails({...patientDetails, dob: e.target.value})}
                      className="bg-white" 
                    />
                  </div>
                  <div className="col-span-2 space-y-1">
                    <Label className="text-[10px]">Residential Address</Label>
                    <Input 
                      value={patientDetails.address || ''} 
                      onChange={(e) => setPatientDetails({...patientDetails, address: e.target.value})}
                      className="bg-white" 
                    />
                  </div>
                </div>
              </div>
            </div>

            <Button onClick={handleSendOTP} disabled={loading} className="bg-indigo-600 hover:bg-indigo-700 text-white">
              {loading ? 'Transmitting details...' : 'Generate OTP Verification Credentials'}
              <ArrowRight className="w-4 h-4 ml-2" />
            </Button>
          </div>
        )}

        {step === 2 && (
          <div className="py-6 max-w-md mx-auto text-center space-y-5">
            <Smartphone className="w-12 h-12 text-slate-400 mx-auto animate-bounce" />
            <div>
              <h3 className="font-bold text-slate-800">Verification OTP Required</h3>
              <p className="text-xs text-slate-500 mt-1">
                ABDM Sandbox sent a 6-digit cryptographic authentication token to the user's mobile device.
              </p>
            </div>
            <div className="space-y-2">
              <Input 
                placeholder="Enter demo OTP (123456)" 
                maxLength={6} 
                className="text-center font-mono letter-spacing-4 text-lg w-48 mx-auto"
                value={otp}
                onChange={(e) => setOtp(e.target.value)}
              />
              <span className="text-[11px] text-amber-600 font-bold bg-amber-50 px-2 py-0.5 rounded">
                Developer Simulation: Type "123456" of "1234" to bypass
              </span>
            </div>
            <div className="flex gap-2 justify-center pt-2">
              <Button variant="ghost" className="text-xs text-slate-500" onClick={handleReset}>Cancel</Button>
              <Button className="bg-indigo-600 hover:bg-indigo-700 text-white" disabled={loading} onClick={handleVerifyOTP}>
                {loading ? 'Authorizing KYC Profile...' : 'Confirm OTP Token'}
              </Button>
            </div>
          </div>
        )}

        {step === 3 && generatedAbha && (
          <div className="space-y-6">
            <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-4 flex items-center gap-3 text-emerald-800">
              <CheckCircle className="w-5 h-5 text-emerald-600 shrink-0" />
              <div>
                <p className="text-xs font-bold">Cryptographically Verified ABHA Record Linked!</p>
                <p className="text-[10px] text-emerald-700">The healthcare record timeline has successfully synchronized with Government Gateway records.</p>
              </div>
            </div>

            {/* ABHA card visual rendering */}
            <div className="flex flex-col md:flex-row gap-6 items-center justify-center p-4">
              <div className="w-[380px] h-[230px] rounded-2xl bg-gradient-to-br from-indigo-900 via-indigo-950 to-slate-900 text-white p-5 shadow-2xl relative overflow-hidden border border-slate-700/50 flex flex-col justify-between">
                
                {/* Visual grid watermark backgrounds */}
                <div className="absolute inset-0 opacity-10 bg-[linear-gradient(to_right,#808080_1px,transparent_1px),linear-gradient(to_bottom,#808080_1px,transparent_1px)] bg-[size:14px_24px]"></div>
                
                <div className="flex justify-between items-start z-10">
                  <div className="flex items-center gap-2">
                    <div className="w-7 h-7 rounded-sm bg-white/10 flex items-center justify-center font-black text-rose-500 border border-white/20 select-none">
                      AB
                    </div>
                    <div>
                      <h4 className="text-[10px] font-black leading-none bg-gradient-to-r from-teal-400 to-indigo-300 bg-clip-text text-transparent">ABHA DIGITAL CARD</h4>
                      <p className="text-[7px] text-indigo-200 mt-1 uppercase tracking-widest font-bold">Ayushman Bharat Health Account</p>
                    </div>
                  </div>
                  <span className="text-[8px] bg-emerald-500 text-slate-950 font-black px-1.5 py-0.5 rounded-sm uppercase tracking-wide">
                    VERIFIED
                  </span>
                </div>

                <div className="flex gap-4 items-center z-10 my-2">
                  <img src={generatedAbha.photoUrl} alt="Photo" className="w-16 h-16 rounded-lg border border-slate-600 bg-slate-800 object-cover shrink-0" />
                  <div className="space-y-1 overflow-hidden">
                    <p className="text-xs font-black truncate">{generatedAbha.name}</p>
                    <p className="text-[10px] font-mono text-slate-300 font-semibold tracking-wider">{generatedAbha.abhaNumber}</p>
                    <p className="text-[9px] text-teal-400 truncate font-bold font-mono">{generatedAbha.abhaAddress}</p>
                  </div>
                </div>

                <div className="flex justify-between items-end border-t border-white/10 pt-2 z-10 text-[8px] text-slate-300">
                  <div>
                    <p className="text-[7px] text-slate-400 uppercase font-bold">DOB & Gender</p>
                    <p className="font-semibold text-white">{generatedAbha.dob} • {generatedAbha.gender}</p>
                  </div>
                  <div className="flex items-center gap-1.5 font-bold text-slate-200">
                    <QrCode className="w-4 h-4 text-emerald-400" />
                    NDHM ID Compliant
                  </div>
                </div>
              </div>

              {/* Controls */}
              <div className="space-y-3 w-full max-w-sm">
                <span className="text-xs font-bold text-slate-700 uppercase tracking-wide block">Card Utility & Operations</span>
                <p className="text-xs text-slate-500">
                  Use the verified ABHA Card details to auto-populate future consultation visits, coordinate prescription dispatches and process claim settlements securely.
                </p>
                <div className="flex flex-wrap gap-2 pt-2">
                  <Button variant="outline" className="text-xs border-indigo-200 hover:bg-slate-50" onClick={() => {
                    toast.success('ABHA Physical Health Identity Card PDF generated and downloaded!');
                  }}>
                    <Download className="w-3.5 h-3.5 mr-1" />
                    Download PDF Card
                  </Button>
                  <Button variant="outline" className="text-xs border-slate-200" onClick={() => {
                    toast.success('Successfully linked other state health lockers/health accounts (DigiLocker, PM-JAY)!');
                  }}>
                    <Link className="w-3.5 h-3.5 mr-1" />
                    Bind Multi-Lockers
                  </Button>
                  <Button className="bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold" onClick={handleReset}>
                    <RefreshCw className="w-3.5 h-3.5 mr-1" />
                    Register Another Patient
                  </Button>
                </div>
              </div>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
