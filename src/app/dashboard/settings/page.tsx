"use client";

import { Suspense } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Globe, KeyRound, Puzzle, ShieldCheck, Tags, UserRound, Webhook } from "lucide-react";
import { AccountTab } from "@/components/settings/account-tab";
import { ApiKeysTab } from "@/components/settings/api-keys-tab";
import { DomainsTab } from "@/components/settings/domains-tab";
import { IntegrationsTab } from "@/components/settings/integrations-tab";
import { ProfileTab } from "@/components/settings/profile-tab";
import { TagsTab } from "@/components/settings/tags-tab";
import { WebhooksTab } from "@/components/settings/webhooks-tab";
import { PageHeader, Segmented } from "@/components/shared/ui-kit";

const TABS = [
  { value: "profile", label: "Profile", icon: UserRound, Component: ProfileTab },
  { value: "tags", label: "Tags", icon: Tags, Component: TagsTab },
  { value: "api", label: "API keys", icon: KeyRound, Component: ApiKeysTab },
  { value: "webhooks", label: "Webhooks", icon: Webhook, Component: WebhooksTab },
  { value: "domains", label: "Domains", icon: Globe, Component: DomainsTab },
  { value: "integrations", label: "Integrations", icon: Puzzle, Component: IntegrationsTab },
  { value: "account", label: "Account", icon: ShieldCheck, Component: AccountTab },
] as const;

function Settings() {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const active = TABS.find((t) => t.value === params.get("tab")) ?? TABS[0];

  return (
    <div className="mx-auto max-w-4xl">
      <PageHeader
        title="Settings"
        description="Your profile, tags, developer tools, domains and account."
      />
      <div className="mb-5">
        <Segmented
          value={active.value}
          onChange={(value) =>
            router.replace(value === "profile" ? pathname : `${pathname}?tab=${value}`, {
              scroll: false,
            })
          }
          options={TABS.map((t) => ({
            value: t.value,
            label: (
              <span className="flex items-center gap-1.5">
                <t.icon className="size-3.5" />
                {t.label}
              </span>
            ),
          }))}
        />
      </div>
      <active.Component />
    </div>
  );
}

export default function SettingsPage() {
  return (
    <Suspense>
      <Settings />
    </Suspense>
  );
}
