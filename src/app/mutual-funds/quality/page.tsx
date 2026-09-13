import { MfListPage } from "@/components/mf-list-page";

export default function Page() {
  return (
    <MfListPage
      title="Quality at Reasonable Cost"
      subtitle="High consistency, acceptable Sharpe, controlled drawdown. Expense ratio is shown when published — never invented."
      endpoint="/api/mutual-funds/quality"
    />
  );
}
