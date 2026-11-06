import { NextResponse } from "next/server";
import { getAppOrigin } from "@/lib/app-url";
import { buildOpenApiSpec } from "@/lib/openapi";

export async function GET(request: Request) {
  return NextResponse.json(buildOpenApiSpec(getAppOrigin(request)), {
    headers: { "Access-Control-Allow-Origin": "*", "Cache-Control": "public, max-age=300" },
  });
}
