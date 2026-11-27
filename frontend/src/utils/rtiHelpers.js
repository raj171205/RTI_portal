export function getSLAInfo(createdAt, status) {
  if (!createdAt) {
    return { daysLeft: 30, isOverdue: false, label: "30d SLA", tone: "neutral" };
  }
  const filedDate = new Date(createdAt);
  const deadline = new Date(filedDate.getTime() + 30 * 24 * 60 * 60 * 1000);
  const now = new Date();
  const diffMs = deadline.getTime() - now.getTime();
  const daysLeft = Math.ceil(diffMs / (1000 * 60 * 60 * 24));

  if (status === "RESPONDED") {
    return {
      daysLeft,
      isOverdue: false,
      label: "Disposed",
      deadlineStr: deadline.toLocaleDateString("en-IN"),
      tone: "responded",
    };
  }

  if (daysLeft < 0) {
    return {
      daysLeft,
      isOverdue: true,
      label: `Overdue by ${Math.abs(daysLeft)}d`,
      deadlineStr: deadline.toLocaleDateString("en-IN"),
      tone: "overdue",
    };
  }

  if (daysLeft <= 5) {
    return {
      daysLeft,
      isOverdue: false,
      label: `${daysLeft}d Left (Urgent)`,
      deadlineStr: deadline.toLocaleDateString("en-IN"),
      tone: "urgent",
    };
  }

  return {
    daysLeft,
    isOverdue: false,
    label: `${daysLeft}d Left`,
    deadlineStr: deadline.toLocaleDateString("en-IN"),
    tone: "normal",
  };
}

export function exportOfficialRTIPDF(rti) {
  const filedDate = rti.created_at
    ? new Date(rti.created_at).toLocaleDateString("en-IN", {
        day: "2-digit",
        month: "long",
        year: "numeric",
      })
    : "N/A";

  const sla = getSLAInfo(rti.created_at, rti.status);

  const printWindow = window.open("", "_blank", "width=850,height=950");
  if (!printWindow) {
    alert("Please allow pop-ups to download the official RTI PDF.");
    return;
  }

  const html = `<!DOCTYPE html>
<html>
<head>
  <title>RTI Official Record - ${rti.application_no}</title>
  <style>
    body { font-family: 'Georgia', serif; color: #111827; padding: 40px; line-height: 1.6; max-width: 780px; margin: auto; }
    .header { text-align: center; border-bottom: 2px solid #111827; padding-bottom: 16px; margin-bottom: 24px; }
    .header h1 { font-size: 20px; margin: 0; letter-spacing: 0.5px; text-transform: uppercase; }
    .header p { font-size: 12px; color: #4b5563; margin: 4px 0 0; }
    .meta-table { width: 100%; border-collapse: collapse; margin-bottom: 24px; font-family: Arial, sans-serif; font-size: 13px; }
    .meta-table td { border: 1px solid #d1d5db; padding: 8px 12px; }
    .meta-label { font-weight: bold; background: #f3f4f6; width: 28%; }
    .section-title { font-family: Arial, sans-serif; font-size: 13px; font-weight: bold; text-transform: uppercase; color: #1f2937; border-bottom: 1px solid #e5e7eb; padding-bottom: 4px; margin-top: 24px; margin-bottom: 10px; }
    .box { background: #f9fafb; border: 1px solid #e5e7eb; padding: 16px; border-radius: 6px; white-space: pre-wrap; font-size: 14px; }
    .response-box { background: #ecfdf5; border: 1px solid #a7f3d0; padding: 16px; border-radius: 6px; white-space: pre-wrap; font-size: 14px; }
    .footer { margin-top: 40px; padding-top: 12px; border-top: 1px dashed #9ca3af; font-family: Arial, sans-serif; font-size: 11px; color: #6b7280; display: flex; justify-content: space-between; }
    @media print { body { padding: 20px; } }
  </style>
</head>
<body>
  <div class="header">
    <h1>Right to Information Act, 2005 — Official Record</h1>
    <p>Application Under Section 6(1) & Disposal Register Under Section 7(1)</p>
  </div>

  <table class="meta-table">
    <tr>
      <td class="meta-label">Application Number</td>
      <td><strong>${rti.application_no}</strong></td>
      <td class="meta-label">Current Status</td>
      <td><strong>${rti.status}</strong></td>
    </tr>
    <tr>
      <td class="meta-label">Public Authority</td>
      <td>${rti.category}</td>
      <td class="meta-label">Date of Filing</td>
      <td>${filedDate}</td>
    </tr>
    <tr>
      <td class="meta-label">Applicant Name</td>
      <td>${rti.citizen_name || "Registered Citizen"}</td>
      <td class="meta-label">Statutory SLA Due</td>
      <td>${sla.deadlineStr || "30 Days from Filing"}</td>
    </tr>
  </table>

  <div class="section-title">Subject of Application</div>
  <p style="font-weight: bold; font-size: 15px; margin: 0 0 16px;">${rti.subject}</p>

  <div class="section-title">Particulars of Information Sought</div>
  <div class="box">${rti.description}</div>

  ${
    rti.response_text
      ? `<div class="section-title">Official Response by Public Information Officer (PIO)</div>
         <div class="response-box">${rti.response_text}</div>`
      : `<div class="section-title">Disposal Status</div>
         <p style="font-size: 13px; color: #b45309;">Pending official disposal by the designated Public Information Officer within the mandatory 30-day statutory period.</p>`
  }

  <div class="footer">
    <span>Generated via AI-Powered RTI Portal (JanSoochna)</span>
    <span>Printed on: ${new Date().toLocaleDateString("en-IN")}</span>
  </div>
  <script>
    window.onload = function() { window.print(); };
  </script>
</body>
</html>`;

  printWindow.document.open();
  printWindow.document.write(html);
  printWindow.document.close();
}
