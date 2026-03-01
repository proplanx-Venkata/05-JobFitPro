import type { ParsedResume } from "@/types/resume";

// pdfkit is in serverExternalPackages — never bundled, always Node.js native.
// eslint-disable-next-line @typescript-eslint/no-require-imports
const PDFDocument = require("pdfkit") as typeof import("pdfkit");

const MARGIN = 50;
const PAGE_WIDTH = 612; // US Letter
const CONTENT_WIDTH = PAGE_WIDTH - MARGIN * 2;

// Fonts (all built-in to pdfkit — no external files needed)
const FONT_REGULAR = "Helvetica";
const FONT_BOLD = "Helvetica-Bold";
const FONT_ITALIC = "Helvetica-Oblique";

// Sizes
const SIZE_NAME = 20;
const SIZE_CONTACT = 9;
const SIZE_SECTION = 11;
const SIZE_BODY = 10;
const SIZE_SMALL = 9;

/**
 * Generates an ATS-safe PDF resume from a ParsedResume object.
 * Layout: Name → Contact → Summary → Experience → Education →
 *         Skills → Certifications → Projects → Languages.
 * Returns a Buffer ready to upload to Supabase Storage.
 */
export function generateResumePdf(resume: ParsedResume): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ margin: MARGIN, size: "LETTER", bufferPages: true });
    const chunks: Buffer[] = [];
    doc.on("data", (chunk: Buffer) => chunks.push(chunk));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);

    // ── Header: Name ────────────────────────────────────────────────────────
    const name = resume.personal_info.name ?? "Resume";
    doc.font(FONT_BOLD).fontSize(SIZE_NAME).text(name, { align: "center" });
    doc.moveDown(0.2);

    // ── Header: Contact ──────────────────────────────────────────────────────
    const contactParts: string[] = [];
    if (resume.personal_info.email) contactParts.push(resume.personal_info.email);
    if (resume.personal_info.phone) contactParts.push(resume.personal_info.phone);
    if (resume.personal_info.location) contactParts.push(resume.personal_info.location);
    if (resume.personal_info.linkedin) contactParts.push(resume.personal_info.linkedin);
    if (resume.personal_info.website) contactParts.push(resume.personal_info.website);

    if (contactParts.length > 0) {
      doc
        .font(FONT_REGULAR)
        .fontSize(SIZE_CONTACT)
        .text(contactParts.join("  |  "), { align: "center" });
    }

    sectionDivider(doc);

    // ── Summary ──────────────────────────────────────────────────────────────
    if (resume.summary) {
      sectionHeader(doc, "SUMMARY");
      doc.font(FONT_REGULAR).fontSize(SIZE_BODY).text(resume.summary, { align: "left" });
      doc.moveDown(0.5);
    }

    // ── Experience ───────────────────────────────────────────────────────────
    if (resume.experience.length > 0) {
      sectionHeader(doc, "EXPERIENCE");
      for (const job of resume.experience) {
        // Company + dates on same line
        const dates = formatDateRange(job.start_date, job.end_date);
        const titleLine = job.title;

        doc.font(FONT_BOLD).fontSize(SIZE_BODY);
        const companyX = MARGIN;
        const datesWidth = doc.widthOfString(dates);
        doc.text(job.company, companyX, doc.y, { continued: false });

        // Go back up to same line for dates (right-aligned)
        const prevY = doc.y - doc.currentLineHeight();
        if (dates) {
          doc
            .font(FONT_REGULAR)
            .fontSize(SIZE_SMALL)
            .text(dates, MARGIN, prevY, {
              width: CONTENT_WIDTH,
              align: "right",
            });
        }

        // Title + location
        doc.font(FONT_ITALIC).fontSize(SIZE_BODY);
        const titleText = job.location ? `${titleLine}  —  ${job.location}` : titleLine;
        doc.text(titleText, MARGIN, doc.y + 2);

        // Bullets
        if (job.bullets.length > 0) {
          doc.moveDown(0.2);
          doc.font(FONT_REGULAR).fontSize(SIZE_BODY);
          for (const bullet of job.bullets) {
            doc.text(`\u2022  ${bullet}`, MARGIN + 12, doc.y, {
              width: CONTENT_WIDTH - 12,
              align: "left",
            });
            doc.moveDown(0.15);
          }
        }
        doc.moveDown(0.4);

        // Suppress unused variable warning
        void datesWidth;
      }
    }

    // ── Education ────────────────────────────────────────────────────────────
    if (resume.education.length > 0) {
      sectionHeader(doc, "EDUCATION");
      for (const edu of resume.education) {
        const dates = formatDateRange(edu.start_date, edu.end_date);
        doc.font(FONT_BOLD).fontSize(SIZE_BODY).text(edu.institution);

        if (dates) {
          const prevY = doc.y - doc.currentLineHeight();
          doc.font(FONT_REGULAR).fontSize(SIZE_SMALL).text(dates, MARGIN, prevY, {
            width: CONTENT_WIDTH,
            align: "right",
          });
        }

        const degreeParts: string[] = [];
        if (edu.degree) degreeParts.push(edu.degree);
        if (edu.field) degreeParts.push(edu.field);
        if (edu.gpa) degreeParts.push(`GPA: ${edu.gpa}`);
        if (degreeParts.length > 0) {
          doc
            .font(FONT_ITALIC)
            .fontSize(SIZE_BODY)
            .text(degreeParts.join(", "), MARGIN, doc.y + 2);
        }
        doc.moveDown(0.4);
      }
    }

    // ── Skills ───────────────────────────────────────────────────────────────
    const hasSkills =
      resume.skills.technical.length > 0 ||
      resume.skills.soft.length > 0 ||
      resume.skills.other.length > 0;

    if (hasSkills) {
      sectionHeader(doc, "SKILLS");
      if (resume.skills.technical.length > 0) {
        skillRow(doc, "Technical", resume.skills.technical);
      }
      if (resume.skills.soft.length > 0) {
        skillRow(doc, "Soft Skills", resume.skills.soft);
      }
      if (resume.skills.other.length > 0) {
        skillRow(doc, "Other", resume.skills.other);
      }
      doc.moveDown(0.3);
    }

    // ── Certifications ───────────────────────────────────────────────────────
    if (resume.certifications.length > 0) {
      sectionHeader(doc, "CERTIFICATIONS");
      for (const cert of resume.certifications) {
        const parts: string[] = [cert.name];
        if (cert.issuer) parts.push(cert.issuer);
        if (cert.date) parts.push(cert.date);
        doc.font(FONT_REGULAR).fontSize(SIZE_BODY).text(parts.join("  \u2014  "));
        doc.moveDown(0.2);
      }
    }

    // ── Projects ─────────────────────────────────────────────────────────────
    if (resume.projects.length > 0) {
      sectionHeader(doc, "PROJECTS");
      for (const proj of resume.projects) {
        doc.font(FONT_BOLD).fontSize(SIZE_BODY).text(proj.name, { continued: false });
        if (proj.technologies.length > 0) {
          doc
            .font(FONT_ITALIC)
            .fontSize(SIZE_SMALL)
            .text(`Technologies: ${proj.technologies.join(", ")}`);
        }
        if (proj.description) {
          doc.font(FONT_REGULAR).fontSize(SIZE_BODY).text(proj.description);
        }
        doc.moveDown(0.3);
      }
    }

    // ── Languages ────────────────────────────────────────────────────────────
    if (resume.languages.length > 0) {
      sectionHeader(doc, "LANGUAGES");
      doc
        .font(FONT_REGULAR)
        .fontSize(SIZE_BODY)
        .text(resume.languages.join(", "));
    }

    doc.end();
  });
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function sectionDivider(doc: InstanceType<typeof PDFDocument>) {
  doc.moveDown(0.3);
  doc
    .moveTo(MARGIN, doc.y)
    .lineTo(PAGE_WIDTH - MARGIN, doc.y)
    .lineWidth(0.5)
    .stroke();
  doc.moveDown(0.3);
}

function sectionHeader(doc: InstanceType<typeof PDFDocument>, title: string) {
  doc.font(FONT_BOLD).fontSize(SIZE_SECTION).text(title);
  doc
    .moveTo(MARGIN, doc.y)
    .lineTo(PAGE_WIDTH - MARGIN, doc.y)
    .lineWidth(0.5)
    .stroke();
  doc.moveDown(0.3);
}

function skillRow(
  doc: InstanceType<typeof PDFDocument>,
  label: string,
  items: string[]
) {
  doc
    .font(FONT_BOLD)
    .fontSize(SIZE_BODY)
    .text(`${label}: `, { continued: true })
    .font(FONT_REGULAR)
    .text(items.join(", "));
  doc.moveDown(0.2);
}

function formatDateRange(
  start: string | null,
  end: string | null
): string {
  if (!start && !end) return "";
  if (!start) return end ?? "";
  if (!end) return `${start} – Present`;
  return `${start} – ${end}`;
}
