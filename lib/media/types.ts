export const acceptedLicenseCodes = [
  "PD",
  "CC0-1.0",
  "CC-BY-3.0",
  "CC-BY-4.0",
  "CC-BY-SA-3.0",
  "CC-BY-SA-4.0",
  "VITAL-FREE-PACK",
  "CUSTOM",
] as const;

export type LicenseCode = (typeof acceptedLicenseCodes)[number];
export type SourceType =
  | "public_domain"
  | "creative_commons"
  | "licensed_pack"
  | "self_produced"
  | "external_embed";

export type { MediaRole, MediaStatus, PrimaryChecklist } from "./operations";

export type LicenseInfo = {
  code: LicenseCode;
  name: string;
  url: string | null;
  attributionRequired: boolean;
  shareAlike: boolean;
  sourceType: SourceType;
};

export type MatchExercise = {
  id: string;
  slug: string;
  namePt: string;
  nameEn?: string | null;
  aliases: string[];
  movementPattern: string;
  equipment: string[];
  muscles: string[];
  category?: string;
};

export type MediaCandidateText = {
  title: string;
  description: string;
  categories: string[];
  mime?: string;
  source?: string;
};

export type MatchResult = {
  score: number;
  eligible: boolean;
  confidence: "strong" | "candidate" | "low" | "ignored";
  details: Record<string, boolean | number | string | string[]>;
  positiveReasons: string[];
  negativeReasons: string[];
};
