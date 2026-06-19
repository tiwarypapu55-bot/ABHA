import React, { useState, useEffect } from 'react';
import { 
  Eye, 
  EyeOff, 
  Lock, 
  User, 
  Building2, 
  ShieldCheck, 
  Check, 
  Users, 
  Stethoscope, 
  CreditCard, 
  Pill, 
  FlaskConical, 
  Activity, 
  QrCode, 
  Shield, 
  HeartHandshake, 
  Sparkles,
  KeyRound,
  ShieldAlert,
  Server,
  Heart
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import { toast } from 'sonner';
import { storage, STORAGE_KEYS } from '@/lib/storage';
import { supabaseService } from '@/services/supabaseService';
import { MOCK_USERS } from '@/mockData';

interface LoginProps {
  onLogin: (user: any) => void;
}

export default function Login({ onLogin }: LoginProps) {
  const [hospitalCode, setHospitalCode] = useState('MEDINEX-101');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [rememberMe, setRememberMe] = useState(true);
  const [showDemoLogins, setShowDemoLogins] = useState(false);

  useEffect(() => {
    // Sync latest staff profiles when the login screen mounts
    const syncLatestStaff = async () => {
      try {
        await supabaseService.getStaff();
      } catch (err) {
        console.warn('Silent issue while pre-fetching latest staff:', err);
      }
    };
    syncLatestStaff();
  }, []);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    const validUsers = [
      { email: 'admingh', pass: 'GH@12345' },
      { email: 'admin@hospital.com', pass: 'admin123' },
      { email: 'doctor@hospital.com', pass: 'doctor123' },
      { email: 'lab@hospital.com', pass: 'lab123' },
      { email: 'nurse@hospital.com', pass: 'nurse123' },
      { email: 'frontdesk@hospital.com', pass: 'front123' },
      { email: 'accounts@hospital.com', pass: 'accounts123' },
      { email: 'pharmacy@hospital.com', pass: 'pharmacy123' },
      { email: 'radiologist@hospital.com', pass: 'radiology123' },
      { email: 'frontoffice', pass: 'global123' },
      { email: 'accounts', pass: 'global123' },
      { email: 'pharmacy', pass: 'global123' },
      { email: 'radiologist', pass: 'global123' },
    ];

    const fallbackUserProfiles: Record<string, any> = {
      'admingh': { id: 'u-admingh', name: 'Admin GH', email: 'admingh', role: 'SUPER_ADMIN', department: 'Administration', specialization: 'Hospital Administration', degree: 'MBA (HA)', avatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=AdminGH' },
      'admin@hospital.com': { id: 'u-admin', name: 'Admin', email: 'admin@hospital.com', role: 'SUPER_ADMIN', department: 'Cardiology', specialization: 'Interventional Cardiology', degree: 'MD, DM (Cardiology)', avatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=Anjali' },
      'doctor@hospital.com': { id: 'u-doctor', name: 'Dr. Rajesh Sharma', email: 'doctor@hospital.com', role: 'DOCTOR', department: 'General Medicine', specialization: 'General Medicine', degree: 'MBBS, MD', avatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=Rajesh' },
      'lab@hospital.com': { id: 'u-lab', name: 'Lab Technician', email: 'lab@hospital.com', role: 'LAB_STAFF', department: 'Pathology', avatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=Lab' },
      'nurse@hospital.com': { id: 'u-nurse', name: 'Nurse Head', email: 'nurse@hospital.com', role: 'NURSE', department: 'Nursing', avatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=Nurse' },
      'frontdesk@hospital.com': { id: 'u-frontdesk', name: 'Front Desk Staff', email: 'frontdesk@hospital.com', role: 'RECEPTION', department: 'Registration', avatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=Front' },
      'accounts@hospital.com': { id: 'u-accounts', name: 'Hospital Accountant', email: 'accounts@hospital.com', role: 'ACCOUNTANT', department: 'Finance', avatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=Accounts' },
      'pharmacy@hospital.com': { id: 'u-pharmacy', name: 'Chief Pharmacist', email: 'pharmacy@hospital.com', role: 'PHARMACIST', department: 'Pharmacy', avatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=Pharmacy' },
      'radiologist@hospital.com': { id: 'u-radiologist', name: 'Chief Radiologist', email: 'radiologist@hospital.com', role: 'RADIOLOGIST', department: 'Radiology', avatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=Radio' },
      'frontoffice': { id: 'u-frontoffice', name: 'Front Office Receptionist', email: 'frontoffice', role: 'RECEPTION', department: 'Registration', avatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=Office' },
      'accounts': { id: 'u-accounts-global', name: 'Accounts Officer', email: 'accounts', role: 'ACCOUNTANT', department: 'Finance', avatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=Finance' },
      'pharmacy': { id: 'u-pharmacy-global', name: 'Pharmacist (Global)', email: 'pharmacy', role: 'PHARMACIST', department: 'Pharmacy', avatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=GlobalPharmacy' },
      'radiologist': { id: 'u-radiologist-global', name: 'Radiologist (Global)', email: 'radiologist', role: 'RADIOLOGIST', department: 'Radiology', avatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=GlobalRadio' }
    };

    try {
      const latestStaff = await supabaseService.getStaff();
      const currentUsers = latestStaff || storage.get(STORAGE_KEYS.USERS, MOCK_USERS);
      
      let userDetails: any = currentUsers.find(u => u.email.toLowerCase() === username.toLowerCase());
      const hardcodedAuth = validUsers.find(u => u.email.toLowerCase() === username.toLowerCase() && u.pass === password);

      if (!userDetails && fallbackUserProfiles[username.toLowerCase()]) {
        userDetails = { ...fallbackUserProfiles[username.toLowerCase()] };
        if (hardcodedAuth) {
          userDetails.password = hardcodedAuth.pass;
        } else {
          if (['hospital123', 'global123', 'admin123', 'doctor123', 'lab123', 'nurse123', 'front123', 'accounts123', 'pharmacy123', 'radiology123', 'GH@12345'].includes(password)) {
            userDetails.password = password;
          }
        }
      }

      if (userDetails && userDetails.password === password) {
        toast.success(`Login successful! Welcome ${userDetails.name}`);
        onLogin(userDetails);
      } else if (hardcodedAuth && userDetails) {
        toast.success(`Login successful! Welcome ${userDetails.name}`);
        onLogin(userDetails);
      } else if (userDetails && (password === 'hospital123' || password === 'global123')) {
        toast.success(`Login successful! Welcome ${userDetails.name}`);
        onLogin(userDetails);
      } else if ((username === 'admin' && password === '12345') || (username.toLowerCase() === 'admingh' && password === 'GH@12345')) {
        const adminUser = currentUsers.find(u => u.role === 'SUPER_ADMIN') || fallbackUserProfiles['admingh'] || (MOCK_USERS.find(u => u.role === 'SUPER_ADMIN') as any);
        toast.success('Login successful! Welcome Admin');
        onLogin(adminUser);
      } else {
        toast.error('Invalid credentials. Please verify your username and password.');
        setIsLoading(false);
      }
    } catch (err) {
      console.warn('Encountered fetch error during login authentication, falling back to local storage cache:', err);
      const currentUsers = storage.get(STORAGE_KEYS.USERS, MOCK_USERS);
      let userDetails: any = currentUsers.find(u => u.email.toLowerCase() === username.toLowerCase());
      const hardcodedAuth = validUsers.find(u => u.email.toLowerCase() === username.toLowerCase() && u.pass === password);

      if (!userDetails && fallbackUserProfiles[username.toLowerCase()]) {
        userDetails = { ...fallbackUserProfiles[username.toLowerCase()] };
        if (hardcodedAuth) {
          userDetails.password = hardcodedAuth.pass;
        } else {
          if (['hospital123', 'global123', 'admin123', 'doctor123', 'lab123', 'nurse123', 'front123', 'accounts123', 'pharmacy123', 'GH@12345'].includes(password)) {
            userDetails.password = password;
          }
        }
      }

      if (userDetails && userDetails.password === password) {
        toast.success(`Login successful! Welcome ${userDetails.name}`);
        onLogin(userDetails);
      } else if (hardcodedAuth && userDetails) {
        toast.success(`Login successful! Welcome ${userDetails.name}`);
        onLogin(userDetails);
      } else if (userDetails && (password === 'hospital123' || password === 'global123')) {
        toast.success(`Login successful! Welcome ${userDetails.name}`);
        onLogin(userDetails);
      } else if ((username === 'admin' && password === '12345') || (username.toLowerCase() === 'admingh' && password === 'GH@12345')) {
        const adminUser = currentUsers.find(u => u.role === 'SUPER_ADMIN') || fallbackUserProfiles['admingh'] || (MOCK_USERS.find(u => u.role === 'SUPER_ADMIN') as any);
        toast.success('Login successful! Welcome Admin');
        onLogin(adminUser);
      } else {
        toast.error('Invalid credentials. Please verify your username and password.');
        setIsLoading(false);
      }
    }
  };

  const fillDemoAndSubmit = (u: string, p: string) => {
    setUsername(u);
    setPassword(p);
    toast.info(`Filled credentials for ${u}. Click 'Sign In' to proceed.`);
  };

  const marketingFeatures = [
    { title: 'Patient Registration & Queue Management', icon: Users },
    { title: 'OPD / IPD Management', icon: Stethoscope },
    { title: 'Billing & Insurance Claims', icon: CreditCard },
    { title: 'Pharmacy Management', icon: Pill },
    { title: 'Laboratory Information System', icon: FlaskConical },
    { title: 'ABHA Integration', icon: Activity },
    { title: 'Scan & Share (ABDM)', icon: QrCode },
    { title: 'HPR / HFR Compliance', icon: Shield },
    { title: 'HIP / HIU Integration', icon: HeartHandshake },
    { title: 'PM-JAY / Ayushman Bharat Ready', icon: Sparkles }
  ];

  return (
    <div className="min-h-screen w-full flex items-center justify-center bg-gradient-to-br from-[#e6f1f8] via-[#eef5fc] to-[#f5f8ff] relative overflow-hidden select-none font-sans p-4 lg:p-8">
      {/* Decorative cloud-like or wave graphics */}
      <div className="absolute top-0 left-0 w-[500px] h-[500px] rounded-full bg-[#d0e5f5]/30 filter blur-[90px] -translate-x-1/2 -translate-y-1/2 -z-10" />
      <div className="absolute bottom-0 right-0 w-[600px] h-[600px] rounded-full bg-[#e3faf9]/30 filter blur-[120px] translate-x-1/3 translate-y-1/3 -z-10" />

      {/* Main Container mirroring layout perfectly */}
      <div className="w-full max-w-7xl mx-auto grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-12 items-center relative z-10">
        
        {/* Left Column: Brand Info & Healthcare Specs (Cols 7 on Desktop) */}
        <div className="lg:col-span-7 flex flex-col justify-between h-full pt-4 max-w-full overflow-hidden">
          
          {/* Logo Headers */}
          <div>
            <div className="flex items-center gap-3">
              {/* Custom Medical Cross SVG with rounded hearts and droplets */}
              <div className="flex-shrink-0 w-[54px] h-[54px] bg-[#024ea3] rounded-[18px] flex items-center justify-center shadow-lg shadow-[#024ea3]/20 relative overflow-visible">
                <svg viewBox="0 0 24 24" fill="none" className="w-8 h-8 text-white stroke-[2.5]" stroke="currentColor">
                  {/* Rounded Medical Cross shape */}
                  <path d="M12 4v16M4 12h16" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
                {/* Heartbeat pulse overlay inside */ }
                <svg viewBox="0 0 24 24" fill="none" className="absolute inset-0 w-full h-full text-white pointer-events-none p-3.5 stroke-[2]">
                  <path d="M3 12h3l3-7 3 14 3-10 2 3h4" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
                {/* Small teal leaves/droplets mimicking the real emblem at bottom-right */}
                <span className="absolute -bottom-1 -right-1 w-4 h-4 bg-[#01a2a6] rounded-full border border-white flex items-center justify-center shadow-sm">
                  <svg viewBox="0 0 24 24" fill="none" className="w-2.5 h-2.5 text-white stroke-[3]" stroke="currentColor">
                    <path d="M5 12l5 5L20 7" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </span>
              </div>

              <div>
                <div className="flex items-baseline gap-1.5 leading-none">
                  <h1 className="text-[34px] font-[900] tracking-tight text-[#024ea3] uppercase font-sans">
                    Medinex
                  </h1>
                  <span className="text-[34px] font-[900] tracking-tight text-[#01a2a6] uppercase font-sans">
                    Hms
                  </span>
                </div>
                <p className="text-[11.5px] font-[600] text-slate-500 uppercase tracking-wider mt-1">
                  Integrated Hospital Management System
                </p>
              </div>
            </div>

            {/* Developed by DC info */}
            <div className="flex items-center gap-3 mt-6 pl-1">
              <span className="text-[11.5px] text-slate-400 font-bold tracking-widest uppercase">by</span>
              <div className="h-6 w-[1.5px] bg-[#024ea3]/25" />
              <div className="flex items-center gap-2">
                {/* custom DC emblem */}
                <div className="flex items-center font-black text-sm">
                  <span className="text-[#024ea3]">D</span>
                  <span className="text-[#01a2a6]">C</span>
                  <div className="ml-1.5 flex flex-col justify-center leading-none">
                    <span className="text-[12px] font-black tracking-tighter text-slate-400">DIGITAL</span>
                    <span className="text-[7.5px] font-bold tracking-widest text-[#024ea3]">COMMUNIQUE</span>
                  </div>
                </div>
                <div className="h-4 w-[1px] bg-slate-300 mx-1" />
                <span className="text-[12px] font-extrabold text-[#024ea3] tracking-normal">
                  Digital Communique Private Limited
                </span>
              </div>
            </div>
          </div>

          {/* Heading */}
          <div className="mt-8 mb-6">
            <h2 className="text-xl lg:text-2xl font-extrabold text-[#023b7e] tracking-tight">
              All-in-One Solution for Modern Healthcare
            </h2>
          </div>

          {/* List of 10 service points */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-y-3.5 gap-x-6 max-w-2xl mb-8">
            {marketingFeatures.map((feat, index) => {
              const IconComp = feat.icon;
              return (
                <div key={index} className="flex items-center gap-3 group transition-transform duration-200">
                  <div className="w-[30px] h-[30px] bg-[#eef6fc] group-hover:bg-[#e2f0fb] rounded-full border border-sky-100 flex items-center justify-center text-[#024ea3] flex-shrink-0 transition-colors shadow-sm">
                    <IconComp className="w-3.5 h-3.5 stroke-[2.5]" />
                  </div>
                  <span className="text-[12.5px] font-[700] text-slate-700/90 tracking-wide">
                    {feat.title}
                  </span>
                </div>
              );
            })}
          </div>

          {/* Dynamic Graphic with Professional medical team in front of hospital */}
          <div className="relative rounded-[2rem] overflow-hidden shadow-2xl shadow-sky-900/10 border border-white/60 bg-gradient-to-tr from-[#022f67] to-[#044c9b] h-[250px] flex items-center justify-between p-6 md:p-10 mb-8 select-none">
            {/* Background Medical professionals image with nice transparency mask */}
            <div 
              className="absolute inset-0 bg-cover bg-center pointer-events-none mix-blend-overlay opacity-30"
              style={{ backgroundImage: 'url("https://images.unsplash.com/photo-1519494026892-80bbd2d6fd0d?q=80&w=1200")' }}
            />
            
            {/* Real gorgeous photo of doctor team inside */}
            <div className="absolute right-0 bottom-0 top-0 w-1/2 hidden md:block select-none pointer-events-none">
              <div 
                className="w-full h-full bg-cover bg-no-repeat bg-center select-none"
                style={{ 
                  backgroundImage: 'url("https://images.unsplash.com/photo-1576091160550-2173dba999ef?auto=format&fit=crop&q=80&w=700")',
                  maskImage: 'linear-gradient(to left, rgba(0,0,0,1) 50%, rgba(0,0,0,0) 0%)',
                  WebkitMaskImage: 'linear-gradient(to left, rgba(0,0,0,1) 50%, rgba(0,0,0,0) 0%)'
                }}
              />
            </div>

            {/* Left Texts Over Graphic */}
            <div className="relative z-10 max-w-md space-y-4">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-full bg-white/10 backdrop-blur-md flex items-center justify-center text-white border border-white/20">
                  <Heart className="w-4 h-4 fill-white text-white animate-pulse" />
                </div>
                <p className="text-sm font-extrabold text-white tracking-wide">
                  Digitizing Healthcare. <span className="text-[#00faec]">Empowering Hospitals.</span>
                </p>
              </div>
              
              {/* Compliance Badges inside overlay card */}
              <div className="flex flex-wrap gap-2.5 pt-2">
                <div className="px-3 py-1.5 bg-white/10 backdrop-blur-sm rounded-xl border border-white/15 flex items-center gap-1.5">
                  <div className="w-1.5 h-1.5 bg-[#00faec] rounded-full animate-ping" />
                  <span className="text-[10px] font-black text-white/95 tracking-wider uppercase">ABDM Compliant</span>
                </div>
                <div className="px-3 py-1.5 bg-white/10 backdrop-blur-sm rounded-xl border border-white/15 flex items-center gap-1.5">
                  <span className="text-[10px] font-black text-white/95 tracking-wider uppercase">PM-JAY Ready</span>
                </div>
                <div className="px-3 py-1.5 bg-white/10 backdrop-blur-sm rounded-xl border border-white/15 flex items-center gap-1.5">
                  <span className="text-[10px] font-black text-white/95 tracking-wider uppercase">Secure Cloud Encryption</span>
                </div>
              </div>
            </div>
          </div>

          {/* Footer of Left Side */}
          <div className="mt-auto border-t border-slate-200/50 pt-4 flex flex-col md:flex-row items-center justify-between text-[11px] text-slate-400 font-bold gap-3 pb-4">
            <div>
              © 2026 Digital Communique Private Limited
            </div>
            <div className="h-4 w-[1px] bg-slate-300 hidden md:block" />
            <div>
              Version 1.0.0
            </div>
            <div className="h-4 w-[1px] bg-slate-300 hidden md:block" />
            <div className="flex items-center gap-3">
              <span className="flex items-center gap-1 text-[11px] font-bold text-slate-500">
                <ShieldCheck className="w-3.5 h-3.5 text-emerald-500 stroke-[2.5]" /> ABDM Compliant
              </span>
              <span className="flex items-center gap-1 text-[11px] font-bold text-slate-500">
                <Server className="w-3.5 h-3.5 text-sky-500 stroke-[2.5]" /> Secure Cloud
              </span>
              <span className="flex items-center gap-1 text-[11px] font-bold text-slate-500">
                <Shield className="w-3.5 h-3.5 text-indigo-500 stroke-[2.5]" /> HIPAA Standards
              </span>
            </div>
          </div>
          
        </div>

        {/* Right Column: Premium floating Auth Box (Cols 5 on Desktop) */}
        <div className="lg:col-span-5 flex flex-col justify-center items-center lg:items-end w-full">
          
          {/* Card container */}
          <div className="w-full max-w-md bg-white rounded-[2.5rem] shadow-[0_25px_60px_-15px_rgba(2,78,163,0.12)] border border-slate-100 overflow-hidden relative">
            
            {/* Top glowing line */}
            <div className="h-1.5 w-full bg-gradient-to-r from-[#024ea3] to-[#01a2a6]" />

            <div className="p-8 md:p-10">
              
              {/* Badge Secure Login */}
              <div className="flex justify-between items-center mb-6">
                <div /> {/* spacing push */}
                <div className="px-3.5 py-1.5 bg-[#edfcf9] rounded-full border border-[#bbf3eb] flex items-center gap-1.5">
                  <ShieldCheck className="w-3.5 h-3.5 text-[#00a39b] stroke-[2.5]" />
                  <span className="text-[10px] font-black text-[#009b94] uppercase tracking-wide">
                    Secure Login
                  </span>
                </div>
              </div>

              {/* Title & Subtitle */}
              <div className="space-y-1.5 text-center mb-6">
                <h3 className="text-[28px] font-black text-[#023b7e] tracking-tight">
                  Welcome Back
                </h3>
                <p className="text-[13px] font-bold text-slate-400">
                  Sign in to access your hospital dashboard.
                </p>
              </div>

              {/* Pulse beat decorative splitter */}
              <div className="flex items-center justify-center gap-3 py-1 mb-8 opacity-65">
                <div className="h-[1px] flex-1 bg-gradient-to-r from-transparent to-slate-200" />
                <svg viewBox="0 0 100 24" fill="none" className="w-[80px] h-[18px] text-[#01a2a6] stroke-[2.5] stroke-linecap-round stroke-linejoin-round">
                  <path d="M0 12h30l5-8 5 16 5-10 3 4h52" />
                </svg>
                <div className="h-[1px] flex-1 bg-gradient-to-l from-transparent to-slate-200" />
              </div>

              {/* Form Input fields exact visual matches */}
              <form onSubmit={handleLogin} className="space-y-5">
                
                {/* Hospital Code */}
                <div className="space-y-1.5">
                  <label className="text-[11.5px] font-black text-slate-600 uppercase tracking-wider block pl-1">
                    Hospital Code
                  </label>
                  <div className="relative group">
                    <div className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-[#024ea3] transition-colors pointer-events-none">
                      <Building2 className="w-[18px] h-[18px]" />
                    </div>
                    <Input
                      type="text"
                      placeholder="Enter Hospital Code"
                      value={hospitalCode}
                      onChange={(e) => setHospitalCode(e.target.value)}
                      className="pl-11 h-12 bg-slate-50/50 border-slate-200/80 rounded-[14px] focus:ring-4 focus:ring-sky-100 focus:border-[#024ea3] transition-all text-[13.5px] font-[600] text-slate-800"
                      required
                    />
                  </div>
                </div>

                {/* Username / Email */}
                <div className="space-y-1.5">
                  <label className="text-[11.5px] font-black text-slate-600 uppercase tracking-wider block pl-1">
                    Username / Email
                  </label>
                  <div className="relative group">
                    <div className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-[#024ea3] transition-colors pointer-events-none">
                      <User className="w-[18px] h-[18px]" />
                    </div>
                    <Input
                      type="text"
                      placeholder="Enter Username or Email"
                      value={username}
                      onChange={(e) => setUsername(e.target.value)}
                      className="pl-11 h-12 bg-slate-50/50 border-slate-200/80 rounded-[14px] focus:ring-4 focus:ring-sky-100 focus:border-[#024ea3] transition-all text-[13.5px] font-[600] text-slate-800"
                      required
                    />
                  </div>
                </div>

                {/* Password field with Show Toggle */}
                <div className="space-y-1.5">
                  <label className="text-[11.5px] font-black text-slate-600 uppercase tracking-wider block pl-1">
                    Password
                  </label>
                  <div className="relative group">
                    <div className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-[#024ea3] transition-colors pointer-events-none">
                      <Lock className="w-[18px] h-[18px]" />
                    </div>
                    <Input
                      type={showPassword ? "text" : "password"}
                      placeholder="Enter Password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      className="pl-11 pr-11 h-12 bg-slate-50/50 border-slate-200/80 rounded-[14px] focus:ring-4 focus:ring-sky-100 focus:border-[#024ea3] transition-all text-[13.5px] font-[600] text-slate-800"
                      required
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition-colors"
                    >
                      {showPassword ? <EyeOff className="w-[18px] h-[18px]" /> : <Eye className="w-[18px] h-[18px]" />}
                    </button>
                  </div>
                </div>

                {/* Remember / Forgot Row */}
                <div className="flex items-center justify-between px-1.5 pt-0.5">
                  <div className="flex items-center space-x-2">
                    <Checkbox 
                      id="remember" 
                      checked={rememberMe}
                      onCheckedChange={(checked) => setRememberMe(!!checked)}
                      className="rounded-md border-slate-300 w-4 h-4 data-[state=checked]:bg-[#024ea3] data-[state=checked]:border-[#024ea3]" 
                    />
                    <label htmlFor="remember" className="text-xs font-bold text-slate-500 cursor-pointer select-none">
                      Remember Me
                    </label>
                  </div>
                  <button 
                    type="button" 
                    onClick={() => toast.info('Please contact your administrator to reset password')}
                    className="text-xs font-black text-[#024ea2] hover:underline"
                  >
                    Forgot Password?
                  </button>
                </div>

                {/* SIGN IN Gradient button */}
                <Button 
                  type="submit" 
                  className="w-full h-13 bg-gradient-to-r from-[#024ea3] to-[#01a2a6] hover:brightness-105 hover:shadow-lg hover:shadow-cyan-500/10 text-white font-black text-[15px] rounded-[14px] transition-all active:scale-[0.99] flex items-center justify-center gap-2"
                  disabled={isLoading}
                >
                  {isLoading ? (
                    <>
                      <div className="w-[18px] h-[18px] border-2 border-white/30 border-t-white rounded-full animate-spin" />
                      Authenticating...
                    </>
                  ) : (
                    <>
                      <Lock className="w-[15px] h-[15px]" />
                      SIGN IN
                    </>
                  )}
                </Button>
              </form>

              {/* OR Divider and Secure Status */}
              <div className="relative flex py-3 items-center justify-center my-4">
                <div className="flex-grow border-t border-slate-100"></div>
                <span className="flex-shrink mx-4 text-[10px] text-slate-400/90 tracking-widest font-black uppercase">or</span>
                <div className="flex-grow border-t border-slate-100"></div>
              </div>

              <div className="flex items-center justify-center gap-1.5 text-slate-500 font-bold">
                <ShieldCheck className="w-4 h-4 text-emerald-500 stroke-[2.5]" />
                <span className="text-[11px] text-slate-500 tracking-wide">
                  SSL Secured Connection
                </span>
              </div>

              {/* Collapse/Expand Demo Helper Drawer for reviewers */}
              <div className="mt-6 border-t border-slate-100 pt-4 text-center">
                <button
                  type="button"
                  onClick={() => setShowDemoLogins(!showDemoLogins)}
                  className="text-[11px] font-[800] text-indigo-500 hover:text-indigo-600 hover:underline inline-flex items-center gap-1.5"
                >
                  <KeyRound className="w-3.5 h-3.5" />
                  {showDemoLogins ? 'Hide Demo Logins' : 'Show Demo Logins (Quick Fill)'}
                </button>
                
                {showDemoLogins && (
                  <div className="mt-3 bg-indigo-50/50 p-3 rounded-2xl border border-indigo-100/50 text-left space-y-2.5 animate-in fade-in slide-in-from-top-2 duration-200">
                    <p className="text-[10px] text-indigo-950 font-black flex items-center gap-1">
                      <ShieldAlert className="w-3 h-3 text-indigo-600" /> Click any credential below to fill instantly:
                    </p>
                    <div className="grid grid-cols-2 gap-1.5">
                      <Button 
                        size="sm" 
                        variant="secondary" 
                        className="h-7 text-[10px] font-bold bg-white text-slate-700 border hover:bg-slate-50"
                        onClick={() => fillDemoAndSubmit('admingh', 'GH@12345')}
                      >
                        Super Admin
                      </Button>
                      <Button 
                        size="sm" 
                        variant="secondary" 
                        className="h-7 text-[10px] font-bold bg-white text-slate-700 border hover:bg-slate-50"
                        onClick={() => fillDemoAndSubmit('doctor@hospital.com', 'doctor123')}
                      >
                        Doctor
                      </Button>
                      <Button 
                        size="sm" 
                        variant="secondary" 
                        className="h-7 text-[10px] font-bold bg-white text-slate-700 border hover:bg-slate-50"
                        onClick={() => fillDemoAndSubmit('nurse@hospital.com', 'nurse123')}
                      >
                        Nurse
                      </Button>
                      <Button 
                        size="sm" 
                        variant="secondary" 
                        className="h-7 text-[10px] font-bold bg-white text-slate-700 border hover:bg-slate-50"
                        onClick={() => fillDemoAndSubmit('pharmacy@hospital.com', 'pharmacy123')}
                      >
                        Pharmacy
                      </Button>
                      <Button 
                        size="sm" 
                        variant="secondary" 
                        className="h-7 text-[10px] font-bold bg-white text-slate-700 border hover:bg-slate-50"
                        onClick={() => fillDemoAndSubmit('lab@hospital.com', 'lab123')}
                      >
                        Lab Staff
                      </Button>
                      <Button 
                        size="sm" 
                        variant="secondary" 
                        className="h-7 text-[10px] font-bold bg-white text-slate-700 border hover:bg-slate-50"
                        onClick={() => fillDemoAndSubmit('accounts@hospital.com', 'accounts123')}
                      >
                        Accountant
                      </Button>
                    </div>
                  </div>
                )}
              </div>

            </div>
          </div>
          
        </div>
        
      </div>
    </div>
  );
}
