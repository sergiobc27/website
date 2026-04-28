export function SkeletonLoader({ rows = 5 }: { rows?: number }) {
  return (
    <div className="space-y-3">
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="flex items-center gap-4 p-4 bg-background rounded-lg border border-border overflow-hidden">
          <div className="w-10 h-10 bg-muted rounded-lg skeleton overflow-hidden" />
          <div className="flex-1 space-y-2">
            <div className="h-4 bg-muted rounded skeleton w-3/4 overflow-hidden" />
            <div className="h-3 bg-muted rounded skeleton w-1/2 overflow-hidden" />
          </div>
          <div className="space-y-2">
            <div className="h-4 bg-muted rounded skeleton w-24 overflow-hidden" />
            <div className="h-3 bg-muted rounded skeleton w-16 overflow-hidden" />
          </div>
        </div>
      ))}
    </div>
  );
}
