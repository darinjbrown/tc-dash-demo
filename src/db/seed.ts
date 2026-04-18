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
    contractDate?: string | null;
    acceptanceDate?: string | null;
    verificationOfFundsDate?: string | null;
    earnestMoneyDueDate?: string | null;
    expectedCloseDate?: string | null;
    inspectionContingencyDate?: string | null;
    insuranceContingencyDate?: string | null;
    loanContingencyDate?: string | null;
    appraisalContingencyDate?: string | null;
    hoaDocsDueDate?: string | null;
    listingActiveDate?: string | null;
  },
  relativeTo: string,
  relativeDueDays: number,
): string | null {
  let milestone: string | null | undefined;
  switch (relativeTo) {
    case 'contract_date':
      milestone = transaction.contractDate;
      break;
    case 'acceptance_date':
      milestone = transaction.acceptanceDate;
      break;
    case 'verification_of_funds_date':
      milestone = transaction.verificationOfFundsDate;
      break;
    case 'earnest_money_due_date':
      milestone = transaction.earnestMoneyDueDate;
      break;
    case 'expected_close_date':
      milestone = transaction.expectedCloseDate;
      break;
    case 'inspection_contingency_date':
      milestone = transaction.inspectionContingencyDate;
      break;
    case 'insurance_contingency_date':
      milestone = transaction.insuranceContingencyDate;
      break;
    case 'loan_contingency_date':
      milestone = transaction.loanContingencyDate;
      break;
    case 'appraisal_contingency_date':
      milestone = transaction.appraisalContingencyDate;
      break;
    case 'hoa_docs_due_date':
      milestone = transaction.hoaDocsDueDate;
      break;
    case 'listing_active_date':
      milestone = transaction.listingActiveDate;
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
  await db.delete(schema.taskTemplateGroups);
  await db.delete(schema.transactions);
  await db.delete(schema.agents);
  await db.delete(schema.sessions);
  await db.delete(schema.accounts);
  await db.delete(schema.verificationTokens);
  await db.delete(schema.users);

  // ── Admin users ────────────────────────────────────────────────────────
  console.log('  Seeding admin users...');
  const adminId = uuid();
  const hashedPassword = await bcrypt.hash('password123', 12);
  await db.insert(schema.users).values([
    {
      id: adminId,
      name: 'Admin User',
      email: 'admin@example.com',
      hashedPassword,
      role: 'admin',
      createdAt: new Date(),
    },
    {
      id: uuid(),
      name: 'Darin Brown',
      email: 'info@d20web.com',
      hashedPassword,
      role: 'admin',
      createdAt: new Date(),
    },
  ]);

  // ── Agents ─────────────────────────────────────────────────────────────
  console.log('  Seeding agents...');
  const agent1Id = uuid();
  const agent2Id = uuid();
  const agent3Id = uuid();

  await db.insert(schema.agents).values([
    {
      id: agent1Id,
      name: 'Sarah Johnson',
      email: 'sarah.johnson@sonomarealty.com',
      phone: '(707) 555-0101',
      broker: 'Sonoma Valley Realty',
      licenseNumber: 'CA-DRE-02012345',
      isActive: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    },
    {
      id: agent2Id,
      name: 'Marcus Chen',
      email: 'marcus.chen@sonomarealty.com',
      phone: '(707) 555-0202',
      broker: 'Sonoma Valley Realty',
      licenseNumber: 'CA-DRE-01987654',
      isActive: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    },
    {
      id: agent3Id,
      name: 'Linda Ramirez',
      email: 'linda.ramirez@northbayproperties.com',
      phone: '(707) 555-0303',
      broker: 'North Bay Properties',
      licenseNumber: 'CA-DRE-02156789',
      isActive: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    },
  ]);

  // ── Template groups ────────────────────────────────────────────────────
  console.log('  Seeding task template groups...');
  const listingGroupId = uuid();
  const purchaseGroupId = uuid();
  const dualGroupId = uuid();

  await db.insert(schema.taskTemplateGroups).values([
    {
      id: listingGroupId,
      name: 'Listing Template',
      description: 'Tasks for listing transactions',
      transactionType: 'listing',
      isDefault: true,
      isActive: true,
      sortOrder: 0,
      createdAt: new Date(),
    },
    {
      id: purchaseGroupId,
      name: 'Purchase Template',
      description: 'Tasks for purchase transactions',
      transactionType: 'purchase',
      isDefault: true,
      isActive: true,
      sortOrder: 1,
      createdAt: new Date(),
    },
    {
      id: dualGroupId,
      name: 'Dual Agency Template',
      description: 'Additional tasks specific to dual agency transactions',
      transactionType: 'dual',
      isDefault: true,
      isActive: true,
      sortOrder: 2,
      createdAt: new Date(),
    },
  ]);
  console.log('    → 3 template groups inserted');

  // ── Task templates ─────────────────────────────────────────────────────
  console.log('  Seeding task templates...');
  const templateRows = defaultTaskTemplates.map((t) => {
    // Map old transactionType to group: listing → Listing, purchase/both → Purchase
    const templateGroupId =
      t.transactionType === 'listing' ? listingGroupId : purchaseGroupId;
    return {
      id: uuid(),
      templateGroupId,
      name: t.name,
      description: t.description ?? null,
      category: t.category,
      relativeDueDays: t.relativeDueDays,
      relativeTo: t.relativeTo,
      sortOrder: t.sortOrder,
      isRequired: t.isRequired !== false,
      isActive: true,
      createdAt: new Date(),
    };
  });
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
      address: '412 Vineyard Ln',
      city: 'Healdsburg',
      state: 'CA',
      zipCode: '95448',
      mlsNumber: 'SN26001',
      buyerAgentId: agent1Id,
      buyerAgentIsInHouse: true,
      transactionType: 'purchase',
      status: 'in_escrow',
      propertyType: 'single_family',
      escrowNumber: 'ESC-26001',
      escrowCompany: 'Wine Country Escrow',
      escrowOfficer: 'Janet Park',
      escrowOfficerPhone: '(707) 433-1100',
      escrowOfficerEmail: 'janet@wineescrow.com',

      lenderName: 'Wells Fargo Home Mortgage',
      loanOfficer: 'Tom Bradley',
      loanOfficerPhone: '(707) 578-1234',
      loanOfficerEmail: 'tom.bradley@wf.com',
      buyerName: 'David & Amy Nguyen',
      sellerName: 'Michael Porter',
      purchasePrice: 187500000, // $1,875,000
      earnestMoneyDeposit: 5000000, // $50,000
      buyerCommissionPercent: '2.5',
      listingCommissionPercent: '2.5',
      contractDate: addDays(today, -31),
      acceptanceDate: addDays(today, -30),
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
      address: '2205 Mendocino Ave #4B',
      city: 'Santa Rosa',
      state: 'CA',
      zipCode: '95403',
      mlsNumber: 'SN26002',
      sellerAgentId: agent1Id,
      sellerAgentIsInHouse: true,
      transactionType: 'listing',
      status: 'listed',
      propertyType: 'condo',
      escrowCompany: 'Redwood Empire Escrow',
      sellerName: 'Grace & Henry Liu',
      purchasePrice: 74900000, // $749,000
buyerCommissionPercent: '2.5',
      listingCommissionPercent: '2.5',
      contractDate: null,
      acceptanceDate: null,
      expectedCloseDate: null,
      createdBy: adminId,
      createdAt: new Date(),
      updatedAt: new Date(),
    },
    {
      id: uuid(),
      address: '88 W Watmaugh Rd',
      city: 'Sonoma',
      state: 'CA',
      zipCode: '95476',
      mlsNumber: 'SN26003',
      buyerAgentId: agent1Id,
      buyerAgentIsInHouse: true,
      transactionType: 'purchase',
      status: 'in_escrow',
      propertyType: 'single_family',
      escrowNumber: 'ESC-26003',
      escrowCompany: 'Sonoma Valley Escrow',
      escrowOfficer: 'Michelle Torres',
      escrowOfficerPhone: '(707) 938-2200',
      escrowOfficerEmail: 'michelle@sonomaescrow.com',

      lenderName: 'Bank of America',
      loanOfficer: 'Sandra Lee',
      buyerName: 'James & Patricia Wilson',
      sellerName: 'Steven Hart',
      purchasePrice: 265000000, // $2,650,000
      earnestMoneyDeposit: 8000000, // $80,000
      buyerCommissionPercent: '2.5',
      listingCommissionPercent: '2.5',
      contractDate: addDays(today, -46),
      acceptanceDate: addDays(today, -45),
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
      address: '4520 Chalk Hill Rd',
      city: 'Healdsburg',
      state: 'CA',
      zipCode: '95448',
      mlsNumber: 'SN26004',
      sellerAgentId: agent2Id,
      sellerAgentIsInHouse: true,
      buyerAgentId: agent2Id,
      buyerAgentIsInHouse: true,
      transactionType: 'dual',
      status: 'in_escrow',
      propertyType: 'single_family',
      escrowNumber: 'ESC-26004',
      escrowCompany: 'Wine Country Escrow',
      escrowOfficer: 'Brian Walsh',
      escrowOfficerPhone: '(707) 433-1100',
      escrowOfficerEmail: 'brian@wineescrow.com',

      lenderName: 'JPMorgan Chase',
      loanOfficer: 'Karen Davis',
      buyerName: 'Robert & Ellen Hayes',
      sellerName: 'Phillip Nguyen',
      purchasePrice: 475000000, // $4,750,000
      earnestMoneyDeposit: 15000000, // $150,000
      buyerCommissionPercent: '2.5',
      listingCommissionPercent: '2.5',
      contractDate: addDays(today, -21),
      acceptanceDate: addDays(today, -20),
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
      address: '345 D St #12',
      city: 'Petaluma',
      state: 'CA',
      zipCode: '94952',
      mlsNumber: 'SN26005',
      buyerAgentId: agent2Id,
      buyerAgentIsInHouse: true,
      transactionType: 'purchase',
      status: 'closed',
      propertyType: 'condo',
      escrowNumber: 'ESC-25095',
      escrowCompany: 'North Bay Escrow',
      buyerName: 'Thomas & Cynthia Park',
      sellerName: 'Daniel Freeman',
      purchasePrice: 62500000, // $625,000
      buyerCommissionPercent: '2.5',
      listingCommissionPercent: '2.5',
      contractDate: addDays(today, -66),
      acceptanceDate: addDays(today, -65),
      expectedCloseDate: addDays(today, -5),
      actualCloseDate: addDays(today, -5),
      createdBy: adminId,
      createdAt: new Date(),
      updatedAt: new Date(),
    },
    {
      id: uuid(),
      address: '1822 Sebastopol Rd',
      city: 'Santa Rosa',
      state: 'CA',
      zipCode: '95407',
      mlsNumber: 'SN26006',
      buyerAgentId: agent2Id,
      buyerAgentIsInHouse: true,
      transactionType: 'purchase',
      status: 'pending',
      propertyType: 'townhouse',
      buyerName: 'Aisha Thompson',
      sellerName: 'Westside Development LLC',
      purchasePrice: 82500000, // $825,000
      earnestMoneyDeposit: 1500000, // $15,000
      buyerCommissionPercent: '2.5',
      listingCommissionPercent: '2.5',
      acceptanceDate: addDays(today, -2),
      expectedCloseDate: null,
      createdBy: adminId,
      createdAt: new Date(),
      updatedAt: new Date(),
    },

    // Linda — 3 transactions
    {
      id: uuid(),
      address: '901 E Cotati Ave',
      city: 'Rohnert Park',
      state: 'CA',
      zipCode: '94928',
      mlsNumber: 'SN26007',
      buyerAgentId: agent3Id,
      buyerAgentIsInHouse: true,
      transactionType: 'purchase',
      status: 'in_escrow',
      propertyType: 'single_family',
      escrowNumber: 'ESC-26007',
      escrowCompany: 'Redwood Empire Escrow',
      escrowOfficer: 'Lisa Hammond',
      escrowOfficerPhone: '(707) 545-3300',

      lenderName: 'Guaranteed Rate',
      loanOfficer: 'Chris Murphy',
      buyerName: 'Kevin & Rosa Martinez',
      sellerName: 'Alan & Judy Foster',
      purchasePrice: 105000000, // $1,050,000
      earnestMoneyDeposit: 3000000, // $30,000
      buyerCommissionPercent: '2.5',
      listingCommissionPercent: '2.5',
      contractDate: addDays(today, -15),
      acceptanceDate: addDays(today, -14),
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
      address: '17700 Armstrong Woods Rd',
      city: 'Guerneville',
      state: 'CA',
      zipCode: '95446',
      mlsNumber: 'SN26008',
      sellerAgentId: agent3Id,
      sellerAgentIsInHouse: true,
      transactionType: 'listing',
      status: 'listed',
      propertyType: 'single_family',
      sellerName: 'Benjamin & Sarah Cole',
      purchasePrice: 129500000, // $1,295,000
      buyerCommissionPercent: '2.5',
      listingCommissionPercent: '2.5',
      createdBy: adminId,
      createdAt: new Date(),
      updatedAt: new Date(),
    },
    {
      id: uuid(),
      address: '1250 Aviation Blvd',
      city: 'Santa Rosa',
      state: 'CA',
      zipCode: '95403',
      mlsNumber: 'SN26009',
      buyerAgentId: agent3Id,
      buyerAgentIsInHouse: true,
      transactionType: 'purchase',
      status: 'cancelled',
      propertyType: 'multi_family',
      buyerName: 'Atlas Investment Group',
      sellerName: 'Horizon Properties',
      purchasePrice: 285000000, // $2,850,000
      buyerCommissionPercent: '2.0',
      listingCommissionPercent: '2.0',
      contractDate: addDays(today, -51),
      acceptanceDate: addDays(today, -50),
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

  const allGroups = await db.select().from(schema.taskTemplateGroups);
  const allTemplates = await db.select().from(schema.taskTemplates);
  const allTasks: schema.NewTransactionTask[] = [];

  for (const tx of transactionData) {
    // Filter templates by applicable groups for this transaction type
    const activeGroups = allGroups.filter((g) => g.isActive);
    const applicableGroupIds = new Set(
      tx.transactionType === 'dual'
        ? activeGroups
            .filter((g) => ['listing', 'purchase', 'dual', 'all'].includes(g.transactionType))
            .map((g) => g.id)
        : activeGroups
            .filter(
              (g) => g.transactionType === tx.transactionType || g.transactionType === 'all',
            )
            .map((g) => g.id),
    );
    const applicableTemplates = allTemplates.filter(
      (t) => t.isActive && t.templateGroupId !== null && applicableGroupIds.has(t.templateGroupId),
    );

    for (const template of applicableTemplates) {
      const dueDate = calcDueDate(
        {
          contractDate: tx.contractDate,
          acceptanceDate: tx.acceptanceDate,
          verificationOfFundsDate: tx.verificationOfFundsDate,
          earnestMoneyDueDate: tx.earnestMoneyDueDate,
          expectedCloseDate: tx.expectedCloseDate,
          inspectionContingencyDate: tx.inspectionContingencyDate,
          insuranceContingencyDate: tx.insuranceContingencyDate,
          loanContingencyDate: tx.loanContingencyDate,
          appraisalContingencyDate: tx.appraisalContingencyDate,
          hoaDocsDueDate: tx.hoaDocsDueDate,
          listingActiveDate: tx.listingActiveDate,
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
