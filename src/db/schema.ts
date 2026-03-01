import { sqliteTable, text, integer, primaryKey } from 'drizzle-orm/sqlite-core';
import { relations } from 'drizzle-orm';

// ============================================================
// NextAuth tables (follow Auth.js Drizzle adapter schema exactly)
// ============================================================

export const users = sqliteTable('users', {
  id: text('id').primaryKey(),
  name: text('name'),
  email: text('email').notNull().unique(),
  emailVerified: integer('email_verified', { mode: 'timestamp_ms' }),
  image: text('image'),
  hashedPassword: text('hashed_password'),
  role: text('role', { enum: ['admin', 'broker', 'tc', 'agent'] })
    .default('tc')
    .notNull(),
  createdAt: integer('created_at', { mode: 'timestamp_ms' })
    .$defaultFn(() => new Date()),
});

export const accounts = sqliteTable(
  'accounts',
  {
    userId: text('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    type: text('type').notNull(),
    provider: text('provider').notNull(),
    providerAccountId: text('provider_account_id').notNull(),
    refresh_token: text('refresh_token'),
    access_token: text('access_token'),
    expires_at: integer('expires_at'),
    token_type: text('token_type'),
    scope: text('scope'),
    id_token: text('id_token'),
    session_state: text('session_state'),
  },
  (table) => [primaryKey({ columns: [table.provider, table.providerAccountId] })],
);

export const sessions = sqliteTable('sessions', {
  sessionToken: text('session_token').primaryKey(),
  userId: text('user_id')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  expires: integer('expires', { mode: 'timestamp_ms' }).notNull(),
});

export const verificationTokens = sqliteTable(
  'verification_tokens',
  {
    identifier: text('identifier').notNull(),
    token: text('token').notNull(),
    expires: integer('expires', { mode: 'timestamp_ms' }).notNull(),
  },
  (table) => [primaryKey({ columns: [table.identifier, table.token] })],
);

// ============================================================
// App tables
// ============================================================

export const agents = sqliteTable('agents', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  email: text('email').notNull(),
  phone: text('phone'),
  licenseNumber: text('license_number'),
  brokerageId: text('brokerage_id'),
  isActive: integer('is_active', { mode: 'boolean' }).default(true).notNull(),
  createdAt: integer('created_at', { mode: 'timestamp_ms' })
    .$defaultFn(() => new Date()),
  updatedAt: integer('updated_at', { mode: 'timestamp_ms' })
    .$defaultFn(() => new Date()),
});

export const transactions = sqliteTable('transactions', {
  id: text('id').primaryKey(),
  address: text('address').notNull(),
  city: text('city'),
  state: text('state').default('CA'),
  zipCode: text('zip_code'),
  mlsNumber: text('mls_number'),
  agentId: text('agent_id').references(() => agents.id),
  transactionType: text('transaction_type', {
    enum: ['listing', 'purchase', 'dual'],
  }).notNull(),
  status: text('status', {
    enum: ['pending', 'active', 'in_escrow', 'closing', 'closed', 'cancelled'],
  })
    .default('pending')
    .notNull(),
  propertyType: text('property_type', {
    enum: ['single_family', 'condo', 'townhouse', 'multi_family', 'land', 'commercial'],
  }),
  escrowNumber: text('escrow_number'),
  escrowCompany: text('escrow_company'),
  escrowOfficer: text('escrow_officer'),
  escrowOfficerPhone: text('escrow_officer_phone'),
  escrowOfficerEmail: text('escrow_officer_email'),
  titleCompany: text('title_company'),
  titleOfficer: text('title_officer'),
  lenderName: text('lender_name'),
  loanOfficer: text('loan_officer'),
  loanOfficerPhone: text('loan_officer_phone'),
  loanOfficerEmail: text('loan_officer_email'),
  buyerName: text('buyer_name'),
  buyerAgent: text('buyer_agent'),
  sellerName: text('seller_name'),
  sellerAgent: text('seller_agent'),
  // Money stored in cents (integers)
  purchasePrice: integer('purchase_price'),
  listPrice: integer('list_price'),
  earnestMoneyDeposit: integer('earnest_money_deposit'),
  commissionPercent: text('commission_percent'), // string to avoid float issues
  // Dates stored as ISO strings
  acceptanceDate: text('acceptance_date'),
  escrowOpenDate: text('escrow_open_date'),
  inspectionContingencyDate: text('inspection_contingency_date'),
  appraisalContingencyDate: text('appraisal_contingency_date'),
  loanContingencyDate: text('loan_contingency_date'),
  expectedCloseDate: text('expected_close_date'),
  actualCloseDate: text('actual_close_date'),
  notes: text('notes'),
  createdBy: text('created_by').references(() => users.id),
  createdAt: integer('created_at', { mode: 'timestamp_ms' })
    .$defaultFn(() => new Date()),
  updatedAt: integer('updated_at', { mode: 'timestamp_ms' })
    .$defaultFn(() => new Date()),
});

