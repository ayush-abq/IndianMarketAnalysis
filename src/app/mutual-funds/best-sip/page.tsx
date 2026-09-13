import { MfListPage } from "@/components/mf-list-page";

export default function Page() {
  return (
    <MfListPage
      title="Best SIP Funds"
      subtitle="Historical monthly SIP XIRR (default ₹10,000) with consistency and drawdown still visible. Past SIP performance is not a future return."
      endpoint="/api/mutual-funds/best-sip"
    />
  );
}
