import { MfListPage } from "@/components/mf-list-page";

export default function Page() {
  return (
    <MfListPage
      title="Recovery Funds"
      subtitle="Funds whose mapped NSE sectors show early recovery and whose own relative strength has not collapsed. Research label only."
      endpoint="/api/mutual-funds/recovery"
    />
  );
}
