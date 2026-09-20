import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

export type PdfColumn = { header: string; dataKey: string };
export type PdfRow = Record<string, string | number>;

type PdfDoc = jsPDF & { lastAutoTable?: { finalY: number } };

export function downloadPDF(opts: {
  title: string;
  subtitle?: string;
  summary: { label: string; value: string }[];
  columns: PdfColumn[];
  rows: PdfRow[];
  filename: string;
}) {
  const doc = new jsPDF({ orientation: "portrait", unit: "pt", format: "a4" }) as PdfDoc;
  const margin = 40;
  let y = margin;

  doc.setFontSize(16);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(20);
  doc.text(opts.title, margin, y);
  y += 18;

  if (opts.subtitle) {
    doc.setFontSize(10);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(110);
    doc.text(opts.subtitle, margin, y);
    y += 16;
  }

  if (opts.summary.length) {
    doc.setTextColor(20);
    doc.setFontSize(11);
    doc.setFont("helvetica", "bold");
    doc.text("Summary", margin, y + 4);
    autoTable(doc, {
      startY: y + 10,
      head: [["", ""]],
      body: opts.summary.map((s) => [s.label, s.value]),
      theme: "plain",
      styles: { fontSize: 10, cellPadding: 3 },
      columnStyles: {
        0: { fontStyle: "bold", textColor: [90, 90, 90], cellWidth: 120 },
        1: { fontStyle: "bold" },
      },
      margin: { left: margin, right: margin },
    });
    y = (doc.lastAutoTable?.finalY ?? y + 10) + 20;
  }

  autoTable(doc, {
    startY: y,
    head: [opts.columns.map((c) => c.header)],
    body: opts.rows.map((r) => opts.columns.map((c) => String(r[c.dataKey] ?? ""))),
    margin: { left: margin, right: margin },
    headStyles: { fillColor: [29, 35, 64], textColor: 255, fontStyle: "bold" },
    alternateRowStyles: { fillColor: [245, 247, 255] },
    styles: { fontSize: 9, cellPadding: 4 },
  });

  doc.save(opts.filename);
}