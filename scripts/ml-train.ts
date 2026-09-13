import { trainLocalModels } from "@/services/local-ai-layer";

async function main() {
  const index = process.argv.find((a) => a.startsWith("--index="))?.split("=")[1] ?? "NIFTY500";
  const limit = Number(process.argv.find((a) => a.startsWith("--limit="))?.split("=")[1] ?? "80");
  const every = Number(process.argv.find((a) => a.startsWith("--every="))?.split("=")[1] ?? "21");
  const result = await trainLocalModels({ index, limit, every });
  console.log(JSON.stringify(result, null, 2));
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
