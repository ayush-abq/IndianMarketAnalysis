import { ScannerPage } from "@/components/scanner-page";

export default function Page() {
  return (
    <ScannerPage
      title="Falling Knives"
      subtitle="Deeply beaten down but still falling — not ranked as attractive solely because of drawdown."
      preset={{ signal: "FALLING_KNIFE", sort: "drawdown" }}
    />
  );
}
