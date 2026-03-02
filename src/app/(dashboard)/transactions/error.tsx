'use client';

import { useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { AlertTriangle } from 'lucide-react';

export default function TransactionsError({
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
        <h2 className="text-lg font-semibold">Failed to load transactions</h2>
        <p className="text-sm text-muted-foreground mt-1">
          There was an error loading your transactions. Please try again.
        </p>
      </div>
      <Button onClick={reset} variant="outline">
        Try Again
      </Button>
    </div>
  );
}
