import jsPDF from "jspdf";

interface TypedSection {
  type?: "cover" | "summary" | "content" | "stats" | "two_columns" | "references" | "closing";
  title: string;
  content?: string;
  subtitle?: string;
  summary_items?: string[];
  stats?: { value: string; label: string }[];
  left_column?: string;
  right_column?: string;
  left_title?: string;
  right_title?: string;
}

interface DocData {
  companyName: string;
  primaryColor: string;
  secondaryColor: string;
  logoUrl?: string;
  tenderTitle: string;
  tenderRef: string;
  buyerName: string;
  deadline: string;
  sections: TypedSection[];
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

  const addPageHeader = () => {
    doc.setFillColor(...primary);
    doc.rect(0, 0, pageW, 2, "F");
    doc.setFontSize(8);
    doc.setTextColor(160, 160, 160);
    doc.text(data.companyName, margin, 10);
    doc.setDrawColor(230, 230, 230);
    doc.line(margin, 13, pageW - margin, 13);
  };

  const addPageFooter = (pageNum: number) => {
    doc.setFontSize(8);
    doc.setTextColor(160, 160, 160);
    doc.text(`${pageNum}`, pageW / 2, pageH - 10, { align: "center" });
  };

  let pageNumber = 0;

  for (const section of data.sections) {
    const sType = section.type || "content";

    if (sType === "cover") {
      // Cover page
      doc.setFillColor(...secondary);
      doc.rect(0, 0, pageW, pageH, "F");
      doc.setFillColor(...primary);
      doc.rect(0, 80, pageW, 4, "F");

      doc.setTextColor(200, 200, 200);
      doc.setFontSize(13);
      doc.setFont("helvetica", "normal");
      doc.text(data.companyName.toUpperCase(), margin, 45);

      doc.setTextColor(255, 255, 255);
      doc.setFontSize(28);
      doc.setFont("helvetica", "bold");
      const titleLines = doc.splitTextToSize(data.tenderTitle, contentW);
      doc.text(titleLines, margin, 110);

      if (section.subtitle || section.content) {
        doc.setFontSize(12);
        doc.setFont("helvetica", "italic");
        doc.setTextColor(180, 180, 180);
        const subLines = doc.splitTextToSize(section.subtitle || section.content || "", contentW);
        doc.text(subLines, margin, 110 + titleLines.length * 12 + 10);
      }

      doc.setFontSize(11);
      doc.setFont("helvetica", "normal");
      doc.setTextColor(160, 160, 160);
      let metaY = 200;
      if (data.tenderRef) { doc.text(`Référence : ${data.tenderRef}`, margin, metaY); metaY += 7; }
      if (data.buyerName) { doc.text(`Acheteur : ${data.buyerName}`, margin, metaY); metaY += 7; }
      if (data.deadline) {
        try {
          const d = new Date(data.deadline);
          doc.setTextColor(...primary);
          doc.setFont("helvetica", "bold");
          doc.text(`Date limite : ${d.toLocaleDateString("fr-FR")}`, margin, metaY);
        } catch {}
      }

      doc.setFontSize(8);
      doc.setTextColor(120, 120, 120);
      doc.text(`Document généré le ${new Date().toLocaleDateString("fr-FR")}`, margin, pageH - 15);
      continue;
    }

    doc.addPage();
    pageNumber++;

    if (sType === "summary") {
      addPageHeader();
      let y = 25;
      doc.setFillColor(...primary);
      doc.rect(margin, y, 3, 10, "F");
      doc.setTextColor(...secondary);
      doc.setFontSize(20);
      doc.setFont("helvetica", "bold");
      doc.text("Sommaire", margin + 8, y + 8);
      y += 22;

      const items = section.summary_items || (section.content ? section.content.split("\n").filter(Boolean) : []);
      items.forEach((item, idx) => {
        doc.setFontSize(14);
        doc.setFont("helvetica", "bold");
        doc.setTextColor(...primary);
        doc.text(`${String(idx + 1).padStart(2, "0")}`, margin + 5, y);
        doc.setFontSize(12);
        doc.setFont("helvetica", "normal");
        doc.setTextColor(60, 60, 60);
        doc.text(item.replace(/^\d+[\.\)]\s*/, ""), margin + 18, y);
        doc.setDrawColor(230, 230, 230);
        doc.line(margin + 18, y + 3, pageW - margin, y + 3);
        y += 12;
      });
      addPageFooter(pageNumber);
      continue;
    }

