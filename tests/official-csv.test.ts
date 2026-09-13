import { describe, expect, it } from "vitest";
import { eodFileName, parseOfficialIndexCloseCsv, rowsToBars } from "@/providers/nse-csv";

const SAMPLE = `Index Name,Index Date,Open Index Value,High Index Value,Low Index Value,Closing Index Value,Volume
Nifty Media,11-Sep-2026,1400.10,1410.00,1380.20,1390.55,12345
Nifty IT,11-Sep-2026,35000.00,35200.00,34800.00,34910.25,999
Nifty 50,11-Sep-2026,25000,25100,24900,25050,1
`;

describe("Official NSE EOD CSV parser", () => {
  it("parses official ind_close_all columns", () => {
    const rows = parseOfficialIndexCloseCsv(SAMPLE);
    expect(rows).toHaveLength(3);
    expect(rows[0].nseName).toBe("NIFTY MEDIA");
    expect(rows[0].date).toBe("2026-09-11");
    expect(rows[0].close).toBeCloseTo(1390.55);
  });

  it("filters a single index into provider bars", () => {
    const bars = rowsToBars(parseOfficialIndexCloseCsv(SAMPLE), "NIFTY IT", "PR");
    expect(bars).toHaveLength(1);
    expect(bars[0].returnType).toBe("PR");
    expect(bars[0].close).toBeCloseTo(34910.25);
  });

  it("builds the official archive file name", () => {
    expect(eodFileName("2026-09-11")).toBe("ind_close_all_11092026.csv");
  });

  it("maps historical CNX publication names onto current Nifty series", () => {
    const rows = parseOfficialIndexCloseCsv(
      "Index Name,Index Date,Closing Index Value\nCNX IT,02-Jan-2015,12000\n",
    );
    expect(rows[0]?.nseName).toBe("NIFTY IT");
  });
});
