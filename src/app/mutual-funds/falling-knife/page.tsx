import { MfListPage } from "@/components/mf-list-page";

export default function Page() {
  return (
    <MfListPage
      title="Falling Knife Funds"
      subtitle="Prevents buying a fund just because NAV has fallen. Underlying sectors are still deteriorating and recent fund returns remain weak."
      endpoint="/api/mutual-funds/falling-knife"
    />
  );
}
