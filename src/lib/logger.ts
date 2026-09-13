import pino from "pino";

const level = process.env.LOG_LEVEL ?? "info";
const pretty = process.env.NODE_ENV !== "production";

export const logger = pino({
  level,
  base: { service: "nse-sector-scanner" },
  timestamp: pino.stdTimeFunctions.isoTime,
  transport: pretty
    ? {
        target: "pino-pretty",
        options: { colorize: true, translateTime: "SYS:standard" },
      }
    : undefined,
});

export function childLogger(bindings: Record<string, unknown>) {
  return logger.child(bindings);
}
