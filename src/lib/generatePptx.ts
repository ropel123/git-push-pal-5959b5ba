import PptxGenJS from "pptxgenjs";

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

export async function generatePptx(data: DocData) {
  const pptx = new PptxGenJS();
  pptx.layout = "LAYOUT_16x9";
  pptx.author = data.companyName;
  pptx.title = data.tenderTitle;

  const primary = data.primaryColor.replace("#", "");
  const secondary = data.secondaryColor.replace("#", "");
  const lightBg = "F8F9FA";
  const darkText = "333333";

  const addFooter = (slide: any) => {
    slide.addText(data.companyName, {
      x: 0.5, y: 5.1, w: 5, h: 0.3,
      fontSize: 8, color: "999999", fontFace: "Arial",
    });
    slide.addShape(pptx.ShapeType.rect, {
      x: 0, y: 5.45, w: 10, h: 0.03,
      fill: { color: primary },
    });
  };

  for (const section of data.sections) {
    const sType = section.type || "content";

    if (sType === "cover") {
      const cover = pptx.addSlide();
      cover.background = { color: secondary };
      cover.addShape(pptx.ShapeType.rect, {
        x: 0, y: 2.8, w: 10, h: 0.08,
        fill: { color: primary },
      });
      cover.addText(data.companyName.toUpperCase(), {
        x: 0.8, y: 0.6, w: 8, h: 0.5,
        fontSize: 14, color: "AAAAAA", fontFace: "Arial",
      });
      cover.addText(data.tenderTitle, {
        x: 0.8, y: 1.4, w: 8.4, h: 1.5,
        fontSize: 28, color: "FFFFFF", fontFace: "Arial",
        bold: true, valign: "top",
      });
      if (section.subtitle || section.content) {
        cover.addText(section.subtitle || section.content || "", {
          x: 0.8, y: 3.2, w: 8, h: 0.6,
          fontSize: 13, color: "CCCCCC", fontFace: "Arial", italic: true,
        });
      }
      const meta = [data.tenderRef && `Réf. ${data.tenderRef}`, data.buyerName].filter(Boolean).join(" — ");
      if (meta) {
        cover.addText(meta, {
          x: 0.8, y: 4.0, w: 8, h: 0.4,
          fontSize: 11, color: "888888", fontFace: "Arial",
        });
      }
      if (data.deadline) {
        try {
          const d = new Date(data.deadline);
          cover.addText(`Date limite : ${d.toLocaleDateString("fr-FR")}`, {
            x: 0.8, y: 4.4, w: 8, h: 0.4,
            fontSize: 11, color: primary, fontFace: "Arial", bold: true,
          });
        } catch {}
      }
      continue;
    }

    if (sType === "summary") {
      const slide = pptx.addSlide();
      slide.background = { color: "FFFFFF" };
      slide.addShape(pptx.ShapeType.rect, { x: 0, y: 0, w: 0.06, h: 5.63, fill: { color: primary } });
      slide.addText("Sommaire", {
        x: 0.5, y: 0.3, w: 9, h: 0.7,
        fontSize: 24, color: secondary, fontFace: "Arial", bold: true,
      });
      const items = section.summary_items || (section.content ? section.content.split("\n").filter(Boolean) : []);
      let y = 1.3;
      items.forEach((item, idx) => {
        slide.addText(`${String(idx + 1).padStart(2, "0")}`, {
          x: 0.8, y, w: 0.6, h: 0.45,
          fontSize: 18, color: primary, fontFace: "Arial", bold: true,
        });
        slide.addText(item.replace(/^\d+[\.\)]\s*/, ""), {
          x: 1.5, y, w: 7.5, h: 0.45,
          fontSize: 14, color: darkText, fontFace: "Arial",
        });
        y += 0.55;
      });
      addFooter(slide);
      continue;
    }

    if (sType === "stats") {
      const slide = pptx.addSlide();
      slide.background = { color: secondary };
      slide.addText(section.title, {
        x: 0.5, y: 0.3, w: 9, h: 0.7,
        fontSize: 22, color: "FFFFFF", fontFace: "Arial", bold: true,
      });
      slide.addShape(pptx.ShapeType.rect, { x: 0.5, y: 1.0, w: 1.5, h: 0.04, fill: { color: primary } });

      const statsArr = section.stats || [];
      const count = Math.min(statsArr.length, 4);
      const boxW = count > 0 ? (9 / count) - 0.2 : 2;
      statsArr.slice(0, 4).forEach((stat, idx) => {
        const x = 0.5 + idx * (boxW + 0.2);
        slide.addShape(pptx.ShapeType.roundRect, {
          x, y: 1.5, w: boxW, h: 2.5,
          fill: { color: primary }, rectRadius: 0.1,
        });
        slide.addText(stat.value, {
          x, y: 1.7, w: boxW, h: 1.2,
          fontSize: 48, color: "FFFFFF", fontFace: "Arial",
          bold: true, align: "center",
        });
        slide.addText(stat.label, {
          x, y: 2.9, w: boxW, h: 0.8,
          fontSize: 12, color: "FFFFFF", fontFace: "Arial",
          align: "center", valign: "top",
        });
      });
      slide.addText(data.companyName, {
        x: 0.5, y: 5.1, w: 5, h: 0.3,
        fontSize: 8, color: "666666", fontFace: "Arial",
      });
      continue;
    }

    if (sType === "two_columns") {
      const slide = pptx.addSlide();
      slide.background = { color: lightBg };
      slide.addShape(pptx.ShapeType.rect, { x: 0, y: 0, w: 0.06, h: 5.63, fill: { color: primary } });
      slide.addText(section.title, {
        x: 0.5, y: 0.3, w: 9, h: 0.7,
        fontSize: 22, color: secondary, fontFace: "Arial", bold: true,
      });
      slide.addShape(pptx.ShapeType.rect, { x: 0.5, y: 1.05, w: 1.5, h: 0.04, fill: { color: primary } });

      // Left column
      if (section.left_title) {
        slide.addText(section.left_title, {
          x: 0.5, y: 1.3, w: 4.2, h: 0.4,
          fontSize: 14, color: primary, fontFace: "Arial", bold: true,
        });
      }
      slide.addText(section.left_column || "", {
        x: 0.5, y: section.left_title ? 1.7 : 1.3, w: 4.2, h: 3.2,
        fontSize: 12, color: darkText, fontFace: "Arial", valign: "top", paraSpaceAfter: 6,
      });

      // Separator
      slide.addShape(pptx.ShapeType.rect, {
        x: 4.9, y: 1.3, w: 0.02, h: 3.5,
        fill: { color: primary },
      });

      // Right column
      if (section.right_title) {
        slide.addText(section.right_title, {
          x: 5.2, y: 1.3, w: 4.3, h: 0.4,
          fontSize: 14, color: primary, fontFace: "Arial", bold: true,
        });
      }
      slide.addText(section.right_column || "", {
        x: 5.2, y: section.right_title ? 1.7 : 1.3, w: 4.3, h: 3.2,
        fontSize: 12, color: darkText, fontFace: "Arial", valign: "top", paraSpaceAfter: 6,
      });

      addFooter(slide);
      continue;
    }

    if (sType === "references") {
      const refSlide = pptx.addSlide();
      refSlide.background = { color: "FFFFFF" };
      refSlide.addShape(pptx.ShapeType.rect, { x: 0, y: 0, w: 0.06, h: 5.63, fill: { color: primary } });
      refSlide.addText(section.title || "Nos références", {
        x: 0.5, y: 0.3, w: 9, h: 0.7,
        fontSize: 22, color: secondary, fontFace: "Arial", bold: true,
      });
      refSlide.addShape(pptx.ShapeType.rect, { x: 0.5, y: 1.05, w: 1.5, h: 0.04, fill: { color: primary } });

      let refY = 1.4;
      for (const ref of data.references.slice(0, 5)) {
        refSlide.addShape(pptx.ShapeType.roundRect, {
          x: 0.5, y: refY, w: 9, h: 0.7,
          fill: { color: lightBg }, rectRadius: 0.05,
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
      addFooter(refSlide);
      continue;
    }

    if (sType === "closing") {
      const endSlide = pptx.addSlide();
      endSlide.background = { color: secondary };
      endSlide.addText(section.title || "Merci de votre attention", {
        x: 1, y: 1.8, w: 8, h: 1,
        fontSize: 32, color: "FFFFFF", fontFace: "Arial",
        bold: true, align: "center",
      });
      if (section.content) {
        endSlide.addText(section.content, {
          x: 1, y: 2.8, w: 8, h: 0.8,
          fontSize: 14, color: "CCCCCC", fontFace: "Arial",
          align: "center", italic: true,
        });
      }
      endSlide.addText(data.companyName, {
        x: 1, y: 3.8, w: 8, h: 0.5,
        fontSize: 16, color: primary, fontFace: "Arial",
        align: "center",
      });
      continue;
    }

    // Default: content slide
    const slide = pptx.addSlide();
    // Alternate background
    const contentIdx = data.sections.filter(s => (s.type || "content") === "content").indexOf(section);
    slide.background = { color: contentIdx % 2 === 0 ? "FFFFFF" : lightBg };
    slide.addShape(pptx.ShapeType.rect, { x: 0, y: 0, w: 0.06, h: 5.63, fill: { color: primary } });
    slide.addText(section.title, {
      x: 0.5, y: 0.3, w: 9, h: 0.7,
      fontSize: 22, color: secondary, fontFace: "Arial", bold: true,
    });
    slide.addShape(pptx.ShapeType.rect, { x: 0.5, y: 1.05, w: 1.5, h: 0.04, fill: { color: primary } });
    slide.addText(section.content || "", {
      x: 0.5, y: 1.4, w: 9, h: 3.8,
      fontSize: 13, color: darkText, fontFace: "Arial",
      valign: "top", paraSpaceAfter: 8,
    });
    addFooter(slide);
  }

  // Fallback: if no closing slide was generated, add one
  const hasClosing = data.sections.some(s => s.type === "closing");
  if (!hasClosing) {
    const endSlide = pptx.addSlide();
    endSlide.background = { color: secondary };
    endSlide.addText("Merci de votre attention", {
      x: 1, y: 2, w: 8, h: 1,
      fontSize: 32, color: "FFFFFF", fontFace: "Arial", bold: true, align: "center",
    });
    endSlide.addText(data.companyName, {
      x: 1, y: 3.2, w: 8, h: 0.5,
      fontSize: 16, color: primary, fontFace: "Arial", align: "center",
    });
  }

  await pptx.writeFile({ fileName: `reponse_${data.tenderRef || "offre"}.pptx` });
}
