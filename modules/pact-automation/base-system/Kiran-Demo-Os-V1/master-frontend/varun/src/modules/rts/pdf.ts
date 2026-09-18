// Real PDF generation for a reimbursement claim. jsPDF is imported dynamically so it
// only lands in the bundle when someone actually exports — it is ~350 kB.
//
// The document is drawn, not screenshotted: every value is typed onto the page, so the
// output is selectable, searchable text at any zoom.

import type { Employee, Payout, ReceiptRequest } from './types';
import { CATEGORY_LABEL, STAGE_LABEL, statusLabel } from './status';
import { formatAmount, formatDate, formatDateRange, formatDateTime, maskAccount } from './format';

// design.md palette, as RGB for jsPDF.
const NAVY: [number, number, number] = [2, 34, 60];
const ORANGE: [number, number, number] = [233, 151, 65];
const INK: [number, number, number] = [51, 51, 51];
const META: [number, number, number] = [107, 114, 128];
const HAIRLINE: [number, number, number] = [220, 225, 230];

/** `formatCurrency` emits ₹, which the built-in PDF fonts cannot encode. */
function rupees(value: number): string {
  return `INR ${formatAmount(value)}`;
}

export async function exportRequestPdf(
  request: ReceiptRequest,
  employee: Employee | undefined,
  payout?: Payout,
): Promise<void> {
  const { jsPDF } = await import('jspdf');
  const doc = new jsPDF({ unit: 'pt', format: 'a4' });

  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  const M = 48; // margin
  const CONTENT = pageW - M * 2;
  let y = 0;

  /** Starts a new page when the next block would overflow the footer zone. */
  const ensure = (needed: number) => {
    if (y + needed > pageH - 72) {
      doc.addPage();
      y = M;
    }
  };

  const rule = () => {
    doc.setDrawColor(...HAIRLINE);
    doc.setLineWidth(0.75);
    doc.line(M, y, M + CONTENT, y);
  };

  /* ------------------------------------------------------------ letterhead */
  doc.setFillColor(...NAVY);
  doc.rect(0, 0, pageW, 84, 'F');
  doc.setFillColor(...ORANGE);
  doc.rect(M, 26, 5, 32, 'F');

  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(20);
  doc.text('RTS', M + 14, 44);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(220, 226, 232);
  doc.text('Kiran Udyog  ·  Receipt & Reimbursement Tracking', M + 14, 58);

  doc.setFontSize(9);
  doc.text('CLAIM SUMMARY', pageW - M, 44, { align: 'right' });
  doc.setFontSize(11);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(255, 255, 255);
  doc.text(request.id, pageW - M, 60, { align: 'right' });

  y = 118;

  /* ----------------------------------------------------------------- title */
  doc.setTextColor(2, 22, 39);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(17);
  const titleLines = doc.splitTextToSize(request.title, CONTENT - 130) as string[];
  doc.text(titleLines, M, y);

  // Status chip, right-aligned against the title.
  const chip = statusLabel(request.status).toUpperCase();
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  const chipW = doc.getTextWidth(chip) + 16;
  doc.setFillColor(...NAVY);
  doc.rect(pageW - M - chipW, y - 11, chipW, 16, 'F');
  doc.setTextColor(255, 255, 255);
  doc.text(chip, pageW - M - chipW / 2, y, { align: 'center' });

  y += titleLines.length * 20 + 4;

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  doc.setTextColor(...META);
  doc.text(
    `Raised by ${employee?.name ?? 'Unknown'} (${employee?.employeeCode ?? '—'})  ·  ${
      employee?.department ?? '—'
    }`,
    M,
    y,
  );
  y += 22;

  /* ---------------------------------------------------------- amount panel */
  doc.setFillColor(246, 248, 250);
  doc.rect(M, y, CONTENT, 54, 'F');
  doc.setDrawColor(...HAIRLINE);
  doc.rect(M, y, CONTENT, 54, 'S');

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(...META);
  doc.text('CLAIMED AMOUNT', M + 14, y + 19);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(20);
  doc.setTextColor(2, 22, 39);
  doc.text(rupees(request.amount), M + 14, y + 42);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(...META);
  doc.text('CURRENT STAGE', pageW - M - 14, y + 19, { align: 'right' });
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.setTextColor(2, 22, 39);
  doc.text(STAGE_LABEL[request.currentStage], pageW - M - 14, y + 40, { align: 'right' });

  y += 78;

  /* --------------------------------------------------------------- section */
  const section = (label: string) => {
    ensure(40);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9);
    doc.setTextColor(...META);
    doc.text(label.toUpperCase(), M, y);
    y += 6;
    rule();
    y += 16;
  };

  /** Two-column definition rows. */
  const pairs = (rows: Array<[string, string]>) => {
    const colW = CONTENT / 2;
    rows.forEach(([k, v], i) => {
      const col = i % 2;
      if (col === 0) ensure(34);
      const x = M + col * colW;
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(8);
      doc.setTextColor(...META);
      doc.text(k.toUpperCase(), x, y);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(10);
      doc.setTextColor(...INK);
      const lines = doc.splitTextToSize(v, colW - 16) as string[];
      doc.text(lines, x, y + 14);
      if (col === 1 || i === rows.length - 1) y += 34;
    });
    y += 6;
  };

  section('Request details');
  pairs([
    ['Category', CATEGORY_LABEL[request.category]],
    ['Amount', rupees(request.amount)],
    ['Travel dates', formatDateRange(request.travelDates)],
    ['Submitted on', formatDateTime(request.submittedOn)],
    ['Status', statusLabel(request.status)],
    ['SLA due', request.slaDueOn ? formatDate(request.slaDueOn) : '—'],
    ['Department', employee?.department ?? '—'],
    ['Reporting manager', employee?.managerName ?? '—'],
  ]);

  section('Justification');
  ensure(40);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  doc.setTextColor(...INK);
  const just = doc.splitTextToSize(request.justification, CONTENT) as string[];
  doc.text(just, M, y);
  y += just.length * 14 + 16;

  /* -------------------------------------------------------------- receipts */
  section(`Receipts (${request.receipts.length})`);
  if (request.receipts.length === 0) {
    doc.setFont('helvetica', 'italic');
    doc.setFontSize(10);
    doc.setTextColor(...META);
    doc.text('No receipts attached.', M, y);
    y += 22;
  } else {
    request.receipts.forEach((r) => {
      ensure(20);
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(10);
      doc.setTextColor(...INK);
      doc.text(r.fileName, M, y);
      doc.setTextColor(...META);
      doc.setFontSize(9);
      doc.text(
        `${r.sizeKb >= 1024 ? `${(r.sizeKb / 1024).toFixed(1)} MB` : `${Math.round(r.sizeKb)} KB`}  ·  ${formatDate(r.uploadedOn)}`,
        pageW - M,
        y,
        { align: 'right' },
      );
      y += 17;
    });
    y += 8;
  }

  /* -------------------------------------------------------------- approval */
  section('Approval trail');
  if (request.timeline.length === 0) {
    doc.setFont('helvetica', 'italic');
    doc.setFontSize(10);
    doc.setTextColor(...META);
    doc.text('Nothing has happened yet — this claim is still a draft.', M, y);
    y += 22;
  } else {
    request.timeline.forEach((e) => {
      ensure(34);
      doc.setFillColor(...ORANGE);
      doc.rect(M, y - 7, 3, 10, 'F');

      doc.setFont('helvetica', 'bold');
      doc.setFontSize(10);
      doc.setTextColor(...INK);
      doc.text(e.action, M + 12, y);

      doc.setFont('helvetica', 'normal');
      doc.setFontSize(9);
      doc.setTextColor(...META);
      doc.text(`${e.actor} · ${e.role}`, M + 12, y + 12);
      doc.text(formatDateTime(e.at), pageW - M, y, { align: 'right' });
      y += 20;

      if (e.comment) {
        const c = doc.splitTextToSize(`"${e.comment}"`, CONTENT - 24) as string[];
        ensure(c.length * 12 + 8);
        doc.setFont('helvetica', 'italic');
        doc.setFontSize(9);
        doc.setTextColor(...META);
        doc.text(c, M + 12, y + 4);
        y += c.length * 12 + 6;
      }
      y += 6;
    });
  }

  /* --------------------------------------------------------------- payment */
  if (payout) {
    section('Payment');
    pairs([
      ['Payout ID', payout.id],
      ['Method', payout.method],
      ['Amount', rupees(payout.amount)],
      ['Status', payout.status],
      ['Initiated on', formatDate(payout.initiatedOn)],
      ['Settled on', payout.settledOn ? formatDate(payout.settledOn) : '—'],
      ['UTR', payout.utr ?? '—'],
      [
        'Bank account',
        employee
          ? `${employee.bankAccount.bankName} ${maskAccount(employee.bankAccount.accountNumberMasked)} · ${employee.bankAccount.ifsc}`
          : '—',
      ],
    ]);
  }

  /* ---------------------------------------------------------------- footer */
  const pages = doc.getNumberOfPages();
  for (let p = 1; p <= pages; p += 1) {
    doc.setPage(p);
    doc.setDrawColor(...HAIRLINE);
    doc.setLineWidth(0.75);
    doc.line(M, pageH - 52, pageW - M, pageH - 52);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(...META);
    doc.text(
      `Generated ${formatDateTime(new Date())}  ·  Demo build, no funds were transferred`,
      M,
      pageH - 36,
    );
    doc.text(`Page ${p} of ${pages}`, pageW - M, pageH - 36, { align: 'right' });
  }

  doc.save(`${request.id}-${(employee?.name ?? 'claim').replace(/\s+/g, '-')}.pdf`);
}
