import { cpus, freemem, totalmem, type, arch } from "node:os";
import { execFile } from "node:child_process";
import { promisify } from "node:util";

const exec = promisify(execFile);

export type HardwareProfile = {
  os: string;
  arch: string;
  cpuModel: string;
  cpuCores: number;
  ramGb: number;
  freeRamGb: number;
  appleSilicon: boolean;
  unifiedMemory: boolean;
  gpu: string | null;
  gpuMemoryGb: number | null;
  recommendedTier: "LOW" | "MEDIUM" | "HIGH" | "VERY_HIGH";
  recommendedSize: string;
  note: string;
};

export async function detectHardware(): Promise<HardwareProfile> {
  const ramGb = totalmem() / 1024 ** 3;
  const freeRamGb = freemem() / 1024 ** 3;
  const cpu = cpus();
  const appleSilicon = process.platform === "darwin" && arch() === "arm64";
  let gpu: string | null = appleSilicon ? "Apple Silicon GPU (unified memory)" : null;
  let gpuMemoryGb: number | null = appleSilicon ? ramGb : null;
  if (!appleSilicon) {
    try {
      const { stdout } = await exec("nvidia-smi", ["--query-gpu=name,memory.total", "--format=csv,noheader,nounits"], {
        timeout: 2000,
      });
      const line = stdout.trim().split("\n")[0];
      if (line) {
        const [name, mem] = line.split(",").map((s) => s.trim());
        gpu = name;
        gpuMemoryGb = Number(mem) / 1024;
      }
    } catch {
      gpu = gpu ?? "No discrete NVIDIA GPU detected";
    }
  }
  const usable = gpuMemoryGb ?? ramGb;
  let recommendedTier: HardwareProfile["recommendedTier"] = "LOW";
  let recommendedSize = "4B–8B local model (e.g. qwen2.5:7b or deepseek-r1:8b distilled)";
  if (usable >= 48) {
    recommendedTier = "VERY_HIGH";
    recommendedSize = "larger local model (32B+) if you confirm a pull";
  } else if (usable >= 24) {
    recommendedTier = "HIGH";
    recommendedSize = "14B–32B local model";
  } else if (usable >= 12) {
    recommendedTier = "MEDIUM";
    recommendedSize = "8B–14B local model";
  }
  return {
    os: `${type()} ${process.platform}`,
    arch: arch(),
    cpuModel: cpu[0]?.model ?? "unknown",
    cpuCores: cpu.length,
    ramGb: Number(ramGb.toFixed(1)),
    freeRamGb: Number(freeRamGb.toFixed(1)),
    appleSilicon,
    unifiedMemory: appleSilicon,
    gpu,
    gpuMemoryGb: gpuMemoryGb != null ? Number(gpuMemoryGb.toFixed(1)) : null,
    recommendedTier,
    recommendedSize,
    note: "Models are never downloaded automatically. Pull with Ollama only after you confirm the size.",
  };
}
