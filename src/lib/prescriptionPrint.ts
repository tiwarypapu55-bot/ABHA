export interface PrintPatient {
  name: string;
  age?: number | string;
  gender?: string;
  mrn?: string;
}

export interface PrintMedicine {
  name: string;
  dosage?: string;
  frequency?: string;
  duration?: string;
  time?: string;
  startTime?: string;
}

export interface PrintPrescription {
  date?: string;
  medicines: PrintMedicine[];
  advice?: string;
  diagnosis?: string;
  notes?: string;
}

export interface PrintDoctor {
  name?: string;
  degree?: string;
  specialization?: string;
  department?: string;
  id?: string;
}

export function getPrescriptionPrintHtml(
  patient: PrintPatient,
  prescription: PrintPrescription,
  doctor?: PrintDoctor,
  hospitalInfo?: { name: string; address: string; phone: string }
): string {
  const hospName = hospitalInfo?.name || 'GLOBAL HOSPITAL';
  const hospAddress = hospitalInfo?.address || '123 Healthcare Way, Medical City';
  const hospPhone = hospitalInfo?.phone || '+91 98765 43210';
  
  const patName = patient?.name || 'N/A';
  const patAgeGender = `${patient?.age || 'N/A'}Y / ${patient?.gender || 'N/A'}`;
  const presDate = prescription?.date || new Date().toISOString().split('T')[0];
  const patMRN = patient?.mrn || 'N/A';

  const docName = doctor?.name || 'Attending Doctor';
  const docReg = doctor?.degree ? `Reg No: MC-${doctor.id?.toUpperCase() || '1234567'}` : 'Reg No: MC1234567';
  const docSpecialty = doctor?.specialization || doctor?.department || 'Senior Consultant';

  // Format Medicines content
  let medContent = '';
  if (prescription.medicines && prescription.medicines.length > 0) {
    medContent = prescription.medicines.map(m => `
      <tr style="border-bottom: 1.5px solid #e2e8f0; page-break-inside: avoid;">
        <td style="padding: 16px 14px; font-weight: 700; color: #000; font-size: 14px;">${m.name}</td>
        <td style="padding: 16px 14px; font-weight: 600; color: #334155; font-size: 14px;">${m.dosage || '-'}</td>
        <td style="padding: 16px 14px; font-weight: 600; color: #334155; font-size: 14px;">${m.frequency || '-'}</td>
        <td style="padding: 16px 14px; font-weight: 600; color: #334155; font-size: 14px;">${m.duration || '-'}</td>
      </tr>
    `).join('');
  } else {
    // Return empty lines for blank pad
    for (let i = 0; i < 5; i++) {
      medContent += `
        <tr style="border-bottom: 1px dotted #cbd5e1; height: 50px;">
          <td></td>
          <td></td>
          <td></td>
          <td></td>
        </tr>
      `;
    }
  }

  const adviceContent = (prescription.advice || prescription.notes || prescription.diagnosis) ? `
    <div style="margin-top: 30px; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; page-break-inside: avoid;">
      <div style="font-weight: 700; font-size: 11px; text-transform: uppercase; color: #475569; letter-spacing: 0.05em; margin-bottom: 8px;">Advice / Notes:</div>
      <div style="font-size: 14px; color: #1e293b; font-weight: 500; line-height: 1.5; background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 12px 16px;">
        ${prescription.diagnosis ? `<div style="font-weight: 700; color: #000; margin-bottom: 6px;">Diagnosis: ${prescription.diagnosis}</div>` : ''}
        ${prescription.advice || prescription.notes || ''}
      </div>
    </div>
  ` : '';

  return `
    <!DOCTYPE html>
    <html>
      <head>
        <title>Prescription - ${patName}</title>
        <style>
          @page {
            size: A4;
            margin: 15mm 15mm 20mm 15mm;
          }
          body {
            font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
            margin: 0;
            padding: 0;
            color: #000;
            -webkit-print-color-adjust: exact;
            background-color: #fff;
          }
          .container {
            width: 100%;
            height: 100%;
            display: flex;
            flex-direction: column;
          }
          .header {
            text-align: center;
            padding-bottom: 12px;
          }
          .hosp-name {
            font-size: 28px;
            font-weight: 800;
            margin: 0 0 6px 0;
            letter-spacing: 0.5px;
            text-transform: uppercase;
            color: #000;
          }
          .hosp-sub {
            font-size: 13px;
            font-weight: 500;
            color: #334155;
            margin: 0 0 4px 0;
          }
          .divider {
            border-bottom: 2px solid #000;
            margin-bottom: 24px;
          }
          .patient-box {
            display: grid;
            grid-template-cols: 1.2fr 0.8fr;
            border: 1px solid #b4c6ef;
            border-radius: 8px;
            padding: 16px 20px;
            background-color: #f3f6fc;
            margin-bottom: 25px;
          }
          .info-group {
            display: flex;
            flex-direction: column;
            gap: 8px;
          }
          .info-item {
            font-size: 14px;
            color: #1e293b;
          }
          .info-label {
            font-weight: 700;
            color: #475569;
            text-transform: uppercase;
            font-size: 10px;
            letter-spacing: 0.05em;
            margin-right: 6px;
          }
          .info-value {
            font-weight: 700;
            color: #000;
          }
          .rx-symbol {
            font-size: 48px;
            font-style: italic;
            font-weight: 500;
            font-family: 'Georgia', 'Times New Roman', Times, serif;
            margin: 0 0 15px 5px;
            color: #111827;
          }
          .meds-table {
            width: 100%;
            border-collapse: collapse;
            margin-bottom: 40px;
          }
          .meds-table th {
            background-color: #e2e8f1;
            color: #334155;
            font-size: 11px;
            font-weight: 800;
            text-transform: uppercase;
            letter-spacing: 0.05em;
            padding: 10px 14px;
            text-align: left;
          }
          .meds-table th:first-child {
            border-top-left-radius: 4px;
            border-bottom-left-radius: 4px;
          }
          .meds-table th:last-child {
            border-top-right-radius: 4px;
            border-bottom-right-radius: 4px;
          }
          .footer-section {
            margin-top: auto;
            padding-top: 40px;
            display: flex;
            justify-content: space-between;
            align-items: flex-end;
            page-break-inside: avoid;
          }
          .footer-left {
            max-width: 350px;
          }
          .footer-right {
            text-align: right;
            min-width: 240px;
            display: flex;
            flex-direction: column;
            align-items: flex-end;
          }
          .sig-line {
            width: 220px;
            border-bottom: 1.5px solid #000;
            margin-bottom: 10px;
          }
          .doc-name {
            font-size: 15px;
            font-weight: 800;
            color: #000;
            margin: 0 0 2px 0;
          }
          .doc-reg {
            font-size: 12px;
            color: #475569;
            margin: 0 0 2px 0;
          }
          .doc-spec {
            font-size: 11px;
            color: #64748b;
            margin: 0;
          }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1 class="hosp-name">${hospName}</h1>
            <p class="hosp-sub">${hospAddress}</p>
            <p class="hosp-sub">Tel: ${hospPhone} | Email: contact@hms.com</p>
          </div>
          
          <div class="divider"></div>
          
          <div class="patient-box">
            <div class="info-group">
              <div class="info-item">
                <span class="info-label">PATIENT NAME:</span>
                <span class="info-value">${patName}</span>
              </div>
              <div class="info-item">
                <span class="info-label">AGE / GENDER:</span>
                <span class="info-value">${patAgeGender}</span>
              </div>
            </div>
            <div class="info-group" style="align-items: flex-end; text-align: right;">
              <div class="info-item">
                <span class="info-label">DATE:</span>
                <span class="info-value">${presDate}</span>
              </div>
              <div class="info-item">
                <span class="info-label">MRN:</span>
                <span class="info-value">${patMRN}</span>
              </div>
            </div>
          </div>
          
          <div class="rx-symbol">Rx</div>
          
          <table class="meds-table">
            <thead>
              <tr>
                <th style="width: 45%;">MEDICINE & STRENGTH</th>
                <th style="width: 18%;">DOSAGE</th>
                <th style="width: 22%;">FREQUENCY</th>
                <th style="width: 15%;">DURATION</th>
              </tr>
            </thead>
            <tbody>
              ${medContent}
            </tbody>
          </table>
          
          ${adviceContent}
          
          <div class="footer-section">
            <div class="footer-left">
              <h3 style="font-size: 12px; font-weight: 800; color: #1e293b; margin: 0 0 4px 0; text-transform: uppercase; letter-spacing: 0.02em;">Digital Health Record</h3>
              <p style="font-size: 11px; color: #64748b; margin: 0; line-height: 1.5;">This is a system-generated document authorized for clinical use. Valid for 7 days.</p>
            </div>
            <div class="footer-right">
              <div class="sig-line"></div>
              <h3 class="doc-name">${docName}</h3>
              <p class="doc-reg">${docReg}</p>
              <p class="doc-spec">${docSpecialty}</p>
            </div>
          </div>
        </div>
        
        <script>
          window.onload = () => {
            window.print();
            setTimeout(() => { window.close(); }, 500);
          }
        </script>
      </body>
    </html>
  `;
}
