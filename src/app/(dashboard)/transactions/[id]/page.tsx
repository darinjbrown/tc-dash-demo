import { notFound } from 'next/navigation';
import { getTransactionById } from '@/actions/transactions';
import { TransactionDetail } from '@/components/transactions/transaction-detail';

interface TransactionDetailPageProps {
  params: Promise<{ id: string }>;
}

export default async function TransactionDetailPage({ params }: TransactionDetailPageProps) {
  const { id } = await params;

  const transaction = await getTransactionById(id);

  if (!transaction) {
    notFound();
  }

  return (
    <div className="p-4 sm:p-6">
      <TransactionDetail transaction={transaction} />
    </div>
  );
}
