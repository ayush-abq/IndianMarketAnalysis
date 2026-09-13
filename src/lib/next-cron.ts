const DOW: Record<string, number> = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };

function istWall(d: Date) {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Asia/Kolkata",
    weekday: "short",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(d);
  const g = (type: string) => parts.find((p) => p.type === type)?.value ?? "";
  return {
    minute: Number(g("minute")),
    hour: Number(g("hour") === "24" ? "0" : g("hour")),
    day: Number(g("day")),
    month: Number(g("month")),
    dow: DOW[g("weekday")] ?? 0,
  };
}

function fieldOk(field: string, value: number) {
  if (field === "*") return true;
  return field.split(",").some((part) => {
    if (part.includes("-")) {
      const [a, b] = part.split("-").map(Number);
      return value >= a && value <= b;
    }
    return value === Number(part);
  });
}

export function cronMatchesIst(expr: string, at: Date) {
  const [min, hour, dom, mon, dow] = expr.trim().split(/\s+/);
  if (!min || !hour || !dom || !mon || !dow) return false;
  const w = istWall(at);
  return fieldOk(min, w.minute) && fieldOk(hour, w.hour) && fieldOk(dom, w.day) && fieldOk(mon, w.month) && fieldOk(dow, w.dow);
}

export function nextCronIst(expr: string, from = new Date()): Date {
  const t = new Date(from.getTime() + 60_000);
  t.setSeconds(0, 0);
  for (let i = 0; i < 60 * 24 * 90; i++) {
    if (cronMatchesIst(expr, t)) return new Date(t);
    t.setTime(t.getTime() + 60_000);
  }
  throw new Error(`No match for cron ${expr}`);
}

export function formatIstStamp(value: Date | string | null | undefined) {
  if (!value) return "Not yet";
  const d = typeof value === "string" ? new Date(value) : value;
  if (Number.isNaN(d.getTime())) return "Not yet";
  const text = new Intl.DateTimeFormat("en-IN", {
    timeZone: "Asia/Kolkata",
    weekday: "short",
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  }).format(d);
  return `${text} IST`;
}
