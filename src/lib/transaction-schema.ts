import { z } from 'zod';

// Plain schema without transforms — compatible with react-hook-form resolvers.
// Server actions handle empty-string-to-null and dollar-to-cents conversions.

export const transactionSchema = z.object({
  address: z.string().min(1, 'Address is required'),
  city: z.string().optional(),
  state: z.string().optional(),
  zipCode: z.string().optional(),
  mlsNumber: z.string().optional(),
  sellerAgentId: z.string().optional(),
  sellerAgentIsInHouse: z.boolean().optional(),
  buyerAgentId: z.string().optional(),
  buyerAgentIsInHouse: z.boolean().optional(),
  transactionType: z.enum(['listing', 'purchase', 'dual']),
  status: z.enum(['pending', 'active', 'in_escrow', 'closing', 'closed', 'cancelled']),
  propertyType: z.string().optional(),
  escrowNumber: z.string().optional(),
  escrowCompany: z.string().optional(),
  escrowOfficer: z.string().optional(),
  escrowOfficerPhone: z.string().optional(),
  escrowOfficerEmail: z.string().optional(),
  titleCompany: z.string().optional(),
  titleOfficer: z.string().optional(),
  lenderName: z.string().optional(),
  loanOfficer: z.string().optional(),
  loanOfficerPhone: z.string().optional(),
  loanOfficerEmail: z.string().optional(),
  buyerName: z.string().optional(),
  buyerAgent: z.string().optional(),
  sellerName: z.string().optional(),
  sellerAgent: z.string().optional(),
  // Money: user enters dollars as strings, server converts to cents
  purchasePrice: z.string().optional(),
  listPrice: z.string().optional(),
  earnestMoneyDeposit: z.string().optional(),
  commissionPercent: z.string().optional(),
  // Dates as ISO strings (YYYY-MM-DD)
  acceptanceDate: z.string().optional(),
  escrowOpenDate: z.string().optional(),
  inspectionContingencyDate: z.string().optional(),
  appraisalContingencyDate: z.string().optional(),
  loanContingencyDate: z.string().optional(),
  expectedCloseDate: z.string().optional(),
  actualCloseDate: z.string().optional(),
  notes: z.string().optional(),
});

export type TransactionFormValues = z.infer<typeof transactionSchema>;
