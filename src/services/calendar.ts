import { and, gte, lte } from "drizzle-orm";
import { NSE_HOLIDAYS } from "@/config/holidays";
import { getDb } from "@/db/client";
import { marketHolidays } from "@/db/schema";
import { addCalendarDays, isWeekend, isTradingDay } from "@/calculations/trading-days";
import { todayIST } from "@/lib/utils";

export async function loadHolidaySet(): Promise<Set<string>> {
  const db = getDb();
  const rows = await db.select().from(marketHolidays);
  const set = new Set<string>(NSE_HOLIDAYS.map((h) => h.date));
  for (const row of rows) set.add(row.date);
  return set;
}

export async function seedHolidays() {
  const db = getDb();
  for (const h of NSE_HOLIDAYS) {
    await db
      .insert(marketHolidays)
      .values({ date: h.date, name: h.name, market: "NSE" })
      .onConflictDoNothing();
  }
}

export async function isNseTradingDay(date: string): Promise<boolean> {
  const holidays = await loadHolidaySet();
  return isTradingDay(date, holidays);
}

export async function previousTradingDay(date: string): Promise<string> {
  const holidays = await loadHolidaySet();
  let cur = addCalendarDays(date, -1);
  for (let i = 0; i < 15; i++) {
    if (isTradingDay(cur, holidays)) return cur;
    cur = addCalendarDays(cur, -1);
  }
  return cur;
}

export async function expectedDataDate(): Promise<string> {
  const now = new Date();
  const istHour = Number(
    new Intl.DateTimeFormat("en-GB", {
      timeZone: "Asia/Kolkata",
      hour: "2-digit",
      hour12: false,
    }).format(now),
  );
  let date = todayIST();
  if (istHour < 16) date = addCalendarDays(date, -1);
  if (!(await isNseTradingDay(date))) date = await previousTradingDay(date);
  return date;
}

export async function tradingDaysBetween(from: string, to: string): Promise<string[]> {
  const holidays = await loadHolidaySet();
  const out: string[] = [];
  let cur = from;
  while (cur <= to) {
    if (isTradingDay(cur, holidays)) out.push(cur);
    cur = addCalendarDays(cur, 1);
  }
  return out;
}

export async function listHolidays(from: string, to: string) {
  const db = getDb();
  return db
    .select()
    .from(marketHolidays)
    .where(and(gte(marketHolidays.date, from), lte(marketHolidays.date, to)));
}

export { isWeekend };
