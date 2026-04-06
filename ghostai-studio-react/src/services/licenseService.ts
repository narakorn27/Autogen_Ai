import type { LicensedFeature, LicenseStatus } from "@/types/license";

const defaultFeatures: LicensedFeature[] = ["feed", "story", "tts", "tarot", "ouija"];

// รอบแรกยังไม่มี backend จริง จึงคืนค่า local trial ไว้ก่อน เพื่อให้อนาคตเปลี่ยนเป็น fetch license ได้ง่าย
export async function checkLicense(): Promise<LicenseStatus> {
  return {
    valid: true,
    expiresAt: null,
    features: defaultFeatures,
    message: "โหมด local trial: ยังไม่ได้ผูก license server"
  };
}

export function hasFeature(status: LicenseStatus, feature: LicensedFeature) {
  return status.valid && status.features.includes(feature);
}
