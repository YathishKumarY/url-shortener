import { Skeleton } from "@/components/ui/skeleton";

/**
 * Dashboard navigation fallback. It lives here rather than at the app root:
 * a root loading.tsx wraps the home page in Suspense, which turns the
 * custom-domain root redirect into a meta refresh instead of an HTTP 307.
 */
export default function Loading() {
  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <div className="flex items-end justify-between">
        <div className="space-y-2">
          <Skeleton className="h-8 w-40" />
          <Skeleton className="h-4 w-72" />
        </div>
        <Skeleton className="h-10 w-32 rounded-full" />
      </div>
      <Skeleton className="h-10 w-full rounded-full" />
      <div className="space-y-2">
        {Array.from({ length: 6 }).map((_, i) => (
          <Skeleton key={i} className="h-20 w-full rounded-2xl" />
        ))}
      </div>
    </div>
  );
}