    if (sType === "stats") {
      addPageHeader();
      let y = 25;
      doc.setFillColor(...primary);
      doc.rect(margin, y, 3, 10, "F");
      doc.setTextColor(...secondary);
      doc.setFontSize(20);
      doc.setFont("helvetica", "bold");
      doc.text(section.title, margin + 8, y + 8);
      y += 25;

      const statsArr = section.stats || [];
      const count = Math.min(statsArr.length, 4);
      const boxW = count > 0 ? (contentW / count) - 5 : 40;
      const boxH = 45;

      statsArr.slice(0, 4).forEach((stat, idx) => {
        const x = margin + idx * (boxW + 5);
        doc.setFillColor(...primary);
        doc.roundedRect(x, y, boxW, boxH, 3, 3, "F");

        doc.setTextColor(255, 255, 255);
        doc.setFontSize(28);
        doc.setFont("helvetica", "bold");
        doc.text(stat.value, x + boxW / 2, y + 20, { align: "center" });

        doc.setFontSize(9);
        doc.setFont("helvetica", "normal");
        const labelLines = doc.splitTextToSize(stat.label, boxW - 6);
        doc.text(labelLines, x + boxW / 2, y + 30, { align: "center" });
      });

      addPageFooter(pageNumber);
      continue;
    }

    if (sType === "two_columns") {
      addPageHeader();
      let y = 25;
      doc.setFillColor(...primary);
      doc.rect(margin, y, 3, 10, "F");
      doc.setTextColor(...secondary);
      doc.setFontSize(20);
      doc.setFont("helvetica", "bold");
      doc.text(section.title, margin + 8, y + 8);
      y += 22;

      const colW = (contentW - 8) / 2;

      // Left column
      if (section.left_title) {
        doc.setFontSize(12);
        doc.setFont("helvetica", "bold");
        doc.setTextColor(...primary);
        doc.text(section.left_title, margin, y);
        y += 7;
      }
      doc.setFontSize(10);
      doc.setFont("helvetica", "normal");
      doc.setTextColor(60, 60, 60);
      const leftLines = doc.splitTextToSize(section.left_column || "", colW);
      doc.text(leftLines, margin, y);

      // Separator
      doc.setDrawColor(...primary);
      doc.setLineWidth(0.3);
      doc.line(margin + colW + 3, 47, margin + colW + 3, pageH - 30);

      // Right column
      let rightY = 47;
      if (section.right_title) {
        doc.setFontSize(12);
        doc.setFont("helvetica", "bold");
        doc.setTextColor(...primary);
        doc.text(section.right_title, margin + colW + 8, rightY);
        rightY += 7;
      }
      doc.setFontSize(10);
      doc.setFont("helvetica", "normal");
      doc.setTextColor(60, 60, 60);
      const rightLines = doc.splitTextToSize(section.right_column || "", colW);
      doc.text(rightLines, margin + colW + 8, rightY);

      addPageFooter(pageNumber);
      continue;
    }

    if (sType === "references") {
      addPageHeader();
      let y = 25;
      doc.setFillColor(...primary);
      doc.rect(margin, y, 3, 10, "F");
      doc.setTextColor(...secondary);
      doc.setFontSize(20);
      doc.setFont("helvetica", "bold");
      doc.text(section.title || "Références", margin + 8, y + 8);
      y += 22;

      for (const ref of data.references) {
        if (y > pageH - 40) { doc.addPage(); pageNumber++; addPageHeader(); y = 25; }
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
      addPageFooter(pageNumber);
      continue;
    }

    if (sType === "closing") {
      doc.setFillColor(...secondary);
      doc.rect(0, 0, pageW, pageH, "F");

      doc.setTextColor(255, 255, 255);
      doc.setFontSize(26);
      doc.setFont("helvetica", "bold");
      doc.text(section.title || "Merci de votre attention", pageW / 2, 120, { align: "center" });

      if (section.content) {
        doc.setFontSize(12);
        doc.setFont("helvetica", "italic");
        doc.setTextColor(180, 180, 180);
        const closingLines = doc.splitTextToSize(section.content, contentW);
        doc.text(closingLines, pageW / 2, 140, { align: "center" });
      }

      doc.setFontSize(16);
      doc.setTextColor(...primary);
      doc.setFont("helvetica", "bold");
      doc.text(data.companyName, pageW / 2, 170, { align: "center" });
      continue;
    }

    // Default content
    addPageHeader();
    let y = 25;
    doc.setFillColor(...primary);
    doc.rect(margin, y, 3, 10, "F");
    doc.setTextColor(...secondary);
    doc.setFontSize(18);
    doc.setFont("helvetica", "bold");
    doc.text(section.title, margin + 8, y + 8);
    y += 18;

    doc.setTextColor(50, 50, 50);
    doc.setFontSize(11);
    doc.setFont("helvetica", "normal");
    const lines = doc.splitTextToSize(section.content || "", contentW);

    for (const line of lines) {
      if (y > pageH - 25) {
        addPageFooter(pageNumber);
        doc.addPage();
        pageNumber++;
        addPageHeader();
        y = 20;
      }
      doc.text(line, margin, y);
      y += 6;
    }
    addPageFooter(pageNumber);
  }

  doc.save(`reponse_${data.tenderRef || "offre"}.pdf`);
}
