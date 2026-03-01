export default function TransactionDetailPage({ params }: { params: { id: string } }) {
  return (
    <main className="p-6">
      <h1 className="text-2xl font-bold">Transaction {params.id}</h1>
      <p className="text-muted-foreground mt-2">Transaction detail — coming in Phase 9</p>
    </main>
  )
}
