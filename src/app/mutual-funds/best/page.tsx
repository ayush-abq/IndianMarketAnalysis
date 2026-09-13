import { MfListPage } from "@/components/mf-list-page";

export default function Page() {
  return (
    <MfListPage
      title="Best Funds"
      subtitle="Composite research score inside the selected category/plan — not highest 5-year return. Risk-adjusted returns, consistency, drawdown, and benchmark excess all count."
      endpoint="/api/mutual-funds/best"
    />
  );
}
