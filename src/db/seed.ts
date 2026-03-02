/**
 * Seed script — run with: npx tsx src/db/seed.ts
 *
 * Populates the database with:
 *   - 1 admin user (admin@example.com / password123)
 *   - 3 sample agents
 *   - 9 sample transactions across various statuses
 *   - 38 task templates (CA real estate scaffold)
 *   - Transaction tasks stamped from templates with calculated due dates
 */

import { drizzle } from 'drizzle-orm/libsql';
import { createClient } from '@libsql/client';
import * as schema from './schema';
import { defaultTaskTemplates } from '../lib/task-templates';
import bcrypt from 'bcryptjs';

// Load env manually when running outside Next.js
import { config } from 'dotenv';
config({ path: '.env.local' });

const client = createClient({
  url: process.env.TURSO_DATABASE_URL!,
  authToken: process.env.TURSO_AUTH_TOKEN,
});

const db = drizzle(client, { schema });

// ── Helpers ──────────────────────────────────────────────────────────────────

function uuid() {
  return crypto.randomUUID();
}

/** Add days to an ISO date string, return ISO date string (YYYY-MM-DD). */
function addDays(isoDate: string, days: number): string {
  const d = new Date(isoDate);
  d.setDate(d.getDate() + days);
  return d.toISOString().split('T')[0];
}

/** Calculate a task due date from a transaction's milestone dates. */
function calcDueDate(
  transaction: {
    acceptanceDate?: string | null;
    escrowOpenDate?: string | null;
    expectedCloseDate?: string | null;
    inspectionContingencyDate?: string | null;
    appraisalContingencyDate?: string | null;
    loanContingencyDate?: string | null;
  },
  relativeTo: string,
  relativeDueDays: number,
): string | null {
  let milestone: string | null | undefined;
  switch (relativeTo) {
    case 'acceptance_date':
      milestone = transaction.acceptanceDate;
      break;
    case 'escrow_open':
      milestone = transaction.escrowOpenDate;
      break;
    case 'expected_close_date':
      milestone = transaction.expectedCloseDate;
      break;
    case 'inspection_contingency_date':
      milestone = transaction.inspectionContingencyDate;
      break;
    case 'appraisal_contingency_date':
      milestone = transaction.appraisalContingencyDate;
      break;
    case 'loan_contingency_date':
      milestone = transaction.loanContingencyDate;
      break;
    default:
      milestone = null;
  }
  if (!milestone) return null;
  return addDays(milestone, relativeDueDays);
}

// ── Seed data ─────────────────────────────────────────────────────────────────

