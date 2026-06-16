import { useState, useEffect } from 'react';
import { 
  Building2, 
  Users, 
  QrCode, 
  ShieldCheck, 
  Award, 
  BellRing, 
  HeartPulse, 
  ChevronRight, 
  CheckCircle,
  Clock,
  Terminal,
  Activity
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';

// Import our modular subcomponents
import AbdmDashboard from './abdm/AbdmDashboard';
import AbdmAbha from './abdm/AbdmAbha';
import AbdmScanShare from './abdm/AbdmScanShare';
import AbdmConsentHIP from './abdm/AbdmConsentHIP';
import AbdmRegistryPmjay from './abdm/AbdmRegistryPmjay';
import { NotificationLog } from './abdm/types';

const PRELOADED_NOTIFS: NotificationLog[] = [
  {
    id: 'nt-1',
    timestamp: new Date().toISOString(),
    patientName: 'Karan Manoj Rawat',
    channel: 'WhatsApp',
    recipient: '8229304910',
    content: 'Namaste, you have scanned successfully at Global Hospital! Token Issued: SSD-040. Wait time approximate: 10 mins.',
    status: 'Delivered'
  },
  {
    id: 'nt-2',
    timestamp: new Date(Date.now() - 3600000).toISOString(),
    patientName: 'Ramesh Chander Gupta',
    channel: 'SMS',
    recipient: '9192939495',
    content: 'Your ABHA Registration is active! ABHA ID: 38-3920-4491-1029. Health Records linked with Global Hospital care teams.',
    status: 'Delivered'
  },
  {
    id: 'nt-3',
    timestamp: new Date(Date.now() - 7200000).toISOString(),
    patientName: 'Sandeep Kumar Saxena',
    channel: 'Email',
    recipient: 'sandeep.saxena@email.com',
    content: 'PM-JAY pre-authorization PA-UP-772901-P approved! Amount ₹18,500 allocated for Maternity Normal Delivery package.',
    status: 'Delivered'
  }
];

export default function AbdmSuite() {
  const [activeTab, setActiveTab] = useState('dashboard');
  const [notifications, setNotifications] = useState<NotificationLog[]>([]);

  const loadNotifications = () => {
    const saved = localStorage.getItem('hms_abdm_notifications');
    if (saved) {
      setNotifications(JSON.parse(saved));
    } else {
      localStorage.setItem('hms_abdm_notifications', JSON.stringify(PRELOADED_NOTIFS));
      setNotifications(PRELOADED_NOTIFS);
    }
  };

  useEffect(() => {
    loadNotifications();

    const handleSync = () => {
      loadNotifications();
    };

    window.addEventListener('storage', handleSync);
    window.addEventListener('hms-abdm-sync', handleSync);
    window.addEventListener('supabase-data-sync', handleSync);

    return () => {
      window.removeEventListener('storage', handleSync);
      window.removeEventListener('hms-abdm-sync', handleSync);
      window.removeEventListener('supabase-data-sync', handleSync);
    };
  }, []);

  const getChannelBadge = (channel: string) => {
    switch (channel) {
      case 'WhatsApp':
        return <Badge className="bg-emerald-50 text-emerald-700 border-emerald-150 text-[10px] uppercase font-bold">WhatsApp</Badge>;
      case 'SMS':
        return <Badge className="bg-blue-50 text-blue-700 border-blue-150 text-[10px] uppercase font-bold">SMS</Badge>;
      default:
        return <Badge className="bg-indigo-50 text-indigo-700 border-indigo-150 text-[10px] uppercase font-bold">Email</Badge>;
    }
  };

  return (
    <div className="p-6 md:p-8 space-y-6 max-w-7xl mx-auto">
      
      {/* Dynamic Upper Banner with Sandbox indicators */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-gradient-to-r from-indigo-900 to-slate-900 rounded-3xl p-6 text-white shadow-xl relative overflow-hidden border border-slate-800">
        <div className="absolute top-0 right-0 w-80 h-80 bg-indigo-500/10 rounded-full blur-3xl -mr-20 -mt-20"></div>
        <div className="absolute bottom-0 left-0 w-60 h-60 bg-emerald-500/5 rounded-full blur-2xl -ml-20 -mb-20"></div>

        <div className="space-y-1.5 z-10">
          <div className="flex items-center gap-2">
            <span className="text-[10px] bg-emerald-500 text-slate-950 font-black px-2 py-0.5 rounded-full uppercase tracking-wider">
              ABDM Certified v2.0
            </span>
            <span className="text-[10px] bg-white/10 text-slate-200 font-extrabold px-2 py-0.5 rounded-full uppercase border border-white/10">
              PM-JAY Empanelled
            </span>
          </div>
          <h2 className="text-xl md:text-2xl font-black tracking-tight flex items-center gap-2.5">
            <HeartPulse className="w-6.5 h-6.5 text-rose-500" />
            ABDM & PM-JAY Integrated Health Information Suite
          </h2>
          <p className="text-xs text-indigo-200 max-w-xl font-medium">
            National Health Authority (NHA) Sandbox and Uttar Pradesh State Health Agency (SACHIS) verified environment.
          </p>
        </div>

        <div className="bg-white/5 border border-white/10 p-4 rounded-2xl flex items-center gap-3.5 z-10 min-w-[210px]">
          <span className="w-2.5 h-2.5 bg-emerald-400 rounded-full animate-ping"></span>
          <div className="text-xs">
            <p className="text-slate-300 font-bold uppercase tracking-wider text-[8px]">ABDM Gateway Connection</p>
            <p className="font-extrabold text-white mt-0.5">SANDBOX ONLINE</p>
            <p className="text-[9px] text-teal-400 font-mono mt-0.5">Global Hospital: @GH_UP_10</p>
          </div>
        </div>
      </div>

      {/* Primary Tab Workspace Drawer */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
        
        {/* Customized horizontal tabs headers bar */}
        <div className="bg-slate-100 p-1.5 rounded-2xl border flex items-center justify-between overflow-x-auto custom-scrollbar">
          <TabsList className="bg-transparent space-x-1 border-0 flex">
            <TabsTrigger value="dashboard" className="text-xs font-bold leading-none px-4 py-2.5 rounded-xl border-0">
              <Activity className="w-4 h-4 mr-1.5" />
              Metrics & Telemetry
            </TabsTrigger>
            <TabsTrigger value="abha" className="text-xs font-bold leading-none px-4 py-2.5 rounded-xl border-0">
              <Users className="w-4 h-4 mr-1.5" />
              ABHA Identity Center
            </TabsTrigger>
            <TabsTrigger value="scanshare" className="text-xs font-bold leading-none px-4 py-2.5 rounded-xl border-0">
              <QrCode className="w-4 h-4 mr-1.5" />
              Scan & Share OPD
            </TabsTrigger>
            <TabsTrigger value="consent" className="text-xs font-bold leading-none px-4 py-2.5 rounded-xl border-0">
              <ShieldCheck className="w-4 h-4 mr-1.5" />
              Consent Explorer
            </TabsTrigger>
            <TabsTrigger value="pmjay" className="text-xs font-bold leading-none px-4 py-2.5 rounded-xl border-0">
              <Award className="w-4 h-4 mr-1.5" />
              PM-JAY & Registries
            </TabsTrigger>
            <TabsTrigger value="notifications" className="text-xs font-bold leading-none px-4 py-2.5 rounded-xl border-0">
              <BellRing className="w-4 h-4 mr-1.5" />
              Notifications
            </TabsTrigger>
          </TabsList>
        </div>

        {/* Tab Contents Mounting */}
        <TabsContent value="dashboard" className="mt-0 focus-visible:outline-none">
          <AbdmDashboard />
        </TabsContent>

        <TabsContent value="abha" className="mt-0 focus-visible:outline-none">
          <AbdmAbha />
        </TabsContent>

        <TabsContent value="scanshare" className="mt-0 focus-visible:outline-none">
          <AbdmScanShare />
        </TabsContent>

        <TabsContent value="consent" className="mt-0 focus-visible:outline-none">
          <AbdmConsentHIP />
        </TabsContent>

        <TabsContent value="pmjay" className="mt-0 focus-visible:outline-none">
          <AbdmRegistryPmjay />
        </TabsContent>

        {/* Unified Notifications engine tracking log */}
        <TabsContent value="notifications" className="mt-0 focus-visible:outline-none">
          <Card className="shadow-sm border-slate-100 bg-white">
            <CardHeader className="pb-3 border-b border-slate-50">
              <CardTitle className="text-sm font-bold text-slate-800 flex items-center gap-2">
                <BellRing className="w-5 h-5 text-indigo-600" />
                Notification Transmission Log Engine
              </CardTitle>
              <CardDescription className="text-xs">
                Review and audit automated confirmation notifications dispatched to patients regarding ABHA setups, QR listings, prescriptions, and claim approvals.
              </CardDescription>
            </CardHeader>
            <CardContent className="p-0">
              <Table>
                <TableHeader className="bg-slate-50/70">
                  <TableRow>
                    <TableHead className="text-[10px] font-bold text-slate-400 py-2">Timestamp</TableHead>
                    <TableHead className="text-[10px] font-bold text-slate-400 py-2">Patient</TableHead>
                    <TableHead className="text-[10px] font-bold text-slate-400 py-2">Channel</TableHead>
                    <TableHead className="text-[10px] font-bold text-slate-400 py-2">Recipient address/number</TableHead>
                    <TableHead className="text-[10px] font-bold text-slate-400 py-2">Message content payload</TableHead>
                    <TableHead className="text-[10px] font-bold text-slate-400 py-2 text-right">Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {notifications.map((notif) => (
                    <TableRow key={notif.id} className="hover:bg-slate-50/50 text-xs">
                      <TableCell className="font-mono text-slate-400 text-[10px]">
                        {new Date(notif.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                      </TableCell>
                      <TableCell className="font-bold text-slate-700">{notif.patientName}</TableCell>
                      <TableCell>{getChannelBadge(notif.channel)}</TableCell>
                      <TableCell className="font-mono text-[10.5px] text-slate-500">{notif.recipient}</TableCell>
                      <TableCell className="font-medium text-slate-600 max-w-md truncate">{notif.content}</TableCell>
                      <TableCell className="text-right">
                        <span className="text-[10px] text-emerald-700 font-extrabold bg-emerald-50 px-2 py-0.5 rounded-full uppercase flex items-center gap-1 justify-end w-fit ml-auto">
                          <CheckCircle className="w-3.5 h-3.5 text-emerald-500" /> Delivered
                        </span>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

      </Tabs>
      
    </div>
  );
}
