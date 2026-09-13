import { ScannerPage } from "@/components/scanner-page";

export default function Page() {
  return (
    <ScannerPage
      title="Recovery Candidates"
      subtitle="High drawdown with improving short-term evidence. Still a research classification."
      preset={{ signal: "EARLY_RECOVERY", sort: "recovery" }}
    />
  );
}
