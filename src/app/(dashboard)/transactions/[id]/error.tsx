'use client';

import { useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { AlertTriangle } from 'lucide-react';
import Link from 'next/link';

export default function TransactionDetailError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // Log to error reporting service in production
  }, [error]);

  return (
    <div className="flex flex-col items-center justify-center min-h-[400px] gap-4 p-6 text-center">
      <AlertTriangle className="size-10 text-destructive opacity-80" />
      <div>
        <h2 className="text-lg font-semibold">Failed to load transaction</h2>
        <p className="text-sm text-muted-foreground mt-1">
          There was an error loading this transaction. It may have been deleted or you may not have
          access.
        </p>
      </div>
      <div className="flex gap-2">
        <Button onClick={reset} variant="outline">
          Try Again
        </Button>
        <Button asChild variant="ghost">
          <Link href="/transactions">Back to Transactions</Link>
        </Button>
      </div>
    </div>
  );
}
