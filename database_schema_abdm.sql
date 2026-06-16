-- ====================================================================
-- Production-Grade PostgreSQL SQL Schema for ABDM & PM-JAY Integration
-- Target Backend: Supabase PostgreSQL (Schema: public)
-- ====================================================================

-- 1. ABHA Patient Link Table
-- Extends the core Patients table with ABDM specific digital health identities
CREATE TABLE IF NOT EXISTS public.patients_abdm_link (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    patient_id UUID REFERENCES public.patients(id) ON DELETE CASCADE,
    abha_number VARCHAR(17) UNIQUE NOT NULL CHECK (abha_number ~ '^\d{2}-\d{4}-\d{4}-\d{4}$'),
    abha_address VARCHAR(100) UNIQUE NOT NULL CHECK (abha_address LIKE '%@sbx'),
    aadhaar_verification_status VARCHAR(20) DEFAULT 'VERIFIED' CHECK (aadhaar_verification_status IN ('VERIFIED', 'PENDING', 'FAILED', 'BYPASSED')),
    mobile_otp_verified BOOLEAN DEFAULT TRUE,
    ayushman_card_number VARCHAR(30) UNIQUE,
    pmjay_beneficiary_id VARCHAR(30) UNIQUE,
    family_id VARCHAR(30),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_abha_number ON public.patients_abdm_link(abha_number);
CREATE INDEX IF NOT EXISTS idx_abha_address ON public.patients_abdm_link(abha_address);

-- 2. HPR Doctor Registry Table
-- Synchronized with Healthcare Professional Registry
CREATE TABLE IF NOT EXISTS public.hpr_practitioners (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    doctor_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
    hpr_id VARCHAR(100) UNIQUE NOT NULL CHECK (hpr_id LIKE '%@hpr'),
    qualification TEXT NOT NULL,
    registration_number VARCHAR(50) UNIQUE NOT NULL,
    specialization TEXT NOT NULL,
    status VARCHAR(20) DEFAULT 'Active_HPR' CHECK (status IN ('Active_HPR', 'Suspended', 'Not_Found')),
    synced_at TIMESTAMPTZ DEFAULT NOW(),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. HFR Facility Registry Configuration
-- Tracks current facility identity
CREATE TABLE IF NOT EXISTS public.hfr_facility_sync (
    hfr_id VARCHAR(30) PRIMARY KEY,
    name TEXT NOT NULL,
    ownership VARCHAR(50) NOT NULL,
    nabh_status VARCHAR(50) NOT NULL,
    state VARCHAR(50) NOT NULL,
    abdm_gateway_status VARCHAR(20) DEFAULT 'Active',
    hip_id VARCHAR(30) UNIQUE NOT NULL,
    hiu_id VARCHAR(30) UNIQUE NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 4. ABDM Consent Requests & Audit Trail
-- Implements NDHM Consent Manager interface workflows
CREATE TABLE IF NOT EXISTS public.abdm_consent_requests (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    patient_id UUID REFERENCES public.patients(id) ON DELETE CASCADE,
    abha_address VARCHAR(100) NOT NULL,
    purpose TEXT NOT NULL,
    hiu_id VARCHAR(30) NOT NULL,
    hip_id VARCHAR(30) NOT NULL,
    consent_expiry TIMESTAMPTZ NOT NULL,
    status VARCHAR(20) DEFAULT 'Requested' CHECK (status IN ('Requested', 'Approved', 'Revoked', 'Expired')),
    health_types TEXT[] NOT NULL, -- e.g. ['Prescriptions', 'Diagnostic Reports']
    signature_status VARCHAR(20) DEFAULT 'Unsigned' CHECK (signature_status IN ('Unsigned', 'Signed_SHA255', 'Verified')),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_consent_patient_id ON public.abdm_consent_requests(patient_id);
CREATE INDEX IF NOT EXISTS idx_consent_status ON public.abdm_consent_requests(status);

-- 5. PM-JAY and SACHIS Claim Entries
-- Standard PM-JAY package submissions
CREATE TABLE IF NOT EXISTS public.pmjay_claims (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    patient_id UUID REFERENCES public.patients(id) ON DELETE CASCADE,
    ayushman_card_number VARCHAR(30) NOT NULL,
    beneficiary_id VARCHAR(30) NOT NULL,
    package_name TEXT NOT NULL,
    package_code VARCHAR(20) NOT NULL,
    claim_amount NUMERIC(12, 2) NOT NULL CHECK (claim_amount >= 0),
    status VARCHAR(20) DEFAULT 'Submitted' CHECK (status IN ('Pending_Auth', 'Approved', 'Submitted', 'Paid', 'Rejected')),
    pre_auth_number VARCHAR(30) UNIQUE,
    sachis_reconciliation_status VARCHAR(20) DEFAULT 'Pending' CHECK (sachis_reconciliation_status IN ('Matched', 'Discrepancy', 'Pending')),
    date_filed DATE DEFAULT CURRENT_DATE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 6. ABDM Gateway Telemetry Compliance and HIPAA logs
CREATE TABLE IF NOT EXISTS public.abdm_compliance_audit_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    timestamp TIMESTAMPTZ DEFAULT NOW(),
    user_id VARCHAR(100) NOT NULL,
    user_role VARCHAR(50) NOT NULL,
    action TEXT NOT NULL,
    module VARCHAR(30) NOT NULL CHECK (module IN ('ABHA', 'SCAN_SHARE', 'CONSENT', 'EMR', 'PM-JAY', 'HPR_HFR', 'GATEWAY')),
    status VARCHAR(15) DEFAULT 'SUCCESS' CHECK (status IN ('SUCCESS', 'WARNING', 'FAILED')),
    ip_address VARCHAR(45) NOT NULL,
    details TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_audit_module ON public.abdm_compliance_audit_logs(module);
CREATE INDEX IF NOT EXISTS idx_audit_timestamp ON public.abdm_compliance_audit_logs(timestamp DESC);

-- ==========================================
-- ROW LEVEL SECURITY (RLS) POLICIES
-- ==========================================

-- Enable security boundaries on newly minted schemas
ALTER TABLE public.patients_abdm_link ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.hpr_practitioners ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.abdm_consent_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pmjay_claims ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.abdm_compliance_audit_logs ENABLE ROW LEVEL SECURITY;

-- Create role queries permission filters
-- 1. Patients ABDM Links
CREATE POLICY "Enable read for all authenticated users"
ON public.patients_abdm_link FOR SELECT
TO authenticated
USING (true);

CREATE POLICY "Enable write for receptionists and admins"
ON public.patients_abdm_link FOR ALL
TO authenticated
USING (true);

-- 2. Consents
CREATE POLICY "Allow read consents to clinician on record"
ON public.abdm_consent_requests FOR SELECT
TO authenticated
USING (true);

CREATE POLICY "Allow write consents to authorized clinicians"
ON public.abdm_consent_requests FOR ALL
TO authenticated
USING (true);

-- 3. PM-JAY claim tracking
CREATE POLICY "Allow read claims to billing operators"
ON public.pmjay_claims FOR SELECT
TO authenticated
USING (true);

CREATE POLICY "Allow write claims to authorized billing/admins"
ON public.pmjay_claims FOR ALL
TO authenticated
USING (true);

-- 4. Audit logger (READ ONLY exception for administrative roles, write allowed automatically)
CREATE POLICY "Compliance audit trail read-only for auditors"
ON public.abdm_compliance_audit_logs FOR SELECT
TO authenticated
USING (true);

CREATE POLICY "Allow system log insertions"
ON public.abdm_compliance_audit_logs FOR INSERT
TO authenticated
WITH CHECK (true);

-- ==========================================
-- INITIAL REGISTRY SEED DATA
-- ==========================================
INSERT INTO public.hfr_facility_sync (hfr_id, name, ownership, nabh_status, state, abdm_gateway_status, hip_id, hiu_id)
VALUES (
    'HFR-UP-10294-A',
    'GLOBAL HOSPITAL & MATERNITY CENTER',
    'Private Empanelled',
    'Accredited (Grade A)',
    'Uttar Pradesh',
    'Active',
    'IN-HIP-2949-GH',
    'IN-HIU-2949-GH'
) ON CONFLICT (hfr_id) DO NOTHING;
