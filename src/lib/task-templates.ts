// Default CA real estate task templates — populated in Phase 4
export const defaultTaskTemplates: {
  name: string;
  category: string;
  transactionType: 'listing' | 'purchase' | 'both';
  relativeDueDays: number;
  relativeTo: string;
  sortOrder: number;
}[] = [];
