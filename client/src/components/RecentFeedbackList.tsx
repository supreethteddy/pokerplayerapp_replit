import { useQuery } from "@tanstack/react-query";
import { Skeleton } from "@/components/ui/skeleton";

interface RecentFeedbackListProps {
  playerId?: number | string | null;
}

export function RecentFeedbackList({ playerId }: RecentFeedbackListProps) {
  const { data, isLoading, error } = useQuery({
    queryKey: ["/api/feedback", playerId],
    enabled: !!playerId,
    queryFn: async () => {
      const res = await fetch(`/api/feedback?playerId=${playerId}`);
      if (!res.ok) {
        throw new Error("Failed to load feedback history");
      }
      return res.json();
    },
    staleTime: 30_000,
  });

  if (!playerId) {
    return (
      <div className="text-xs text-slate-500">
        Sign in to view your feedback history.
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="space-y-2">
        {[1, 2, 3].map((i) => (
          <Skeleton key={i} className="h-8 bg-slate-700" />
        ))}
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-xs text-red-400">
        Could not load your previous feedback. Please try again later.
      </div>
    );
  }

  const items = Array.isArray(data) ? data.slice(0, 10) : [];

  if (!items.length) {
    return (
      <div className="text-xs text-slate-400">
        You have not submitted any feedback yet.
      </div>
    );
  }

  return (
    <div className="space-y-2 max-h-64 overflow-y-auto">
      {items.map((fb: any) => (
        <div
          key={fb.id}
          className="p-2 rounded-md bg-slate-700/80 border border-slate-600/70"
        >
          <div className="flex items-center justify-between mb-1">
            <span className="text-[11px] text-slate-400">
              {fb.createdAt
                ? new Date(fb.createdAt).toLocaleString()
                : "Pending time"}
            </span>
            {fb.status && (
              <span className="text-[10px] text-emerald-300 uppercase tracking-wide">
                {fb.status}
              </span>
            )}
          </div>
          <div className="text-xs text-slate-100 line-clamp-3">
            {fb.message || fb.text || ""}
          </div>
        </div>
      ))}
    </div>
  );
}