async function seed() {
  console.log('🌱 Seeding database...\n');

  // ── Clear existing data (in reverse FK order) ──────────────────────────
  console.log('  Clearing existing data...');
  await db.delete(schema.activityLog);
  await db.delete(schema.transactionTasks);
  await db.delete(schema.taskTemplates);
  await db.delete(schema.transactions);
  await db.delete(schema.agents);
  await db.delete(schema.sessions);
  await db.delete(schema.accounts);
  await db.delete(schema.verificationTokens);
  await db.delete(schema.users);

  // ── Admin user ─────────────────────────────────────────────────────────
  console.log('  Seeding admin user...');
  const adminId = uuid();
  const hashedPassword = await bcrypt.hash('password123', 12);
  await db.insert(schema.users).values({
    id: adminId,
    name: 'Admin User',
    email: 'admin@example.com',
    hashedPassword,
    role: 'admin',
    createdAt: new Date(),
  });

  // ── Agents ─────────────────────────────────────────────────────────────
  console.log('  Seeding agents...');
  const agent1Id = uuid();
  const agent2Id = uuid();
  const agent3Id = uuid();

  await db.insert(schema.agents).values([
    {
      id: agent1Id,
      name: 'Sarah Johnson',
      email: 'sarah.johnson@realty.com',
      phone: '(619) 555-0101',
      licenseNumber: 'CA-DRE-02012345',
      isActive: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    },
    {
      id: agent2Id,
      name: 'Marcus Chen',
      email: 'marcus.chen@realty.com',
      phone: '(858) 555-0202',
      licenseNumber: 'CA-DRE-01987654',
      isActive: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    },
    {
      id: agent3Id,
      name: 'Linda Ramirez',
      email: 'linda.ramirez@realty.com',
      phone: '(760) 555-0303',
      licenseNumber: 'CA-DRE-02156789',
      isActive: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    },
  ]);

  // ── Task templates ─────────────────────────────────────────────────────
  console.log('  Seeding task templates...');
  const templateRows = defaultTaskTemplates.map((t) => ({
    id: uuid(),
    name: t.name,
    description: t.description ?? null,
    category: t.category,
    transactionType: t.transactionType,
    relativeDueDays: t.relativeDueDays,
    relativeTo: t.relativeTo,
    sortOrder: t.sortOrder,
    isRequired: t.isRequired !== false,
    isActive: true,
    createdAt: new Date(),
  }));
  await db.insert(schema.taskTemplates).values(templateRows);
  console.log(`    → ${templateRows.length} templates inserted`);

  // ── Transactions ───────────────────────────────────────────────────────
  console.log('  Seeding transactions...');

  const now = new Date();
  const today = now.toISOString().split('T')[0];

  const transactionData: schema.NewTransaction[] = [
    // Sarah — 3 transactions
    {
      id: uuid(),
      address: '1234 Ocean View Dr',
      city: 'La Jolla',
      state: 'CA',
      zipCode: '92037',
      mlsNumber: 'SD2024001',
      sellingAgentId: agent1Id,
      transactionType: 'purchase',
      status: 'in_escrow',
      propertyType: 'single_family',
      escrowNumber: 'ESC-24001',
      escrowCompany: 'Pacific Escrow Services',
      escrowOfficer: 'Janet Park',
      escrowOfficerEmail: 'janet@pacificescrow.com',
      titleCompany: 'Fidelity National Title',
      titleOfficer: 'Robert Kim',
      lenderName: 'Wells Fargo Home Mortgage',
      loanOfficer: 'Tom Bradley',
      loanOfficerPhone: '(619) 555-1234',
      loanOfficerEmail: 'tom.bradley@wf.com',
      buyerName: 'David & Amy Nguyen',
      sellerName: 'Michael Porter',
      purchasePrice: 189500000, // $1,895,000
      earnestMoneyDeposit: 5000000, // $50,000
      commissionPercent: '2.5',
      acceptanceDate: addDays(today, -30),
      escrowOpenDate: addDays(today, -28),
      inspectionContingencyDate: addDays(today, -15),
      appraisalContingencyDate: addDays(today, -10),
      loanContingencyDate: addDays(today, -5),
      expectedCloseDate: addDays(today, 10),
      createdBy: adminId,
      createdAt: new Date(),
      updatedAt: new Date(),
    },
    {
      id: uuid(),
      address: '567 Sunset Blvd',
      city: 'San Diego',
      state: 'CA',
      zipCode: '92103',
      mlsNumber: 'SD2024002',
      listingAgentId: agent1Id,
      transactionType: 'listing',
      status: 'active',
      propertyType: 'condo',
      escrowCompany: 'California Escrow',
      buyerName: 'First-Time Buyer TBD',
      sellerName: 'Grace & Henry Liu',
      listPrice: 72500000, // $725,000
      commissionPercent: '2.5',
      acceptanceDate: null,
      escrowOpenDate: null,
      expectedCloseDate: null,
      createdBy: adminId,
      createdAt: new Date(),
      updatedAt: new Date(),
    },
    {
      id: uuid(),
      address: '890 Coronado Bay Rd',
      city: 'Coronado',
      state: 'CA',
      zipCode: '92118',
      mlsNumber: 'SD2024003',
      sellingAgentId: agent1Id,
      transactionType: 'purchase',
      status: 'closing',
      propertyType: 'single_family',
      escrowNumber: 'ESC-24003',
      escrowCompany: 'Coronado Escrow',
      escrowOfficer: 'Michelle Torres',
      escrowOfficerEmail: 'michelle@coronadoescrow.com',
      titleCompany: 'Chicago Title',
      lenderName: 'Bank of America',
      loanOfficer: 'Sandra Lee',
      buyerName: 'James & Patricia Wilson',
      sellerName: 'Steven Hart',
      purchasePrice: 285000000, // $2,850,000
      earnestMoneyDeposit: 8500000, // $85,000
      commissionPercent: '2.5',
      acceptanceDate: addDays(today, -45),
      escrowOpenDate: addDays(today, -43),
      inspectionContingencyDate: addDays(today, -30),
      appraisalContingencyDate: addDays(today, -25),
      loanContingencyDate: addDays(today, -20),
      expectedCloseDate: addDays(today, 3),
      createdBy: adminId,
      createdAt: new Date(),
      updatedAt: new Date(),
    },

    // Marcus — 3 transactions
    {
      id: uuid(),
      address: '2210 Rancho Santa Fe Ln',
      city: 'Rancho Santa Fe',
      state: 'CA',
      zipCode: '92067',
      mlsNumber: 'SD2024004',
      listingAgentId: agent2Id,
      sellingAgentId: agent2Id,
      transactionType: 'dual',
      status: 'in_escrow',
      propertyType: 'single_family',
      escrowNumber: 'ESC-24004',
      escrowCompany: 'RSF Escrow Group',
      escrowOfficer: 'Brian Walsh',
      escrowOfficerEmail: 'brian@rsfescrow.com',
      titleCompany: 'Old Republic Title',
      lenderName: 'JPMorgan Chase',
      loanOfficer: 'Karen Davis',
      buyerName: 'Robert & Ellen Hayes',
      sellerName: 'Phillip Nguyen',
      purchasePrice: 485000000, // $4,850,000
      earnestMoneyDeposit: 15000000, // $150,000
      commissionPercent: '5.0',
      acceptanceDate: addDays(today, -20),
      escrowOpenDate: addDays(today, -18),
      inspectionContingencyDate: addDays(today, -5),
      appraisalContingencyDate: addDays(today, 2),
      loanContingencyDate: addDays(today, 7),
      expectedCloseDate: addDays(today, 25),
      createdBy: adminId,
      createdAt: new Date(),
      updatedAt: new Date(),
    },
    {
      id: uuid(),
      address: '44 Palm Canyon Dr',
      city: 'Palm Springs',
      state: 'CA',
      zipCode: '92262',
      mlsNumber: 'PS2024001',
      sellingAgentId: agent2Id,
      transactionType: 'purchase',
      status: 'closed',
      propertyType: 'condo',
      escrowNumber: 'ESC-23095',
      escrowCompany: 'Desert Escrow',
      buyerName: 'Thomas & Cynthia Park',
      sellerName: 'Daniel Freeman',
      purchasePrice: 59500000, // $595,000
      commissionPercent: '2.5',
      acceptanceDate: addDays(today, -65),
      escrowOpenDate: addDays(today, -63),
      expectedCloseDate: addDays(today, -5),
      actualCloseDate: addDays(today, -5),
      createdBy: adminId,
      createdAt: new Date(),
      updatedAt: new Date(),
    },
    {
      id: uuid(),
      address: '1500 Mission Valley Pkwy',
      city: 'San Diego',
      state: 'CA',
      zipCode: '92108',
      mlsNumber: 'SD2024006',
      sellingAgentId: agent2Id,
      transactionType: 'purchase',
      status: 'pending',
      propertyType: 'townhouse',
      buyerName: 'Aisha Thompson',
      sellerName: 'Harbor Development LLC',
      purchasePrice: 84900000, // $849,000
      earnestMoneyDeposit: 1500000, // $15,000
      commissionPercent: '2.5',
      acceptanceDate: addDays(today, -2),
      expectedCloseDate: null,
      createdBy: adminId,
      createdAt: new Date(),
      updatedAt: new Date(),
    },

    // Linda — 3 transactions
    {
      id: uuid(),
      address: '3301 El Camino Real',
      city: 'Carlsbad',
      state: 'CA',
      zipCode: '92008',
      mlsNumber: 'NC2024001',
      sellingAgentId: agent3Id,
      transactionType: 'purchase',
      status: 'in_escrow',
      propertyType: 'single_family',
      escrowNumber: 'ESC-24007',
      escrowCompany: 'North County Escrow',
      escrowOfficer: 'Lisa Hammond',
      titleCompany: 'First American Title',
      lenderName: 'Guaranteed Rate',
      loanOfficer: 'Chris Murphy',
      buyerName: 'Kevin & Rosa Martinez',
      sellerName: 'Alan & Judy Foster',
      purchasePrice: 112500000, // $1,125,000
      earnestMoneyDeposit: 3000000, // $30,000
      commissionPercent: '2.5',
      acceptanceDate: addDays(today, -14),
      escrowOpenDate: addDays(today, -12),
      inspectionContingencyDate: addDays(today, 3),
      appraisalContingencyDate: addDays(today, 8),
      loanContingencyDate: addDays(today, 14),
      expectedCloseDate: addDays(today, 31),
      createdBy: adminId,
      createdAt: new Date(),
      updatedAt: new Date(),
    },
    {
      id: uuid(),
      address: '780 Coast Hwy 101',
      city: 'Encinitas',
      state: 'CA',
      zipCode: '92024',
      mlsNumber: 'NC2024002',
      listingAgentId: agent3Id,
      transactionType: 'listing',
      status: 'active',
      propertyType: 'single_family',
      sellerName: 'Benjamin & Sarah Cole',
      listPrice: 245000000, // $2,450,000
      commissionPercent: '2.5',
      createdBy: adminId,
      createdAt: new Date(),
      updatedAt: new Date(),
    },
    {
      id: uuid(),
      address: '9988 Mira Mesa Blvd',
      city: 'San Diego',
      state: 'CA',
      zipCode: '92126',
      mlsNumber: 'SD2024009',
      sellingAgentId: agent3Id,
      transactionType: 'purchase',
      status: 'cancelled',
      propertyType: 'multi_family',
      buyerName: 'Atlas Investment Group',
      sellerName: 'Horizon Properties',
      purchasePrice: 320000000, // $3,200,000
      commissionPercent: '2.0',
      acceptanceDate: addDays(today, -50),
      escrowOpenDate: addDays(today, -48),
      expectedCloseDate: addDays(today, -10),
      notes: 'Cancelled due to failed inspection and buyer financing issues.',
      createdBy: adminId,
      createdAt: new Date(),
      updatedAt: new Date(),
    },
  ];

  await db.insert(schema.transactions).values(transactionData);
  console.log(`    → ${transactionData.length} transactions inserted`);

  // ── Stamp transaction tasks ────────────────────────────────────────────
  console.log('  Stamping transaction tasks...');

  const allTemplates = await db.select().from(schema.taskTemplates);
  const allTasks: schema.NewTransactionTask[] = [];

  for (const tx of transactionData) {
    // Filter templates that apply to this transaction type
    const applicableTemplates = allTemplates.filter(
      (t) => t.transactionType === 'both' || t.transactionType === tx.transactionType,
    );

    for (const template of applicableTemplates) {
      const dueDate = calcDueDate(
        {
          acceptanceDate: tx.acceptanceDate,
          escrowOpenDate: tx.escrowOpenDate,
          expectedCloseDate: tx.expectedCloseDate,
          inspectionContingencyDate: tx.inspectionContingencyDate,
          appraisalContingencyDate: tx.appraisalContingencyDate,
          loanContingencyDate: tx.loanContingencyDate,
        },
        template.relativeTo,
        template.relativeDueDays,
      );

      // Determine task status based on transaction status and due date
      let status: schema.NewTransactionTask['status'] = 'pending';
      if (tx.status === 'closed' || tx.status === 'cancelled') {
        status = 'completed';
      } else if (dueDate && dueDate < today) {
        status = 'overdue';
      }

      allTasks.push({
        id: uuid(),
        transactionId: tx.id!,
        templateId: template.id,
        name: template.name,
        description: template.description,
        category: template.category,
        dueDate,
        completedDate: status === 'completed' ? tx.actualCloseDate ?? today : null,
        status,
        priority: 'medium',
        sortOrder: template.sortOrder,
        createdAt: new Date(),
        updatedAt: new Date(),
      });
    }
  }

  // Insert in batches to avoid hitting SQLite param limits
  const BATCH = 50;
  for (let i = 0; i < allTasks.length; i += BATCH) {
    await db.insert(schema.transactionTasks).values(allTasks.slice(i, i + BATCH));
  }
  console.log(`    → ${allTasks.length} transaction tasks inserted`);

  // ── Activity log entries ───────────────────────────────────────────────
  console.log('  Seeding activity log...');
  const activityEntries: schema.NewActivityLog[] = transactionData.map((tx) => ({
    id: uuid(),
    transactionId: tx.id!,
    userId: adminId,
    action: 'created',
    details: JSON.stringify({ address: tx.address }),
    createdAt: new Date(),
  }));
  await db.insert(schema.activityLog).values(activityEntries);

  console.log('\n✅ Seed complete!');
  console.log('   Login: admin@example.com / password123');
  console.log(`   Transactions: ${transactionData.length}`);
  console.log(`   Task templates: ${templateRows.length}`);
  console.log(`   Transaction tasks: ${allTasks.length}`);

  process.exit(0);
}

seed().catch((err) => {
  console.error('❌ Seed failed:', err);
  process.exit(1);
});
