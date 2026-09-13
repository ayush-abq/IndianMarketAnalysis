import { describe, expect, it } from "vitest";
import { GLOSSARY, glossaryEntry, glossaryGroups, humanizeCode, termLabel } from "@/lib/glossary";

describe("glossary", () => {
  it("explains the terms a new user sees first", () => {
    for (const id of ["drawdown", "probability", "rsi", "ath", "pr", "class.FALLING_KNIFE"]) {
      expect(glossaryEntry(id)?.hint.length).toBeGreaterThan(20);
    }
    expect(termLabel("drawdown")).toBe("Below peak");
    expect(termLabel("probability")).toBe("Chance");
    expect(termLabel("FRESH_BREAKOUT")).toBe("Fresh breakout");
    expect(humanizeCode("FRESH_BREAKOUT")).toBe("Fresh Breakout");
  });

  it("keeps grouped pages pointed at real entries", () => {
    for (const group of glossaryGroups()) {
      for (const id of group.ids) {
        expect(GLOSSARY[id], id).toBeTruthy();
      }
    }
  });
});
