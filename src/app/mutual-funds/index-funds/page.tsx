import { MfListPage } from "@/components/mf-list-page";

export default function Page() {
  return (
    <MfListPage
      title="Best Index Funds / ETFs"
      subtitle="Not ranked solely by TER. Tracking difference appears only when an official/licensed feed supplies it."
      endpoint="/api/mutual-funds/index-funds"
    />
  );
}
