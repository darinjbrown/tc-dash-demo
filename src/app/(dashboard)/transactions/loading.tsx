import { Skeleton } from '@/components/ui/skeleton';

export default function TransactionsLoading() {
  return (
    <div className="p-4 sm:p-6 space-y-6">
      {/* Filter bar */}
      <div className="flex items-center gap-3">
        <Skeleton className="h-9 flex-1 max-w-xs" />
        <Skeleton className="h-9 w-28" />
        <Skeleton className="h-9 w-32 ml-auto" />
      </div>
      {/* Agent groups */}
      {[...Array(3)].map((_, i) => (
        <div key={i} className="space-y-3">
          <Skeleton className="h-10 rounded-lg" />
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3 pl-4">
            {[...Array(3)].map((_, j) => (
              <Skeleton key={j} className="h-36 rounded-lg" />
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
