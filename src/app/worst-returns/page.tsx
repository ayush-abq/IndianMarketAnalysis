import { ScannerPage } from "@/components/scanner-page";

export default function Page() {
  return (
    <ScannerPage
      title="Worst Returns"
      subtitle="Sorted by weakest 1-year price return. Insufficient history is shown as N/A, never 0%."
      preset={{ sort: "y1" }}
    />
  );
}
