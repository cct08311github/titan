import { ListSkeleton } from "@/app/components/page-states";

export default function ActivityLoading() {
  return (
    <div className="space-y-4">
      <div className="space-y-1">
        <div className="animate-pulse rounded bg-muted h-6 w-32" />
        <div className="animate-pulse rounded bg-muted h-4 w-48" />
      </div>
      <ListSkeleton rows={8} />
    </div>
  );
}
