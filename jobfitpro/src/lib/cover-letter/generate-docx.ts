import {
  Document,
  Paragraph,
  TextRun,
  AlignmentType,
  BorderStyle,
  Packer,
} from "docx";
import type { CoverLetterContent } from "@/types/cover-letter";
import type { ParsedResume } from "@/types/resume";

/**
 * Renders a CoverLetterContent object as a DOCX document.
 * Layout mirrors generate-pdf.ts:
 * candidate header → divider → date → addressee → greeting → body → closing → name
 * Returns a Buffer ready to send as a download.
 */
export async function generateCoverLetterDocx(
  content: CoverLetterContent,
  resume: ParsedResume,
  jdCompany: string | null,
  jdTitle: string | null
): Promise<Buffer> {
  const children: Paragraph[] = [];

  // ── Candidate name ────────────────────────────────────────────────────────
  const name = resume.personal_info.name ?? content.candidate_name;
  children.push(
    new Paragraph({
      children: [new TextRun({ text: name, bold: true, size: 28 })],
      spacing: { after: 60 },
    })
  );

  // ── Contact line ──────────────────────────────────────────────────────────
  const contactParts: string[] = [];
  if (resume.personal_info.email) contactParts.push(resume.personal_info.email);
  if (resume.personal_info.phone) contactParts.push(resume.personal_info.phone);
  if (resume.personal_info.location) contactParts.push(resume.personal_info.location);
  if (resume.personal_info.linkedin) contactParts.push(resume.personal_info.linkedin);

  if (contactParts.length > 0) {
    children.push(
      new Paragraph({
        children: [new TextRun({ text: contactParts.join("  |  "), size: 18 })],
        spacing: { after: 120 },
      })
    );
  }

  // ── Divider ───────────────────────────────────────────────────────────────
  children.push(
    new Paragraph({
      border: {
        bottom: {
          color: "000000",
          space: 1,
          style: BorderStyle.SINGLE,
          size: 4,
        },
      },
      spacing: { before: 80, after: 200 },
    })
  );

  // ── Date ──────────────────────────────────────────────────────────────────
  const dateStr = new Date().toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
  children.push(
    new Paragraph({
      children: [new TextRun({ text: dateStr, size: 22 })],
      spacing: { after: 240 },
    })
  );

  // ── Addressee block ───────────────────────────────────────────────────────
  if (jdCompany || jdTitle) {
    if (jdCompany) {
      children.push(
        new Paragraph({
          children: [new TextRun({ text: jdCompany, size: 22 })],
          spacing: { after: 60 },
        })
      );
    }
    if (jdTitle) {
      children.push(
        new Paragraph({
          children: [new TextRun({ text: `Re: ${jdTitle} Position`, size: 22 })],
          spacing: { after: 60 },
        })
      );
    }
    children.push(new Paragraph({ spacing: { after: 200 } }));
  }

  // ── Greeting ──────────────────────────────────────────────────────────────
  children.push(
    new Paragraph({
      children: [new TextRun({ text: content.greeting, size: 22 })],
      spacing: { after: 200 },
    })
  );

  // ── Body paragraphs ───────────────────────────────────────────────────────
  for (const para of content.paragraphs) {
    children.push(
      new Paragraph({
        alignment: AlignmentType.JUSTIFIED,
        children: [new TextRun({ text: para, size: 22 })],
        spacing: { after: 200 },
      })
    );
  }

  // ── Closing ───────────────────────────────────────────────────────────────
  children.push(
    new Paragraph({
      children: [new TextRun({ text: content.closing, size: 22 })],
      spacing: { after: 600 }, // space for handwritten signature
    })
  );

  // ── Typed name ────────────────────────────────────────────────────────────
  children.push(
    new Paragraph({
      children: [new TextRun({ text: content.candidate_name, bold: true, size: 22 })],
    })
  );

  const doc = new Document({
    sections: [{ children }],
    styles: {
      default: {
        document: {
          run: { font: "Calibri", size: 22 },
          paragraph: { spacing: { line: 276 } },
        },
      },
    },
  });

  const arrayBuffer = await Packer.toBuffer(doc);
  return Buffer.from(arrayBuffer);
}
