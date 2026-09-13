import { MfListPage } from "@/components/mf-list-page";

export default function Page() {
  return (
    <MfListPage
      title="Value / Contrarian"
      subtitle="Meaningful exposure to deeply beaten-down NSE sectors without a structural collapse in the fund’s own research profile. Contrarian Research Candidate — not Buy."
      endpoint="/api/mutual-funds/contrarian"
    />
  );
}
