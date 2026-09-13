import { ScannerPage } from "@/components/scanner-page";

export default function Page() {
  return (
    <ScannerPage
      title="Extreme Drawdowns"
      subtitle="Indices at least 50% below historical closing ATH."
      preset={{ drawdown: "50", sort: "drawdown" }}
    />
  );
}
