'use client';

import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetFooter,
} from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Separator } from '@/components/ui/separator';
import { transactionSchema } from '@/lib/transaction-schema';
import type { TransactionFormValues } from '@/lib/transaction-schema';
import { createTransaction, updateTransaction } from '@/actions/transactions';
import type { Transaction } from '@/db/schema';

interface TransactionFormProps {
  agents: { id: string; name: string }[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Pass to edit an existing transaction. */
  transaction?: Transaction;
}

function toFormDollars(cents: number | null | undefined): string {
  if (cents == null) return '';
  return (cents / 100).toString();
}

export function TransactionForm({ agents, open, onOpenChange, transaction }: TransactionFormProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const isEdit = !!transaction;

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    reset,
    formState: { errors },
  } = useForm<TransactionFormValues>({
    resolver: zodResolver(transactionSchema),
    defaultValues: transaction
      ? {
          address: transaction.address,
          city: transaction.city ?? '',
          state: transaction.state ?? 'CA',
          zipCode: transaction.zipCode ?? '',
          mlsNumber: transaction.mlsNumber ?? '',
          listingAgentId: transaction.listingAgentId ?? '',
          sellingAgentId: transaction.sellingAgentId ?? '',
          transactionType: transaction.transactionType,
          status: transaction.status,
          propertyType: transaction.propertyType ?? undefined,
          buyerName: transaction.buyerName ?? '',
          buyerAgent: transaction.buyerAgent ?? '',
          sellerName: transaction.sellerName ?? '',
          sellerAgent: transaction.sellerAgent ?? '',
          purchasePrice: toFormDollars(transaction.purchasePrice),
          listPrice: toFormDollars(transaction.listPrice),
          earnestMoneyDeposit: toFormDollars(transaction.earnestMoneyDeposit),
          commissionPercent: transaction.commissionPercent ?? '',
          acceptanceDate: transaction.acceptanceDate ?? '',
          escrowOpenDate: transaction.escrowOpenDate ?? '',
          inspectionContingencyDate: transaction.inspectionContingencyDate ?? '',
          appraisalContingencyDate: transaction.appraisalContingencyDate ?? '',
          loanContingencyDate: transaction.loanContingencyDate ?? '',
          expectedCloseDate: transaction.expectedCloseDate ?? '',
          actualCloseDate: transaction.actualCloseDate ?? '',
          escrowNumber: transaction.escrowNumber ?? '',
          escrowCompany: transaction.escrowCompany ?? '',
          escrowOfficer: transaction.escrowOfficer ?? '',
          escrowOfficerPhone: transaction.escrowOfficerPhone ?? '',
          escrowOfficerEmail: transaction.escrowOfficerEmail ?? '',
          titleCompany: transaction.titleCompany ?? '',
          titleOfficer: transaction.titleOfficer ?? '',
          lenderName: transaction.lenderName ?? '',
          loanOfficer: transaction.loanOfficer ?? '',
          loanOfficerPhone: transaction.loanOfficerPhone ?? '',
          loanOfficerEmail: transaction.loanOfficerEmail ?? '',
          notes: transaction.notes ?? '',
        }
      : { state: 'CA', status: 'pending', transactionType: 'purchase' },
  });

  const transactionType = watch('transactionType');

