"use client";

import { useCallback } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { BlocklistTab } from "@/components/admin/blocklist-tab";
import { LinksTab } from "@/components/admin/links-tab";
import { OverviewTab } from "@/components/admin/overview-tab";
import { ReportsTab } from "@/components/admin/reports-tab";
import { UsersTab } from "@/components/admin/users-tab";
import { PageHeader, Segmented } from "@/components/shared/ui-kit";
import { useAdminStats } from "@/hooks/use-admin";

const TABS = ["overview", "users", "links", "reports", "blocklist"] as const;
type AdminTab = (typeof TABS)[number];

const LABELS: Record<AdminTab, string> = {
  overview: "Overview",
  users: "Users",
  links: "Links",
  reports: "Reports",
  blocklist: "Blocklist",
};

function isTab(value: string | null): value is AdminTab {
  return !!value && (TABS as readonly string[]).includes(value);
}

export function AdminView() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const param = searchParams.get("tab");
  const tab: AdminTab = isTab(param) ? param : "overview";
  const { data: stats } = useAdminStats();

  const setTab = useCallback(
    (next: AdminTab) => {
      const params = new URLSearchParams(searchParams.toString());
      if (next === "overview") params.delete("tab");
      else params.set("tab", next);
      const query = params.toString();
      router.replace(query ? `${pathname}?${query}` : pathname, { scroll: false });
    },
    [pathname, router, searchParams],
  );

  return (
    <div className="mx-auto max-w-6xl">
      <PageHeader
        title="Admin"
        description="Moderate users, links and reports across this instance."
      />
      <Segmented
        className="mb-5"
        value={tab}
        onChange={setTab}
        options={TABS.map((value) => ({
          value,
          label: LABELS[value],
          count:
            value === "reports" && stats && stats.openReports > 0 ? stats.openReports : undefined,
        }))}
      />
      {tab === "overview" && <OverviewTab />}
      {tab === "users" && <UsersTab />}
      {tab === "links" && <LinksTab />}
      {tab === "reports" && <ReportsTab />}
      {tab === "blocklist" && <BlocklistTab />}
    </div>
  );
}
