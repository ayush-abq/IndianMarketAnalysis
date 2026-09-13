import { materializeFeatures } from "@/services/local-ai-layer";

async function main() {
  const limit = Number(process.argv.find((a) => a.startsWith("--limit="))?.split("=")[1] ?? "");
  const result = await materializeFeatures({ limit: Number.isFinite(limit) && limit > 0 ? limit : undefined });
  console.log(JSON.stringify(result, null, 2));
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
