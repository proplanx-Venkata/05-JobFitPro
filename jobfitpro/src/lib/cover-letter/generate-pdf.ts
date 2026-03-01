import type { CoverLetterContent } from "@/types/cover-letter";
import type { ParsedResume } from "@/types/resume";

// pdfkit is in serverExternalPackages — never bundled, always Node.js native.
// eslint-disable-next-line @typescript-eslint/no-require-imports
const PDFDocument = require("pdfkit") as typeof import("pdfkit");

const MARGIN = 60;
const PAGE_WIDTH = 612; // US Letter
const CONTENT_WIDTH = PAGE_WIDTH - MARGIN * 2;

const FONT_REGULAR = "Helvetica";
const FONT_BOLD = "Helvetica-Bold";
const SIZE_CONTACT = 9;
const SIZE_BODY = 11;

/**
 * Renders a CoverLetterContent object as an ATS-safe PDF.
 * Layout: contact header → date → greeting → 3 paragraphs → closing → name.
 * Returns a Buffer ready to upload to Supabase Storage.
 */
export function generateCoverLetterPdf(
  content: CoverLetterContent,
  resume: ParsedResume,
  jdCompany: string | null,
  jdTitle: string | null
): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ margin: MARGIN, size: "LETTER", bufferPages: true });
    const chunks: Buffer[] = [];
    doc.on("data", (chunk: Buffer) => chunks.push(chunk));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);

    // ── Candidate header ──────────────────────────────────────────────────
    const name = resume.personal_info.name ?? content.candidate_name;
    doc.font(FONT_BOLD).fontSize(14).text(name, { align: "left" });

    const contactParts: string[] = [];
    if (resume.personal_info.email) contactParts.push(resume.personal_info.email);
    if (resume.personal_info.phone) contactParts.push(resume.personal_info.phone);
    if (resume.personal_info.location) contactParts.push(resume.personal_info.location);
    if (resume.personal_info.linkedin) contactParts.push(resume.personal_info.linkedin);

    if (contactParts.length > 0) {
      doc
        .font(FONT_REGULAR)
        .fontSize(SIZE_CONTACT)
        .text(contactParts.join("  |  "), { align: "left" });
    }

    // Thin divider
    doc.moveDown(0.5);
    doc
      .moveTo(MARGIN, doc.y)
      .lineTo(PAGE_WIDTH - MARGIN, doc.y)
      .lineWidth(0.5)
      .stroke();
    doc.moveDown(0.8);

    // ── Date ─────────────────────────────────────────────────────────────
    const dateStr = new Date().toLocaleDateString("en-US", {
      year: "numeric",
      month: "long",
      day: "numeric",
    });
    doc.font(FONT_REGULAR).fontSize(SIZE_BODY).text(dateStr, { align: "left" });
    doc.moveDown(1);

    // ── Addressee block (company + role if known) ──────────────────────────
    if (jdCompany || jdTitle) {
      if (jdCompany) doc.font(FONT_REGULAR).fontSize(SIZE_BODY).text(jdCompany);
      if (jdTitle)
        doc
          .font(FONT_REGULAR)
          .fontSize(SIZE_BODY)
          .text(`Re: ${jdTitle} Position`);
      doc.moveDown(1);
    }

    // ── Greeting ──────────────────────────────────────────────────────────
    doc.font(FONT_REGULAR).fontSize(SIZE_BODY).text(content.greeting);
    doc.moveDown(0.8);

    // ── Body paragraphs ───────────────────────────────────────────────────
    for (const para of content.paragraphs) {
      doc
        .font(FONT_REGULAR)
        .fontSize(SIZE_BODY)
        .text(para, { width: CONTENT_WIDTH, align: "justify" });
      doc.moveDown(0.8);
    }

    // ── Closing ───────────────────────────────────────────────────────────
    doc.moveDown(0.5);
    doc.font(FONT_REGULAR).fontSize(SIZE_BODY).text(content.closing);
    doc.moveDown(2.5); // space for handwritten signature

    // ── Typed name ────────────────────────────────────────────────────────
    doc.font(FONT_BOLD).fontSize(SIZE_BODY).text(content.candidate_name);

    // ── Page numbers ─────────────────────────────────────────────────────
    const { count: totalPages } = doc.bufferedPageRange();
    for (let i = 0; i < totalPages; i++) {
      doc.switchToPage(i);
      doc
        .font(FONT_REGULAR)
        .fontSize(SIZE_CONTACT)
        .text(
          `Page ${i + 1} of ${totalPages}`,
          MARGIN,
          doc.page.height - MARGIN + 10,
          { width: CONTENT_WIDTH, align: "center" }
        );
    }

    doc.end();
  });
}
