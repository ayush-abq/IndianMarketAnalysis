import { NextResponse } from "next/server";

export async function GET() {
  return NextResponse.json({
    status: "ok",
    service: "nse-sector-scanner",
    time: new Date().toISOString(),
  });
}
