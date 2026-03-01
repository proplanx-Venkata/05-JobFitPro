import {
  Document,
  Paragraph,
  TextRun,
  HeadingLevel,
  AlignmentType,
  BorderStyle,
  Packer,
} from "docx";
import type { ParsedResume } from "@/types/resume";

/**
 * Generates an ATS-safe DOCX resume from a ParsedResume object.
 * Section order mirrors generate-pdf.ts:
 * Name → Contact → Summary → Experience → Education →
 * Skills → Certifications → Projects → Languages
 * Returns a Buffer ready to send as a download.
 */
export async function generateResumeDocx(resume: ParsedResume): Promise<Buffer> {
  const children: Paragraph[] = [];

  // ── Name ──────────────────────────────────────────────────────────────────
  children.push(
    new Paragraph({
      text: resume.personal_info.name ?? "Resume",
      heading: HeadingLevel.TITLE,
      alignment: AlignmentType.CENTER,
    })
  );

  // ── Contact line ──────────────────────────────────────────────────────────
  const contactParts: string[] = [];
  if (resume.personal_info.email) contactParts.push(resume.personal_info.email);
  if (resume.personal_info.phone) contactParts.push(resume.personal_info.phone);
  if (resume.personal_info.location) contactParts.push(resume.personal_info.location);
  if (resume.personal_info.linkedin) contactParts.push(resume.personal_info.linkedin);
  if (resume.personal_info.website) contactParts.push(resume.personal_info.website);

  if (contactParts.length > 0) {
    children.push(
      new Paragraph({
        alignment: AlignmentType.CENTER,
        children: [new TextRun({ text: contactParts.join("  |  "), size: 18 })],
        spacing: { after: 120 },
      })
    );
  }

  // ── Divider ───────────────────────────────────────────────────────────────
  children.push(dividerParagraph());

  // ── Summary ───────────────────────────────────────────────────────────────
  if (resume.summary) {
    children.push(sectionHeader("SUMMARY"));
    children.push(
      new Paragraph({
        alignment: AlignmentType.JUSTIFIED,
        children: [new TextRun({ text: resume.summary, size: 20 })],
        spacing: { after: 120 },
      })
    );
  }

  // ── Experience ────────────────────────────────────────────────────────────
  if (resume.experience.length > 0) {
    children.push(sectionHeader("EXPERIENCE"));
    for (const job of resume.experience) {
      const dates = formatDateRange(job.start_date, job.end_date);

      // Company (bold) + dates (right side via tab or space)
      children.push(
        new Paragraph({
          children: [
            new TextRun({ text: job.company, bold: true, size: 20 }),
            ...(dates
              ? [new TextRun({ text: `\t${dates}`, size: 18 })]
              : []),
          ],
          tabStops: [{ type: "right" as const, position: 9360 }],
          spacing: { before: 80 },
        })
      );

      // Title + location (italic)
      const titleText = job.location ? `${job.title}  —  ${job.location}` : job.title;
      children.push(
        new Paragraph({
          children: [new TextRun({ text: titleText, italics: true, size: 20 })],
          spacing: { after: 40 },
        })
      );

      // Bullets
      for (const bullet of job.bullets) {
        children.push(
          new Paragraph({
            bullet: { level: 0 },
            alignment: AlignmentType.JUSTIFIED,
            children: [new TextRun({ text: bullet, size: 20 })],
            spacing: { after: 40 },
          })
        );
      }
      children.push(new Paragraph({ spacing: { after: 80 } }));
    }
  }

  // ── Education ─────────────────────────────────────────────────────────────
  if (resume.education.length > 0) {
    children.push(sectionHeader("EDUCATION"));
    for (const edu of resume.education) {
      const dates = formatDateRange(edu.start_date, edu.end_date);
      children.push(
        new Paragraph({
          children: [
            new TextRun({ text: edu.institution, bold: true, size: 20 }),
            ...(dates ? [new TextRun({ text: `\t${dates}`, size: 18 })] : []),
          ],
          tabStops: [{ type: "right" as const, position: 9360 }],
          spacing: { before: 80 },
        })
      );

      const degreeParts: string[] = [];
      if (edu.degree) degreeParts.push(edu.degree);
      if (edu.field) degreeParts.push(edu.field);
      if (edu.gpa) degreeParts.push(`GPA: ${edu.gpa}`);
      if (degreeParts.length > 0) {
        children.push(
          new Paragraph({
            children: [new TextRun({ text: degreeParts.join(", "), italics: true, size: 20 })],
            spacing: { after: 80 },
          })
        );
      }
    }
  }

  // ── Skills ────────────────────────────────────────────────────────────────
  const hasSkills =
    resume.skills.technical.length > 0 ||
    resume.skills.soft.length > 0 ||
    resume.skills.other.length > 0;

  if (hasSkills) {
    children.push(sectionHeader("SKILLS"));
    if (resume.skills.technical.length > 0) {
      children.push(skillParagraph("Technical", resume.skills.technical));
    }
    if (resume.skills.soft.length > 0) {
      children.push(skillParagraph("Soft Skills", resume.skills.soft));
    }
    if (resume.skills.other.length > 0) {
      children.push(skillParagraph("Other", resume.skills.other));
    }
    children.push(new Paragraph({ spacing: { after: 80 } }));
  }

  // ── Certifications ────────────────────────────────────────────────────────
  if (resume.certifications.length > 0) {
    children.push(sectionHeader("CERTIFICATIONS"));
    for (const cert of resume.certifications) {
      const parts = [cert.name];
      if (cert.issuer) parts.push(cert.issuer);
      if (cert.date) parts.push(cert.date);
      children.push(
        new Paragraph({
          children: [new TextRun({ text: parts.join("  —  "), size: 20 })],
          spacing: { after: 60 },
        })
      );
    }
  }

  // ── Projects ──────────────────────────────────────────────────────────────
  if (resume.projects.length > 0) {
    children.push(sectionHeader("PROJECTS"));
    for (const proj of resume.projects) {
      children.push(
        new Paragraph({
          children: [new TextRun({ text: proj.name, bold: true, size: 20 })],
          spacing: { before: 80 },
        })
      );
      if (proj.technologies.length > 0) {
        children.push(
          new Paragraph({
            children: [
              new TextRun({
                text: `Technologies: ${proj.technologies.join(", ")}`,
                italics: true,
                size: 18,
              }),
            ],
          })
        );
      }
      if (proj.description) {
        children.push(
          new Paragraph({
            alignment: AlignmentType.JUSTIFIED,
            children: [new TextRun({ text: proj.description, size: 20 })],
            spacing: { after: 80 },
          })
        );
      }
    }
  }

  // ── Languages ─────────────────────────────────────────────────────────────
  if (resume.languages.length > 0) {
    children.push(sectionHeader("LANGUAGES"));
    children.push(
      new Paragraph({
        children: [new TextRun({ text: resume.languages.join(", "), size: 20 })],
      })
    );
  }

  const doc = new Document({
    sections: [{ children }],
    styles: {
      default: {
        document: {
          run: { font: "Calibri", size: 20 },
          paragraph: { spacing: { line: 276 } },
        },
      },
    },
  });

  const arrayBuffer = await Packer.toBuffer(doc);
  return Buffer.from(arrayBuffer);
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function sectionHeader(title: string): Paragraph {
  return new Paragraph({
    children: [new TextRun({ text: title, bold: true, size: 22 })],
    border: {
      bottom: {
        color: "000000",
        space: 1,
        style: BorderStyle.SINGLE,
        size: 4,
      },
    },
    spacing: { before: 200, after: 80 },
  });
}

function dividerParagraph(): Paragraph {
  return new Paragraph({
    border: {
      bottom: {
        color: "000000",
        space: 1,
        style: BorderStyle.SINGLE,
        size: 4,
      },
    },
    spacing: { before: 80, after: 80 },
  });
}

function skillParagraph(label: string, items: string[]): Paragraph {
  return new Paragraph({
    children: [
      new TextRun({ text: `${label}: `, bold: true, size: 20 }),
      new TextRun({ text: items.join(", "), size: 20 }),
    ],
    spacing: { after: 40 },
  });
}

function formatDateRange(start: string | null, end: string | null): string {
  if (!start && !end) return "";
  if (!start) return end ?? "";
  if (!end) return start;
  return `${start} – ${end}`;
}

