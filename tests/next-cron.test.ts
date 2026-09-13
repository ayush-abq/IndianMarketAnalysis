import { describe, expect, it } from "vitest";
import { cronMatchesIst, nextCronIst } from "@/lib/next-cron";

describe("IST cron", () => {
  it("finds the next weekday 18:30 after a Sunday afternoon", () => {
    const sundayNoonIst = new Date("2026-09-13T06:30:00.000Z");
    const next = nextCronIst("30 18 * * 1-5", sundayNoonIst);
    expect(cronMatchesIst("30 18 * * 1-5", next)).toBe(true);
    const ist = new Intl.DateTimeFormat("en-GB", {
      timeZone: "Asia/Kolkata",
      weekday: "short",
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    }).format(next);
    expect(ist).toMatch(/Mon/);
    expect(ist).toMatch(/18:30/);
  });
});
