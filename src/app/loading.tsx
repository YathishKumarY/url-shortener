import { Skeleton } from "@/components/ui/skeleton";

export default function Loading() {
  return (
    <div className="flex min-h-screen flex-col">
      <div className="flex items-center justify-between px-6 py-4 md:px-12">
        <Skeleton className="h-8 w-24" />
        <div className="flex gap-3">
          <Skeleton className="h-10 w-20 rounded-full" />
          <Skeleton className="h-10 w-32 rounded-full" />
        </div>
      </div>
      <div className="flex-1 px-6 py-16 md:px-12">
        <div className="mx-auto max-w-3xl space-y-8">
          <Skeleton className="mx-auto h-16 w-3/4" />
          <Skeleton className="mx-auto h-6 w-1/2" />
          <Skeleton className="h-14 w-full rounded-full" />
        </div>
      </div>
    </div>
  );
}
