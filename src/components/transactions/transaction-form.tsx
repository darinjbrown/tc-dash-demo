'use client';

import { useState, useTransition, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { Plus, X } from 'lucide-react';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetFooter,
} from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { PhoneInput } from '@/components/ui/phone-input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
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
import type { TransactionDetail as TxDetail, FormAgentInput } from '@/actions/transactions';
import { getAgentsForSelect } from '@/actions/agents';
import { getTemplateGroupsForSelect } from '@/actions/tasks';
import type { TemplateGroupOption } from '@/actions/tasks';
import { AgentPickerDialog } from './agent-picker-dialog';
import type { AgentOption } from './agent-picker-dialog';

interface TransactionFormProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  transaction?: TxDetail;
}

function toFormDollars(cents: number | null | undefined): string {
  if (cents == null) return '';
  return (cents / 100).toString();
}

// ─── Main form ────────────────────────────────────────────────────────────────

export function TransactionForm({ open, onOpenChange, transaction }: TransactionFormProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const isEdit = !!transaction;

  // Multi-agent state
  const [listingAgents, setListingAgents] = useState<FormAgentInput[]>([]);
  const [buyerAgents, setBuyerAgents] = useState<FormAgentInput[]>([]);
  const [pickerSide, setPickerSide] = useState<'listing' | 'buyer' | null>(null);
  const [allAgents, setAllAgents] = useState<AgentOption[]>([]);

  // Template group selection (create mode only)
  const [templateGroups, setTemplateGroups] = useState<TemplateGroupOption[]>([]);
  const [selectedGroupIds, setSelectedGroupIds] = useState<string[]>([]);

  // Load agents when form opens
  useEffect(() => {
    if (open) {
      getAgentsForSelect().then((data) =>
        setAllAgents(data.map((a) => ({ ...a, isInHouse: a.isInHouse ?? false })))
      );
    }
  }, [open]);

  // Pre-populate agents when editing
  useEffect(() => {
    if (transaction) {
      setListingAgents(
        (transaction.listingAgents ?? []).map((a) => ({
          agentId: a.agentId,
          side: 'listing' as const,
          isPrimary: a.isPrimary,
        }))
      );
      setBuyerAgents(
        (transaction.buyerAgents ?? []).map((a) => ({
          agentId: a.agentId,
          side: 'buyer' as const,
          isPrimary: a.isPrimary,
        }))
      );
    } else {
      setListingAgents([]);
      setBuyerAgents([]);
    }
  }, [transaction, open]);

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
          sellerTcName: transaction.sellerTcName ?? '',
          sellerTcEmail: transaction.sellerTcEmail ?? '',
          sellerTcPhone: transaction.sellerTcPhone ?? '',
          buyerTcName: transaction.buyerTcName ?? '',
          buyerTcEmail: transaction.buyerTcEmail ?? '',
          buyerTcPhone: transaction.buyerTcPhone ?? '',
          transactionType: transaction.transactionType,
          status: transaction.status,
          propertyType: transaction.propertyType ?? undefined,
          buyerName: transaction.buyerName ?? '',
          sellerName: transaction.sellerName ?? '',
          purchasePrice: toFormDollars(transaction.purchasePrice),
          earnestMoneyDeposit: toFormDollars(transaction.earnestMoneyDeposit),
          buyerCommissionPercent: transaction.buyerCommissionPercent ?? '',
          listingCommissionPercent: transaction.listingCommissionPercent ?? '',
          contractDate: transaction.contractDate ?? '',
          acceptanceDate: transaction.acceptanceDate ?? '',
          verificationOfFundsDate: transaction.verificationOfFundsDate ?? '',
          earnestMoneyDueDate: transaction.earnestMoneyDueDate ?? '',
          inspectionContingencyDate: transaction.inspectionContingencyDate ?? '',
          insuranceContingencyDate: transaction.insuranceContingencyDate ?? '',
          loanContingencyDate: transaction.loanContingencyDate ?? '',
          appraisalContingencyDate: transaction.appraisalContingencyDate ?? '',
          hoaDocsDueDate: transaction.hoaDocsDueDate ?? '',
          listingActiveDate: transaction.listingActiveDate ?? '',
          expectedCloseDate: transaction.expectedCloseDate ?? '',
          actualCloseDate: transaction.actualCloseDate ?? '',
          escrowNumber: transaction.escrowNumber ?? '',
          escrowCompany: transaction.escrowCompany ?? '',
          escrowOfficer: transaction.escrowOfficer ?? '',
          escrowOfficerPhone: transaction.escrowOfficerPhone ?? '',
          escrowOfficerEmail: transaction.escrowOfficerEmail ?? '',
          lenderName: transaction.lenderName ?? '',
          loanOfficer: transaction.loanOfficer ?? '',
          loanOfficerPhone: transaction.loanOfficerPhone ?? '',
          loanOfficerEmail: transaction.loanOfficerEmail ?? '',
          notes: transaction.notes ?? '',
        }
      : { state: 'CA', status: 'pending', transactionType: 'purchase' },
  });

  const transactionType = watch('transactionType');
  const isListing = transactionType === 'listing' || transactionType === 'dual';

  // Load template groups whenever transaction type changes (create mode only)
  useEffect(() => {
    if (isEdit || !transactionType) return;
    getTemplateGroupsForSelect(transactionType).then((groups) => {
      setTemplateGroups(groups);
      setSelectedGroupIds(groups.filter((g) => g.isDefault).map((g) => g.id));
    });
  }, [transactionType, isEdit]);

  function handlePickerAdd(agentId: string, isPrimary: boolean) {
    const side = pickerSide!;
    const newEntry: FormAgentInput = { agentId, side, isPrimary };
    if (side === 'listing') {
      setListingAgents((prev) => {
        const cleared = isPrimary ? prev.map((a) => ({ ...a, isPrimary: false })) : prev;
        return [...cleared, newEntry];
      });
    } else {
      setBuyerAgents((prev) => {
        const cleared = isPrimary ? prev.map((a) => ({ ...a, isPrimary: false })) : prev;
        return [...cleared, newEntry];
      });
    }
    setPickerSide(null);
  }

  function removeFormAgent(agentId: string, side: 'listing' | 'buyer') {
    if (side === 'listing') setListingAgents((prev) => prev.filter((a) => a.agentId !== agentId));
    else setBuyerAgents((prev) => prev.filter((a) => a.agentId !== agentId));
  }

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
        const result = await createTransaction(data, [...listingAgents, ...buyerAgents], selectedGroupIds.length ? selectedGroupIds : undefined);
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

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-6 px-4 pb-8">
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
                <Input id="city" {...register('city')} placeholder="Santa Rosa" />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="zipCode">ZIP</Label>
                <Input id="zipCode" {...register('zipCode')} placeholder="95401" />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="mlsNumber">MLS #</Label>
                <Input id="mlsNumber" {...register('mlsNumber')} placeholder="SN26001" />
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
                    <SelectItem value="listed">Listed</SelectItem>
                    <SelectItem value="in_escrow">In Escrow</SelectItem>
                    <SelectItem value="closed">Closed</SelectItem>
                    <SelectItem value="cancelled">Cancelled</SelectItem>
                  </SelectContent>
                </Select>
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
                    <SelectItem value="dual">Dual Agency</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </section>

          {/* ── Task Template (create only) ──────────────── */}
          {!isEdit && templateGroups.length > 0 && (
            <>
              <Separator />
              <section className="space-y-3">
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                  Task Template
                </p>
                <div className="space-y-2">
                  {templateGroups.map((group) => {
                    const checked = selectedGroupIds.includes(group.id);
                    return (
                      <label
                        key={group.id}
                        className="flex items-center gap-3 rounded-md border px-3 py-2 cursor-pointer hover:bg-muted/50 transition-colors"
                      >
                        <input
                          type="checkbox"
                          className="accent-primary h-4 w-4 shrink-0"
                          checked={checked}
                          onChange={() =>
                            setSelectedGroupIds((prev) =>
                              checked ? prev.filter((id) => id !== group.id) : [...prev, group.id]
                            )
                          }
                        />
                        <span className="text-sm flex-1">{group.name}</span>
                        {group.isDefault && (
                          <span className="text-xs text-muted-foreground">default</span>
                        )}
                      </label>
                    );
                  })}
                </div>
                {selectedGroupIds.length === 0 && (
                  <p className="text-xs text-muted-foreground">No template selected — transaction will have no tasks.</p>
                )}
              </section>
            </>
          )}

          <Separator />

          {/* ── Agents ───────────────────────────────────── */}
          <section className="space-y-4">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
              Agents
            </p>

            {/* Listing Agents */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label className="text-sm font-medium">Listing Agents</Label>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="h-7 text-xs gap-1"
                  onClick={() => setPickerSide('listing')}
                >
                  <Plus className="size-3" /> Add
                </Button>
              </div>
              {listingAgents.map((a) => {
                const info = allAgents.find((ag) => ag.id === a.agentId);
                return (
                  <div key={a.agentId} className="flex items-center justify-between text-sm border rounded px-3 py-2">
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="font-medium truncate">{info?.name ?? a.agentId}</span>
                      {a.isPrimary && (
                        <Badge className="text-[10px] px-1.5 py-0 h-4 shrink-0">Primary</Badge>
                      )}
                    </div>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="h-6 w-6 p-0 text-muted-foreground hover:text-destructive shrink-0"
                      onClick={() => removeFormAgent(a.agentId, 'listing')}
                    >
                      <X className="size-3" />
                    </Button>
                  </div>
                );
              })}
              {listingAgents.length === 0 && (
                <p className="text-xs text-muted-foreground italic">No listing agents added</p>
              )}
            </div>

            {/* Buyer Agents */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label className="text-sm font-medium">Buyer&apos;s Agents</Label>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="h-7 text-xs gap-1"
                  onClick={() => setPickerSide('buyer')}
                >
                  <Plus className="size-3" /> Add
                </Button>
              </div>
              {buyerAgents.map((a) => {
                const info = allAgents.find((ag) => ag.id === a.agentId);
                return (
                  <div key={a.agentId} className="flex items-center justify-between text-sm border rounded px-3 py-2">
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="font-medium truncate">{info?.name ?? a.agentId}</span>
                      {a.isPrimary && (
                        <Badge className="text-[10px] px-1.5 py-0 h-4 shrink-0">Primary</Badge>
                      )}
                    </div>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="h-6 w-6 p-0 text-muted-foreground hover:text-destructive shrink-0"
                      onClick={() => removeFormAgent(a.agentId, 'buyer')}
                    >
                      <X className="size-3" />
                    </Button>
                  </div>
                );
              })}
              {buyerAgents.length === 0 && (
                <p className="text-xs text-muted-foreground italic">No buyer&apos;s agents added</p>
              )}
            </div>
          </section>

          <Separator />

          {/* ── Transaction Coordinators ─────────────────── */}
          <section className="space-y-4">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
              Transaction Coordinators
            </p>

            <div className="space-y-1.5">
              <p className="text-xs text-muted-foreground font-medium">Seller-Side TC</p>
              <Input {...register('sellerTcName')} placeholder="Name" />
              <div className="grid grid-cols-2 gap-2">
                <PhoneInput {...register('sellerTcPhone')} placeholder="(707) 000-0000" />
                <Input type="email" {...register('sellerTcEmail')} placeholder="tc@example.com" />
              </div>
            </div>

            <div className="space-y-1.5">
              <p className="text-xs text-muted-foreground font-medium">Buyer-Side TC</p>
              <Input {...register('buyerTcName')} placeholder="Name" />
              <div className="grid grid-cols-2 gap-2">
                <PhoneInput {...register('buyerTcPhone')} placeholder="(707) 000-0000" />
                <Input type="email" {...register('buyerTcEmail')} placeholder="tc@example.com" />
              </div>
            </div>
          </section>

          <Separator />

          {/* ── Parties ───────────────────────────────────── */}
          <section className="space-y-3">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
              Parties
            </p>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="sellerName">Seller Name</Label>
                <Input id="sellerName" {...register('sellerName')} placeholder="John Doe" />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="buyerName">Buyer Name</Label>
                <Input id="buyerName" {...register('buyerName')} placeholder="Jane Smith" />
              </div>
            </div>
          </section>

          <Separator />

          {/* ── Key Dates ─────────────────────────────────── */}
          <section className="space-y-3">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
              Key Dates
            </p>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="contractDate">Contract Date</Label>
                <Input id="contractDate" type="date" {...register('contractDate')} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="acceptanceDate">Acceptance Date</Label>
                <Input id="acceptanceDate" type="date" {...register('acceptanceDate')} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="verificationOfFundsDate">Verification of Funds Due</Label>
                <Input id="verificationOfFundsDate" type="date" {...register('verificationOfFundsDate')} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="earnestMoneyDueDate">Earnest Money Due</Label>
                <Input id="earnestMoneyDueDate" type="date" {...register('earnestMoneyDueDate')} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="inspectionContingencyDate">Inspection Contingency</Label>
                <Input id="inspectionContingencyDate" type="date" {...register('inspectionContingencyDate')} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="insuranceContingencyDate">Insurance Contingency</Label>
                <Input id="insuranceContingencyDate" type="date" {...register('insuranceContingencyDate')} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="loanContingencyDate">Loan Contingency</Label>
                <Input id="loanContingencyDate" type="date" {...register('loanContingencyDate')} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="appraisalContingencyDate">Appraisal Contingency</Label>
                <Input id="appraisalContingencyDate" type="date" {...register('appraisalContingencyDate')} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="hoaDocsDueDate">HOA Docs Due</Label>
                <Input id="hoaDocsDueDate" type="date" {...register('hoaDocsDueDate')} />
              </div>
              {isListing && (
                <div className="space-y-1.5">
                  <Label htmlFor="listingActiveDate">Listing Active Date</Label>
                  <Input id="listingActiveDate" type="date" {...register('listingActiveDate')} />
                </div>
              )}
              <div className="space-y-1.5">
                <Label htmlFor="expectedCloseDate">Expected Close</Label>
                <Input id="expectedCloseDate" type="date" {...register('expectedCloseDate')} />
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
                <Label htmlFor="buyerCommissionPercent">Buyer Commission %</Label>
                <Input
                  id="buyerCommissionPercent"
                  {...register('buyerCommissionPercent')}
                  placeholder="2.5"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="listingCommissionPercent">Listing Commission %</Label>
                <Input
                  id="listingCommissionPercent"
                  {...register('listingCommissionPercent')}
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
                <PhoneInput id="escrowOfficerPhone" {...register('escrowOfficerPhone')} />
              </div>
              <div className="col-span-2 space-y-1.5">
                <Label htmlFor="escrowOfficerEmail">Escrow Email</Label>
                <Input id="escrowOfficerEmail" type="email" {...register('escrowOfficerEmail')} />
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
                <PhoneInput id="loanOfficerPhone" {...register('loanOfficerPhone')} />
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

      <AgentPickerDialog
        open={!!pickerSide}
        onOpenChange={(v) => !v && setPickerSide(null)}
        side={pickerSide ?? 'listing'}
        existingAgentIds={
          pickerSide === 'listing'
            ? listingAgents.map((a) => a.agentId)
            : buyerAgents.map((a) => a.agentId)
        }
        agents={allAgents}
        onAdd={handlePickerAdd}
        onAgentCreated={(a) => setAllAgents((prev) => [...prev, a])}
      />
    </Sheet>
  );
}
