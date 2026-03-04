import { describe, it, expect } from "vitest";
import {
  validateJdMimeType,
  validateJdFileSize,
  validateJdPageCount,
  validateJdText,
  validateUrl,
} from "@/lib/jd/validate";

describe("validateJdMimeType", () => {
  it("accepts PDF", () => {
    expect(validateJdMimeType("application/pdf").valid).toBe(true);
  });

  it("accepts DOCX", () => {
    expect(
      validateJdMimeType(
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
      ).valid
    ).toBe(true);
  });

  it("rejects text/html", () => {
    expect(validateJdMimeType("text/html").valid).toBe(false);
  });
});

describe("validateJdFileSize", () => {
  const MB = 1024 * 1024;

  it("accepts file at limit", () => {
    expect(validateJdFileSize(5 * MB).valid).toBe(true);
  });

  it("rejects file over limit", () => {
    expect(validateJdFileSize(5 * MB + 1).valid).toBe(false);
  });
});

describe("validateJdPageCount", () => {
  it("accepts exactly 5 pages", () => {
    expect(validateJdPageCount(5).valid).toBe(true);
  });

  it("rejects 6 pages", () => {
    const result = validateJdPageCount(6);
    expect(result.valid).toBe(false);
    expect(result.error).toMatch(/5/);
  });
});

describe("validateJdText", () => {
  const validText = "Software Engineer role requires React, TypeScript, and Node.js skills. ".repeat(3);

  it("accepts valid JD text", () => {
    expect(validateJdText(validText).valid).toBe(true);
  });

  it("rejects empty string", () => {
    expect(validateJdText("").valid).toBe(false);
  });

  it("rejects text under 50 chars", () => {
    expect(validateJdText("short").valid).toBe(false);
  });

  it("rejects text over 25,000 chars", () => {
    const result = validateJdText("a".repeat(25_001));
    expect(result.valid).toBe(false);
    expect(result.error).toMatch(/too much text/i);
  });

  it("accepts text at exactly the 25,000 char limit", () => {
    expect(validateJdText("a".repeat(25_000)).valid).toBe(true);
  });
});

describe("validateUrl — SSRF protection", () => {
  // ── valid URLs ─────────────────────────────────────────────────────────────
  it("accepts a normal https URL", () => {
    expect(validateUrl("https://jobs.lever.co/company/123").valid).toBe(true);
  });

  it("accepts a normal http URL", () => {
    expect(validateUrl("http://example.com/job").valid).toBe(true);
  });

  // ── protocol checks ────────────────────────────────────────────────────────
  it("rejects ftp:// protocol", () => {
    expect(validateUrl("ftp://example.com").valid).toBe(false);
  });

  it("rejects file:// protocol", () => {
    expect(validateUrl("file:///etc/passwd").valid).toBe(false);
  });

  it("rejects javascript: protocol", () => {
    expect(validateUrl("javascript:alert(1)").valid).toBe(false);
  });

  it("rejects plain string (no protocol)", () => {
    expect(validateUrl("not-a-url").valid).toBe(false);
  });

  // ── SSRF: loopback ─────────────────────────────────────────────────────────
  it("rejects http://localhost", () => {
    expect(validateUrl("http://localhost").valid).toBe(false);
  });

  it("rejects http://localhost:3000/admin", () => {
    expect(validateUrl("http://localhost:3000/admin").valid).toBe(false);
  });

  it("rejects http://127.0.0.1", () => {
    expect(validateUrl("http://127.0.0.1").valid).toBe(false);
  });

  it("rejects http://127.0.0.2 (other loopback)", () => {
    expect(validateUrl("http://127.0.0.2").valid).toBe(false);
  });

  it("rejects http://0.0.0.0", () => {
    expect(validateUrl("http://0.0.0.0").valid).toBe(false);
  });

  // ── SSRF: private ranges ───────────────────────────────────────────────────
  it("rejects http://10.0.0.1 (RFC 1918 class A)", () => {
    expect(validateUrl("http://10.0.0.1").valid).toBe(false);
  });

  it("rejects http://192.168.1.1 (RFC 1918 class C)", () => {
    expect(validateUrl("http://192.168.1.1").valid).toBe(false);
  });

  it("rejects http://172.16.0.1 (RFC 1918 class B start)", () => {
    expect(validateUrl("http://172.16.0.1").valid).toBe(false);
  });

  it("rejects http://172.31.255.255 (RFC 1918 class B end)", () => {
    expect(validateUrl("http://172.31.255.255").valid).toBe(false);
  });

  it("accepts http://172.15.0.1 (just outside RFC 1918 class B)", () => {
    expect(validateUrl("http://172.15.0.1").valid).toBe(true);
  });

  it("accepts http://172.32.0.1 (just outside RFC 1918 class B)", () => {
    expect(validateUrl("http://172.32.0.1").valid).toBe(true);
  });

  // ── SSRF: link-local / metadata ────────────────────────────────────────────
  it("rejects http://169.254.169.254 (AWS metadata)", () => {
    expect(validateUrl("http://169.254.169.254").valid).toBe(false);
  });

  it("rejects http://169.254.0.1 (link-local)", () => {
    expect(validateUrl("http://169.254.0.1").valid).toBe(false);
  });

  // ── SSRF: mDNS / .local ────────────────────────────────────────────────────
  it("rejects http://myserver.local", () => {
    expect(validateUrl("http://myserver.local").valid).toBe(false);
  });

  // ── IPv6 loopback ──────────────────────────────────────────────────────────
  it("rejects http://[::1] (IPv6 loopback)", () => {
    expect(validateUrl("http://[::1]").valid).toBe(false);
  });
});
