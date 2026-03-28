import { z } from 'zod';

export const templateGroupSchema = z.object({
  name: z.string().min(1, 'Name is required'),
  description: z.string().optional(),
  transactionType: z.enum(['listing', 'purchase', 'dual', 'all']),
  sortOrder: z.number().int().min(0).optional(),
});

export type TemplateGroupFormValues = z.infer<typeof templateGroupSchema>;
