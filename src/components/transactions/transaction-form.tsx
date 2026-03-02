'use client';

import { useState, useTransition } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { Plus } from 'lucide-react';
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
import { Checkbox } from '@/components/ui/checkbox';
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
import { QuickAddAgentDialog } from './quick-add-agent-dialog';

interface AgentOption {
  id: string;
  name: string;
  broker: string | null;
}

interface TransactionFormProps {
  agents: AgentOption[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Pass to edit an existing transaction. */
  transaction?: Transaction;
}

function toFormDollars(cents: number | null | undefined): string {
  if (cents == null) return '';
  return (cents / 100).toString();
}

// ─── Agent Picker Field ───────────────────────────────────────────────────────
// Shows a checkbox "In-House" + either a Select (in-house) or a text input (outside).

interface AgentPickerFieldProps {
  label: string;
  /** form field names for the two data points */
  agentIdField: 'sellerAgentId' | 'buyerAgentId';
  isInHouseField: 'sellerAgentIsInHouse' | 'buyerAgentIsInHouse';
  agentTextField: 'sellerAgent' | 'buyerAgent';
  agents: AgentOption[];
  defaultAgentId?: string | null;
  defaultIsInHouse?: boolean | null;
  defaultAgentText?: string | null;
  setValue: (field: keyof TransactionFormValues, value: string | boolean) => void;
  register: ReturnType<typeof useForm<TransactionFormValues>>['register'];
  onAddAgent: (newAgent: AgentOption) => void;
}

function AgentPickerField({
  label,
  agentIdField,
  isInHouseField,
  agentTextField,
  agents,
  defaultAgentId,
  defaultIsInHouse,
  defaultAgentText,
  setValue,
  register,
  onAddAgent,
}: AgentPickerFieldProps) {
  const [isInHouse, setIsInHouse] = useState<boolean>(defaultIsInHouse ?? false);
  const [quickAddOpen, setQuickAddOpen] = useState(false);

  function handleInHouseToggle(checked: boolean) {
    setIsInHouse(checked);
    setValue(isInHouseField, checked);
    if (!checked) {
      // Clear the FK when switching to outside
      setValue(agentIdField, '');
    } else {
      // Clear text input when switching to in-house
      setValue(agentTextField, '');
    }
  }

  function handleAgentSelect(value: string) {
    setValue(agentIdField, value === '__none__' ? '' : value);
  }

  function handleAgentCreated(newAgent: AgentOption) {
    onAddAgent(newAgent);
    // Auto-select the newly created agent
    setValue(agentIdField, newAgent.id);
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <Label className="text-sm font-medium">{label}</Label>
        <label className="flex items-center gap-1.5 cursor-pointer select-none">
          <Checkbox
            checked={isInHouse}
            onCheckedChange={(checked) => handleInHouseToggle(checked === true)}
          />
          <span className="text-xs text-muted-foreground">In-House</span>
        </label>
      </div>

      {isInHouse ? (
        <div className="flex gap-2">
          <Select
            onValueChange={handleAgentSelect}
            defaultValue={defaultAgentId ?? '__none__'}
          >
            <SelectTrigger className="flex-1">
              <SelectValue placeholder="Select agent..." />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="__none__">— None —</SelectItem>
              {agents.map((a) => (
                <SelectItem key={a.id} value={a.id}>
                  <span>{a.name}</span>
                  {a.broker && (
                    <span className="ml-1 text-muted-foreground text-xs">· {a.broker}</span>
                  )}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button
            type="button"
            variant="outline"
            size="icon"
            onClick={() => setQuickAddOpen(true)}
            title="Add new agent"
          >
            <Plus className="size-4" />
          </Button>
        </div>
      ) : (
        <Input
          {...register(agentTextField)}
          defaultValue={defaultAgentText ?? ''}
          placeholder="Agent name (outside brokerage)"
        />
      )}

      <QuickAddAgentDialog
        open={quickAddOpen}
        onOpenChange={setQuickAddOpen}
        onAgentCreated={handleAgentCreated}
      />
    </div>
  );
}

// ─── Main form ────────────────────────────────────────────────────────────────

export function TransactionForm({ agents: initialAgents, open, onOpenChange, transaction }: TransactionFormProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [agents, setAgents] = useState<AgentOption[]>(initialAgents);
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
          sellerAgentId: transaction.sellerAgentId ?? '',
          sellerAgentIsInHouse: transaction.sellerAgentIsInHouse ?? false,
          buyerAgentId: transaction.buyerAgentId ?? '',
          buyerAgentIsInHouse: transaction.buyerAgentIsInHouse ?? false,
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
          listingActiveDate: transaction.listingActiveDate ?? '',
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
      : { state: 'CA', status: 'pending', transactionType: 'purchase', sellerAgentIsInHouse: false, buyerAgentIsInHouse: false },
  });

  const transactionType = watch('transactionType');
  const isListing = transactionType === 'listing' || transactionType === 'dual';

  function handleAgentAdded(newAgent: AgentOption) {
    setAgents((prev) => {
      if (prev.find((a) => a.id === newAgent.id)) return prev;
      return [...prev, newAgent].sort((a, b) => a.name.localeCompare(b.name));
    });
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
                    <SelectItem value="active">Active</SelectItem>
                    <SelectItem value="in_escrow">In Escrow</SelectItem>
                    <SelectItem value="closing">Closing</SelectItem>
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

          <Separator />

          {/* ── Agents ───────────────────────────────────── */}
          <section className="space-y-4">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
              Agents
            </p>

            <AgentPickerField
              label="Seller's Agent"
              agentIdField="sellerAgentId"
              isInHouseField="sellerAgentIsInHouse"
              agentTextField="sellerAgent"
              agents={agents}
              defaultAgentId={transaction?.sellerAgentId}
              defaultIsInHouse={transaction?.sellerAgentIsInHouse ?? false}
              defaultAgentText={transaction?.sellerAgent}
              setValue={setValue}
              register={register}
              onAddAgent={handleAgentAdded}
            />

            <AgentPickerField
              label="Buyer's Agent"
              agentIdField="buyerAgentId"
              isInHouseField="buyerAgentIsInHouse"
              agentTextField="buyerAgent"
              agents={agents}
              defaultAgentId={transaction?.buyerAgentId}
              defaultIsInHouse={transaction?.buyerAgentIsInHouse ?? false}
              defaultAgentText={transaction?.buyerAgent}
              setValue={setValue}
              register={register}
              onAddAgent={handleAgentAdded}
            />
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
                <Label htmlFor="acceptanceDate">Acceptance Date</Label>
                <Input id="acceptanceDate" type="date" {...register('acceptanceDate')} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="escrowOpenDate">Escrow Open</Label>
                <Input id="escrowOpenDate" type="date" {...register('escrowOpenDate')} />
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
                <PhoneInput id="escrowOfficerPhone" {...register('escrowOfficerPhone')} />
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
    </Sheet>
  );
}
