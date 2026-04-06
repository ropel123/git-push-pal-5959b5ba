import PptxGenJS from "pptxgenjs";

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

export async function generatePptx(data: DocData) {
  const pptx = new PptxGenJS();
  pptx.layout = "LAYOUT_16x9";
  pptx.author = data.companyName;
  pptx.title = data.tenderTitle;

  const primary = data.primaryColor.replace("#", "");
  const secondary = data.secondaryColor.replace("#", "");

  // ---- Cover slide ----
  const cover = pptx.addSlide();
  cover.background = { color: secondary };

  // Accent bar
  cover.addShape(pptx.ShapeType.rect, {
    x: 0, y: 2.8, w: 10, h: 0.08,
    fill: { color: primary },
  });

  cover.addText(data.companyName.toUpperCase(), {
    x: 0.8, y: 0.8, w: 8, h: 0.6,
    fontSize: 14, color: "CCCCCC", fontFace: "Arial",
    bold: false,
  });

  cover.addText(data.tenderTitle, {
    x: 0.8, y: 1.8, w: 8.4, h: 1.5,
    fontSize: 28, color: "FFFFFF", fontFace: "Arial",
    bold: true, valign: "top",
  });

  const meta = [data.tenderRef && `Réf. ${data.tenderRef}`, data.buyerName].filter(Boolean).join(" — ");
  if (meta) {
    cover.addText(meta, {
      x: 0.8, y: 3.2, w: 8, h: 0.5,
      fontSize: 12, color: "AAAAAA", fontFace: "Arial",
    });
  }

  if (data.deadline) {
    try {
      const d = new Date(data.deadline);
      cover.addText(`Date limite : ${d.toLocaleDateString("fr-FR")}`, {
        x: 0.8, y: 3.7, w: 8, h: 0.4,
        fontSize: 11, color: primary, fontFace: "Arial", bold: true,
      });
    } catch {}
  }

  // ---- Content slides ----
  for (const section of data.sections) {
    const slide = pptx.addSlide();
    slide.background = { color: "FFFFFF" };

    // Accent bar left
    slide.addShape(pptx.ShapeType.rect, {
      x: 0, y: 0, w: 0.06, h: 5.63,
      fill: { color: primary },
    });

    // Title
    slide.addText(section.title, {
      x: 0.5, y: 0.3, w: 9, h: 0.7,
      fontSize: 22, color: secondary, fontFace: "Arial",
      bold: true,
    });

    // Divider
    slide.addShape(pptx.ShapeType.rect, {
      x: 0.5, y: 1.05, w: 1.5, h: 0.04,
      fill: { color: primary },
    });

    // Content
    slide.addText(section.content, {
      x: 0.5, y: 1.4, w: 9, h: 3.8,
      fontSize: 13, color: "333333", fontFace: "Arial",
      valign: "top", paraSpaceAfter: 8,
    });

    // Footer
    slide.addText(data.companyName, {
      x: 0.5, y: 5.1, w: 5, h: 0.3,
      fontSize: 8, color: "999999", fontFace: "Arial",
    });
  }

  // ---- References slide ----
  if (data.references.length > 0) {
    const refSlide = pptx.addSlide();
    refSlide.background = { color: "FFFFFF" };

    refSlide.addShape(pptx.ShapeType.rect, {
      x: 0, y: 0, w: 0.06, h: 5.63,
      fill: { color: primary },
    });

    refSlide.addText("Nos références", {
      x: 0.5, y: 0.3, w: 9, h: 0.7,
      fontSize: 22, color: secondary, fontFace: "Arial",
      bold: true,
    });

    refSlide.addShape(pptx.ShapeType.rect, {
      x: 0.5, y: 1.05, w: 1.5, h: 0.04,
      fill: { color: primary },
    });

    let refY = 1.4;
    for (const ref of data.references.slice(0, 5)) {
      refSlide.addShape(pptx.ShapeType.roundRect, {
        x: 0.5, y: refY, w: 9, h: 0.7,
        fill: { color: "F5F5F5" }, rectRadius: 0.05,
      });
      refSlide.addText(ref.title || "Projet", {
        x: 0.7, y: refY + 0.05, w: 5, h: 0.3,
        fontSize: 12, color: secondary, fontFace: "Arial", bold: true,
      });
      const details = [ref.client, ref.montant, ref.date].filter(Boolean).join(" · ");
      refSlide.addText(details, {
        x: 0.7, y: refY + 0.35, w: 8, h: 0.25,
        fontSize: 9, color: "888888", fontFace: "Arial",
      });
      refY += 0.85;
    }
  }

  // ---- End slide ----
  const endSlide = pptx.addSlide();
  endSlide.background = { color: secondary };
  endSlide.addText("Merci de votre attention", {
    x: 1, y: 2, w: 8, h: 1,
    fontSize: 32, color: "FFFFFF", fontFace: "Arial",
    bold: true, align: "center",
  });
  endSlide.addText(data.companyName, {
    x: 1, y: 3.2, w: 8, h: 0.5,
    fontSize: 16, color: primary, fontFace: "Arial",
    align: "center",
  });

  await pptx.writeFile({ fileName: `reponse_${data.tenderRef || "offre"}.pptx` });
}
