import { 
  Users, 
  Calendar as CalendarIcon, 
  Activity, 
  TrendingUp, 
  Clock, 
  AlertCircle,
  ArrowUpRight,
  ArrowDownRight,
  Baby,
  FlaskConical,
  Pill,
  CreditCard,
  Filter,
  BarChart3,
  Calendar,
  Search,
  CheckCircle2,
  Ticket,
  PlusCircle,
  HelpCircle,
  ShieldCheck
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer,
  Cell
} from 'recharts';

import { Link } from 'react-router-dom';
import { MOCK_PRESCRIPTIONS, MOCK_PATIENTS, MOCK_USERS, MOCK_BILLING, MOCK_PHARMACY_BILLING, MOCK_APPOINTMENTS } from '@/mockData';
import { FileText, Download, Eye, TrendingDown, QrCode, Sparkles, HeartHandshake } from 'lucide-react';
import { useState, useMemo, useEffect } from 'react';
import AppointmentCalendar from '@/components/AppointmentCalendar';
import { supabaseService } from '@/services/supabaseService';
import { useDataSync } from '@/hooks/useDataSync';
import { Loader2 } from 'lucide-react';
import { formatCurrency } from '@/lib/utils';
import { storage, STORAGE_KEYS } from '@/lib/storage';
import { toast } from 'sonner';
import { Label } from '@/components/ui/label';
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle, 
  DialogFooter 
} from '@/components/ui/dialog';
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { 
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export default function Dashboard() {
  const [isPreviewOpen, setIsPreviewOpen] = useState(false);
  const [previewData, setPreviewData] = useState<{url: string, name: string} | null>(null);
  const [timeFrame, setTimeFrame] = useState('month');
  const [dateRange, setDateRange] = useState({ start: '', end: '' });

  const [isLoading, setIsLoading] = useState(true);
  const [patients, setPatients] = useState<any[]>([]);
  const [invoices, setInvoices] = useState<any[]>([]);
  const [expenses, setExpenses] = useState<any[]>([]);
  const [dbStats, setDbStats] = useState<any>(null);
  const [appointments, setAppointments] = useState<any[]>([]);
  const [users, setUsers] = useState<any[]>(() => storage.get(STORAGE_KEYS.USERS, MOCK_USERS));

  // Walk-in Quick Appointment States
  const [newApptPatientId, setNewApptPatientId] = useState('');
  const [newApptDoctor, setNewApptDoctor] = useState('');
  const [newApptDate, setNewApptDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [newApptTime, setNewApptTime] = useState('10:00 AM');
  const [newApptUrgency, setNewApptUrgency] = useState('Routine');

  const fetchData = async () => {
    setIsLoading(true);
    const [patientsData, invoicesData, statsData, expensesData, appointmentsData] = await Promise.all([
      supabaseService.getPatients(),
      supabaseService.getInvoices(),
      supabaseService.getDashboardStats(),
      supabaseService.getExpenses(),
      supabaseService.getAppointments()
    ]);

    if (patientsData) setPatients(patientsData);
    if (invoicesData) setInvoices(invoicesData);
    if (statsData) setDbStats(statsData);
    if (expensesData) setExpenses(expensesData);
    if (appointmentsData) setAppointments(appointmentsData);
    setIsLoading(false);
  };

  useDataSync(fetchData);

  const handleQuickBook = async () => {
    if (!newApptPatientId || !newApptDoctor) {
      toast.error('Please select both patient and specialized doctor');
      return;
    }
    const selectedPat = patients.find(p => p.id === newApptPatientId);
    
    const synced = await supabaseService.createAppointment({
      patient_id: newApptPatientId,
      doctor_id: null,
      type: 'OPD',
      appointment_date: newApptDate,
      appointment_time: newApptTime,
      status: 'Scheduled',
      urgency: newApptUrgency
    });

    if (synced) {
      const liveApt = {
        ...synced,
        patientId: synced.patient_id,
        patientName: selectedPat?.name || 'Unknown',
        patientMrn: selectedPat?.mrn || 'N/A',
        appointment_date: synced.appointment_date,
        appointment_time: synced.appointment_time,
      };
      const updated = [liveApt, ...appointments];
      setAppointments(updated);
      storage.set(STORAGE_KEYS.APPOINTMENTS, updated);
      toast.success(`Walk-In Appointment Booked successfully! Token generated.`);
      setNewApptPatientId('');
      setNewApptDoctor('');
    } else {
      const fallbackApt = {
        id: 'apt-' + Date.now(),
        patient_id: newApptPatientId,
        patientId: newApptPatientId,
        patientName: selectedPat?.name || 'Unknown',
        patientMrn: selectedPat?.mrn || 'N/A',
        appointment_date: newApptDate,
        appointment_time: newApptTime,
        status: 'Scheduled',
        urgency: newApptUrgency
      };
      const updated = [fallbackApt, ...appointments];
      setAppointments(updated);
      storage.set(STORAGE_KEYS.APPOINTMENTS, updated);
      toast.success(`Walk-In Appointment Booked successfully! Token generated (Offline Mode).`);
      setNewApptPatientId('');
      setNewApptDoctor('');
    }
    window.dispatchEvent(new Event('storage'));
  };

  // Filter Logic
  const filteredBilling = useMemo(() => {
    const now = new Date(); 
    
    return invoices.filter(bill => {
      const billDate = new Date(bill.created_at);
      
      if (timeFrame === 'today') {
        const today = new Date();
        return billDate.getDate() === today.getDate() && 
               billDate.getMonth() === today.getMonth() && 
               billDate.getFullYear() === today.getFullYear();
      }
      
      if (timeFrame === 'month') {
        return billDate.getMonth() === now.getMonth() && billDate.getFullYear() === now.getFullYear();
      }
      
      if (timeFrame === 'quarter') {
        const currentQuarter = Math.floor(now.getMonth() / 3);
        const billQuarter = Math.floor(billDate.getMonth() / 3);
        return currentQuarter === billQuarter && billDate.getFullYear() === now.getFullYear();
      }
      
      if (timeFrame === 'year') {
        return billDate.getFullYear() === now.getFullYear();
      }

      if (timeFrame === 'custom' && dateRange.start && dateRange.end) {
        const start = new Date(dateRange.start);
        const end = new Date(dateRange.end);
        return billDate >= start && billDate <= end;
      }
      
      return true; // default/all
    });
  }, [timeFrame, dateRange, invoices]);

  // Filter Logic for Expenses
  const filteredExpensesList = useMemo(() => {
    const now = new Date(); 
    
    return expenses.filter(exp => {
      const expDate = new Date(exp.expense_date);
      
      if (timeFrame === 'today') {
        const today = new Date();
        return expDate.getDate() === today.getDate() && 
               expDate.getMonth() === today.getMonth() && 
               expDate.getFullYear() === today.getFullYear();
      }
      
      if (timeFrame === 'month') {
        return expDate.getMonth() === now.getMonth() && expDate.getFullYear() === now.getFullYear();
      }
      
      if (timeFrame === 'quarter') {
        const currentQuarter = Math.floor(now.getMonth() / 3);
        const expQuarter = Math.floor(expDate.getMonth() / 3);
        return currentQuarter === expQuarter && expDate.getFullYear() === now.getFullYear();
      }
      
      if (timeFrame === 'year') {
        return expDate.getFullYear() === now.getFullYear();
      }

      if (timeFrame === 'custom' && dateRange.start && dateRange.end) {
        const start = new Date(dateRange.start);
        const end = new Date(dateRange.end);
        return expDate >= start && expDate <= end;
      }
      
      return true; // default/all
    });
  }, [timeFrame, dateRange, expenses]);

  // Derive Stats
  const dashboardStats = useMemo(() => {
    const totalRevenue = filteredBilling.reduce((acc, b) => acc + (Number(b.paid_amount) || 0), 0);
    const appointmentCount = filteredBilling.filter(b => b.invoice_items?.some((i: any) => i.category === 'OPD')).length;
    const ipdCount = filteredBilling.filter(b => b.invoice_items?.some((i: any) => i.category === 'IPD' || i.category === 'OT')).length;
    
    const totalPatients = patients.length;
    const totalExpenses = filteredExpensesList.reduce((acc, e) => acc + (Number(e.amount) || 0), 0);
    const netProfit = totalRevenue - totalExpenses;

    const baseStats = [
      { name: 'Total Patients', value: totalPatients.toLocaleString(), icon: Users, change: '+0', trend: 'up', color: 'bg-blue-500' },
      { name: 'OPD Transactions', value: appointmentCount.toString(), icon: Activity, change: '0%', trend: 'up', color: 'bg-teal-500' },
      { name: 'IPD/OT Records', value: ipdCount.toString(), icon: CalendarIcon, change: '0%', trend: 'up', color: 'bg-indigo-500' },
      { name: 'Total Revenue', value: formatCurrency(totalRevenue), icon: TrendingUp, change: '0%', trend: 'up', color: 'bg-emerald-500' },
    ];

    const currentUser = storage.get(STORAGE_KEYS.SESSION_USER, null);
    const showFinancials = !currentUser || 
      ['SUPER_ADMIN', 'ADMIN', 'HOSPITAL_ADMIN', 'ACCOUNTANT'].includes(currentUser.role) || 
      currentUser.role?.toUpperCase().includes('ADMIN');

    if (showFinancials) {
      baseStats.push(
        { name: 'Total Expenses', value: formatCurrency(totalExpenses), icon: TrendingDown, change: '0%', trend: 'down', color: 'bg-rose-500' },
        { name: 'Net Income', value: formatCurrency(netProfit), icon: TrendingUp, change: '0%', trend: netProfit >= 0 ? 'up' : 'down', color: netProfit >= 0 ? 'bg-emerald-500' : 'bg-rose-500' }
      );
    }

    return baseStats;
  }, [filteredBilling, patients, filteredExpensesList]);

  // Derive Revenue breakdown for chart
  const revenueBreakdown = useMemo(() => {
    const categories: Record<string, { value: number, color: string }> = {
      'Main Billing': { value: 0, color: '#1E6FA8' },
      'Pharmacy': { value: 0, color: '#2EC4B6' },
      'Lab & Rad': { value: 0, color: '#9333ea' },
      'OPD/Consultancy': { value: 0, color: '#f59e0b' }
    };

    filteredBilling.forEach(bill => {
      bill.invoice_items?.forEach((item: any) => {
        if (item.category === 'Pharmacy') categories['Pharmacy'].value += Number(item.total_price) || 0;
        else if (item.category === 'Pathology' || item.category === 'Radiology') categories['Lab & Rad'].value += Number(item.total_price) || 0;
        else if (item.category === 'OPD') categories['OPD/Consultancy'].value += Number(item.total_price) || 0;
        else categories['Main Billing'].value += Number(item.total_price) || 0;
      });
    });

    return Object.entries(categories).map(([name, data]) => ({
      name,
      value: data.value,
      color: data.color
    })).filter(d => d.value > 0);
  }, [filteredBilling]);

  if (isLoading) {
    return (
      <div className="h-full w-full flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-medical-blue" />
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      {/* Dynamic, Vibrant, Richly Colored Banner Header */}
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-indigo-700 via-purple-600 to-pink-600 text-white p-6 sm:p-8 shadow-xl shadow-indigo-100 animate-in fade-in duration-500">
        <div className="absolute top-0 right-0 -mr-16 -mt-16 w-80 h-80 rounded-full bg-white/10 blur-3xl pointer-events-none"></div>
        <div className="absolute bottom-0 left-0 -ml-20 -mb-20 w-80 h-80 rounded-full bg-pink-400/20 blur-3xl pointer-events-none"></div>
        
        <div className="relative flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="space-y-2">
            <span className="text-[10px] font-black tracking-widest bg-white/20 text-white px-3 py-1 rounded-full uppercase my-1 select-none w-fit">
              ★ SYSTEM CONTROLLER ACTIVE
            </span>
            <h1 className="text-3xl font-extrabold tracking-tight md:text-4xl text-white">
              Medinex Hms Analytics
            </h1>
            <p className="text-indigo-100 text-sm font-medium max-w-xl">
              Live updates across all panels, overall databases, pharmacies, clinical admissions, and real-time ledger audits.
            </p>
          </div>
          
          <div className="flex flex-wrap items-center gap-3 bg-white/10 backdrop-blur-md p-2 rounded-2xl shadow-inner border border-white/10">
            <Tabs value={timeFrame} onValueChange={setTimeFrame} className="w-auto">
              <TabsList className="grid grid-cols-4 h-9 bg-black/20 text-indigo-100">
                <TabsTrigger value="today" className="text-xs data-[state=checked]:bg-white data-[state=checked]:text-indigo-900">Today</TabsTrigger>
                <TabsTrigger value="month" className="text-xs data-[state=checked]:bg-white data-[state=checked]:text-indigo-900">Monthly</TabsTrigger>
                <TabsTrigger value="quarter" className="text-xs data-[state=checked]:bg-white data-[state=checked]:text-indigo-900">Quarterly</TabsTrigger>
                <TabsTrigger value="year" className="text-xs data-[state=checked]:bg-white data-[state=checked]:text-indigo-900">Yearly</TabsTrigger>
              </TabsList>
            </Tabs>

            <Select value={timeFrame} onValueChange={setTimeFrame}>
              <SelectTrigger className="w-[140px] h-9 text-xs bg-white text-slate-800 rounded-xl font-bold">
                <div className="flex items-center gap-2">
                  <Filter className="w-3 h-3 text-indigo-600" />
                  <SelectValue placeholder="Other Filters" />
                </div>
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Time</SelectItem>
                <SelectItem value="custom">Custom Range</SelectItem>
              </SelectContent>
            </Select>

            {timeFrame === 'custom' && (
              <div className="flex items-center gap-1 bg-white/85 p-1 rounded-xl text-slate-800">
                <Input 
                  type="date" 
                  className="h-7 w-28 text-[10px] border-none font-bold bg-transparent" 
                  value={dateRange.start} 
                  onChange={(e) => setDateRange(prev => ({ ...prev, start: e.target.value }))}
                />
                <span className="text-slate-400 text-xs font-bold px-1">-</span>
                <Input 
                  type="date" 
                  className="h-7 w-28 text-[10px] border-none font-bold bg-transparent" 
                  value={dateRange.end} 
                  onChange={(e) => setDateRange(prev => ({ ...prev, end: e.target.value }))}
                />
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {dashboardStats.map((stat) => (
          <Card key={stat.name} className="overflow-hidden border-none shadow-sm">
            <CardContent className="p-6">
              <div className="flex items-center justify-between mb-4">
                <div className={`p-2 rounded-lg ${stat.color} bg-opacity-10`}>
                  <stat.icon className={`w-5 h-5 text-${stat.color.split('-')[1]}-600`} />
                </div>
                <Badge variant="secondary" className={`flex items-center gap-1 ${stat.trend === 'up' ? 'text-emerald-600 bg-emerald-50' : 'text-rose-600 bg-rose-50'}`}>
                  {stat.trend === 'up' ? <ArrowUpRight className="w-3 h-3" /> : <ArrowDownRight className="w-3 h-3" />}
                  {stat.change}
                </Badge>
              </div>
              <h3 className="text-2xl font-bold">{stat.value}</h3>
              <p className="text-xs text-muted-foreground font-medium uppercase tracking-wider mt-1">{stat.name}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card className="lg:col-span-2 border-none shadow-sm">
          <CardHeader className="flex flex-row items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2 text-lg">
                <BarChart3 className="w-5 h-5 text-medical-blue" />
                Revenue Performance
              </CardTitle>
              <CardDescription className="text-xs uppercase font-bold tracking-tight">
                {timeFrame === 'today' ? 'Today' : 
                 timeFrame === 'month' ? 'Current Month' :
                 timeFrame === 'quarter' ? 'Current Quarter' :
                 timeFrame === 'year' ? 'Current Year' : 'Overall'} Summary
              </CardDescription>
            </div>
            <div className="flex gap-4">
              {revenueBreakdown.map(d => (
                <div key={d.name} className="flex items-center gap-1.5">
                  <div className="w-2 h-2 rounded-full" style={{ backgroundColor: d.color }}></div>
                  <span className="text-[10px] font-bold text-muted-foreground uppercase">{d.name}</span>
                </div>
              ))}
            </div>
          </CardHeader>
          <CardContent className="h-[300px]">
            {revenueBreakdown.length > 0 ? (
              <div className="w-full h-full min-h-[250px] relative">
                <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={0}>
                  <BarChart data={revenueBreakdown} layout="vertical">
                    <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#f1f5f9" />
                    <XAxis type="number" axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: '#64748b' }} />
                    <YAxis dataKey="name" type="category" axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: '#64748b' }} width={120} />
                    <Tooltip 
                      formatter={(value: number) => [`₹${value.toLocaleString()}`, 'Revenue']}
                      contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }}
                    />
                    <Bar dataKey="value" radius={[0, 4, 4, 0]} barSize={40}>
                      {revenueBreakdown.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            ) : (
              <div className="h-full flex flex-col items-center justify-center text-slate-400 gap-2">
                <BarChart3 className="w-12 h-12 opacity-20" />
                <p className="text-sm italic">No data records found for this period</p>
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="border-none shadow-sm h-full overflow-hidden">
          <CardHeader className="bg-slate-50/50">
            <div className="flex items-center gap-2">
              <Clock className="w-5 h-5 text-medical-blue" />
              <CardTitle className="text-lg">Recent Audit Logs</CardTitle>
            </div>
            <CardDescription className="text-xs">Latest transactions within selected timeframe.</CardDescription>
          </CardHeader>
          <CardContent className="pt-6">
            <div className="space-y-6">
              {filteredBilling.length === 0 ? (
                <div className="text-center py-10 space-y-2">
                  <div className="text-slate-300 flex justify-center"><Filter size={32} /></div>
                  <p className="text-slate-400 italic text-sm">No recent transactions</p>
                </div>
              ) : (
                filteredBilling.slice(0, 5).map((bill, i) => (
                  <div key={bill.id} className="flex gap-4">
                    <div className="relative">
                      <div className={`w-8 h-8 rounded-full bg-blue-50 flex items-center justify-center text-medical-blue`}>
                        <CreditCard className="w-4 h-4" />
                      </div>
                      {i !== Math.min(filteredBilling.length, 5) - 1 && <div className="absolute top-8 left-4 w-[1px] h-6 bg-slate-100"></div>}
                    </div>
                    <div>
                      <p className="text-xs font-bold text-slate-800">Payment {bill.payment_method || 'N/A'}</p>
                      <p className="text-[10px] text-muted-foreground font-medium uppercase tracking-tight">Invoice #{bill.invoice_number} • {formatCurrency(bill.paid_amount)}</p>
                      <p className="text-[9px] text-slate-400 mt-1 flex items-center gap-1">
                        <CalendarIcon className="w-2.5 h-2.5" />
                        {new Date(bill.created_at).toLocaleDateString()}
                      </p>
                    </div>
                  </div>
                ))
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      <Card className="border-none shadow-sm overflow-hidden">
        <CardHeader className="border-b border-slate-50">
          <CardTitle className="text-lg">Departmental Activity Report</CardTitle>
          <CardDescription className="text-xs">Operational summary based on current filters.</CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-5 divide-x divide-slate-50">
            {[
              { dept: 'OPD', count: filteredBilling.filter(b => b.invoice_items?.some((i: any) => i.category === 'OPD')).length, label: 'OPD Visits', color: 'bg-blue-500' },
              { dept: 'IPD', count: filteredBilling.filter(b => b.invoice_items?.some((i: any) => i.category === 'IPD')).length, label: 'IPD Days', color: 'bg-indigo-500' },
              { dept: 'Pharmacy', count: filteredBilling.filter(b => b.invoice_items?.some((i: any) => i.category === 'Pharmacy')).length, label: 'RX Sold', color: 'bg-teal-500' },
              { dept: 'Lab/Rad', count: filteredBilling.filter(b => b.invoice_items?.some((i: any) => i.category === 'Pathology' || i.category === 'Radiology')).length, label: 'Test Reports', color: 'bg-purple-500' },
              { dept: 'OT', count: filteredBilling.filter(b => b.invoice_items?.some((i: any) => i.category === 'OT')).length, label: 'OT Records', color: 'bg-rose-500' },
            ].map((d) => (
              <div key={d.dept} className="p-6 hover:bg-slate-50/50 transition-colors">
                <div className="flex items-center gap-2 mb-3">
                  <div className={`w-2 h-2 rounded-full ${d.color}`}></div>
                  <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500">{d.dept}</span>
                </div>
                <div className="space-y-1">
                  <p className="text-2xl font-bold">{d.count}</p>
                  <p className="text-[10px] text-muted-foreground font-medium uppercase">{d.label}</p>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Interactive Hourly-Monthly Appointment Calendar */}
      <AppointmentCalendar appointments={appointments} patients={patients} />

      {/* Front Office & Reception Walk-in Appointment Desk */}
      <Card className="border-none shadow-md bg-gradient-to-br from-white to-slate-50/50 overflow-hidden animate-in fade-in duration-300">
        <CardHeader className="border-b border-indigo-50/75 bg-gradient-to-r from-indigo-50/50 via-purple-50/20 to-white py-4 px-6 flex flex-row items-center justify-between">
          <div>
            <div className="flex items-center gap-2">
              <span className="p-1 px-2 rounded bg-indigo-600 text-white font-mono text-[9px] font-black uppercase tracking-widest my-0.5">
                FO-DESK
              </span>
              <CardTitle className="text-base font-bold text-slate-800 flex items-center gap-2">
                <Ticket className="w-5 h-5 text-indigo-600" />
                Front Office Walk-in Appointment Desk
              </CardTitle>
            </div>
            <CardDescription className="text-xs">
              Direct walk-in registration, consultation token scheduling, and live queuing for front office desks.
            </CardDescription>
          </div>
          <Badge className="bg-indigo-100 hover:bg-slate-100 text-indigo-800 border-none px-2.5 py-1 text-[10px] font-bold">
            Receptionist Authorized Section
          </Badge>
        </CardHeader>

        <CardContent className="p-6">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            {/* Quick Scheduler Form (4 cols) */}
            <div className="lg:col-span-5 space-y-4 bg-white p-4 rounded-2xl border border-indigo-50/50 shadow-sm text-left">
              <h3 className="text-xs font-black text-indigo-950 uppercase tracking-widest flex items-center gap-1.5 border-b border-slate-100 pb-2">
                <PlusCircle className="w-4 h-4 text-indigo-600" />
                Schedule walk-in consult
              </h3>

              <div className="space-y-1.5">
                <Label className="text-xs font-bold text-slate-700">Select Registered Patient *</Label>
                <Select value={newApptPatientId} onValueChange={setNewApptPatientId}>
                  <SelectTrigger className="h-9 text-xs bg-slate-50 border-none">
                    <SelectValue placeholder="-- Select Registered Patient --" />
                  </SelectTrigger>
                  <SelectContent>
                    {patients.length === 0 ? (
                      <SelectItem value="none" disabled>No patients on record</SelectItem>
                    ) : (
                      patients.map(p => (
                        <SelectItem key={p.id} value={p.id}>
                          {p.name} ({p.mrn || 'No MRN'}) • {p.phone || 'No Phone'}
                        </SelectItem>
                      ))
                    )}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs font-bold text-slate-700">Select Specialty OPD Doctor *</Label>
                <Select value={newApptDoctor} onValueChange={setNewApptDoctor}>
                  <SelectTrigger className="h-9 text-xs bg-slate-50 border-none">
                    <SelectValue placeholder="-- Assign Specialised Doctor --" />
                  </SelectTrigger>
                  <SelectContent>
                    {users.filter(u => u.role?.toUpperCase() === 'DOCTOR' || u.role?.toUpperCase() === 'SUPER_ADMIN' || u.role?.toUpperCase() === 'SURGEON').map(doc => (
                      <SelectItem key={doc.id} value={doc.name}>
                        {doc.name} ({doc.department || 'General Medicine'} - {doc.degree || 'MBBS'})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div className="space-y-1.5">
                  <Label className="text-xs font-bold text-slate-700">Preferred Date</Label>
                  <Input 
                    type="date" 
                    className="h-9 text-xs bg-slate-50 border-none" 
                    value={newApptDate}
                    onChange={(e) => setNewApptDate(e.target.value)}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs font-bold text-slate-700">Session/Time slot</Label>
                  <Select value={newApptTime} onValueChange={setNewApptTime}>
                    <SelectTrigger className="h-9 text-xs bg-slate-50 border-none">
                      <SelectValue placeholder="Time block" />
                    </SelectTrigger>
                    <SelectContent>
                      {['09:00 AM', '10:00 AM', '11:00 AM', '12:00 PM', '02:00 PM', '03:00 PM', '04:00 PM', '05:00 PM'].map(time => (
                        <SelectItem key={time} value={time}>{time}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs font-bold text-slate-700">Consultation Urgency</Label>
                <div className="grid grid-cols-3 gap-1">
                  {['Routine', 'Urgent', 'Emergency'].map(level => (
                    <Button
                      key={level}
                      type="button"
                      variant="outline"
                      size="sm"
                      className={`h-8 text-[11px] border px-1 ${
                        newApptUrgency === level 
                          ? level === 'Emergency' 
                            ? 'bg-rose-600 border-none text-white hover:bg-rose-700' 
                            : level === 'Urgent' 
                              ? 'bg-amber-500 border-none text-white hover:bg-amber-600'
                              : 'bg-indigo-600 border-none text-white hover:bg-indigo-700'
                          : 'bg-white hover:bg-slate-50'
                      }`}
                      onClick={() => setNewApptUrgency(level)}
                    >
                      {level}
                    </Button>
                  ))}
                </div>
              </div>

              <Button 
                onClick={handleQuickBook}
                className="w-full h-10 font-bold text-xs bg-indigo-600 hover:bg-indigo-700 text-white gap-2 mt-2 shadow-md"
              >
                <PlusCircle className="w-4 h-4" />
                Confirm Walk-in Booking & Print Token
              </Button>
            </div>

            {/* Live Board Queue (7 cols) */}
            <div className="lg:col-span-7 space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-xs font-black text-indigo-950 uppercase tracking-widest flex items-center gap-1.5 font-mono">
                  <CheckCircle2 className="w-4 h-4 text-indigo-600 animate-pulse" />
                  Live Operational Daily Queue
                </h3>
                <span className="text-[10px] bg-indigo-50 text-indigo-700 px-2 py-0.5 rounded-full font-black">
                  Total Active: {appointments.length}
                </span>
              </div>

              <div className="bg-slate-900 text-slate-100 rounded-2xl p-4 min-h-[300px] border border-slate-800/80 shadow-inner overflow-hidden flex flex-col justify-between">
                <div>
                  <div className="grid grid-cols-4 text-[10px] font-black text-slate-500 uppercase tracking-wider pb-2 border-b border-slate-800/60 mb-2 font-mono">
                    <span>Patient / MRN</span>
                    <span>OPD Doctor / Dept</span>
                    <span>Scheduled Time</span>
                    <span className="text-right">Urgency / Token</span>
                  </div>

                  <div className="space-y-2 max-h-[220px] overflow-y-auto pr-1">
                    {appointments.length === 0 ? (
                      <div className="h-32 flex flex-col items-center justify-center text-slate-400 text-center">
                        <Ticket className="w-8 h-8 opacity-20 mb-1" />
                        <p className="text-xs italic text-slate-500">No walk-in bookings registered today.</p>
                      </div>
                    ) : (
                      appointments.slice(0, 5).map((apt: any) => {
                        const patName = apt.patientName || (patients.find(p => p.id === apt.patient_id || p.id === apt.patientId)?.name) || 'WALK-IN';
                        const patMRN = apt.patientMrn || (patients.find(p => p.id === apt.patient_id || p.id === apt.patientId)?.mrn) || 'EMERG';
                        const tokNum = apt.token || `TK-${apt.id?.slice(-3).toUpperCase() || '099'}`;

                        return (
                          <div key={apt.id} className="grid grid-cols-4 items-center text-xs py-1.5 border-b border-slate-800/40 hover:bg-slate-800/20 rounded px-1 transition-colors text-left font-mono">
                            <div>
                              <p className="font-bold text-slate-200 truncate">{patName}</p>
                              <p className="text-[9px] text-slate-500">MRN: {patMRN}</p>
                            </div>
                            <div className="text-slate-300">
                              <p className="truncate font-black text-indigo-200">{apt.doctor || 'OPD Consultant'}</p>
                              <p className="text-[9px] text-slate-500">General OPD</p>
                            </div>
                            <div className="text-slate-300 text-left">
                              <p className="font-bold">{new Date(apt.appointment_date).toLocaleDateString()}</p>
                              <p className="text-[10px] font-black tracking-tighter text-indigo-400">{apt.appointment_time}</p>
                            </div>
                            <div className="text-right flex flex-col items-end gap-1">
                              <span className={`text-[8px] font-black px-1.5 rounded uppercase ${
                                apt.urgency === 'Emergency' 
                                  ? 'bg-rose-500/20 text-rose-400 border border-rose-500/20' 
                                  : apt.urgency === 'Urgent' 
                                    ? 'bg-amber-500/20 text-amber-400 border border-amber-500/20' 
                                    : 'bg-indigo-500/20 text-indigo-400 border border-indigo-500/20'
                              }`}>
                                {apt.urgency || 'Routine'}
                              </span>
                              <Badge className="bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-400 border border-emerald-500/30 text-[9px] px-1 font-bold">
                                {tokNum}
                              </Badge>
                            </div>
                          </div>
                        );
                      })
                    )}
                  </div>
                </div>

                <div className="pt-2 border-t border-slate-800/80 flex items-center justify-between text-[10px] text-slate-400 font-medium">
                  <span>Showing daily bookings logged on active receptionist counters.</span>
                  <Link to="/opd" className="text-indigo-400 font-bold hover:underline flex items-center gap-1">
                    Manage Full OPD Desk & Queue →
                  </Link>
                </div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* India NHA ABDM Integrated Gateway Controller */}
      <div className="bg-gradient-to-br from-[#f0f7fc] to-[#e4eff9] border border-blue-100 p-6 rounded-3xl space-y-4 shadow-sm animate-in fade-in duration-300 text-left">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div>
            <h3 className="text-sm font-black text-[#024ea3] uppercase tracking-wider font-sans flex items-center gap-2">
              <Activity className="w-4 h-4 text-[#01a2a6] animate-pulse" />
              ABDM & Ayushman Bharat National Gateways Desk
            </h3>
            <p className="text-[11px] text-slate-500 font-medium">
              Verified Sandbox connectivity protocols. Direct entry nodes to registries, consent monitors, and billing claims.
            </p>
          </div>
          <Badge className="bg-[#024ea3] hover:bg-[#024ea3] text-white border-none text-[9px] uppercase font-black px-2.5 py-0.5 w-fit">
            NHA SANDBOX READY
          </Badge>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* 1. Scan & Share */}
          <Link 
            to="/abdm?tab=scanshare" 
            state={{ tab: 'scanshare' }}
            className="flex items-center gap-3.5 bg-white p-4 rounded-2xl border border-blue-50/50 hover:border-[#01a2a6]/40 hover:shadow-md transition-all group duration-200"
          >
            <div className="w-[42px] h-[42px] rounded-full bg-[#f0f7fc] group-hover:bg-[#e4eff9] border border-blue-50 flex items-center justify-center text-[#024ea3] shrink-0 transition-all shadow-sm">
              <QrCode className="w-5 h-5 stroke-[2.5]" />
            </div>
            <div className="text-left">
              <h4 className="text-[13px] font-[800] text-slate-800 group-hover:text-[#024ea3] leading-tight transition-colors">
                Scan & Share (ABDM)
              </h4>
              <p className="text-[9px] text-[#01a2a6] font-bold uppercase tracking-wider mt-0.5 font-mono">
                Opd ticket engine
              </p>
            </div>
          </Link>

          {/* 2. HPR / HFR Compliance */}
          <Link 
            to="/abdm?tab=pmjay" 
            state={{ tab: 'pmjay', scrollSection: 'hpr' }}
            className="flex items-center gap-3.5 bg-white p-4 rounded-2xl border border-blue-50/50 hover:border-[#01a2a6]/40 hover:shadow-md transition-all group duration-200"
          >
            <div className="w-[42px] h-[42px] rounded-full bg-[#f0f7fc] group-hover:bg-[#e4eff9] border border-blue-50 flex items-center justify-center text-[#024ea3] shrink-0 transition-all shadow-sm">
              <ShieldCheck className="w-5 h-5 stroke-[2.5]" />
            </div>
            <div className="text-left">
              <h4 className="text-[13px] font-[800] text-slate-800 group-hover:text-[#024ea3] leading-tight transition-colors">
                HPR / HFR Compliance
              </h4>
              <p className="text-[9px] text-[#01a2a6] font-bold uppercase tracking-wider mt-0.5 font-mono">
                Staff & Facility Logs
              </p>
            </div>
          </Link>

          {/* 3. HIP / HIU Integration */}
          <Link 
            to="/abdm?tab=consent" 
            state={{ tab: 'consent' }}
            className="flex items-center gap-3.5 bg-white p-4 rounded-2xl border border-blue-50/50 hover:border-[#01a2a6]/40 hover:shadow-md transition-all group duration-200"
          >
            <div className="w-[42px] h-[42px] rounded-full bg-[#f0f7fc] group-hover:bg-[#e4eff9] border border-blue-50 flex items-center justify-center text-[#024ea3] shrink-0 transition-all shadow-sm">
              <HeartHandshake className="w-5 h-5 stroke-[2.5]" />
            </div>
            <div className="text-left">
              <h4 className="text-[13px] font-[800] text-slate-800 group-hover:text-[#024ea3] leading-tight transition-colors">
                HIP / HIU Integration
              </h4>
              <p className="text-[9px] text-[#01a2a6] font-bold uppercase tracking-wider mt-0.5 font-mono">
                Consent approvals
              </p>
            </div>
          </Link>

          {/* 4. PM-JAY / Ayushman Bharat Ready */}
          <Link 
            to="/abdm?tab=pmjay" 
            state={{ tab: 'pmjay', scrollSection: 'pmjay' }}
            className="flex items-center gap-3.5 bg-white p-4 rounded-2xl border border-blue-50/50 hover:border-[#01a2a6]/40 hover:shadow-md transition-all group duration-200"
          >
            <div className="w-[42px] h-[42px] rounded-full bg-[#f0f7fc] group-hover:bg-[#e4eff9] border border-blue-50 flex items-center justify-center text-[#024ea3] shrink-0 transition-all shadow-sm">
              <Sparkles className="w-5 h-5 stroke-[2.5]" />
            </div>
            <div className="text-left">
              <h4 className="text-[13px] font-[800] text-slate-800 group-hover:text-[#024ea3] leading-tight transition-colors">
                PM-JAY / Ayushman Bharat Ready
              </h4>
              <p className="text-[9px] text-[#01a2a6] font-bold uppercase tracking-wider mt-0.5 font-mono">
                Claim pre-authorizations
              </p>
            </div>
          </Link>
        </div>

        <div className="border-t border-blue-150/50 pt-3 flex flex-col sm:flex-row items-center justify-between gap-3">
          <p className="text-[10px] text-slate-400 font-medium">
            All gateway actions are signed under secured TLS/SSL connection with state health authority certificates.
          </p>
          <Link to="/patient-overview" className="shrink-0 w-full sm:w-auto">
            <Button variant="outline" className="border-medical-blue text-medical-blue hover:bg-blue-50/50 h-8 text-[11px] font-bold px-4 rounded-xl flex items-center gap-1.5 w-full">
              <Users className="w-3.5 h-3.5" />
              Access Clinical 360 Reports Desk →
            </Button>
          </Link>
        </div>
      </div>

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
