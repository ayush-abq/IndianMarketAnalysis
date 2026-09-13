/**
 * NSE cash-market holidays. Weekends are handled separately.
 * Additional holidays can be inserted via the market_holidays table / Settings.
 * Sources: NSE circulars for 2024–2026.
 */
export const NSE_HOLIDAYS: { date: string; name: string }[] = [
  // 2024
  { date: "2024-01-26", name: "Republic Day" },
  { date: "2024-03-08", name: "Mahashivratri" },
  { date: "2024-03-25", name: "Holi" },
  { date: "2024-03-29", name: "Good Friday" },
  { date: "2024-04-11", name: "Id-Ul-Fitr" },
  { date: "2024-04-17", name: "Ram Navami" },
  { date: "2024-05-01", name: "Maharashtra Day" },
  { date: "2024-06-17", name: "Bakri Id" },
  { date: "2024-07-17", name: "Moharram" },
  { date: "2024-08-15", name: "Independence Day" },
  { date: "2024-10-02", name: "Mahatma Gandhi Jayanti" },
  { date: "2024-11-01", name: "Diwali-Laxmi Pujan (Muhurat session possible)" },
  { date: "2024-11-15", name: "Gurunanak Jayanti" },
  { date: "2024-12-25", name: "Christmas" },
  // 2025
  { date: "2025-02-26", name: "Mahashivratri" },
  { date: "2025-03-14", name: "Holi" },
  { date: "2025-03-31", name: "Id-Ul-Fitr" },
  { date: "2025-04-10", name: "Mahavir Jayanti" },
  { date: "2025-04-14", name: "Dr. Baba Saheb Ambedkar Jayanti" },
  { date: "2025-04-18", name: "Good Friday" },
  { date: "2025-05-01", name: "Maharashtra Day" },
  { date: "2025-08-15", name: "Independence Day" },
  { date: "2025-08-27", name: "Ganesh Chaturthi" },
  { date: "2025-10-02", name: "Mahatma Gandhi Jayanti / Dussehra" },
  { date: "2025-10-21", name: "Diwali-Laxmi Pujan" },
  { date: "2025-10-22", name: "Balipratipada" },
  { date: "2025-11-05", name: "Prakash Gurpurb Sri Guru Nanak Dev" },
  { date: "2025-12-25", name: "Christmas" },
  // 2026
  { date: "2026-01-26", name: "Republic Day" },
  { date: "2026-03-03", name: "Holi" },
  { date: "2026-03-26", name: "Ram Navami" },
  { date: "2026-03-31", name: "Mahavir Jayanti" },
  { date: "2026-04-03", name: "Good Friday" },
  { date: "2026-04-14", name: "Dr. Baba Saheb Ambedkar Jayanti" },
  { date: "2026-05-01", name: "Maharashtra Day" },
  { date: "2026-05-28", name: "Bakri Id" },
  { date: "2026-06-26", name: "Muharram" },
  { date: "2026-08-15", name: "Independence Day" },
  { date: "2026-09-14", name: "Ganesh Chaturthi" },
  { date: "2026-10-02", name: "Mahatma Gandhi Jayanti" },
  { date: "2026-10-20", name: "Dussehra" },
  { date: "2026-11-10", name: "Diwali-Laxmi Pujan" },
  { date: "2026-11-24", name: "Guru Nanak Jayanti" },
  { date: "2026-12-25", name: "Christmas" },
];
