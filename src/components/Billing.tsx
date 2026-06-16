import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  CreditCard, 
  Search, 
  Filter, 
  Download, 
  Printer, 
  Plus,
  ArrowUpRight,
  History,
  CheckCircle2,
  Clock,
  AlertCircle,
  Trash2,
  Edit,
  Loader2,
  User
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { formatCurrency, formatDate } from '@/lib/utils';
import { storage, STORAGE_KEYS } from '@/lib/storage';
import { MOCK_USERS, MOCK_BILLING } from '@/mockData';
import { supabaseService } from '@/services/supabaseService';
import { useDataSync } from '@/hooks/useDataSync';

import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle, 
  DialogTrigger,
  DialogFooter,
  DialogDescription
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';

export default function Billing() {
  const navigate = useNavigate();
  const [bills, setBills] = useState<any[]>([]);
  const [patients, setPatients] = useState<any[]>([]);
  const [users, setUsers] = useState<any[]>(() => storage.get(STORAGE_KEYS.USERS, MOCK_USERS));
  const [expenses, setExpenses] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [templateImage, setTemplateImage] = useState<string | null>(() => storage.get(STORAGE_KEYS.TEMPLATE_IMAGE, null));
  const [hospitalInfo, setHospitalInfo] = useState(() => storage.get(STORAGE_KEYS.HOSPITAL_INFO, {
    name: 'medinex HMS',
    address: '123 Healthcare Way, Medical City',
    phone: '+91 98765 43210',
    email: 'accounts@medinexhms.com',
    logo: null as string | null
  }));

  const fetchData = async () => {
    setLoading(true);
    const [invoicesData, patientsData, staffData, expensesData] = await Promise.all([
      supabaseService.getInvoices(),
      supabaseService.getPatients(),
      supabaseService.getStaff(),
      supabaseService.getExpenses()
    ]);

    if (invoicesData) setBills(invoicesData);
    if (patientsData) setPatients(patientsData);
    if (staffData && staffData.length > 0) setUsers(staffData);
    if (expensesData) setExpenses(expensesData);
    setLoading(false);
  };

  useDataSync(fetchData);

  // Load latest rates from storage
  const [otRates] = useState(() => storage.get(STORAGE_KEYS.OT_RATES, []));
  const [bedRates] = useState(() => storage.get(STORAGE_KEYS.BED_RATES, []));
  const [labRates] = useState(() => storage.get(STORAGE_KEYS.LAB_RATES, []));
  const [materialRates] = useState(() => storage.get(STORAGE_KEYS.MATERIAL_RATES, []));

  const currentUser = storage.get(STORAGE_KEYS.SESSION_USER, null);

  const isAddedByAdmin = (record: any) => {
    if (!record) return false;
    const seedIds = ['bill1', 'bill2', 'bill3', 'bill4', 'bill5'];
    if (record.id && seedIds.includes(record.id)) return true;

    const creatorId = record.created_by || record.issued_by || record.createdBy;
    if (!creatorId) {
      // Treat legacy records without creator info as admin-seeded fail-safe
      return true;
    }
    if (creatorId === 'u2' || creatorId === 'u-admin' || creatorId === 'u-admingh') return true;

    const creatorUser = users?.find((u: any) => u.id === creatorId || u.email === creatorId);
    if (creatorUser && (creatorUser.role === 'SUPER_ADMIN' || creatorUser.role === 'ADMIN' || creatorUser.role === 'HOSPITAL_ADMIN' || creatorUser.role?.toUpperCase().includes('ADMIN'))) return true;

    return false;
  };

  const canModify = (record: any) => {
    const isCurrentUserAdmin = currentUser?.role === 'SUPER_ADMIN' || currentUser?.role === 'ADMIN' || currentUser?.role === 'HOSPITAL_ADMIN' || currentUser?.role?.toUpperCase().includes('ADMIN');
    if (isCurrentUserAdmin) return true;
    return !isAddedByAdmin(record);
  };

  const logAudit = (action: string, entityId: string, details: any) => {
    const logs = storage.get(STORAGE_KEYS.AUDIT_LOGS, []);
    const newLog = {
      id: `audit-${Date.now()}`,
      userId: currentUser?.id || 'unknown',
      userName: currentUser?.name || 'Unknown User',
      userRole: currentUser?.role || 'N/A',
      action,
      entityType: 'Billing',
      entityId,
      details,
      timestamp: new Date().toISOString()
    };
    storage.set(STORAGE_KEYS.AUDIT_LOGS, [newLog, ...logs]);
  };

  const [searchQuery, setSearchQuery] = useState('');
  const [activeTab, setActiveTab] = useState<'recent' | 'consolidated' | 'gst' | 'claims' | 'refunds'>('recent');
  const [conPatientId, setConPatientId] = useState<string>('');
  const [conPatientSearch, setConPatientSearch] = useState<string>('');
  const [showConPatientResults, setShowConPatientResults] = useState<boolean>(false);
  const [filterCategory, setFilterCategory] = useState<string>('all');
  const [isHistoryOpen, setIsHistoryOpen] = useState(false);
  const [isInvoiceOpen, setIsInvoiceOpen] = useState(false);
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [editingBill, setEditingBill] = useState<any>(null);

  // Refunds State & Setup
  const [refunds, setRefunds] = useState<any[]>(() => {
    const saved = localStorage.getItem('hms_billing_refunds');
    if (saved) return JSON.parse(saved);
    const initial = [
      {
        id: 'REF-831032',
        patientId: 'p2',
        patientName: 'Karan Manoj Rawat',
        mrn: 'MRN000104',
        invoiceId: 'b-refundmock-1',
        amount: 500,
        reason: 'Duplicate OPD consultation fee charged',
        paymentMethod: 'UPI',
        status: 'Processed',
        requestedBy: 'u-accounts',
        reviewedBy: 'Super Admin',
        createdAt: new Date(Date.now() - 48 * 3600000).toISOString(),
        processedAt: new Date(Date.now() - 47 * 3600000).toISOString()
      },
      {
        id: 'REF-120349',
        patientId: 'p3',
        patientName: 'Ramesh Chander Gupta',
        mrn: 'MRN000105',
        invoiceId: 'b-refundmock-2',
        amount: 2500,
        reason: 'Laboratory pathology test cancelled by doctor',
        paymentMethod: 'Cash',
        status: 'Processed',
        requestedBy: 'u-accounts',
        reviewedBy: 'Super Admin',
        createdAt: new Date(Date.now() - 24 * 3600000).toISOString(),
        processedAt: new Date(Date.now() - 23 * 3600000).toISOString()
      },
      {
        id: 'REF-772910',
        patientId: 'p2',
        patientName: 'Karan Manoj Rawat',
        mrn: 'MRN000104',
        invoiceId: 'b-refundmock-3',
        amount: 1500,
        reason: 'Radiology scan overcharge correction',
        paymentMethod: 'Bank Transfer',
        status: 'Pending Approved',
        requestedBy: 'u-accounts',
        reviewedBy: null,
        createdAt: new Date().toISOString(),
        processedAt: null
      }
    ];
    localStorage.setItem('hms_billing_refunds', JSON.stringify(initial));
    return initial;
  });

  // Claims State & Setup
  const [claims, setClaims] = useState<any[]>(() => {
    const saved = localStorage.getItem('hms_billing_claims');
    if (saved) return JSON.parse(saved);
    const initial = [
      {
        id: 'CLM-772091',
        patientId: 'p2',
        patientName: 'Karan Manoj Rawat',
        mrn: 'MRN000104',
        type: 'PM-JAY',
        packageCode: 'Maternity Packages - UP-0402',
        claimAmount: 18500,
        preAuthId: 'PA-UP-772901-P',
        tpaName: 'State Health Agency SACHIS',
        status: 'Approved',
        filedDate: new Date(Date.now() - 5 * 24 * 3600000).toISOString(),
        adjudicatedDate: new Date(Date.now() - 2 * 24 * 3600000).toISOString(),
        notes: 'Pre-auth documentation verified. Dispatched package fee directly.'
      },
      {
        id: 'CLM-331024',
        patientId: 'p3',
        patientName: 'Ramesh Chander Gupta',
        mrn: 'MRN000105',
        type: 'TPA Insurance',
        packageCode: 'Coronary Angiography Pack',
        claimAmount: 45000,
        preAuthId: 'PA-TPA-930219-N',
        tpaName: 'Star Health Insurance',
        status: 'Filed',
        filedDate: new Date(Date.now() - 2 * 24 * 3600000).toISOString(),
        adjudicatedDate: null,
        notes: 'Awaiting biometric authentication verification logs from room egress.'
      },
      {
        id: 'CLM-102948',
        patientId: 'p2',
        patientName: 'Karan Manoj Rawat',
        mrn: 'MRN000104',
        type: 'PM-JAY',
        packageCode: 'General Ward Stay & Support - GW-01',
        claimAmount: 8000,
        preAuthId: 'PA-UP-930248-Y',
        tpaName: 'State Health Agency SACHIS',
        status: 'Queried',
        filedDate: new Date(Date.now() - 1 * 24 * 3600000).toISOString(),
        adjudicatedDate: null,
        notes: 'State auditor requested copy of Aadhaar-linked OTP sheet and UHID digital card.'
      }
    ];
    localStorage.setItem('hms_billing_claims', JSON.stringify(initial));
    return initial;
  });

  const [newRefund, setNewRefund] = useState({
    patientId: '',
    invoiceId: '',
    amount: '',
    reason: '',
    paymentMethod: 'UPI'
  });

  const [newClaim, setNewClaim] = useState({
    patientId: '',
    type: 'PM-JAY',
    packageCode: '',
    claimAmount: '',
    preAuthId: '',
    tpaName: 'State Health Agency SACHIS',
    notes: ''
  });

  const [newRefundPatSearch, setNewRefundPatSearch] = useState('');
  const [newClaimPatSearch, setNewClaimPatSearch] = useState('');
  const [showRefundRefPatResults, setShowRefundRefPatResults] = useState(false);
  const [showClaimRefPatResults, setShowClaimRefPatResults] = useState(false);
  const [selectedRefundBillList, setSelectedRefundBillList] = useState<any[]>([]);

  const [gstMonth, setGstMonth] = useState('June 2026');

  const handleCreateRefund = () => {
    if (!newRefund.patientId || !newRefund.invoiceId || !newRefund.amount || !newRefund.reason) {
      toast.error('Please input all required fields for refund processing.');
      return;
    }
    const patientObj = patients.find(p => p.id === newRefund.patientId);
    if (!patientObj) return;

    const refundId = `REF-${Math.floor(Math.random() * 900000) + 100000}`;
    const refundObj = {
      id: refundId,
      patientId: newRefund.patientId,
      patientName: patientObj.name,
      mrn: patientObj.mrn,
      invoiceId: newRefund.invoiceId,
      amount: parseFloat(newRefund.amount),
      reason: newRefund.reason,
      paymentMethod: newRefund.paymentMethod,
      status: currentUser?.role?.toUpperCase()?.includes('ADMIN') ? 'Processed' : 'Pending Approved',
      requestedBy: currentUser?.id || 'u-accounts',
      reviewedBy: currentUser?.role?.toUpperCase()?.includes('ADMIN') ? currentUser.name : null,
      createdAt: new Date().toISOString(),
      processedAt: currentUser?.role?.toUpperCase()?.includes('ADMIN') ? new Date().toISOString() : null
    };

    const updatedRefunds = [refundObj, ...refunds];
    setRefunds(updatedRefunds);
    localStorage.setItem('hms_billing_refunds', JSON.stringify(updatedRefunds));

    if (refundObj.status === 'Processed') {
      const updatedBills = bills.map(b => {
        if (b.id === refundObj.invoiceId) {
          const newPaid = Math.max(0, (Number(b.paid_amount) || Number(b.total_amount)) - refundObj.amount);
          return {
            ...b,
            paid_amount: newPaid,
            status: newPaid === 0 ? 'Refunded' : b.status
          };
        }
        return b;
      });
      setBills(updatedBills);
      toast.success(`Refund processed for ₹${refundObj.amount}! Invoice adjusted.`);
    } else {
      toast.success(`Refund Request ${refundId} raised successfully! Pending Admin review.`);
    }

    setNewRefund({
      patientId: '',
      invoiceId: '',
      amount: '',
      reason: '',
      paymentMethod: 'UPI'
    });
    setNewRefundPatSearch('');
  };

  const handleApproveRefund = (refundId: string) => {
    const updatedRefunds = refunds.map(r => {
      if (r.id === refundId) {
        const invoiceToAdjust = r.invoiceId;
        const refundAmt = r.amount;
        const updatedBills = bills.map(b => {
          if (b.id === invoiceToAdjust) {
            const newPaid = Math.max(0, (Number(b.paid_amount) || Number(b.total_amount)) - refundAmt);
            return {
              ...b,
              paid_amount: newPaid,
              status: newPaid === 0 ? 'Refunded' : b.status
            };
          }
          return b;
        });
        setBills(updatedBills);
        return {
          ...r,
          status: 'Processed',
          reviewedBy: currentUser?.name || 'Super Admin',
          processedAt: new Date().toISOString()
        };
      }
      return r;
    });

    setRefunds(updatedRefunds);
    localStorage.setItem('hms_billing_refunds', JSON.stringify(updatedRefunds));
    toast.success('Refund request approved and processed successfully!');
  };

  const handleCreateClaim = () => {
    if (!newClaim.patientId || !newClaim.claimAmount || !newClaim.packageCode || !newClaim.preAuthId) {
      toast.error('Please input patient, package details, claim amount and Pre-Authorization code.');
      return;
    }
    const patObj = patients.find(p => p.id === newClaim.patientId);
    if (!patObj) return;

    const claimId = `CLM-${Math.floor(Math.random() * 900000) + 100000}`;
    const claimObj = {
      id: claimId,
      patientId: newClaim.patientId,
      patientName: patObj.name,
      mrn: patObj.mrn,
      type: newClaim.type,
      packageCode: newClaim.packageCode,
      claimAmount: parseFloat(newClaim.claimAmount),
      preAuthId: newClaim.preAuthId,
      tpaName: newClaim.tpaName,
      status: 'Filed',
      filedDate: new Date().toISOString(),
      adjudicatedDate: null,
      notes: newClaim.notes || 'Submitting TPA/PMJAY claim via local integrated NHA gateway.'
    };

    const updatedClaims = [claimObj, ...claims];
    setClaims(updatedClaims);
    localStorage.setItem('hms_billing_claims', JSON.stringify(updatedClaims));
    toast.success(`Claim ${claimId} successfully processed and filed through ABDM gateway!`);

    setNewClaim({
      patientId: '',
      type: 'PM-JAY',
      packageCode: '',
      claimAmount: '',
      preAuthId: '',
      tpaName: 'State Health Agency SACHIS',
      notes: ''
    });
    setNewClaimPatSearch('');
  };

  const handleUpdateClaimStatus = (claimId: string, newStatus: string) => {
    const updatedClaims = claims.map(c => {
      if (c.id === claimId) {
        return {
          ...c,
          status: newStatus,
          adjudicatedDate: newStatus === 'Approved' || newStatus === 'Rejected' ? new Date().toISOString() : null
        };
      }
      return c;
    });
    setClaims(updatedClaims);
    localStorage.setItem('hms_billing_claims', JSON.stringify(updatedClaims));
    toast.success(`Claim portfolio updated: Status set to ${newStatus}`);
  };
  
  // Multi-item invoice state
  const [invoiceItems, setInvoiceItems] = useState<any[]>([]);
  const [patientSearchTerm, setPatientSearchTerm] = useState('');
  const [showPatientResults, setShowPatientResults] = useState(false);
  const [newInvoice, setNewInvoice] = useState({
    patientId: '',
    paymentMode: 'Cash',
    discount: 0
  });
  
  const [currentItem, setCurrentItem] = useState({
    category: '',
    description: '',
    amount: '',
    subType: ''
  });

  const handleAddItem = () => {
    if (!currentItem.description || !currentItem.amount) {
      toast.error('Please select a service and ensure amount is valid');
      return;
    }
    setInvoiceItems([...invoiceItems, { 
      description: currentItem.description, 
      amount: parseInt(currentItem.amount), 
      category: currentItem.category 
    }]);
    setCurrentItem({ category: '', description: '', amount: '', subType: '' });
  };

  const removeItem = (index: number) => {
    setInvoiceItems(invoiceItems.filter((_, i) => i !== index));
  };

  const totalInvoiceAmount = invoiceItems.reduce((sum, item) => sum + item.amount, 0);
  const finalAmount = Math.max(0, totalInvoiceAmount - (newInvoice.discount || 0));
  const finalEditAmount = Math.max(0, totalInvoiceAmount - (editingBill?.discount || 0));

  const handleCreateInvoice = async () => {
    if (!newInvoice.patientId || invoiceItems.length === 0) {
      toast.error('Please select a patient and add at least one item');
      return;
    }
    const billToAdd = {
      patient_id: newInvoice.patientId,
      total_amount: totalInvoiceAmount,
      discount_amount: newInvoice.discount || 0,
      payable_amount: finalAmount,
      paid_amount: finalAmount,
      payment_status: 'Paid',
      payment_method: newInvoice.paymentMode,
      status: 'Settled',
      type: 'Independent',
      created_by: currentUser?.id || 'u-accounts',
      issued_by: currentUser?.id || 'u-accounts'
    };
    
    const itemsToInsert = invoiceItems.map(item => ({
      item_name: item.description,
      quantity: 1,
      unit_price: item.amount,
      total_price: item.amount,
      category: item.category
    }));

    const result = await supabaseService.createInvoice(billToAdd, itemsToInsert);
    if (result) {
      fetchData();
      setInvoiceItems([]);
      setNewInvoice({ patientId: '', paymentMode: 'Cash', discount: 0 });
      setPatientSearchTerm('');
      setShowPatientResults(false);
      setIsInvoiceOpen(false);
      toast.success('Independent invoice generated');
      logAudit('CREATE_INVOICE', result.id, { bill: result });
    } else {
      toast.error('Failed to create invoice');
    }
  };

  const handleCategoryChange = (val: string) => {
    setCurrentItem({ category: val, description: '', amount: '', subType: '' });
  };

  const handleSubTypeChange = (val: string) => {
    let rate = 0;
    let description = '';

    if (currentItem.category === 'ot') {
      const found = otRates.find((r: any) => r.type === val);
      rate = found?.rate || 0;
      description = `${val} Surgery Charges`;
    } else if (currentItem.category === 'ipd') {
      const found = bedRates.find((r: any) => r.type === val);
      rate = found?.rate || 0;
      description = `${val} Bed Charges (1 Day)`;
    } else if (currentItem.category === 'lab' || currentItem.category === 'path' || currentItem.category === 'radio') {
      const found = labRates.find((r: any) => r.name === val);
      rate = found?.price || 0;
      description = val;
    } else if (currentItem.category === 'materials') {
      const found = materialRates.find((r: any) => r.name === val);
      rate = found?.price || 0;
      description = val;
    } else if (currentItem.category === 'opd') {
      rate = 500;
      description = 'OPD Consultation Fee';
    } else if (currentItem.category === 'custom') {
      rate = 0;
      description = '';
    }

    setCurrentItem({ 
      ...currentItem, 
      subType: val, 
      amount: rate.toString(), 
      description: description 
    });
  };

  const filteredBills = bills.filter(bill => {
    if (!bill) return false;
    const searchMatch = 
      (bill.id || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
      (bill.patients?.name?.toLowerCase()?.includes(searchQuery.toLowerCase()) || false) ||
      (bill.patients?.mrn?.toLowerCase()?.includes(searchQuery.toLowerCase()) || false) ||
      (bill.patients?.phone?.includes(searchQuery) || false);
    
    let categoryMatch = false;
    if (filterCategory === 'all') {
      categoryMatch = true;
    } else {
      const bType = (bill.type || '').toLowerCase();
      const bMethod = (bill.payment_method || '').toLowerCase();
      const hasItemCategory = (cat: string) => 
        (bill.invoice_items || []).some((item: any) => 
          item && item.category && item.category.toLowerCase() === cat.toLowerCase()
        );
      
      if (filterCategory === 'opd') {
        categoryMatch = bType === 'opd' || hasItemCategory('opd');
      } else if (filterCategory === 'ipd') {
        categoryMatch = bType === 'ipd' || hasItemCategory('ipd');
      } else if (filterCategory === 'lab') {
        categoryMatch = bType === 'lab' || hasItemCategory('lab') || hasItemCategory('path');
      } else if (filterCategory === 'radiology') {
        categoryMatch = bType === 'radiology' || hasItemCategory('radio') || hasItemCategory('radiology');
      } else if (filterCategory === 'pharmacy') {
        categoryMatch = bType === 'pharmacy' || hasItemCategory('pharmacy');
      } else if (filterCategory === 'ot') {
        categoryMatch = bType === 'ot' || hasItemCategory('ot');
      } else if (filterCategory === 'insurance') {
        categoryMatch = bMethod === 'insurance' || bType.includes('insurance');
      }
    }
    
    return searchMatch && categoryMatch;
  });

  const groupedBillsByDate = bills.reduce((acc: Record<string, any[]>, bill) => {
    const dateKey = bill.date || new Date(bill.created_at).toISOString().split('T')[0];
    if (!acc[dateKey]) acc[dateKey] = [];
    acc[dateKey].push(bill);
    return acc;
  }, {});

  const handleDeleteBill = async (id: string) => {
    const billToDelete = bills.find(b => b.id === id);
    if (billToDelete && !canModify(billToDelete)) {
      toast.error('This invoice was created by administration and cannot be cancelled by non-admin roles.');
      return;
    }
    const success = await supabaseService.deleteInvoice(id);
    if (success) {
      logAudit('DELETE', id, { bill: billToDelete });
      setBills(bills.filter(b => b.id !== id));
      toast.success('Invoice cancelled');
    } else {
      toast.error('Failed to cancel invoice');
    }
  };

  const handleExportBilling = () => {
    const headers = ['Invoice ID', 'Patient MRN', 'Date', 'Amount', 'Status', 'Mode'];
    const rows = bills.map(b => [
      b.id,
      b.patients?.mrn || 'N/A',
      b.created_at,
      b.total_amount,
      b.status,
      b.payment_method || 'N/A'
    ]);
    
    const csvContent = [headers, ...rows].map(e => e.join(",")).join("\n");
    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.setAttribute('hidden', '');
    a.setAttribute('href', url);
    a.setAttribute('download', 'hospital_billing.csv');
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    toast.success('Billing data exported');
  };

  const handleEditBill = (bill: any) => {
    if (bill && !canModify(bill)) {
      toast.error('This invoice was created by administration and cannot be modified by non-admin roles.');
      return;
    }
    setEditingBill({ ...bill });
    const rawItems = bill.invoice_items || bill.items || [];
    const formattedItems = rawItems.map((it: any) => ({
      description: it.item_name || it.description || 'Service/Medicine',
      amount: Number(it.unit_price || it.amount || it.total_price || 0),
      category: it.category || 'OPD'
    }));
    setInvoiceItems(formattedItems);
    setIsEditOpen(true);
  };

  const handleUpdateInvoice = async () => {
    if (invoiceItems.length === 0) {
      toast.error('Add at least one item');
      return;
    }

    if (editingBill && !canModify(editingBill)) {
      toast.error('This invoice was created by administration and cannot be modified by non-admin roles.');
      return;
    }
    
    const billToUpdate = {
      patient_id: editingBill.patient_id || editingBill.patientId,
      total_amount: totalInvoiceAmount,
      discount_amount: editingBill.discount || 0,
      payable_amount: finalEditAmount,
      paid_amount: finalEditAmount,
      payment_method: editingBill.paymentMode || editingBill.payment_method || 'Cash',
      payment_status: 'Paid',
      status: 'Settled',
      type: editingBill.type || 'Independent',
      created_by: editingBill.created_by || editingBill.issued_by
    };

    const itemsToInsert = invoiceItems.map(item => ({
      item_name: item.description,
      quantity: 1,
      unit_price: item.amount,
      total_price: item.amount,
      category: item.category
    }));

    try {
      const result = await supabaseService.updateInvoice(editingBill.id, billToUpdate, itemsToInsert);
      if (result) {
        logAudit('UPDATE', editingBill.id, { before: editingBill, after: result });
        await fetchData();
        setIsEditOpen(false);
        setEditingBill(null);
        setInvoiceItems([]);
        toast.success('Invoice updated successfully');
      } else {
        toast.error('Failed to update invoice');
      }
    } catch (err: any) {
      console.error('Error updating invoice:', err);
      toast.error('Error: ' + err.message);
    }
  };

  const printInvoice = (rawBill: any) => {
    const patientObj = patients.find(p => p.id === rawBill.patientId || p.id === rawBill.patient_id || p.mrn === rawBill.patient_id) || rawBill.patients;
    const itemsList = rawBill.invoice_items || rawBill.items || [];
    const subTotal = Number(rawBill.total_amount || rawBill.totalAmount || rawBill.total || 0);
    const discountAmt = Number(rawBill.discount_amount || rawBill.discount || 0);
    const totalPaid = Number(rawBill.paid_amount || rawBill.paidAmount || (subTotal - discountAmt));
    
    const bill = {
      ...rawBill,
      date: rawBill.created_at || rawBill.date || new Date().toISOString(),
      paymentMode: rawBill.payment_method || rawBill.paymentMode || 'Cash',
      totalAmount: subTotal,
      discount: discountAmt,
      paidAmount: totalPaid,
      items: itemsList.map((item: any) => ({
        description: item.item_name || item.name || item.description || 'Service/Medicine',
        category: item.category || 'General',
        amount: Number(item.unit_price || item.total_price || item.amount || 0)
      }))
    };

    const patient = patientObj;
    const printWindow = window.open('', '_blank', 'width=800,height=600');
    if (!printWindow) {
      toast.error('Please allow popups to print invoice');
      return;
    }

    const invoiceHtml = `
      <html>
        <head>
          <title>Invoice - ${bill.id}</title>
          <style>
            @page { margin: 15mm; size: A4; }
            body { 
              font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; 
              margin: 0; 
              padding: 0;
              color: #1e293b;
              line-height: 1.6;
              -webkit-print-color-adjust: exact;
            }
            .template-bg {
              position: fixed;
              top: 0;
              left: 0;
              width: 100%;
              height: 100%;
              z-index: -100;
              opacity: 0.1;
            }
            .content { 
              position: relative;
              padding-top: ${templateImage ? '240px' : '20px'}; 
              margin: 0 30px;
              z-index: 10;
            }
            .hospital-header {
              text-align: center;
              margin-bottom: 40px;
              display: ${templateImage ? 'none' : 'block'};
              border-bottom: 2px solid #2563eb;
              padding-bottom: 20px;
            }
            .hospital-name { font-size: 32px; font-weight: 800; color: #2563eb; letter-spacing: -0.025em; margin-bottom: 5px; }
            
            .bill-title { 
              text-align: center; 
              font-size: 24px; 
              font-weight: 800; 
              margin: 30px 0; 
              color: #0f172a; 
              text-transform: uppercase;
              letter-spacing: 0.1em;
            }
            .info-grid { 
              border: 1px solid #e2e8f0;
              border-radius: 12px;
              padding: 24px;
              margin-bottom: 40px;
              display: grid;
              grid-template-columns: 1fr 1fr;
              gap: 30px;
              background-color: #f8fafc;
            }
            .info-label { color: #64748b; font-weight: 700; text-transform: uppercase; font-size: 10px; margin-bottom: 6px; display: block; letter-spacing: 0.05em; }
            .info-value { font-weight: 800; color: #0f172a; font-size: 15px; }
            
            .invoice-table { width: 100%; border-collapse: collapse; margin-bottom: 40px; }
            .invoice-table th { 
              text-align: left; 
              background-color: #f1f5f9;
              padding: 15px; 
              color: #475569; 
              font-size: 11px; 
              text-transform: uppercase; 
              font-weight: 800;
              border-bottom: 2px solid #cbd5e1;
            }
            .invoice-table td { padding: 18px 15px; border-bottom: 1px solid #e2e8f0; font-size: 14px; }
            .service-desc { font-weight: 800; color: #1e293b; font-size: 15px; }
            .service-cat { font-size: 10px; color: #64748b; text-transform: uppercase; font-weight: 700; margin-top: 4px; }
            
            .total-card {
              margin-left: auto;
              width: 320px;
              padding: 24px;
              background-color: #f8fafc;
              border-radius: 12px;
              border: 1px solid #e2e8f0;
              page-break-inside: avoid;
            }
            .total-row { display: flex; justify-content: space-between; margin-bottom: 10px; font-size: 15px; }
            .grand-total { 
              border-top: 2px solid #2563eb; 
              margin-top: 20px; 
              padding-top: 20px; 
              font-weight: 800; 
              font-size: 22px; 
              color: #2563eb; 
            }
            
            .footer { 
              margin-top: 100px; 
              text-align: center;
              padding-bottom: 40px;
              page-break-inside: avoid;
            }
            .sig-section { display: flex; justify-content: space-between; margin-top: 80px; }
            .sig-box { width: 220px; text-align: center; }
            .sig-line { border-top: 2px solid #0f172a; margin-bottom: 10px; }
            .sig-label { font-size: 13px; font-weight: 800; color: #475569; text-transform: uppercase; }
          </style>
        </head>
        <body>
          ${templateImage ? `<div class="template-bg"><img src="${templateImage}" style="width: 100%;" /></div>` : ''}
          <div class="content">
            <div class="hospital-header">
              ${hospitalInfo.logo ? `<img src="${hospitalInfo.logo}" style="height: 60px; margin-bottom: 10px;" />` : ''}
              <div class="hospital-name">${hospitalInfo.name}</div>
              <div style="font-size: 11px; color: #64748b;">${hospitalInfo.address} | Tel: ${hospitalInfo.phone}</div>
            </div>

            <div class="bill-title">Consolidated Bill / Tax Invoice</div>

            <div class="info-grid">
              <div>
                <span class="info-label">Patient Details:</span>
                <div class="info-value" style="font-size: 18px;">${patient?.name || 'Walk-in Patient'}</div>
                <div class="info-value" style="color: #64748b; font-weight: 600;">MRN: ${patient?.mrn || 'N/A'}</div>
                <div class="info-value" style="color: #64748b; font-weight: 600;">Phone: ${patient?.phone || 'N/A'}</div>
              </div>
              <div style="text-align: right;">
                <span class="info-label">Invoice Details:</span>
                <div class="info-value">Inv No: #${bill.id.toUpperCase()}</div>
                <div class="info-value">Date: ${formatDate(bill.date)}</div>
                <div class="info-value" style="color: #059669; font-weight: 800;">Status: ${bill.status}</div>
              </div>
            </div>

            <table class="invoice-table">
              <thead>
                <tr>
                  <th style="width: 70%;">Service Description</th>
                  <th style="text-align: right;">Amount</th>
                </tr>
              </thead>
              <tbody>
                ${bill.items.map((item: any) => `
                  <tr>
                    <td>
                      <div class="service-desc">${item.description}</div>
                      <div class="service-cat">Category: ${item.category}</div>
                    </td>
                    <td style="text-align: right; font-weight: 700;">${formatCurrency(item.amount)}</td>
                  </tr>
                `).join('')}
              </tbody>
            </table>

            <div class="total-card">
              <div class="total-row"><span>Sub-Total:</span> <span>${formatCurrency(bill.totalAmount)}</span></div>
              <div class="total-row"><span>Discount:</span> <span>${formatCurrency(bill.discount || 0)}</span></div>
              <div class="total-row grand-total"><span>Total Amount:</span> <span>${formatCurrency(bill.paidAmount || (bill.totalAmount - (bill.discount || 0)))}</span></div>
            </div>

            <div style="margin-top: 30px; font-size: 13px; color: #475569;">
              <strong>Payment Mode:</strong> ${bill.paymentMode || 'Cash/UPI'}<br/>
              <strong>Notes:</strong> Please retain this invoice for your records.
            </div>

            <div class="sig-section">
              <div class="sig-box">
                <div class="sig-line"></div>
                <div class="sig-label">Receiver's Signature</div>
              </div>
              <div class="sig-box">
                <div class="sig-line"></div>
                <div class="sig-label">Authorized Signatory</div>
              </div>
            </div>

            <div class="footer">
              <div style="color: #94a3b8; font-size: 11px;">This is an electronically generated document. No physical signature required.</div>
              <div style="font-weight: 700; color: #2563eb; margin-top: 10px;">medinex HMS - HEALING HANDS, CARING HEARTS</div>
            </div>
          </div>
          
          <script>
            window.onload = () => {
              window.print();
              setTimeout(() => window.close(), 700);
            };
          </script>
        </body>
      </html>
    `;

    printWindow.document.write(invoiceHtml);
    printWindow.document.close();
  };

  const printConsolidatedStatement = (patient: any, conBills: any[]) => {
    const printWindow = window.open('', '_blank', 'width=850,height=750');
    if (!printWindow) {
      toast.error('Please allow popups to print');
      return;
    }

    const itemsByDate: Record<string, any[]> = {};
    let grandTotal = 0;
    let grandDiscount = 0;
    let grandPaid = 0;

    conBills.forEach(b => {
      const dateKey = formatDate(b.created_at || b.date);
      if (!itemsByDate[dateKey]) itemsByDate[dateKey] = [];
      
      const billItems = b.invoice_items || b.items || [];
      billItems.forEach((it: any) => {
        const desc = it.item_name || it.description || 'Service/Medicine';
        const amt = Number(it.unit_price || it.amount || it.total_price || 0);
        const cat = it.category || 'General';
        itemsByDate[dateKey].push({ description: desc, amount: amt, category: cat, source: b.type || 'Hospital Bill' });
      });

      grandTotal += Number(b.total_amount || b.totalAmount || b.total || 0);
      grandDiscount += Number(b.discount_amount || b.discount || 0);
      grandPaid += Number(b.paid_amount || b.paidAmount || 0);
    });

    const consolidatedHtml = `
      <html>
        <head>
          <title>Consolidated Statement - ${patient?.name}</title>
          <style>
            @page { margin: 15mm; size: A4; }
            body { 
              font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; 
              margin: 0; 
              padding: 0;
              color: #1e293b;
              line-height: 1.6;
              -webkit-print-color-adjust: exact;
            }
            .content { 
              padding: 20px; 
              margin: 0 30px;
            }
            .hospital-header {
              text-align: center;
              margin-bottom: 30px;
              border-bottom: 2px solid #0f172a;
              padding-bottom: 20px;
            }
            .hospital-name { font-size: 28px; font-weight: 800; color: #1e3a8a; margin-bottom: 5px; }
            .bill-title { 
              text-align: center; 
              font-size: 20px; 
              font-weight: 800; 
              margin: 20px 0; 
              color: #0f172a; 
              text-transform: uppercase;
              letter-spacing: 0.1em;
            }
            .patient-info { 
              border: 1px solid #cbd5e1;
              border-radius: 8px;
              padding: 15px;
              margin-bottom: 30px;
              display: grid;
              grid-template-columns: 1fr 1fr;
              gap: 20px;
              background-color: #f8fafc;
            }
            .info-label { color: #64748b; font-weight: 700; text-transform: uppercase; font-size: 11px; }
            .info-value { font-weight: 800; color: #0f172a; font-size: 13px; }
            
            .date-header {
              background-color: #f1f5f9;
              padding: 8px 12px;
              font-weight: 800;
              color: #1e293b;
              font-size: 13px;
              border-left: 4px solid #1e3a8a;
              margin-top: 25px;
              margin-bottom: 10px;
              display: flex;
              justify-content: space-between;
            }
            .invoice-table { width: 100%; border-collapse: collapse; margin-bottom: 15px; }
            .invoice-table th { 
              text-align: left; 
              background-color: #f8fafc;
              padding: 8px 12px; 
              color: #475569; 
              font-size: 11px; 
              text-transform: uppercase; 
              font-weight: 800;
              border-bottom: 1px solid #e2e8f0;
            }
            .invoice-table td { padding: 10px 12px; border-bottom: 1px solid #f1f5f9; font-size: 12px; }
            .service-desc { font-weight: 700; color: #1e293b; }
            .service-cat { font-size: 9px; color: #64748b; text-transform: uppercase; font-weight: 700; margin-top: 2px; }
            
            .summary-section {
              margin-top: 40px;
              display: flex;
              justify-content: flex-end;
              page-break-inside: avoid;
            }
            .total-card {
              width: 320px;
              padding: 20px;
              background-color: #f8fafc;
              border-radius: 8px;
              border: 1px solid #cbd5e1;
            }
            .total-row { display: flex; justify-content: space-between; margin-bottom: 8px; font-size: 14px; }
            .grand-total { 
              border-top: 2px solid #1e3a8a; 
              margin-top: 15px; 
              padding-top: 15px; 
              font-weight: 800; 
              font-size: 18px; 
              color: #1e3a8a; 
            }
            .sig-section { display: flex; justify-content: space-between; margin-top: 60px; page-break-inside: avoid; }
            .sig-box { width: 220px; text-align: center; }
            .sig-line { border-top: 2px solid #0f172a; margin-bottom: 8px; }
            .sig-label { font-size: 12px; font-weight: 800; color: #475569; text-transform: uppercase; }
          </style>
        </head>
        <body>
          <div class="content">
            <div class="hospital-header">
              ${hospitalInfo.logo ? `<img src="${hospitalInfo.logo}" style="height: 55px; margin-bottom: 10px;" />` : ''}
              <div class="hospital-name">${hospitalInfo.name}</div>
              <div style="font-size: 11px; color: #64748b;">${hospitalInfo.address} | Tel: ${hospitalInfo.phone}</div>
            </div>

            <div class="bill-title">Patient Consolidated Statement</div>

            <div class="patient-info">
              <div>
                <div><span class="info-label">Patient Name:</span> <span class="info-value">${patient?.name}</span></div>
                <div style="margin-top: 5px;"><span class="info-label">MRN:</span> <span class="info-value">${patient?.mrn || 'N/A'}</span></div>
                <div style="margin-top: 5px;"><span class="info-label">Gender / Age:</span> <span class="info-value">${patient?.gender || 'N/A'} / ${patient?.age || 'N/A'} Years</span></div>
              </div>
              <div style="text-align: right;">
                <div><span class="info-label">Statement Date:</span> <span class="info-value">${formatDate(new Date().toISOString())}</span></div>
                <div style="margin-top: 5px;"><span class="info-label">Contact:</span> <span class="info-value">${patient?.phone || 'N/A'}</span></div>
                <div style="margin-top: 5px;"><span class="info-label">Total Invoices:</span> <span class="info-value">${conBills.length}</span></div>
              </div>
            </div>

            ${Object.entries(itemsByDate).map(([dateStr, items]) => `
              <div class="date-header">
                <span>Date: ${dateStr}</span>
                <span style="font-size: 11px; opacity: 0.8;">${items.length} Charge Item(s)</span>
              </div>
              <table class="invoice-table">
                <thead>
                  <tr>
                    <th style="width: 50%;">Service / Item Description</th>
                    <th style="width: 25%;">Department/Category</th>
                    <th style="text-align: right; width: 25%;">Amount</th>
                  </tr>
                </thead>
                <tbody>
                  ${items.map(item => `
                    <tr>
                      <td>
                        <div class="service-desc">${item.description}</div>
                      </td>
                      <td>
                        <div class="service-cat">${item.category} (${item.source})</div>
                      </td>
                      <td style="text-align: right; font-weight: 700;">${formatCurrency(item.amount)}</td>
                    </tr>
                  `).join('')}
                </tbody>
              </table>
            `).join('')}

            <div class="summary-section">
              <div class="total-card">
                <div class="total-row"><span>Consolidated Sub-Total:</span> <span>${formatCurrency(grandTotal)}</span></div>
                <div class="total-row"><span>Consolidated Discount:</span> <span>${formatCurrency(grandDiscount)}</span></div>
                <div class="total-row grand-total"><span>Total Paid Amount:</span> <span>${formatCurrency(grandPaid)}</span></div>
              </div>
            </div>

            <div class="sig-section">
              <div class="sig-box">
                <div class="sig-line"></div>
                <div class="sig-label">Receiver / Patient Sign</div>
              </div>
              <div class="sig-box">
                <div class="sig-line"></div>
                <div class="sig-label">Authorized Signatory</div>
              </div>
            </div>

            <div style="text-align: center; margin-top: 60px; color: #94a3b8; font-size: 11px; border-top: 1px solid #e2e8f0; padding-top: 15px;">
              This is a consolidated account summary generated dynamically. 
            </div>
          </div>
          
          <script>
            window.onload = () => {
              window.print();
              setTimeout(() => window.close(), 1000);
            };
          </script>
        </body>
      </html>
    `;

    printWindow.document.write(consolidatedHtml);
    printWindow.document.close();
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <Loader2 className="w-8 h-8 animate-spin text-medical-blue" />
        <span className="ml-2">Loading Billing Data...</span>
      </div>
    );
  }

  const totalHospitalRevenue = bills.reduce((sum, b) => sum + (Number(b.paid_amount) || 0), 0);
  const mainOfficeCollection = bills.filter(b => b.type !== 'Pharmacy' && b.type !== 'Lab').reduce((sum, b) => sum + (Number(b.paid_amount) || 0), 0);
  const pharmacyRevenue = bills.filter(b => b.type === 'Pharmacy' || b.invoice_items?.some((i: any) => i.category === 'PHARMACY')).reduce((sum, b) => sum + (Number(b.paid_amount) || 0), 0);
  const labRevenue = bills.filter(b => b.type === 'Lab' || b.invoice_items?.some((i: any) => ['LAB', 'PATH', 'RADIO'].includes(i.category.toUpperCase()))).reduce((sum, b) => sum + (Number(b.paid_amount) || 0), 0);

  return (
    <div className="p-6 space-y-6">
      {/* Dynamic, Vibrant, Richly Colored Banner Header */}
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-emerald-600 via-teal-700 to-green-600 text-white p-6 sm:p-8 shadow-xl shadow-emerald-100 animate-in fade-in duration-500">
        <div className="absolute top-0 right-0 -mr-16 -mt-16 w-80 h-80 rounded-full bg-white/10 blur-3xl pointer-events-none"></div>
        <div className="absolute bottom-0 left-0 -ml-20 -mb-20 w-80 h-80 rounded-full bg-emerald-400/20 blur-3xl pointer-events-none"></div>
        
        <div className="relative flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="space-y-2">
            <span className="text-[10px] font-black tracking-widest bg-white/20 text-white px-3 py-1 rounded-full uppercase my-1 select-none w-fit">
              ★ CENTRAL ACCOUNT OFFICE ONLINE
            </span>
            <h1 className="text-3xl font-extrabold tracking-tight md:text-4xl text-white">
              Billing & Revenue
            </h1>
            <p className="text-emerald-50 text-sm font-medium max-w-xl">
              Main hospital ledger auditing for OPD, IPD, and OT. Monitoring real-time pharmacy sales and laboratory diagnostics collections.
            </p>
          </div>
          
          <div className="flex flex-wrap items-center gap-3 bg-white/10 backdrop-blur-md p-3 rounded-2xl border border-white/10 shadow-inner">
            <Button variant="outline" className="gap-2 bg-white/10 text-white border-white/20 hover:bg-white hover:text-emerald-900 rounded-xl font-bold h-10" onClick={handleExportBilling}>
              <Download className="w-4 h-4" />
              Export
            </Button>
            <Button 
              className="bg-white text-emerald-900 hover:bg-emerald-50 gap-2 rounded-xl font-black h-10 shadow-md"
              onClick={() => setIsHistoryOpen(true)}
            >
              <History className="w-4 h-4" />
              Day History
            </Button>
          </div>
        </div>
      </div>

      <Dialog open={isHistoryOpen} onOpenChange={setIsHistoryOpen}>
        <DialogContent className="sm:max-w-[700px] h-[80vh] flex flex-col p-0">
              <DialogHeader className="p-6 border-b">
                <DialogTitle>Daily Transaction History</DialogTitle>
                <DialogDescription>Viewing all transactions grouped by date.</DialogDescription>
              </DialogHeader>
              <ScrollArea className="flex-1 p-6">
                <div className="space-y-8">
                  {Object.entries(groupedBillsByDate).sort((a, b) => new Date(b[0]).getTime() - new Date(a[0]).getTime()).map(([dateKey, dayBills]) => {
                    const typedDayBills = dayBills as any[];
                    return (
                    <div key={dateKey} className="space-y-4">
                      <div className="flex items-center gap-2">
                        <Badge className="bg-medical-blue">{formatDate(dateKey)}</Badge>
                        <Separator className="flex-1" />
                        <span className="text-xs font-bold text-muted-foreground">
                          {typedDayBills.length} Transactions | {formatCurrency(typedDayBills.reduce((sum, b) => sum + (Number(b.total_amount) || 0), 0))}
                        </span>
                      </div>
                      <div className="space-y-2">
                        {typedDayBills.map((bill) => {
                          const patient = patients.find(p => p.id === bill.patient_id);
                          return (
                            <div key={bill.id} className="flex items-center justify-between p-3 rounded-lg border border-slate-100 bg-slate-50/50 hover:bg-slate-50 transition-colors">
                              <div className="flex items-center gap-4">
                                <div className="text-xs font-bold text-medical-blue">#{bill.id.split('-')[1]?.substring(0, 6) || bill.id.substring(bill.id.length-6)}</div>
                                <div>
                                  <p className="text-sm font-semibold">{patient?.name}</p>
                                  <p className="text-[10px] text-muted-foreground uppercase">{bill.invoice_items?.[0]?.category || 'General'} Charge</p>
                                </div>
                              </div>
                              <div className="text-right">
                                <p className="text-sm font-bold">{formatCurrency(bill.total_amount)}</p>
                                <Badge variant="outline" className="text-[8px] h-4">{bill.payment_method}</Badge>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  );
                  })}
                </div>
              </ScrollArea>
              <DialogFooter className="p-6 border-t">
                <DialogTrigger asChild>
                  <Button variant="outline">Close</Button>
                </DialogTrigger>
              </DialogFooter>
            </DialogContent>
          </Dialog>
          <Dialog open={isInvoiceOpen} onOpenChange={(open) => {
            setIsInvoiceOpen(open);
            if (!open) {
              setPatientSearchTerm('');
              setShowPatientResults(false);
            }
          }}>
            <DialogTrigger asChild>
              <Button className="bg-medical-blue gap-2" onClick={() => setIsInvoiceOpen(true)}>
                <Plus className="w-4 h-4" />
                Create New Invoice
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[600px]">
              <DialogHeader>
                <DialogTitle>Independent Billing & Invoicing</DialogTitle>
                <DialogDescription>Add multiple services and items to create a manual invoice.</DialogDescription>
              </DialogHeader>
              <div className="space-y-4 py-4 max-h-[70vh] overflow-y-auto pr-2 custom-scrollbar">
                <div className="space-y-2 relative">
                  <Label>Select Patient (Search by Name or Phone)</Label>
                  <div className="relative">
                    <Input 
                      placeholder="Start typing name or phone..." 
                      value={patientSearchTerm}
                      onChange={(e) => {
                        setPatientSearchTerm(e.target.value);
                        setShowPatientResults(true);
                        if (e.target.value === '') {
                          setNewInvoice({...newInvoice, patientId: ''});
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
                              setNewInvoice({...newInvoice, patientId: p.id});
                              setPatientSearchTerm(p.name);
                              setShowPatientResults(false);
                            }}
                          >
                            <div>
                              <p className="text-sm font-medium">{p.name}</p>
                              <p className="text-[10px] text-muted-foreground">{p.phone} • MRN: {p.mrn}</p>
                            </div>
                            {newInvoice.patientId === p.id && <CheckCircle2 className="w-4 h-4 text-medical-blue" />}
                          </div>
                        ))
                      ) : (
                        <div className="px-4 py-4 text-center text-sm text-muted-foreground">
                          No patients found.
                        </div>
                      )}
                    </div>
                  )}
                  
                  {newInvoice.patientId && (
                    <div className="p-3 bg-blue-50 rounded-lg border border-blue-100 flex flex-col gap-1 mt-2 animate-in fade-in slide-in-from-top-1 text-[11px]">
                      {(() => {
                        const p = patients.find(pat => pat.id === newInvoice.patientId);
                        const doctor = users.find(u => u.id === p?.attendingDoctorId);
                        return (
                          <>
                            <div className="flex justify-between items-center">
                              <span className="font-bold text-blue-500 uppercase tracking-wider">Patient Details</span>
                              <Badge variant="outline" className="text-[8px] border-blue-200 text-blue-600">{doctor?.department || 'General'}</Badge>
                            </div>
                            <p className="font-bold text-blue-900 text-[13px]">{p?.name}</p>
                            <div className="flex gap-4 text-blue-700 font-medium">
                              <span>Ph: {p?.phone}</span>
                              <span>MRN: {p?.mrn}</span>
                            </div>
                          </>
                        );
                      })()}
                    </div>
                  )}
                </div>

                <Separator />
                
                <div className="bg-slate-50 p-4 rounded-xl space-y-4 border border-slate-100">
                  <p className="text-[10px] font-bold uppercase text-slate-400 tracking-wider">Add Service / Item</p>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1.5">
                      <Label className="text-xs">Category</Label>
                      <Select value={currentItem.category} onValueChange={handleCategoryChange}>
                        <SelectTrigger className="h-8">
                          <SelectValue placeholder="Select" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="opd">OPD Consultation</SelectItem>
                          <SelectItem value="ipd">IPD / Ward</SelectItem>
                          <SelectItem value="ot">Surgery / OT</SelectItem>
                          <SelectItem value="lab">Pathology / Lab</SelectItem>
                          <SelectItem value="radio">Radiology</SelectItem>
                          <SelectItem value="materials">Materials / Disposables</SelectItem>
                          <SelectItem value="pharmacy">Pharmacy</SelectItem>
                          <SelectItem value="custom">Custom / Manual Entry</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    {currentItem.category && (
                      <div className="space-y-1.5 animate-in fade-in zoom-in-95">
                        <Label className="text-xs">Service / Item</Label>
                        <Select value={currentItem.subType} onValueChange={handleSubTypeChange}>
                          <SelectTrigger className="h-8">
                            <SelectValue placeholder="Select" />
                          </SelectTrigger>
                          <SelectContent>
                            {currentItem.category === 'ot' && otRates.map((r: any) => <SelectItem key={r.type} value={r.type}>{r.type} Surgery</SelectItem>)}
                            {currentItem.category === 'ipd' && bedRates.map((r: any) => <SelectItem key={r.type} value={r.type}>{r.type} Bed</SelectItem>)}
                            {(currentItem.category === 'lab' || currentItem.category === 'path') && labRates.filter((t: any) => t.category === 'Pathology').map((t: any) => <SelectItem key={t.name} value={t.name}>{t.name}</SelectItem>)}
                            {currentItem.category === 'radio' && labRates.filter((t: any) => t.category === 'Radiology').map((t: any) => <SelectItem key={t.name} value={t.name}>{t.name}</SelectItem>)}
                            {currentItem.category === 'materials' && materialRates.map((t: any) => <SelectItem key={t.name} value={t.name}>{t.name}</SelectItem>)}
                            {currentItem.category === 'opd' && <SelectItem value="OPD Consultation">Standard OPD</SelectItem>}
                            {currentItem.category === 'pharmacy' && <SelectItem value="Pharmacy Bill">Manual Pharma Entry</SelectItem>}
                          </SelectContent>
                        </Select>
                      </div>
                    )}
                  </div>

                  <div className="grid grid-cols-3 gap-3">
                    <div className="col-span-2 space-y-1.5">
                      <Label className="text-xs">Description</Label>
                      <Input 
                        className="h-8" 
                        value={currentItem.description} 
                        onChange={(e) => setCurrentItem({...currentItem, description: e.target.value})} 
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-xs">Rate (₹)</Label>
                      <Input 
                        type="number"
                        className="h-8" 
                        value={currentItem.amount} 
                        onChange={(e) => setCurrentItem({...currentItem, amount: e.target.value})} 
                      />
                    </div>
                  </div>
                  <Button className="w-full h-8 bg-slate-800 text-xs" onClick={handleAddItem}>Add to Invoice</Button>
                </div>

                {invoiceItems.length > 0 && (
                  <div className="space-y-2">
                    <p className="text-[10px] font-bold uppercase text-slate-400 tracking-wider">Invoice Items</p>
                    <div className="space-y-2">
                      {invoiceItems.map((item, idx) => (
                        <div key={idx} className="flex items-center justify-between p-2 bg-white border border-slate-100 rounded-lg text-xs">
                          <div className="flex-1">
                            <span className="font-bold">{item.description}</span>
                            <Badge variant="secondary" className="ml-2 text-[8px] h-3 uppercase">{item.category}</Badge>
                          </div>
                          <div className="flex items-center gap-3">
                            <span className="font-bold">₹{item.amount}</span>
                            <Button variant="ghost" size="icon" className="h-5 w-5 text-rose-500" onClick={() => removeItem(idx)}>
                              <Trash2 className="w-3.5 h-3.5" />
                            </Button>
                          </div>
                        </div>
                      ))}
                    </div>
                    <div className="flex justify-between items-center p-3 bg-medical-blue/5 rounded-xl border border-medical-blue/10">
                      <div className="flex flex-col">
                        <span className="text-[10px] font-bold text-slate-400 uppercase">Subtotal: ₹{totalInvoiceAmount}</span>
                        <span className="text-sm font-bold text-medical-blue uppercase tracking-wider">Final Amount</span>
                      </div>
                      <span className="text-lg font-bold text-medical-blue">₹{finalAmount}</span>
                    </div>
                  </div>
                )}

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Discount (₹)</Label>
                    <Input 
                      type="number" 
                      placeholder="0"
                      value={newInvoice.discount}
                      onChange={(e) => setNewInvoice({...newInvoice, discount: parseInt(e.target.value) || 0})}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Payment Mode</Label>
                    <Select value={newInvoice.paymentMode} onValueChange={(v) => setNewInvoice({...newInvoice, paymentMode: v})}>
                      <SelectTrigger>
                        <SelectValue placeholder="Select mode" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="Cash">Cash</SelectItem>
                        <SelectItem value="UPI">UPI / QR</SelectItem>
                        <SelectItem value="Card">Credit/Debit Card</SelectItem>
                        <SelectItem value="Insurance">Insurance</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </div>
              <DialogFooter>
                <DialogTrigger asChild>
                  <Button variant="outline" onClick={() => { 
                    setInvoiceItems([]); 
                    setNewInvoice({ patientId: '', paymentMode: 'Cash' }); 
                    setPatientSearchTerm('');
                    setShowPatientResults(false);
                    setIsInvoiceOpen(false);
                  }}>Discard</Button>
                </DialogTrigger>
                <Button className="bg-medical-blue" onClick={handleCreateInvoice} disabled={invoiceItems.length === 0}>Generate Bill</Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>

          {/* Edit Invoice Dialog */}
          <Dialog open={isEditOpen} onOpenChange={setIsEditOpen}>
            <DialogContent className="sm:max-w-[600px]">
              <DialogHeader>
                <DialogTitle>Edit Invoice #{editingBill?.id.split('-')[1]?.substring(0, 6)}</DialogTitle>
                <DialogDescription>Modify services and items for this existing invoice.</DialogDescription>
              </DialogHeader>
              <div className="space-y-4 py-4 max-h-[70vh] overflow-y-auto pr-2 custom-scrollbar">
                <div className="p-3 bg-slate-50 rounded-lg border border-slate-200">
                  <p className="text-xs font-bold text-slate-500 uppercase">Patient</p>
                  <p className="text-sm font-bold">{patients.find(p => p.id === editingBill?.patientId)?.name}</p>
                </div>

                <div className="bg-slate-50 p-4 rounded-xl space-y-4 border border-slate-100">
                  <p className="text-[10px] font-bold uppercase text-slate-400 tracking-wider">Add/Modify Service</p>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1.5">
                      <Label className="text-xs">Category</Label>
                      <Select value={currentItem.category} onValueChange={handleCategoryChange}>
                        <SelectTrigger className="h-8">
                          <SelectValue placeholder="Select" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="opd">OPD Consultation</SelectItem>
                          <SelectItem value="ipd">IPD / Ward</SelectItem>
                          <SelectItem value="ot">Surgery / OT</SelectItem>
                          <SelectItem value="lab">Pathology / Lab</SelectItem>
                          <SelectItem value="radio">Radiology</SelectItem>
                          <SelectItem value="materials">Materials / Disposables</SelectItem>
                          <SelectItem value="pharmacy">Pharmacy</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    {currentItem.category && (
                      <div className="space-y-1.5 animate-in fade-in zoom-in-95">
                        <Label className="text-xs">Service / Item</Label>
                        <Select value={currentItem.subType} onValueChange={handleSubTypeChange}>
                          <SelectTrigger className="h-8">
                            <SelectValue placeholder="Select" />
                          </SelectTrigger>
                          <SelectContent>
                            {currentItem.category === 'ot' && otRates.map((r: any) => <SelectItem key={r.type} value={r.type}>{r.type} Surgery</SelectItem>)}
                            {currentItem.category === 'ipd' && bedRates.map((r: any) => <SelectItem key={r.type} value={r.type}>{r.type} Bed</SelectItem>)}
                            {(currentItem.category === 'lab' || currentItem.category === 'path') && labRates.filter((t: any) => t.category === 'Pathology').map((t: any) => <SelectItem key={t.name} value={t.name}>{t.name}</SelectItem>)}
                            {currentItem.category === 'radio' && labRates.filter((t: any) => t.category === 'Radiology').map((t: any) => <SelectItem key={t.name} value={t.name}>{t.name}</SelectItem>)}
                            {currentItem.category === 'materials' && materialRates.map((t: any) => <SelectItem key={t.name} value={t.name}>{t.name}</SelectItem>)}
                            {currentItem.category === 'opd' && <SelectItem value="OPD Consultation">Standard OPD</SelectItem>}
                            {currentItem.category === 'pharmacy' && <SelectItem value="Pharmacy Bill">Manual Pharma Entry</SelectItem>}
                          </SelectContent>
                        </Select>
                      </div>
                    )}
                  </div>

                  <div className="grid grid-cols-3 gap-3">
                    <div className="col-span-2 space-y-1.5">
                      <Label className="text-xs">Description</Label>
                      <Input 
                        className="h-8" 
                        value={currentItem.description} 
                        onChange={(e) => setCurrentItem({...currentItem, description: e.target.value})} 
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-xs">Rate (₹)</Label>
                      <Input 
                        type="number"
                        className="h-8" 
                        value={currentItem.amount} 
                        onChange={(e) => setCurrentItem({...currentItem, amount: e.target.value})} 
                      />
                    </div>
                  </div>
                  <Button className="w-full h-8 bg-slate-800 text-xs" onClick={handleAddItem}>Add to List</Button>
                </div>

                {invoiceItems.length > 0 && (
                  <div className="space-y-2">
                    <p className="text-[10px] font-bold uppercase text-slate-400 tracking-wider">Current Items</p>
                    <div className="space-y-2">
                      {invoiceItems.map((item, idx) => (
                        <div key={idx} className="flex items-center justify-between p-2 bg-white border border-slate-100 rounded-lg text-xs">
                          <div className="flex-1">
                            <span className="font-bold">{item.description}</span>
                            <Badge variant="secondary" className="ml-2 text-[8px] h-3 uppercase">{item.category}</Badge>
                          </div>
                          <div className="flex items-center gap-3">
                            <span className="font-bold">₹{item.amount}</span>
                            <Button variant="ghost" size="icon" className="h-5 w-5 text-rose-500" onClick={() => removeItem(idx)}>
                              <Trash2 className="w-3.5 h-3.5" />
                            </Button>
                          </div>
                        </div>
                      ))}
                    </div>
                    <div className="flex justify-between items-center p-3 bg-medical-blue/5 rounded-xl border border-medical-blue/10">
                      <div className="flex flex-col">
                        <span className="text-[10px] font-bold text-slate-400 uppercase">Subtotal: ₹{totalInvoiceAmount}</span>
                        <span className="text-sm font-bold text-medical-blue uppercase tracking-wider">Final Amount</span>
                      </div>
                      <span className="text-lg font-bold text-medical-blue">₹{finalEditAmount}</span>
                    </div>
                  </div>
                )}

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <Label className="text-xs">Discount (₹)</Label>
                    <Input 
                      type="number"
                      className="h-8 text-xs" 
                      value={editingBill?.discount} 
                      onChange={(e) => setEditingBill({...editingBill, discount: parseInt(e.target.value) || 0})} 
                    />
                  </div>
                  <div className="space-y-2 text-xs">
                    <Label>Change Payment Mode</Label>
                    <Select value={editingBill?.paymentMode} onValueChange={(v) => setEditingBill({...editingBill, paymentMode: v})}>
                      <SelectTrigger className="h-8">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="Cash">Cash</SelectItem>
                        <SelectItem value="UPI">UPI / QR</SelectItem>
                        <SelectItem value="Card">Credit/Debit Card</SelectItem>
                        <SelectItem value="Insurance">Insurance</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setIsEditOpen(false)}>Cancel</Button>
                <Button className="bg-medical-blue" onClick={handleUpdateInvoice}>Save Changes</Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card className="border-none shadow-sm bg-medical-blue/5">
          <CardContent className="p-6">
            <p className="text-xs text-muted-foreground font-bold uppercase tracking-wider mb-1">Total Hospital Revenue</p>
            <h3 className="text-2xl font-bold text-medical-blue">{formatCurrency(totalHospitalRevenue)}</h3>
            <p className="text-[10px] text-muted-foreground mt-1">Aggregated from all departments</p>
          </CardContent>
        </Card>
        <Card className="border-none shadow-sm">
          <CardContent className="p-6">
            <p className="text-xs text-muted-foreground font-bold uppercase tracking-wider mb-1">Main Office Collection</p>
            <h3 className="text-2xl font-bold text-emerald-600">{formatCurrency(mainOfficeCollection)}</h3>
            <p className="text-[10px] text-muted-foreground mt-1">OPD, IPD, OT Services</p>
          </CardContent>
        </Card>
        <Card className="border-none shadow-sm">
          <CardContent className="p-6">
            <p className="text-xs text-muted-foreground font-bold uppercase tracking-wider mb-1">Pharmacy Revenue</p>
            <h3 className="text-2xl font-bold text-teal-600">{formatCurrency(pharmacyRevenue)}</h3>
            <p className="text-[10px] text-muted-foreground mt-1">Collected at Pharmacy POS</p>
          </CardContent>
        </Card>
        <Card className="border-none shadow-sm">
          <CardContent className="p-6">
            <p className="text-xs text-muted-foreground font-bold uppercase tracking-wider mb-1">Lab & Radiology</p>
            <h3 className="text-2xl font-bold text-purple-600">{formatCurrency(labRevenue)}</h3>
            <p className="text-[10px] text-muted-foreground mt-1">Collected at Lab Counter</p>
          </CardContent>
        </Card>
      </div>

      <div className="flex border-b border-slate-200 mt-6 select-none bg-white p-1 rounded-t-xl flex-wrap">
        <button
          className={`px-4 py-2.5 text-xs font-bold border-b-2 transition-all ${
            activeTab === 'recent' 
              ? 'border-medical-blue text-medical-blue font-black bg-blue-50/40 rounded-t-lg' 
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
          onClick={() => setActiveTab('recent')}
        >
          Recent Invoices
        </button>
        <button
          className={`px-4 py-2.5 text-xs font-bold border-b-2 transition-all ${
            activeTab === 'consolidated' 
              ? 'border-medical-blue text-medical-blue font-black bg-blue-50/40 rounded-t-lg' 
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
          onClick={() => setActiveTab('consolidated')}
        >
          Consolidated Patient Ledger
        </button>
        <button
          className={`px-4 py-2.5 text-xs font-bold border-b-2 transition-all ${
            activeTab === 'gst' 
              ? 'border-medical-blue text-medical-blue font-black bg-blue-50/40 rounded-t-lg' 
              : 'border-transparent text-slate-500 hover:text-gray-800'
          }`}
          onClick={() => setActiveTab('gst')}
        >
          GST & Tax Reports
        </button>
        <button
          className={`px-4 py-2.5 text-xs font-bold border-b-2 transition-all ${
            activeTab === 'claims' 
              ? 'border-medical-blue text-medical-blue font-black bg-blue-50/40 rounded-t-lg' 
              : 'border-transparent text-slate-500 hover:text-gray-800'
          }`}
          onClick={() => setActiveTab('claims')}
        >
          PM-JAY & Insurances Claims
        </button>
        <button
          className={`px-4 py-2.5 text-xs font-bold border-b-2 transition-all ${
            activeTab === 'refunds' 
              ? 'border-medical-blue text-medical-blue font-black bg-blue-50/40 rounded-t-lg' 
              : 'border-transparent text-slate-500 hover:text-gray-800'
          }`}
          onClick={() => setActiveTab('refunds')}
        >
          Refund Administration
        </button>
      </div>

      {activeTab === 'recent' && (
        <Card className="border-none shadow-sm rounded-t-none">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
            <CardTitle className="text-lg">Recent Invoices</CardTitle>
            <div className="flex items-center gap-2">
              <div className="relative w-64">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input 
                  placeholder="Search name, MRN, phone..." 
                  className="pl-10 bg-slate-50 border-none h-9" 
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
              </div>
              <Select value={filterCategory} onValueChange={setFilterCategory}>
                <SelectTrigger className="w-[140px] h-9 bg-white border-slate-200">
                  <div className="flex items-center gap-2">
                    <Filter className="w-3.5 h-3.5 text-muted-foreground" />
                    <SelectValue placeholder="Category" />
                  </div>
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Invoices</SelectItem>
                  <SelectItem value="opd">OPD Bills</SelectItem>
                  <SelectItem value="ipd">IPD Bills</SelectItem>
                  <SelectItem value="lab">Lab/Diagnostics</SelectItem>
                  <SelectItem value="radiology">Radiology</SelectItem>
                  <SelectItem value="pharmacy">Pharmacy Bills</SelectItem>
                  <SelectItem value="ot">OT Management</SelectItem>
                  <SelectItem value="insurance">Insurance Claims</SelectItem>
                  <SelectItem value="expenses">Facility Expenses</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            <div className="overflow-x-auto custom-scrollbar">
              <Table>
                <TableHeader>
                  <TableRow className="hover:bg-transparent border-slate-100 text-[11px] uppercase tracking-wider font-bold text-slate-500">
                    <TableHead className="whitespace-nowrap">Invoice ID</TableHead>
                    <TableHead className="whitespace-nowrap">Patient/Facility Details</TableHead>
                    <TableHead className="whitespace-nowrap">Department</TableHead>
                    <TableHead className="whitespace-nowrap">Contact Info / Description</TableHead>
                    <TableHead className="whitespace-nowrap">Date</TableHead>
                    <TableHead className="whitespace-nowrap">Amount</TableHead>
                    <TableHead className="whitespace-nowrap">Status</TableHead>
                    <TableHead className="whitespace-nowrap">Mode</TableHead>
                    <TableHead className="text-right whitespace-nowrap">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {(() => {
                    const displayedBills = filterCategory === 'expenses'
                      ? expenses
                          .filter(exp => 
                            (exp.category || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
                            (exp.description || '').toLowerCase().includes(searchQuery.toLowerCase())
                          )
                          .map(exp => ({
                            id: exp.id,
                            patients: { name: `Facility Expense`, mrn: exp.category, phone: `N/A`, email: exp.description },
                            type: 'Expense',
                            created_at: exp.expense_date || exp.created_at || new Date().toISOString(),
                            paid_amount: exp.amount,
                            total_amount: exp.amount,
                            status: exp.status || 'Paid',
                            payment_method: 'N/A',
                            isExpense: true,
                            created_by: exp.created_by,
                            rawExpense: exp
                          }))
                      : filteredBills;

                    return displayedBills.map((bill) => {
                      return (
                        <TableRow key={bill.id} className="border-slate-50 hover:bg-slate-50/50 transition-colors">
                          <TableCell className="font-bold text-medical-blue whitespace-nowrap">
                            {bill.id.startsWith('exp') || bill.id.startsWith('note-') ? bill.id.toUpperCase() : `#${bill.id.slice(0, 8).toUpperCase()}`}
                          </TableCell>
                          <TableCell className="whitespace-nowrap">
                            <div className="flex flex-col">
                              <span className="font-bold text-slate-800">{bill.patients?.name || 'Walk-in'}</span>
                              <span className="text-[10px] text-muted-foreground font-medium">{bill.patients?.mrn || 'N/A'}</span>
                            </div>
                          </TableCell>
                          <TableCell className="whitespace-nowrap">
                            <Badge variant="outline" className={`text-[10px] font-semibold border-blue-100 ${bill.isExpense ? 'bg-amber-50 text-amber-700 border-amber-200' : 'bg-blue-50 text-blue-700'}`}>
                              {bill.type || 'General'}
                            </Badge>
                          </TableCell>
                          <TableCell className="whitespace-nowrap">
                            <div className="flex flex-col text-[11px]">
                              <span className="text-slate-600 font-medium">{bill.patients?.phone || 'N/A'}</span>
                              <span className="text-slate-400 max-w-[200px] truncate">{bill.patients?.email || 'No description'}</span>
                            </div>
                          </TableCell>
                          <TableCell className="text-xs text-muted-foreground whitespace-nowrap">{formatDate(bill.created_at)}</TableCell>
                          <TableCell className="font-bold whitespace-nowrap">
                            <div className="flex flex-col">
                              <span>{formatCurrency(bill.paid_amount || bill.total_amount)}</span>
                              {(bill.discount_amount || 0) > 0 && <span className="text-[9px] text-rose-500 font-bold">-{formatCurrency(bill.discount_amount)} Disc.</span>}
                            </div>
                          </TableCell>
                          <TableCell className="whitespace-nowrap">
                            <Badge variant="secondary" className={`border-none ${
                              bill.status === 'Settled' || bill.status === 'Paid' ? 'bg-emerald-50 text-emerald-600' :
                              bill.status === 'Partial' ? 'bg-amber-50 text-amber-600' :
                              'bg-rose-50 text-rose-600'
                            }`}>
                              {bill.status === 'Settled' || bill.status === 'Paid' ? <CheckCircle2 className="w-3 h-3 mr-1" /> : 
                               bill.status === 'Partial' ? <Clock className="w-3 h-3 mr-1" /> : 
                               <AlertCircle className="w-3 h-3 mr-1" />}
                              {bill.status}
                            </Badge>
                          </TableCell>
                          <TableCell className="whitespace-nowrap">
                            <Badge variant="outline" className="text-[10px] font-bold uppercase">{bill.payment_method || 'N/A'}</Badge>
                          </TableCell>
                          <TableCell className="text-right">
                            <div className="flex justify-end gap-2 items-center">
                              {!bill.isExpense && (
                                <Button 
                                  variant="ghost" 
                                  size="icon" 
                                  className="h-8 w-8 text-medical-blue" 
                                  title={(!bill.patientId && !bill.patient_id) ? "No registered patient profile" : "Patient 360 Overview"} 
                                  onClick={() => {
                                    const pid = bill.patient_id || bill.patientId;
                                    if (!pid) {
                                      toast.error("This invoice belongs to a Walk-in patient. No registered patient profile exists.");
                                      return;
                                    }
                                    navigate(`/patient-overview?id=${pid}`);
                                  }}
                                >
                                  <Search className="w-4 h-4" />
                                </Button>
                              )}
                              {!bill.isExpense && (
                                <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => printInvoice(bill)}>
                                  <Printer className="w-4 h-4" />
                                </Button>
                              )}
                              {canModify(bill) ? (
                                <>
                                  <Button variant="ghost" size="icon" className="h-8 w-8 text-medical-blue" onClick={() => {
                                    if (bill.isExpense) {
                                      toast.info("Please navigate to the Expenses tab to edit facilities expenses.");
                                    } else {
                                      handleEditBill(bill);
                                    }
                                  }}>
                                    <Edit className="w-4 h-4" />
                                  </Button>
                                  <Button variant="ghost" size="icon" className="h-8 w-8 text-rose-500" onClick={async () => {
                                    if (bill.isExpense) {
                                      const ok = await supabaseService.deleteExpense(bill.id);
                                      if (ok) {
                                        toast.success("Expense record removed");
                                        fetchData();
                                      } else {
                                        toast.error("Failed to remove expense record");
                                      }
                                    } else {
                                      handleDeleteBill(bill.id);
                                    }
                                  }}>
                                    <Trash2 className="w-4 h-4" />
                                  </Button>
                                </>
                              ) : (
                                <Badge variant="secondary" className="text-[10px] text-slate-400 bg-slate-100 font-bold hover:bg-slate-100 select-none px-2 py-0.5">Admin Locked</Badge>
                              )}
                            </div>
                          </TableCell>
                        </TableRow>
                      );
                    });
                  })()}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      )}

      {activeTab === 'consolidated' && (
        <Card className="border-none shadow-sm rounded-t-none">
          <CardHeader>
            <CardTitle className="text-base font-bold text-slate-800">Select Patient for Consolidated Date-wise Statement</CardTitle>
            <CardDescription>Retrieve, review, and print combined bills of Pharmacy, Doctor Consultation, Lab tests, OT/Radiology, and Maternity on a single timeline.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="relative max-w-md space-y-2">
              <Label>Search Patient by Name, phone, or MRN ID</Label>
              <div className="relative border-none">
                <Input
                  placeholder="type patient details..."
                  className="pl-10"
                  value={conPatientSearch}
                  onChange={(e) => {
                    setConPatientSearch(e.target.value);
                    setShowConPatientResults(true);
                  }}
                  onFocus={() => setShowConPatientResults(true)}
                />
                <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                {conPatientSearch && (
                  <Button 
                    variant="ghost" 
                    size="icon" 
                    className="absolute right-2 top-1 h-8 w-8 text-slate-400" 
                    onClick={() => {
                      setConPatientSearch('');
                      setConPatientId('');
                    }}
                  >
                    ×
                  </Button>
                )}
              </div>

              {showConPatientResults && conPatientSearch.length > 0 && (
                <div className="absolute z-20 w-full mt-1 bg-white border border-slate-200 rounded-md shadow-lg max-h-[220px] overflow-y-auto custom-scrollbar">
                  {patients.filter(p => 
                    p.name.toLowerCase().includes(conPatientSearch.toLowerCase()) || 
                    (p.phone || '').includes(conPatientSearch) ||
                    (p.mrn || '').toLowerCase().includes(conPatientSearch.toLowerCase())
                  ).length > 0 ? (
                    patients.filter(p => 
                      p.name.toLowerCase().includes(conPatientSearch.toLowerCase()) || 
                      (p.phone || '').includes(conPatientSearch) ||
                      (p.mrn || '').toLowerCase().includes(conPatientSearch.toLowerCase())
                    ).map(p => (
                      <div 
                        key={p.id} 
                        className="px-4 py-2 hover:bg-slate-50 cursor-pointer flex justify-between items-center border-b border-slate-100 last:border-0 text-sm"
                        onClick={() => {
                          setConPatientId(p.id);
                          setConPatientSearch(p.name);
                          setShowConPatientResults(false);
                        }}
                      >
                        <div>
                          <p className="font-bold text-slate-800">{p.name}</p>
                          <p className="text-[10px] text-muted-foreground">MRN: {p.mrn || 'N/A'} | Age: {p.age || 'N/A'}</p>
                        </div>
                        <Badge variant="outline" className="text-[10px]">{p.phone || 'N/A'}</Badge>
                      </div>
                    ))
                  ) : (
                    <div className="p-4 text-center text-xs text-muted-foreground">No patients matched this search</div>
                  )}
                </div>
              )}
            </div>

            {conPatientId && conPatientId !== '' && (
              <div className="space-y-6">
                {/* Patient Overview Card */}
                {(() => {
                  const selectedPatientData = patients.find(p => p.id === conPatientId);
                  const conPatientInvoices = bills.filter(b => b.patient_id === conPatientId || b.patientId === conPatientId);
                  const conPatientInvoicesByDate = conPatientInvoices.reduce((acc: Record<string, any[]>, bill) => {
                    const rawDate = bill.created_at || bill.date || new Date().toISOString();
                    const dateKey = rawDate.split('T')[0];
                    if (!acc[dateKey]) acc[dateKey] = [];
                    acc[dateKey].push(bill);
                    return acc;
                  }, {} as Record<string, any[]>);

                  if (!selectedPatientData) return null;

                  return (
                    <div className="space-y-6">
                      <div className="flex flex-col md:flex-row justify-between items-start md:items-center bg-slate-50 border border-slate-200/60 p-4 rounded-xl gap-4">
                        <div>
                          <h3 className="text-lg font-bold text-slate-800">{selectedPatientData.name}</h3>
                          <p className="text-xs text-slate-500 font-medium mt-0.5">
                            MRN: <span className="font-bold text-medical-blue">{selectedPatientData.mrn || 'N/A'}</span> &bull; 
                            Age: <span className="font-bold">{selectedPatientData.age || 'N/A'}</span> &bull; 
                            Gender: <span className="font-bold uppercase">{selectedPatientData.gender || 'N/A'}</span> &bull; 
                            Phone: <span className="font-bold">{selectedPatientData.phone || 'N/A'}</span>
                          </p>
                        </div>
                        <div className="flex gap-2">
                          <Button 
                            className="bg-medical-blue gap-1.5 h-9 text-xs font-bold" 
                            onClick={() => printConsolidatedStatement(selectedPatientData, conPatientInvoices)}
                            disabled={conPatientInvoices.length === 0}
                          >
                            <Printer className="w-4 h-4" />
                            Print Date-wise Consolidated Bill
                          </Button>
                          <Button 
                            variant="outline" 
                            className="h-9 text-xs" 
                            onClick={() => {
                              setConPatientId('');
                              setConPatientSearch('');
                            }}
                          >
                            Clear Selection
                          </Button>
                        </div>
                      </div>

                      {/* Invoices Timeline */}
                      {conPatientInvoices.length > 0 ? (
                        <div className="space-y-6">
                          {/* Summary Totals */}
                          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 border border-blue-50 bg-blue-50/10 p-4 rounded-xl">
                            <div>
                              <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Gross Combined Total</span>
                              <h4 className="text-xl font-bold text-slate-800">
                                {formatCurrency(conPatientInvoices.reduce((sum, b) => sum + Number(b.total_amount || b.totalAmount || 0), 0))}
                              </h4>
                            </div>
                            <div>
                              <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Total Combined Discount</span>
                              <h4 className="text-xl font-bold text-rose-500">
                                {formatCurrency(conPatientInvoices.reduce((sum, b) => sum + Number(b.discount_amount || b.discount || 0), 0))}
                              </h4>
                            </div>
                            <div>
                              <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Net Amount Settled</span>
                              <h4 className="text-xl font-black text-emerald-600">
                                {formatCurrency(conPatientInvoices.reduce((sum, b) => sum + Number(b.paid_amount || b.paidAmount || 0), 0))}
                              </h4>
                            </div>
                          </div>

                          {/* Timeline List group by Date */}
                          <div className="relative border-l-2 border-slate-200 ml-3 pl-6 space-y-8">
                            {Object.entries(conPatientInvoicesByDate)
                              .sort((a, b) => new Date(b[0]).getTime() - new Date(a[0]).getTime())
                              .map(([dateKey, dayBills]) => {
                                const billsList = dayBills as any[];
                                return (
                                  <div key={dateKey} className="relative">
                                    <span className="absolute -left-[31px] top-1 bg-medical-blue h-4 w-4 rounded-full border-4 border-white shadow-sm"></span>
                                    <div className="flex items-center gap-3 mb-3">
                                      <Badge className="bg-medical-blue py-1 text-xs font-extrabold">{formatDate(dateKey)}</Badge>
                                      <span className="text-xs text-muted-foreground font-bold">
                                        {billsList.length} Bill Statement(s)
                                      </span>
                                    </div>

                                    <div className="space-y-3">
                                      {billsList.map((bill: any) => {
                                        const items = bill.invoice_items || bill.items || [];
                                        return (
                                          <div key={bill.id} className="bg-white border rounded-lg p-4 shadow-sm hover:border-slate-300 transition-all">
                                            <div className="flex justify-between items-start mb-3 border-b pb-2">
                                              <div>
                                                <span className="text-xs font-black text-medical-blue uppercase bg-blue-50 px-2 py-0.5 rounded mr-2">
                                                  {bill.type || 'HOSPITAL'} BILL
                                                </span>
                                                <span className="text-xs text-slate-400 font-bold">#{bill.id.slice(0, 8).toUpperCase()}</span>
                                              </div>
                                              <div className="text-right">
                                                <span className="text-sm font-bold text-slate-800">
                                                  {formatCurrency(bill.paid_amount || bill.total_amount || 0)}
                                                </span>
                                              </div>
                                            </div>

                                            <div className="space-y-2">
                                              {items.length > 0 ? (
                                                items.map((item: any, idx: number) => (
                                                  <div key={idx} className="flex justify-between items-center text-xs">
                                                    <div className="flex flex-col">
                                                      <span className="font-semibold text-slate-700">{item.item_name || item.name || item.description}</span>
                                                      <span className="text-[10px] text-slate-400 font-bold uppercase">{item.category || 'General Fee'}</span>
                                                    </div>
                                                    <span className="font-bold text-slate-600">
                                                      {formatCurrency(item.unit_price || item.total_price || item.amount || 0)}
                                                    </span>
                                                  </div>
                                                ))
                                              ) : (
                                                <p className="text-slate-400 text-xs italic">No invoice items listed</p>
                                              )}
                                            </div>
                                          </div>
                                        );
                                      })}
                                    </div>
                                  </div>
                                );
                              })}
                          </div>
                        </div>
                      ) : (
                        <div className="p-8 text-center border-2 border-dashed border-slate-200 rounded-xl space-y-2">
                          <AlertCircle className="w-8 h-8 text-slate-400 mx-auto" />
                          <h5 className="font-bold text-slate-700">No Billing Transactions</h5>
                          <p className="text-xs text-muted-foreground">We couldn't find any recorded invoices or pharmacy/lab sales for this patient.</p>
                        </div>
                      )}
                    </div>
                  );
                })()}
              </div>
            )}

            {!conPatientId && (
              <div className="p-12 text-center text-xs text-slate-400 border border-dashed rounded-xl">
                Please search and select a patient to fetch their consolidated, date-wise itemized medical bills.
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* GST & Financial Reports Section */}
      {activeTab === 'gst' && (
        <div className="space-y-6">
          <Card className="border-none shadow-sm bg-white">
            <CardHeader className="pb-3 flex flex-row items-center justify-between space-y-0">
              <div>
                <CardTitle className="text-lg font-bold text-slate-800">GST & Dynamic Financial Tax Return Assistant</CardTitle>
                <CardDescription className="text-xs">Consolidated summary of hospital GST collections across departments (Pharmacy 12%, Room 18%, Lab exempt).</CardDescription>
              </div>
              <Select value={gstMonth} onValueChange={setGstMonth}>
                <SelectTrigger className="w-[150px] h-9">
                  <SelectValue placeholder="Select Month" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="June 2026">June 2026</SelectItem>
                  <SelectItem value="May 2026">May 2026</SelectItem>
                  <SelectItem value="April 2026">April 2026</SelectItem>
                </SelectContent>
              </Select>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Cards row for tax collections */}
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <div className="p-4 bg-slate-50 border border-slate-100 rounded-2xl">
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider font-mono">Gross Business Amount</p>
                  <p className="text-xl font-bold text-slate-800 mt-1">{formatCurrency(totalHospitalRevenue)}</p>
                  <p className="text-[9px] text-muted-foreground mt-0.5 font-sans">All settled invoices</p>
                </div>
                <div className="p-4 bg-emerald-50/50 border border-emerald-100 rounded-2xl">
                  <p className="text-[10px] font-bold text-emerald-650 uppercase tracking-wider font-mono">Pharmacy CGST (6%)</p>
                  <p className="text-xl font-bold text-emerald-700 mt-1">{formatCurrency(pharmacyRevenue * 0.0535)}</p>
                  <p className="text-[9px] text-emerald-600 mt-0.5 font-sans">Central portion (12% slab)</p>
                </div>
                <div className="p-4 bg-emerald-50/50 border border-emerald-100 rounded-2xl">
                  <p className="text-[10px] font-bold text-emerald-650 uppercase tracking-wider font-mono">Pharmacy SGST (6%)</p>
                  <p className="text-xl font-bold text-emerald-700 mt-1">{formatCurrency(pharmacyRevenue * 0.0535)}</p>
                  <p className="text-[9px] text-emerald-600 mt-0.5 font-sans">State portion (12% slab)</p>
                </div>
                <div className="p-4 bg-blue-50/50 border border-blue-100 rounded-2xl">
                  <p className="text-[10px] font-bold text-blue-600 uppercase tracking-wider font-mono">IPD Bed GST (18%)</p>
                  <p className="text-xl font-bold text-blue-700 mt-1">
                    {formatCurrency(bills.filter(b => b.type === 'IPD' || b.invoice_items?.some((i: any) => i.category === 'IPD')).reduce((sum, b) => sum + (Number(b.paid_amount) || 0), 0) * 0.1525)}
                  </p>
                  <p className="text-[9px] text-blue-600 mt-0.5 font-sans font-medium">Applicable on deluxe suites</p>
                </div>
              </div>

              {/* Tax collection table */}
              <div className="border rounded-2xl overflow-hidden bg-white">
                <Table>
                  <TableHeader className="bg-slate-50">
                    <TableRow>
                      <TableHead className="text-xs">Tax Category</TableHead>
                      <TableHead className="text-xs">Applicable GST Slabs</TableHead>
                      <TableHead className="text-xs">Gross Receipts</TableHead>
                      <TableHead className="text-xs">Net Taxable Value</TableHead>
                      <TableHead className="text-xs text-right">SGST Collected</TableHead>
                      <TableHead className="text-xs text-right">CGST Collected</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    <TableRow className="text-xs">
                      <TableCell className="font-bold">Pharmacy Prescriptions Sale</TableCell>
                      <TableCell><Badge variant="outline" className="bg-emerald-50 text-emerald-700 border-emerald-100 font-extrabold text-[10px]">12% GST</Badge></TableCell>
                      <TableCell className="font-semibold">{formatCurrency(pharmacyRevenue)}</TableCell>
                      <TableCell className="font-mono">{formatCurrency(pharmacyRevenue / 1.12)}</TableCell>
                      <TableCell className="font-mono font-bold text-right text-slate-700">{formatCurrency((pharmacyRevenue - (pharmacyRevenue / 1.12)) / 2)}</TableCell>
                      <TableCell className="font-mono font-bold text-right text-slate-700">{formatCurrency((pharmacyRevenue - (pharmacyRevenue / 1.12)) / 2)}</TableCell>
                    </TableRow>
                    <TableRow className="text-xs">
                      <TableCell className="font-bold">IPD Bed & Deluxe Ward Care</TableCell>
                      <TableCell><Badge variant="outline" className="bg-indigo-50 text-indigo-700 border-indigo-150 font-extrabold text-[10px]">18% GST (Room)</Badge></TableCell>
                      <TableCell className="font-semibold">
                        {formatCurrency(bills.filter(b => b.type === 'IPD' || b.invoice_items?.some((i: any) => i.category === 'IPD')).reduce((sum, b) => sum + (Number(b.paid_amount) || 0), 0))}
                      </TableCell>
                      <TableCell className="font-mono">
                        {formatCurrency(bills.filter(b => b.type === 'IPD' || b.invoice_items?.some((i: any) => i.category === 'IPD')).reduce((sum, b) => sum + (Number(b.paid_amount) || 0), 0) / 1.18)}
                      </TableCell>
                      <TableCell className="font-mono font-bold text-right text-slate-700">
                        {formatCurrency((bills.filter(b => b.type === 'IPD' || b.invoice_items?.some((i: any) => i.category === 'IPD')).reduce((sum, b) => sum + (Number(b.paid_amount) || 0), 0) - (bills.filter(b => b.type === 'IPD' || b.invoice_items?.some((i: any) => i.category === 'IPD')).reduce((sum, b) => sum + (Number(b.paid_amount) || 0), 0) / 1.18)) / 2)}
                      </TableCell>
                      <TableCell className="font-mono font-bold text-right text-slate-700">
                        {formatCurrency((bills.filter(b => b.type === 'IPD' || b.invoice_items?.some((i: any) => i.category === 'IPD')).reduce((sum, b) => sum + (Number(b.paid_amount) || 0), 0) - (bills.filter(b => b.type === 'IPD' || b.invoice_items?.some((i: any) => i.category === 'IPD')).reduce((sum, b) => sum + (Number(b.paid_amount) || 0), 0) / 1.18)) / 2)}
                      </TableCell>
                    </TableRow>
                    <TableRow className="text-xs">
                      <TableCell className="font-bold">OPD Consultation Clinics</TableCell>
                      <TableCell><Badge variant="outline" className="bg-slate-50 text-slate-500 border-slate-200 font-extrabold text-[10px]">0% Exempt</Badge></TableCell>
                      <TableCell className="font-semibold">
                        {formatCurrency(bills.filter(b => b.type === 'OPD' || b.invoice_items?.some((i: any) => i.category === 'OPD')).reduce((sum, b) => sum + (Number(b.paid_amount) || 0), 0))}
                      </TableCell>
                      <TableCell className="font-mono">-</TableCell>
                      <TableCell className="font-mono text-right text-slate-400">₹0.00</TableCell>
                      <TableCell className="font-mono text-right text-slate-400">₹0.00</TableCell>
                    </TableRow>
                    <TableRow className="text-xs">
                      <TableCell className="font-bold">Laboratory Pathology & Radiology</TableCell>
                      <TableCell><Badge variant="outline" className="bg-slate-50 text-slate-500 border-slate-200 font-extrabold text-[10px]">0% Exempt</Badge></TableCell>
                      <TableCell className="font-semibold">{formatCurrency(labRevenue)}</TableCell>
                      <TableCell className="font-mono">-</TableCell>
                      <TableCell className="font-mono text-right text-slate-400">₹0.00</TableCell>
                      <TableCell className="font-mono text-right text-slate-400">₹0.00</TableCell>
                    </TableRow>
                    <TableRow className="bg-slate-50 hover:bg-slate-50 font-extrabold text-xs">
                      <TableCell>Aggregate Tax Reconciliation</TableCell>
                      <TableCell className="font-black uppercase text-rose-500">GSTR-1 DRAFT</TableCell>
                      <TableCell className="text-slate-800">{formatCurrency(totalHospitalRevenue)}</TableCell>
                      <TableCell className="text-slate-800">-</TableCell>
                      <TableCell className="text-right text-emerald-800 font-mono">
                        {formatCurrency(((pharmacyRevenue - (pharmacyRevenue / 1.12)) / 2) + ((bills.filter(b => b.type === 'IPD' || b.invoice_items?.some((i: any) => i.category === 'IPD')).reduce((sum, b) => sum + (Number(b.paid_amount) || 0), 0) - (bills.filter(b => b.type === 'IPD' || b.invoice_items?.some((i: any) => i.category === 'IPD')).reduce((sum, b) => sum + (Number(b.paid_amount) || 0), 0) / 1.18)) / 2))}
                      </TableCell>
                      <TableCell className="text-right text-emerald-800 font-mono">
                        {formatCurrency(((pharmacyRevenue - (pharmacyRevenue / 1.12)) / 2) + ((bills.filter(b => b.type === 'IPD' || b.invoice_items?.some((i: any) => i.category === 'IPD')).reduce((sum, b) => sum + (Number(b.paid_amount) || 0), 0) - (bills.filter(b => b.type === 'IPD' || b.invoice_items?.some((i: any) => i.category === 'IPD')).reduce((sum, b) => sum + (Number(b.paid_amount) || 0), 0) / 1.18)) / 2))}
                      </TableCell>
                    </TableRow>
                  </TableBody>
                </Table>
              </div>

              <div className="bg-indigo-50/50 p-4 rounded-xl border border-indigo-100 flex items-center justify-between gap-4">
                <div className="space-y-1">
                  <p className="text-xs font-bold text-indigo-900 flex items-center gap-1.5 flex-wrap">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                    Automated Tax Reconciliation Ready
                  </p>
                  <p className="text-[10px] text-indigo-700 font-medium leading-normal">Verify draft statements and sync directly with Uttar Pradesh Commercial Taxes Department GST portal.</p>
                </div>
                <Button 
                  className="bg-indigo-600 hover:bg-indigo-700 text-white shrink-0 text-xs font-bold rounded-xl h-9 px-4"
                  onClick={() => toast.success('GSTR-1 JSON Payload Generated! Ready for offline filing.')}
                >
                  Download IRS GST JSON
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* PM-JAY & Insurance Claims Section */}
      {activeTab === 'claims' && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* New Claim Form */}
            <Card className="border-none shadow-sm bg-white">
              <CardHeader>
                <CardTitle className="text-sm font-black text-indigo-900 uppercase tracking-wider">File ABDM Gateway PM-JAY & TPA Claim</CardTitle>
                <CardDescription className="text-xs">Submit pre-authorized treatment packages directly to National Health Authority (NHA) or private TPA payers.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* Patient Search */}
                <div className="space-y-2 relative">
                  <Label className="text-xs font-bold">1. Select Patient Profile</Label>
                  <Input 
                    placeholder="Search by name, phone or MRN ID" 
                    value={newClaimPatSearch}
                    onChange={(e) => {
                      setNewClaimPatSearch(e.target.value);
                      setShowClaimRefPatResults(true);
                    }}
                    className="bg-slate-50 border-none text-xs"
                  />
                  {showClaimRefPatResults && newClaimPatSearch && (
                    <div className="absolute z-10 w-full bg-white border rounded-xl shadow-lg max-h-48 overflow-y-auto mt-1 border-slate-100">
                      {patients
                        .filter(p => p.name.toLowerCase().includes(newClaimPatSearch.toLowerCase()) || p.mrn.toLowerCase().includes(newClaimPatSearch.toLowerCase()))
                        .map(p => (
                          <div 
                            key={p.id} 
                            className="p-2.5 hover:bg-slate-50 cursor-pointer text-xs flex justify-between border-b border-slate-50"
                            onClick={() => {
                              setNewClaim({...newClaim, patientId: p.id});
                              setNewClaimPatSearch(`${p.name} (${p.mrn})`);
                              setShowClaimRefPatResults(false);
                            }}
                          >
                            <span className="font-bold">{p.name} <span className="text-[10px] text-muted-foreground font-medium">({p.mrn})</span></span>
                            <span className="text-[10px] text-blue-600 font-bold">{p.phone}</span>
                          </div>
                        ))}
                    </div>
                  )}
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label className="text-xs font-bold">Claim Type</Label>
                    <Select value={newClaim.type} onValueChange={(v) => setNewClaim({...newClaim, type: v})}>
                      <SelectTrigger className="h-9">
                        <SelectValue placeholder="Type" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="PM-JAY">PM-JAY Scheme</SelectItem>
                        <SelectItem value="TPA Insurance">Private TPA Insurance</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label className="text-xs font-bold">Payer / Agency Name</Label>
                    <Input 
                      placeholder="e.g. Star Health or SACHIS" 
                      value={newClaim.tpaName} 
                      onChange={(e) => setNewClaim({...newClaim, tpaName: e.target.value})}
                      className="bg-slate-50 border-none text-xs h-9"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label className="text-xs font-bold">Treatment Package Code</Label>
                    <Input 
                      placeholder="e.g. UP-Maternity-04" 
                      value={newClaim.packageCode} 
                      onChange={(e) => setNewClaim({...newClaim, packageCode: e.target.value})}
                      className="bg-slate-50 border-none text-xs h-9"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-xs font-bold">Claim Amount (₹)</Label>
                    <Input 
                      type="number" 
                      placeholder="e.g. 18500" 
                      value={newClaim.claimAmount} 
                      onChange={(e) => setNewClaim({...newClaim, claimAmount: e.target.value})}
                      className="bg-slate-50 border-none text-xs h-9"
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label className="text-xs font-bold">NHA Pre-Authorization Approval ID</Label>
                  <Input 
                    placeholder="e.g. PA-UP-772901-P" 
                    value={newClaim.preAuthId} 
                    onChange={(e) => setNewClaim({...newClaim, preAuthId: e.target.value})}
                    className="bg-slate-50 border-none text-xs h-9"
                  />
                </div>

                <div className="space-y-2">
                  <Label className="text-xs font-bold">Documentation / Remarks</Label>
                  <Input 
                    placeholder="Provide reference logs, bill links, or verification details" 
                    value={newClaim.notes} 
                    onChange={(e) => setNewClaim({...newClaim, notes: e.target.value})}
                    className="bg-slate-50 border-none text-xs h-9"
                  />
                </div>

                <Button 
                  onClick={handleCreateClaim}
                  className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs rounded-xl h-10 shadow-sm"
                >
                  Transmit Claim Payload to ABDM Gateway
                </Button>
              </CardContent>
            </Card>

            {/* Claims Stats Banner */}
            <Card className="border-none shadow-sm flex flex-col justify-between bg-white">
              <CardHeader>
                <CardTitle className="text-sm font-black text-slate-800 uppercase tracking-wider">Gateways Connection Status</CardTitle>
                <CardDescription className="text-xs">Verify your connection configurations directly connected with SACHIS and private insurances.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4 flex-1">
                <div className="p-4 bg-slate-50 border border-slate-100 rounded-2xl space-y-3">
                  <p className="text-[10px] font-black uppercase text-indigo-600 tracking-wider font-mono">National Health Authority Sandbox</p>
                  <div className="flex items-center justify-between text-xs font-bold">
                    <span>NHA Gateway API Connection</span>
                    <span className="text-emerald-500 flex items-center gap-1 text-[11px] uppercase tracking-wider font-black">● COMPLIANT & SAFE</span>
                  </div>
                  <div className="flex items-center justify-between text-xs font-bold">
                    <span>Claims Dispatched (All-time)</span>
                    <span className="text-slate-700 font-mono">{claims.length} Filed</span>
                  </div>
                  <div className="flex items-center justify-between text-xs font-bold">
                    <span>Approved Portfolios</span>
                    <span className="text-emerald-600 font-mono">
                      {formatCurrency(claims.filter(c => c.status === 'Approved').reduce((sum, c) => sum + c.claimAmount, 0))}
                    </span>
                  </div>
                </div>
                <div className="p-4 bg-amber-50/40 border border-amber-100 rounded-2xl">
                  <p className="text-xs font-bold text-amber-900 flex items-center gap-1.5 flex-wrap">
                    <Clock className="w-4 h-4 text-amber-600 shrink-0" />
                    Pending Claims Turnaround Time (TAT)
                  </p>
                  <p className="text-[10px] text-amber-700 mt-1 font-medium leading-normal">Claims pending adjudication normally settle within 48 to 72 hours via the automated NHA batch release sequence.</p>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Claims Portfolio list */}
          <Card className="border-none shadow-sm bg-white">
            <CardHeader className="pb-3 border-b">
              <CardTitle className="text-xs font-black uppercase text-slate-500 tracking-wider">Claim Portfolio Ledger (PM-JAY & Insurances)</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow className="hover:bg-transparent border-slate-100 text-[10px] uppercase font-bold text-slate-400">
                    <TableHead>Claim ID</TableHead>
                    <TableHead>Patient Details</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Package Code</TableHead>
                    <TableHead>Pre-Auth ID</TableHead>
                    <TableHead>Claim Amount</TableHead>
                    <TableHead>Date Filed</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Action</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {claims.map((claim) => (
                    <TableRow key={claim.id} className="border-slate-50 hover:bg-slate-50/50 transition-colors">
                      <TableCell className="font-bold text-indigo-700">{claim.id}</TableCell>
                      <TableCell>
                        <div className="flex flex-col text-xs">
                          <span className="font-bold text-slate-800">{claim.patientName}</span>
                          <span className="text-[10px] text-muted-foreground">{claim.mrn}</span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge className={`${claim.type === 'PM-JAY' ? 'bg-emerald-50 text-emerald-700 border-emerald-100' : 'bg-blue-50 text-blue-700 border-blue-100'}`} variant="outline">
                          {claim.type}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-xs font-medium text-slate-700">{claim.packageCode}</TableCell>
                      <TableCell className="text-xs font-mono text-indigo-600 font-bold">{claim.preAuthId}</TableCell>
                      <TableCell className="text-xs font-bold text-slate-800">{formatCurrency(claim.claimAmount)}</TableCell>
                      <TableCell className="text-xs text-muted-foreground">{formatDate(claim.filedDate)}</TableCell>
                      <TableCell>
                        <Badge className={`border-none ${
                          claim.status === 'Approved' ? 'bg-emerald-50 text-emerald-600' :
                          claim.status === 'Filed' ? 'bg-blue-50 text-blue-600' :
                          claim.status === 'Queried' ? 'bg-amber-50 text-amber-600' :
                          'bg-rose-50 text-rose-600'
                        }`}>
                          {claim.status}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-1">
                          {claim.status === 'Filed' && (
                            <Button 
                              size="sm" 
                              variant="outline" 
                              className="h-7 text-[10px] bg-emerald-50 text-emerald-700 hover:bg-emerald-100 border-emerald-150 font-bold"
                              onClick={() => handleUpdateClaimStatus(claim.id, 'Approved')}
                            >
                              Approve
                            </Button>
                          )}
                          {claim.status === 'Filed' && (
                            <Button 
                              size="sm" 
                              variant="outline" 
                              className="h-7 text-[10px] bg-amber-50 text-amber-700 hover:bg-amber-100 border-amber-150 font-bold"
                              onClick={() => handleUpdateClaimStatus(claim.id, 'Queried')}
                            >
                              Query
                            </Button>
                          )}
                          <Button 
                            size="sm" 
                            variant="ghost" 
                            className="h-7 text-[10px] text-rose-500 font-bold"
                            onClick={() => {
                              const filtered = claims.filter(c => c.id !== claim.id);
                              setClaims(filtered);
                              localStorage.setItem('hms_billing_claims', JSON.stringify(filtered));
                              toast.success('Claim archived');
                            }}
                          >
                            Archive
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Refund Management Section */}
      {activeTab === 'refunds' && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <Card className="border-none shadow-sm bg-white">
              <CardHeader>
                <CardTitle className="text-sm font-black text-rose-900 uppercase tracking-wider">Process Erroneous / Cancelled Invoices Refund</CardTitle>
                <CardDescription className="text-xs">Raise or finalize refunds for over-billings, duplicate consulting tickets or laboratory/imaging cancellation.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* Patient Search */}
                <div className="space-y-1 relative">
                  <Label className="text-xs font-bold text-slate-700">1. Select Patient Profile</Label>
                  <Input 
                    placeholder="Type name, phone or MRN ID..." 
                    value={newRefundPatSearch}
                    onChange={(e) => {
                      setNewRefundPatSearch(e.target.value);
                      setShowRefundRefPatResults(true);
                    }}
                    className="bg-slate-50 border-none text-xs h-9"
                  />
                  {showRefundRefPatResults && newRefundPatSearch && (
                    <div className="absolute z-15 w-full bg-white border rounded-xl shadow-lg max-h-48 overflow-y-auto mt-1 border-slate-200 font-sans">
                      {patients
                        .filter(p => p.name.toLowerCase().includes(newRefundPatSearch.toLowerCase()) || p.mrn.toLowerCase().includes(newRefundPatSearch.toLowerCase()))
                        .map(p => (
                          <div 
                            key={p.id} 
                            className="p-2.5 hover:bg-slate-50 cursor-pointer text-xs flex justify-between border-b border-slate-50"
                            onClick={() => {
                              setNewRefund({...newRefund, patientId: p.id, invoiceId: ''});
                              setNewRefundPatSearch(`${p.name} (${p.mrn})`);
                              setShowRefundRefPatResults(false);
                              const usersBills = bills.filter(b => b.patient_id === p.id || b.patientId === p.id);
                              setSelectedRefundBillList(usersBills);
                              if (usersBills.length === 0) {
                                toast.error('No settled bills or sales found for this patient.');
                              }
                            }}
                          >
                            <span className="font-bold">{p.name} <span className="text-[10px] text-muted-foreground">({p.mrn})</span></span>
                            <span className="text-[10px] text-rose-650 font-extrabold">{p.phone}</span>
                          </div>
                        ))}
                    </div>
                  )}
                </div>

                <div className="space-y-1">
                  <Label className="text-xs font-bold text-slate-700">2. Select Reference Settle Invoice ID</Label>
                  <Select 
                    value={newRefund.invoiceId} 
                    onValueChange={(v) => {
                      const selectedB = selectedRefundBillList.find(b => b.id === v);
                      setNewRefund({
                        ...newRefund, 
                        invoiceId: v,
                        amount: selectedB ? (selectedB.paid_amount || selectedB.total_amount).toString() : ''
                      });
                    }}
                  >
                    <SelectTrigger className="h-9">
                      <SelectValue placeholder="Invoice Reference" />
                    </SelectTrigger>
                    <SelectContent>
                      {selectedRefundBillList.map(b => (
                        <SelectItem key={b.id} value={b.id}>
                          #{b.id.slice(b.id.length-8).toUpperCase()} - {formatCurrency(b.paid_amount || b.total_amount)} ({b.type || 'HOSPITAL'})
                        </SelectItem>
                      ))}
                      {selectedRefundBillList.length === 0 && (
                        <SelectItem value="none" disabled>Select patient first to populate bills</SelectItem>
                      )}
                    </SelectContent>
                  </Select>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <Label className="text-xs font-bold text-slate-700">Refund Value (₹)</Label>
                    <Input 
                      type="number" 
                      placeholder="e.g. 500" 
                      value={newRefund.amount} 
                      onChange={(e) => setNewRefund({...newRefund, amount: e.target.value})}
                      className="bg-slate-50 border-none text-xs h-9 font-bold"
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs font-bold text-slate-700">Refund Payment Method</Label>
                    <Select value={newRefund.paymentMethod} onValueChange={(v) => setNewRefund({...newRefund, paymentMethod: v})}>
                      <SelectTrigger className="h-9">
                        <SelectValue placeholder="Refund via" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="UPI">UPI Payload</SelectItem>
                        <SelectItem value="Cash">Cash Return</SelectItem>
                        <SelectItem value="Bank Transfer">Bank RTGS / NEFT</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="space-y-1">
                  <Label className="text-xs font-bold text-slate-700">Detailed Refund Justification / Reason</Label>
                  <Input 
                    placeholder="e.g. Service skipped/Double payment error" 
                    value={newRefund.reason} 
                    onChange={(e) => setNewRefund({...newRefund, reason: e.target.value})}
                    className="bg-slate-50 border-none text-xs h-9"
                  />
                </div>

                <Button 
                  onClick={handleCreateRefund}
                  className="w-full bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs rounded-xl h-10 shadow-sm"
                >
                  Confirm & Route Refund Transaction
                </Button>
              </CardContent>
            </Card>

            {/* Audit Logs / Refund Guidance */}
            <Card className="border-none shadow-sm flex flex-col justify-between bg-slate-50/50">
              <CardHeader>
                <CardTitle className="text-sm font-black text-rose-900 uppercase tracking-wider">Refund Control Policy & Safeguards</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4 flex-1 text-xs">
                <div className="p-4 bg-white border border-rose-100 rounded-2xl space-y-2">
                  <p className="font-bold text-rose-950 uppercase text-[10px]">Strict Control Protocols</p>
                  <p className="text-[11px] text-slate-600 leading-relaxed font-semibold">To prevent financial discrepancy, all refund values above <strong>₹5,000</strong> must be verified and co-signed digitally by a Super Admin or Clinical Director. Unapproved transactions are flagged and marked as <strong>Pending Approved</strong> in the general accounting queue.</p>
                </div>
                <div className="p-4 bg-white border border-slate-100 rounded-2xl">
                  <p className="font-extrabold text-slate-800 uppercase text-[10px] mb-2">Refund Portfolio Metrics</p>
                  <div className="flex justify-between items-center py-1 border-b border-slate-50">
                    <span className="font-semibold text-slate-600">Total Processed Refunds</span>
                    <span className="font-bold text-slate-700">{refunds.filter(r => r.status === 'Processed').length} Cases</span>
                  </div>
                  <div className="flex justify-between items-center py-1">
                    <span className="font-semibold text-slate-600">Cumulative Refund Outflow</span>
                    <span className="font-bold text-rose-600">
                      {formatCurrency(refunds.filter(r => r.status === 'Processed').reduce((sum, r) => sum + r.amount, 0))}
                    </span>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Refund ledger list */}
          <Card className="border-none shadow-sm bg-white">
            <CardHeader className="pb-3 border-b">
              <CardTitle className="text-xs font-black uppercase text-slate-500 tracking-wider">Processed & Pending Refund Registry Ledger</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow className="hover:bg-transparent border-slate-100 text-[10px] uppercase font-bold text-slate-400">
                    <TableHead>Refund ID</TableHead>
                    <TableHead>Patient Details</TableHead>
                    <TableHead>Reference Bill</TableHead>
                    <TableHead>Refund Amount</TableHead>
                    <TableHead>Reason</TableHead>
                    <TableHead>Mode</TableHead>
                    <TableHead>Processed At</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Action</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {refunds.map((ref) => (
                    <TableRow key={ref.id} className="border-slate-50 hover:bg-slate-50/50 transition-colors">
                      <TableCell className="font-extrabold text-rose-650 text-[11px] font-mono">{ref.id}</TableCell>
                      <TableCell>
                        <div className="flex flex-col text-xs font-sans">
                          <span className="font-bold text-slate-800">{ref.patientName}</span>
                          <span className="text-[10px] text-muted-foreground">{ref.mrn}</span>
                        </div>
                      </TableCell>
                      <TableCell className="text-xs font-mono text-slate-550 cursor-pointer">
                        #{ref.invoiceId?.slice(0, 8).toUpperCase()}
                      </TableCell>
                      <TableCell className="text-xs font-bold text-rose-600">{formatCurrency(ref.amount)}</TableCell>
                      <TableCell className="text-xs text-slate-600 font-medium max-w-xs truncate" title={ref.reason}>{ref.reason}</TableCell>
                      <TableCell><Badge variant="outline" className="text-[10px] font-medium">{ref.paymentMethod}</Badge></TableCell>
                      <TableCell className="text-[11px] text-slate-400">
                        {ref.processedAt ? formatDate(ref.processedAt) : 'Pending review'}
                      </TableCell>
                      <TableCell>
                        <Badge className={`border-none ${
                          ref.status === 'Processed' ? 'bg-emerald-50 text-emerald-600' : 'bg-amber-50 text-amber-600'
                        }`}>
                          {ref.status}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-1">
                          {ref.status === 'Pending Approved' && currentUser?.role?.toUpperCase()?.includes('ADMIN') && (
                            <Button 
                              size="sm" 
                              variant="outline" 
                              className="h-7 text-[10px] bg-emerald-50 text-emerald-700 hover:bg-emerald-100 border-emerald-150 font-bold"
                              onClick={() => handleApproveRefund(ref.id)}
                            >
                              Approve
                            </Button>
                          )}
                          <Button 
                            size="sm" 
                            variant="ghost" 
                            className="h-7 text-[10px] text-rose-500 font-bold"
                            onClick={() => {
                              const filtered = refunds.filter(r => r.id !== ref.id);
                              setRefunds(filtered);
                              localStorage.setItem('hms_billing_refunds', JSON.stringify(filtered));
                              toast.success('Refund log deleted');
                            }}
                          >
                            Remove
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                  {refunds.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={9} className="text-center py-6 text-xs text-muted-foreground">No active refund entries listed.</TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
