import { User } from '@/types';

export interface AbhaProfile {
  abhaNumber: string;
  abhaAddress: string;
  name: string;
  gender: string;
  dob: string;
  phone: string;
  aadhaarNo?: string;
  address?: string;
  photoUrl?: string;
  verified: boolean;
}

export interface ConsentRequest {
  id: string;
  patientId: string;
  patientName: string;
  abhaAddress: string;
  purpose: string;
  hiuId: string;
  hipId: string;
  consentExpiry: string;
  status: 'Requested' | 'Approved' | 'Revoked' | 'Expired';
  healthTypes: string[];
  dateRequested: string;
  signatureStatus?: 'Unsigned' | 'Signed_SHA256' | 'Verified';
}

export interface PmjayClaim {
  id: string;
  patientId: string;
  patientName: string;
  ayushmanCardNo: string;
  beneficiaryId: string;
  packageName: string;
  packageCode: string;
  amount: number;
  status: 'Pending_Auth' | 'Approved' | 'Submitted' | 'Paid' | 'Rejected';
  preAuthNo?: string;
  dateFiled: string;
  sachisReconciliationStatus?: 'Matched' | 'Discrepancy' | 'Pending';
}

export interface AuditLogItem {
  id: string;
  timestamp: string;
  userId: string;
  userRole: string;
  action: string;
  module: 'ABHA' | 'SCAN_SHARE' | 'CONSENT' | 'EMR' | 'PM-JAY' | 'HPR_HFR' | 'GATEWAY' | 'LOGIN' | 'SYSTEM';
  status: 'SUCCESS' | 'WARNING' | 'FAILED';
  ipAddress: string;
  details: string;
}

export interface NotificationLog {
  id: string;
  timestamp: string;
  patientName: string;
  channel: 'SMS' | 'WhatsApp' | 'Email';
  recipient: string;
  content: string;
  status: 'Delivered' | 'Pending' | 'Failed';
}

export interface HprDoctor {
  hprId: string; // e.g. dr_rajesh@hpr
  name: string;
  registrationNumber: string;
  qualification: string;
  specialization: string;
  status: 'Active_HPR' | 'Suspended' | 'Not_Found';
  verifiedAt?: string;
}

export const ABDM_FACILITY_INFO = {
  hfrId: 'HFR-UP-10294-A',
  name: 'medinex HMS (Digital Communique Private Limited)',
  ownership: 'Private Empanelled',
  nabhStatus: 'Accredited (Grade A)',
  state: 'Uttar Pradesh',
  abdmGatewayStatus: 'Active',
  hipId: 'IN-HIP-2949-GH',
  hiuId: 'IN-HIU-2949-GH'
};
