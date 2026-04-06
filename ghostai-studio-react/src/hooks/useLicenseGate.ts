import { useEffect, useState } from "react";
import { checkLicense } from "@/services/licenseService";
import type { LicenseStatus } from "@/types/license";

export function useLicenseGate() {
  const [license, setLicense] = useState<LicenseStatus | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    checkLicense().then((status) => {
      if (!active) return;
      setLicense(status);
      setLoading(false);
    });
    return () => {
      active = false;
    };
  }, []);

  return { license, loading };
}