export const taskTemplates = sqliteTable('task_templates', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  description: text('description'),
  category: text('category', {
    enum: [
      'pre_escrow',
      'opening',
      'disclosures',
      'inspections',
      'contingencies',
      'loan',
      'appraisal',
      'title',
      'closing',
      'post_closing',
    ],
  }).notNull(),
  transactionType: text('transaction_type', {
    enum: ['listing', 'purchase', 'both'],
  })
    .default('both')
    .notNull(),
  // positive = days AFTER milestone, negative = days BEFORE milestone
  relativeDueDays: integer('relative_due_days').notNull(),
  relativeTo: text('relative_to', {
    enum: [
      'acceptance_date',
      'escrow_open',
      'expected_close_date',
      'inspection_contingency_date',
      'appraisal_contingency_date',
      'loan_contingency_date',
    ],
  })
    .default('escrow_open')
    .notNull(),
  sortOrder: integer('sort_order').notNull(),
  isRequired: integer('is_required', { mode: 'boolean' }).default(true).notNull(),
  isActive: integer('is_active', { mode: 'boolean' }).default(true).notNull(),
  createdAt: integer('created_at', { mode: 'timestamp_ms' })
    .$defaultFn(() => new Date()),
});

export const transactionTasks = sqliteTable('transaction_tasks', {
  id: text('id').primaryKey(),
  transactionId: text('transaction_id')
    .notNull()
    .references(() => transactions.id),
  templateId: text('template_id').references(() => taskTemplates.id), // null = custom task
  name: text('name').notNull(),
  description: text('description'),
  category: text('category').notNull(),
  dueDate: text('due_date'), // calculated ISO date string
  completedDate: text('completed_date'),
  status: text('status', {
    enum: ['pending', 'in_progress', 'completed', 'overdue', 'waived', 'not_applicable'],
  })
    .default('pending')
    .notNull(),
  assignedTo: text('assigned_to'),
  priority: text('priority', { enum: ['low', 'medium', 'high', 'urgent'] })
    .default('medium')
    .notNull(),
  notes: text('notes'),
  sortOrder: integer('sort_order').notNull(),
  createdAt: integer('created_at', { mode: 'timestamp_ms' })
    .$defaultFn(() => new Date()),
  updatedAt: integer('updated_at', { mode: 'timestamp_ms' })
    .$defaultFn(() => new Date()),
});

export const activityLog = sqliteTable('activity_log', {
  id: text('id').primaryKey(),
  transactionId: text('transaction_id').references(() => transactions.id),
  userId: text('user_id').references(() => users.id),
  action: text('action').notNull(), // 'created' | 'updated' | 'status_changed' | 'task_completed' | 'note_added'
  details: text('details'), // JSON string with change details
  createdAt: integer('created_at', { mode: 'timestamp_ms' })
    .$defaultFn(() => new Date()),
});

// ============================================================
// Relations
// ============================================================

export const usersRelations = relations(users, ({ many }) => ({
  accounts: many(accounts),
  sessions: many(sessions),
  activityLog: many(activityLog),
}));

export const accountsRelations = relations(accounts, ({ one }) => ({
  user: one(users, { fields: [accounts.userId], references: [users.id] }),
}));

export const sessionsRelations = relations(sessions, ({ one }) => ({
  user: one(users, { fields: [sessions.userId], references: [users.id] }),
}));

export const agentsRelations = relations(agents, ({ many }) => ({
  transactions: many(transactions),
}));

export const transactionsRelations = relations(transactions, ({ one, many }) => ({
  agent: one(agents, { fields: [transactions.agentId], references: [agents.id] }),
  tasks: many(transactionTasks),
  activityLog: many(activityLog),
}));

export const taskTemplatesRelations = relations(taskTemplates, ({ many }) => ({
  transactionTasks: many(transactionTasks),
}));

export const transactionTasksRelations = relations(transactionTasks, ({ one }) => ({
  transaction: one(transactions, {
    fields: [transactionTasks.transactionId],
    references: [transactions.id],
  }),
  template: one(taskTemplates, {
    fields: [transactionTasks.templateId],
    references: [taskTemplates.id],
  }),
}));

export const activityLogRelations = relations(activityLog, ({ one }) => ({
  transaction: one(transactions, {
    fields: [activityLog.transactionId],
    references: [transactions.id],
  }),
  user: one(users, { fields: [activityLog.userId], references: [users.id] }),
}));

// Inferred types for use throughout the app
export type User = typeof users.$inferSelect;
export type NewUser = typeof users.$inferInsert;
export type Agent = typeof agents.$inferSelect;
export type NewAgent = typeof agents.$inferInsert;
export type Transaction = typeof transactions.$inferSelect;
export type NewTransaction = typeof transactions.$inferInsert;
export type TaskTemplate = typeof taskTemplates.$inferSelect;
export type NewTaskTemplate = typeof taskTemplates.$inferInsert;
export type TransactionTask = typeof transactionTasks.$inferSelect;
export type NewTransactionTask = typeof transactionTasks.$inferInsert;
export type ActivityLog = typeof activityLog.$inferSelect;
export type NewActivityLog = typeof activityLog.$inferInsert;
