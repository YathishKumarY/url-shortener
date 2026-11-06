"use client";

import { CircleAlert, RotateCcw } from "lucide-react";
import { useSession } from "next-auth/react";
import { BioEditor } from "@/components/bio/bio-editor";
import { EmptyState, PageHeader, Panel, pill } from "@/components/shared/ui-kit";
import { Skeleton } from "@/components/ui/skeleton";
import { useBio } from "@/hooks/use-bio";

const TITLE = "Link in bio";
const DESCRIPTION =
  "One page for everything you share. Pick a handle, style it, and feature your best links.";

function EditorSkeleton() {
  return (
    <div className="mx-auto max-w-6xl pb-10" aria-busy="true">
      <PageHeader title={TITLE} description={DESCRIPTION} />
      <p className="sr-only" role="status">
        Loading your bio page
      </p>
      <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_340px] xl:grid-cols-[minmax(0,1fr)_380px] xl:gap-10">
        <div className="flex flex-col gap-5">
          {[236, 252, 188].map((height) => (
            <Panel key={height}>
              <div className="mb-5 flex items-center gap-3">
                <Skeleton className="size-8 rounded-lg" />
                <div className="space-y-1.5">
                  <Skeleton className="h-4 w-28" />
                  <Skeleton className="h-3 w-52" />
                </div>
              </div>
              <Skeleton className="w-full rounded-xl" style={{ height }} />
            </Panel>
          ))}
        </div>
        <div className="hidden flex-col items-center gap-4 lg:flex">
          <Skeleton className="h-4 w-40 self-start" />
          <Skeleton className="h-[645px] w-[309px] rounded-[52px]" />
        </div>
      </div>
    </div>
  );
}

export default function BioDashboardPage() {
  const { data, isPending, isError, error, refetch, isRefetching } = useBio();
  const { data: session, status } = useSession();

  if (isError && !data) {
    return (
      <div className="mx-auto max-w-6xl">
        <PageHeader title={TITLE} description={DESCRIPTION} />
        <EmptyState
          icon={CircleAlert}
          title="We could not load your bio page"
          description={
            error instanceof Error ? error.message : "Something went wrong. Please try again."
          }
          action={
            <button
              type="button"
              onClick={() => refetch()}
              disabled={isRefetching}
              className={pill.secondary}
            >
              <RotateCcw className={isRefetching ? "animate-spin" : undefined} /> Try again
            </button>
          }
        />
      </div>
    );
  }

  // The handle suggestion for a first page comes from the session, so wait for both.
  if (isPending || status === "loading" || !data) return <EditorSkeleton />;

  return <BioEditor data={data} user={session?.user ?? null} />;
}
