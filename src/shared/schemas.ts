import { z } from "zod";

// ── Case details extracted from ServiceNow ──────────────────────────

export const CaseDetailsSchema = z.object({
  name: z.string().nullable(),
  email: z.string().nullable(),
  callback: z.string().nullable(),
  adx: z.string().nullable(),
  issueMessage: z.string().nullable(),
});

export type CaseDetails = z.infer<typeof CaseDetailsSchema>;

// ── Device details extracted from Ivanti Neurons MDM ────────────────

export const DeviceDetailsSchema = z.object({
  ownershipType: z.string().nullable(), // Corp or BYOD
  deviceModel: z.string().nullable(),
  serialNumber: z.string().nullable(),
  mdn: z.string().nullable(),
  iosVersion: z.string().nullable(),
});

export type DeviceDetails = z.infer<typeof DeviceDetailsSchema>;

// ── Merged template ready for output ────────────────────────────────

export const WorkNotesTemplateSchema = z.object({
  name: z.string().nullable(),
  email: z.string().nullable(),
  callback: z.string().nullable(),
  adx: z.string().nullable(),
  corpOrByod: z.string().nullable(),
  deviceModel: z.string().nullable(),
  serialNumber: z.string().nullable(),
  mdn: z.string().nullable(),
  iosVersion: z.string().nullable(),
  issueMessage: z.string().nullable(),
  troubleshoot: z.string().nullable(),
  escalated: z.string().nullable(),
});

export type WorkNotesTemplate = z.infer<typeof WorkNotesTemplateSchema>;