  function onSubmit(data: TransactionFormValues) {
    startTransition(async () => {
      if (isEdit) {
        const result = await updateTransaction(transaction!.id, data);
        if (result.success) {
          toast.success('Transaction updated');
          onOpenChange(false);
          reset();
          router.refresh();
        } else {
          toast.error(result.error ?? 'Something went wrong');
        }
      } else {
        const result = await createTransaction(data);
        if (result.success) {
          toast.success('Transaction created');
          onOpenChange(false);
          reset();
          if (result.data?.id) {
            router.push(`/transactions/${result.data.id}`);
          } else {
            router.refresh();
          }
        } else {
          toast.error(result.error ?? 'Something went wrong');
        }
      }
    });
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full sm:max-w-xl overflow-y-auto">
        <SheetHeader className="pb-4">
          <SheetTitle>{isEdit ? 'Edit Transaction' : 'New Transaction'}</SheetTitle>
        </SheetHeader>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-6 pb-8">
          {/* ── Property ─────────────────────────────────── */}
          <section className="space-y-3">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
              Property
            </p>

            <div className="space-y-1.5">
              <Label htmlFor="address">Address *</Label>
              <Input id="address" {...register('address')} placeholder="123 Main St" />
              {errors.address && (
                <p className="text-xs text-destructive">{errors.address.message}</p>
              )}
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="city">City</Label>
                <Input id="city" {...register('city')} placeholder="Los Angeles" />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="zipCode">ZIP</Label>
                <Input id="zipCode" {...register('zipCode')} placeholder="90210" />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="mlsNumber">MLS #</Label>
                <Input id="mlsNumber" {...register('mlsNumber')} placeholder="ML12345" />
              </div>
              <div className="space-y-1.5">
                <Label>Property Type</Label>
                <Select
                  onValueChange={(v) =>
                    setValue('propertyType', v as TransactionFormValues['propertyType'])
                  }
                  defaultValue={transaction?.propertyType ?? undefined}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select type" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="single_family">Single Family</SelectItem>
                    <SelectItem value="condo">Condo</SelectItem>
                    <SelectItem value="townhouse">Townhouse</SelectItem>
                    <SelectItem value="multi_family">Multi-Family</SelectItem>
                    <SelectItem value="land">Land</SelectItem>
                    <SelectItem value="commercial">Commercial</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </section>

          <Separator />

          {/* ── Transaction Info ──────────────────────────── */}
          <section className="space-y-3">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
              Transaction
            </p>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Listing Agent (In-House)</Label>
                <Select
                  onValueChange={(v) => setValue('listingAgentId', v === '__none__' ? '' : v)}
                  defaultValue={transaction?.listingAgentId ?? '__none__'}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Outside / None" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none__">Outside / None</SelectItem>
                    {agents.map((a) => (
                      <SelectItem key={a.id} value={a.id}>
                        {a.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1.5">
                <Label>Selling Agent (In-House)</Label>
                <Select
                  onValueChange={(v) => setValue('sellingAgentId', v === '__none__' ? '' : v)}
                  defaultValue={transaction?.sellingAgentId ?? '__none__'}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Outside / None" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none__">Outside / None</SelectItem>
                    {agents.map((a) => (
                      <SelectItem key={a.id} value={a.id}>
                        {a.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1.5">
                <Label>Status</Label>
                <Select
                  onValueChange={(v) => setValue('status', v as TransactionFormValues['status'])}
                  defaultValue={transaction?.status ?? 'pending'}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="pending">Pending</SelectItem>
                    <SelectItem value="active">Active</SelectItem>
                    <SelectItem value="in_escrow">In Escrow</SelectItem>
                    <SelectItem value="closing">Closing</SelectItem>
                    <SelectItem value="closed">Closed</SelectItem>
                    <SelectItem value="cancelled">Cancelled</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-1.5">
              <Label>Transaction Type *</Label>
              <Select
                onValueChange={(v) =>
                  setValue('transactionType', v as TransactionFormValues['transactionType'])
                }
                defaultValue={transaction?.transactionType ?? 'purchase'}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="purchase">Purchase</SelectItem>
                  <SelectItem value="listing">Listing</SelectItem>
                  <SelectItem value="dual">Dual</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </section>

          <Separator />

          {/* ── Parties ───────────────────────────────────── */}
          <section className="space-y-3">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
              Parties
            </p>
            {(transactionType === 'purchase' || transactionType === 'dual') && (
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label htmlFor="buyerName">Buyer Name</Label>
                  <Input id="buyerName" {...register('buyerName')} placeholder="Jane Smith" />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="buyerAgent">Buyer&apos;s Agent (Outside)</Label>
                  <Input id="buyerAgent" {...register('buyerAgent')} placeholder="Agent name" />
                </div>
              </div>
            )}
            {(transactionType === 'listing' || transactionType === 'dual') && (
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label htmlFor="sellerName">Seller Name</Label>
                  <Input id="sellerName" {...register('sellerName')} placeholder="John Doe" />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="sellerAgent">Seller&apos;s Agent (Outside)</Label>
                  <Input id="sellerAgent" {...register('sellerAgent')} placeholder="Agent name" />
                </div>
              </div>
            )}
          </section>

          <Separator />

          {/* ── Key Dates ─────────────────────────────────── */}
          <section className="space-y-3">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
              Key Dates
            </p>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="acceptanceDate">Acceptance Date</Label>
                <Input id="acceptanceDate" type="date" {...register('acceptanceDate')} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="escrowOpenDate">Escrow Open</Label>
                <Input id="escrowOpenDate" type="date" {...register('escrowOpenDate')} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="expectedCloseDate">Expected Close</Label>
                <Input id="expectedCloseDate" type="date" {...register('expectedCloseDate')} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="inspectionContingencyDate">Inspection Contingency</Label>
                <Input
                  id="inspectionContingencyDate"
                  type="date"
                  {...register('inspectionContingencyDate')}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="appraisalContingencyDate">Appraisal Contingency</Label>
                <Input
                  id="appraisalContingencyDate"
                  type="date"
                  {...register('appraisalContingencyDate')}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="loanContingencyDate">Loan Contingency</Label>
                <Input
                  id="loanContingencyDate"
                  type="date"
                  {...register('loanContingencyDate')}
                />
              </div>
            </div>
          </section>

          <Separator />

          {/* ── Financials ────────────────────────────────── */}
          <section className="space-y-3">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
              Financials
            </p>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="purchasePrice">Purchase Price ($)</Label>
                <Input
                  id="purchasePrice"
                  type="number"
                  step="1000"
                  {...register('purchasePrice')}
                  placeholder="500000"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="listPrice">List Price ($)</Label>
                <Input
                  id="listPrice"
                  type="number"
                  step="1000"
                  {...register('listPrice')}
                  placeholder="525000"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="earnestMoneyDeposit">Earnest Money ($)</Label>
                <Input
                  id="earnestMoneyDeposit"
                  type="number"
                  step="500"
                  {...register('earnestMoneyDeposit')}
                  placeholder="10000"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="commissionPercent">Commission %</Label>
                <Input
                  id="commissionPercent"
                  {...register('commissionPercent')}
                  placeholder="2.5"
                />
              </div>
            </div>
          </section>

          <Separator />

          {/* ── Escrow & Title ────────────────────────────── */}
          <section className="space-y-3">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
              Escrow &amp; Title
            </p>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="escrowCompany">Escrow Company</Label>
                <Input id="escrowCompany" {...register('escrowCompany')} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="escrowNumber">Escrow #</Label>
                <Input id="escrowNumber" {...register('escrowNumber')} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="escrowOfficer">Escrow Officer</Label>
                <Input id="escrowOfficer" {...register('escrowOfficer')} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="escrowOfficerPhone">Escrow Phone</Label>
                <Input id="escrowOfficerPhone" {...register('escrowOfficerPhone')} />
              </div>
              <div className="col-span-2 space-y-1.5">
                <Label htmlFor="escrowOfficerEmail">Escrow Email</Label>
                <Input id="escrowOfficerEmail" type="email" {...register('escrowOfficerEmail')} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="titleCompany">Title Company</Label>
                <Input id="titleCompany" {...register('titleCompany')} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="titleOfficer">Title Officer</Label>
                <Input id="titleOfficer" {...register('titleOfficer')} />
              </div>
            </div>
          </section>

          <Separator />

          {/* ── Lender ───────────────────────────────────── */}
          <section className="space-y-3">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
              Lender
            </p>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="lenderName">Lender</Label>
                <Input id="lenderName" {...register('lenderName')} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="loanOfficer">Loan Officer</Label>
                <Input id="loanOfficer" {...register('loanOfficer')} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="loanOfficerPhone">Loan Officer Phone</Label>
                <Input id="loanOfficerPhone" {...register('loanOfficerPhone')} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="loanOfficerEmail">Loan Officer Email</Label>
                <Input id="loanOfficerEmail" type="email" {...register('loanOfficerEmail')} />
              </div>
            </div>
          </section>

          <Separator />

          {/* ── Notes ────────────────────────────────────── */}
          <section className="space-y-3">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
              Notes
            </p>
            <Textarea
              {...register('notes')}
              rows={4}
              placeholder="Internal notes about this transaction..."
            />
          </section>

          <SheetFooter className="gap-2 flex-col-reverse sm:flex-row pt-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={isPending}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={isPending}>
              {isPending
                ? isEdit
                  ? 'Saving...'
                  : 'Creating...'
                : isEdit
                  ? 'Save Changes'
                  : 'Create Transaction'}
            </Button>
          </SheetFooter>
        </form>
      </SheetContent>
    </Sheet>
  );
}
