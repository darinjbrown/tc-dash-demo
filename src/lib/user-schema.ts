import { z } from 'zod';

export const userSchema = z.object({
  name: z.string().min(1, 'Name is required'),
  email: z.string().email('Valid email required'),
  role: z.enum(['admin', 'broker', 'tc', 'agent']),
});

export type UserFormValues = z.infer<typeof userSchema>;
