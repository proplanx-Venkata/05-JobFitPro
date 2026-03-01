/**
 * Structured output produced by the Claude resume-parsing prompt.
 * All fields are null / empty-array when not present in the source document —
 * never inferred or hallucinated.
 */

export interface ParsedResumePersonalInfo {
  name: string | null;
  email: string | null;
  phone: string | null;
  location: string | null;
  linkedin: string | null;
  website: string | null;
}

export interface ParsedResumeExperience {
  company: string;
  title: string;
  start_date: string | null;
  end_date: string | null;
  location: string | null;
  bullets: string[];
}

export interface ParsedResumeEducation {
  institution: string;
  degree: string | null;
  field: string | null;
  start_date: string | null;
  end_date: string | null;
  gpa: string | null;
}

export interface ParsedResumeSkills {
  technical: string[];
  soft: string[];
  other: string[];
}

export interface ParsedResumeCertification {
  name: string;
  issuer: string | null;
  date: string | null;
}

export interface ParsedResumeProject {
  name: string;
  description: string | null;
  technologies: string[];
}

export interface ParsedResume {
  personal_info: ParsedResumePersonalInfo;
  summary: string | null;
  experience: ParsedResumeExperience[];
  education: ParsedResumeEducation[];
  skills: ParsedResumeSkills;
  certifications: ParsedResumeCertification[];
  projects: ParsedResumeProject[];
  languages: string[];
}
