import { describe, expect, it } from "vitest";
import {
  adjustmentFactorAfter,
  officialPrZipName,
  parseExDate,
  parseOfficialBookClosureCsv,
  parsePurpose,
} from "@/providers/nse-corporate-actions";

const SAMPLE = `SERIES,SYMBOL,SECURITY,RECORD_DT,BC_STRT_DT,BC_END_DT,EX_DT,ND_STRT_DT,ND_END_DT,PURPOSE
EQ,PGIL,Pearl,2026-09-11,,,2026-09-11,,,BONUS 1:1
EQ,MINDACORP,Minda,05/01/2015,,,05/01/2015,,,BONUS 1:1/FV SPL 10 TO 2
EQ,BANKBARODA,BoB,22/01/2015,,,22/01/2015,,,FV SPLT FRM RS 10 TO RS 2
BE,RITES,RITES,10/01/2020,,,09/01/2020,,,INT DIV-RS 6 PR SH
EQ,CENTEXT,Century,15/09/2026,,,15/09/2026,,,RIGHTS 3:8@ PRM RS 14/-
EQ,FOO,Foo,01/01/2020,,,01/01/2020,,,INTEREST PAYMENT
`;

describe("official PR book-closure parser", () => {
  it("builds the official PR zip name", () => {
    expect(officialPrZipName("2026-09-11")).toBe("PR110926.zip");
    expect(officialPrZipName("2016-11-17")).toBe("PR171116.zip");
  });

  it("parses ISO and DD/MM/YYYY ex-dates", () => {
    expect(parseExDate("2026-09-11")).toBe("2026-09-11");
    expect(parseExDate("09/01/2020")).toBe("2020-01-09");
    expect(parseExDate("21/11/2016")).toBe("2016-11-21");
  });

  it("parses bonus, face-value split, dividend and rights", () => {
    expect(parsePurpose("BONUS 1:1")).toEqual([{ actionType: "BONUS", ratio: "1:1", factor: 0.5 }]);
    expect(parsePurpose("BONUS 3:1")[0]?.factor).toBeCloseTo(0.25);
    expect(parsePurpose("FV SPLT FRM RS 10 TO RS 2")).toEqual([
      { actionType: "SPLIT", ratio: "10→2", factor: 0.2 },
    ]);
    const both = parsePurpose("BONUS 1:1/FV SPL 10 TO 2");
    expect(both).toHaveLength(2);
    expect(both.map((a) => a.actionType).sort()).toEqual(["BONUS", "SPLIT"]);
    expect(parsePurpose("INT DIV-RS 6 PR SH")[0]).toMatchObject({ actionType: "DIVIDEND", factor: null });
    expect(parsePurpose("RIGHTS 3:8@ PRM RS 14/-")[0]).toMatchObject({ actionType: "RIGHTS", factor: null });
    expect(parsePurpose("INTEREST PAYMENT")).toEqual([]);
  });

  it("keeps EQ/BE cash rows only", () => {
    const rows = parseOfficialBookClosureCsv(SAMPLE);
    expect(rows.some((r) => r.symbol === "PGIL" && r.actionType === "BONUS")).toBe(true);
    expect(rows.filter((r) => r.symbol === "MINDACORP")).toHaveLength(2);
    expect(rows.some((r) => r.symbol === "FOO")).toBe(false);
  });

  it("adjusts only bars before the ex-date", () => {
    const actions = [{ date: "2020-01-15", factor: 0.5 }];
    expect(adjustmentFactorAfter(actions, "2020-01-10")).toBeCloseTo(0.5);
    expect(adjustmentFactorAfter(actions, "2020-01-15")).toBeCloseTo(1);
    expect(adjustmentFactorAfter(actions, "2020-01-20")).toBeCloseTo(1);
  });
});
