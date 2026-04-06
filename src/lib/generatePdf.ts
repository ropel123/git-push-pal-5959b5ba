import jsPDF from "jspdf";

interface DocData {
  companyName: string;
  primaryColor: string;
  secondaryColor: string;
  logoUrl?: string;
  tenderTitle: string;
  tenderRef: string;
  buyerName: string;
  deadline: string;
  sections: { title: string; content: string }[];
  references: { title?: string; client?: string; montant?: string; date?: string }[];
}

function hexToRgb(hex: string): [number, number, number] {
  const h = hex.replace("#", "");
  return [parseInt(h.substring(0, 2), 16), parseInt(h.substring(2, 4), 16), parseInt(h.substring(4, 6), 16)];
}

export async function generatePdf(data: DocData) {
  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
  const pageW = 210;
  const pageH = 297;
  const margin = 20;
  const contentW = pageW - margin * 2;
  const primary = hexToRgb(data.primaryColor);
  const secondary = hexToRgb(data.secondaryColor);

  // ---- Cover page ----
  doc.setFillColor(...secondary);
  doc.rect(0, 0, pageW, pageH, "F");

  // Accent bar
  doc.setFillColor(...primary);
  doc.rect(0, 80, pageW, 4, "F");

  // Company name
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(14);
  doc.text(data.companyName.toUpperCase(), margin, 50);

  // Title
  doc.setFontSize(28);
  doc.setFont("helvetica", "bold");
  const titleLines = doc.splitTextToSize(data.tenderTitle, contentW);
  doc.text(titleLines, margin, 110);

  // Metadata
  doc.setFontSize(12);
  doc.setFont("helvetica", "normal");
  let metaY = 110 + titleLines.length * 12 + 15;
  if (data.tenderRef) { doc.text(`Référence : ${data.tenderRef}`, margin, metaY); metaY += 8; }
  if (data.buyerName) { doc.text(`Acheteur : ${data.buyerName}`, margin, metaY); metaY += 8; }
  if (data.deadline) {
    try {
      const d = new Date(data.deadline);
      doc.text(`Date limite : ${d.toLocaleDateString("fr-FR")}`, margin, metaY);
    } catch {}
  }

  // Footer
  doc.setFontSize(9);
  doc.setTextColor(180, 180, 180);
  doc.text(`Document généré le ${new Date().toLocaleDateString("fr-FR")}`, margin, pageH - 15);

  // ---- Content pages ----
  for (const section of data.sections) {
    doc.addPage();
    let y = margin;

    // Section title
    doc.setFillColor(...primary);
    doc.rect(margin, y, 3, 10, "F");
    doc.setTextColor(...secondary);
    doc.setFontSize(18);
    doc.setFont("helvetica", "bold");
    doc.text(section.title, margin + 8, y + 8);
    y += 18;

    // Section content
    doc.setTextColor(50, 50, 50);
    doc.setFontSize(11);
    doc.setFont("helvetica", "normal");
    const lines = doc.splitTextToSize(section.content, contentW);

    for (const line of lines) {
      if (y > pageH - 25) {
        doc.addPage();
        y = margin;
      }
      doc.text(line, margin, y);
      y += 6;
    }
  }

  // ---- References page ----
  if (data.references.length > 0) {
    doc.addPage();
    let y = margin;
    doc.setFillColor(...primary);
    doc.rect(margin, y, 3, 10, "F");
    doc.setTextColor(...secondary);
    doc.setFontSize(18);
    doc.setFont("helvetica", "bold");
    doc.text("Références", margin + 8, y + 8);
    y += 20;

    for (const ref of data.references) {
      if (y > pageH - 40) { doc.addPage(); y = margin; }
      doc.setFillColor(245, 245, 245);
      doc.roundedRect(margin, y, contentW, 22, 2, 2, "F");

      doc.setTextColor(...secondary);
      doc.setFontSize(11);
      doc.setFont("helvetica", "bold");
      doc.text(ref.title || "Projet", margin + 5, y + 8);

      doc.setFont("helvetica", "normal");
      doc.setFontSize(9);
      doc.setTextColor(100, 100, 100);
      const details = [ref.client, ref.montant, ref.date].filter(Boolean).join(" · ");
      doc.text(details, margin + 5, y + 16);

      y += 28;
    }
  }

  doc.save(`reponse_${data.tenderRef || "offre"}.pdf`);
}
