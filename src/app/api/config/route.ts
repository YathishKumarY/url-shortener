import { NextResponse } from "next/server";
import { enabledOAuthProviders } from "@/lib/auth";
import { config } from "@/lib/config";

/** Public instance settings the UI adapts to (sign-up buttons, limits...). */
export async function GET() {
  return NextResponse.json(
    {
      siteName: config.siteName,
      registrationEnabled: !config.registrationDisabled,
      anonymousLinksEnabled: !config.anonymousLinksDisabled,
      oauthProviders: enabledOAuthProviders,
      allowedDomains: config.allowedDomains,
      bulkLimit: config.bulkLimit,
    },
    { headers: { "Cache-Control": "public, max-age=60" } },
  );
}
