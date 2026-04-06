export type LicensedFeature =
  | "feed"
  | "story"
  | "tts"
  | "tarot"
  | "ouija"
  | "dev-tools";

export type LicenseStatus = {
  valid: boolean;
  expiresAt: string | null;
  features: LicensedFeature[];
  message: string;
};
