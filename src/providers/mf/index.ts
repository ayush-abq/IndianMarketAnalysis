import { env } from "@/lib/env";
import { AmfiOfficialProvider } from "./amfi";
import { LicensedMfProvider } from "./licensed";
import type { MutualFundDataProvider } from "./types";

export function createMfProvider(): MutualFundDataProvider {
  return env().MF_PROVIDER === "LICENSED" ? new LicensedMfProvider() : new AmfiOfficialProvider();
}

export function createMfEnrichmentProvider(): LicensedMfProvider | null {
  if (!env().MF_LICENSED_BASE_URL || !env().MF_API_KEY) return null;
  return new LicensedMfProvider();
}
