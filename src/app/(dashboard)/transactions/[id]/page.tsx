import { notFound } from 'next/navigation';
import { getTransactionById } from '@/actions/transactions';
import { getAgentsForSelect } from '@/actions/agents';
import { TransactionDetail } from '@/components/transactions/transaction-detail';

interface TransactionDetailPageProps {
  params: Promise<{ id: string }>;
}

export default async function TransactionDetailPage({ params }: TransactionDetailPageProps) {
  const { id } = await params;

  const [transaction, agents] = await Promise.all([
    getTransactionById(id),
    getAgentsForSelect(),
  ]);

  if (!transaction) {
    notFound();
  }

  return (
    <div className="p-4 sm:p-6">
      <TransactionDetail transaction={transaction} agents={agents} />
    </div>
  );
}
