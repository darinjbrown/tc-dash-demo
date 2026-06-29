/**
 * DEMO seed script — run with: npm run db:demo-seed  (npx tsx src/db/demo-seed.ts)
 *
 * Builds a believable, ENTIRELY FICTIONAL single-office demo instance for the
 * $49/mo product walkthrough / screen recording. This is a PRODUCT DEMO, not a
 * real customer — every person, brokerage, address, phone, license, and escrow
 * number below is synthetic. Do not present any of this as a real client or
 * testimonial.
 *
 * It reuses the exact same schema, default task templates, template/group
 * stamping logic, money-in-cents convention, and milestone-relative due-date
 * math as the canonical src/db/seed.ts — no parallel data model.
 *
 * Populates a single demo office ("Crestline Realty", the active brand):
 *   - 1 admin login  (demo.admin@crestlinerealty.test / demo1234)
 *   - 2 transaction coordinators (tc role)
 *   - 5 agents (each also gets an `agent`-role login so the RBAC agent-scoped
 *     view can be demonstrated)
 *   - 12 transactions spread across every status/stage with stamped tasks
 *   - The full CA task-template scaffold, stamped per transaction with
 *     calculated due dates and realistic completed/overdue/pending states
 *
 * WARNING: like the canonical seed, this CLEARS all existing rows first. Point
 * TURSO_DATABASE_URL at a local/dev database, never production.
 */

import { drizzle } from 'drizzle-orm/libsql';
import { createClient } from '@libsql/client';
import * as schema from './schema';
import { defaultTaskTemplates } from '../lib/task-templates';
import { defaultBrand } from '../lib/brand-config';
import bcrypt from 'bcryptjs';

// Load env manually when running outside Next.js
import { config } from 'dotenv';
config({ path: '.env.local' });

const client = createClient({
  url: process.env.TURSO_DATABASE_URL!,
  authToken: process.env.TURSO_AUTH_TOKEN,
});

const db = drizzle(client, { schema });

// ── Helpers (kept identical to src/db/seed.ts) ───────────────────────────────

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

// ── Demo seed ─────────────────────────────────────────────────────────────────

async function seed() {
  console.log('Seeding DEMO instance (Crestline Realty — fictional)...\n');

  // ── Clear existing data (in reverse FK order) ──────────────────────────
  console.log('  Clearing existing data...');
  await db.delete(schema.activityLog);
  await db.delete(schema.transactionTasks);
  await db.delete(schema.taskTemplates);
  await db.delete(schema.taskTemplateGroups);
  await db.delete(schema.transactionAgents);
  await db.delete(schema.transactions);
  await db.delete(schema.agents);
  await db.delete(schema.sessions);
  await db.delete(schema.accounts);
  await db.delete(schema.verificationTokens);
  await db.delete(schema.users);
  await db.delete(schema.tenantBranding);
  await db.delete(schema.tenants);

  // ── Tenant (Crestline Realty, slug "tenant") ────────────────────────────
  console.log('  Seeding demo tenant...');
  const tenantId = uuid();
  await db.insert(schema.tenants).values({
    id: tenantId,
    name: 'Crestline Realty',
    slug: 'tenant',
    isActive: true,
    billingStatus: 'manual',
    createdAt: new Date(),
    updatedAt: new Date(),
  });
  await db.insert(schema.tenantBranding).values({
    tenantId,
    name: defaultBrand.name,
    tagline: defaultBrand.tagline ?? null,
    logoUrl: defaultBrand.logo,
    logoDarkUrl: defaultBrand.logoDark ?? null,
    logoIconUrl: defaultBrand.logoIcon,
    colors: JSON.stringify(defaultBrand.colors),
    darkColors: defaultBrand.darkColors ? JSON.stringify(defaultBrand.darkColors) : null,
    borderRadius: defaultBrand.borderRadius,
    fontFamily: defaultBrand.fontFamily ?? null,
    updatedAt: new Date(),
  });

  // ── Office staff logins (admin + 2 TCs) ─────────────────────────────────
  console.log('  Seeding office staff (admin + TCs)...');
  const demoPassword = await bcrypt.hash('demo1234', 12);

  const adminId = uuid();
  const tc1Id = uuid();
  const tc2Id = uuid();

  await db.insert(schema.users).values([
    {
      id: adminId,
      tenantId,
      name: 'Toni Marsh',
      email: 'demo.admin@crestlinerealty.test',
      hashedPassword: demoPassword,
      role: 'admin',
      createdAt: new Date(),
    },
    {
      id: tc1Id,
      tenantId,
      name: 'Priya Nair',
      email: 'priya.nair@crestlinerealty.test',
      hashedPassword: demoPassword,
      role: 'tc',
      createdAt: new Date(),
    },
    {
      id: tc2Id,
      tenantId,
      name: 'Devon Brooks',
      email: 'devon.brooks@crestlinerealty.test',
      hashedPassword: demoPassword,
      role: 'tc',
      createdAt: new Date(),
    },
  ]);

  // ── Agents (records + matching agent-role logins for RBAC demo) ─────────
  console.log('  Seeding agents...');
  const agentDefs = [
    {
      name: 'Renee Alvarado',
      email: 'renee.alvarado@crestlinerealty.test',
      phone: '(916) 555-0142',
      licenseNumber: 'CA-DRE-02087431',
    },
    {
      name: 'Marcus Webb',
      email: 'marcus.webb@crestlinerealty.test',
      phone: '(916) 555-0178',
      licenseNumber: 'CA-DRE-01994820',
    },
    {
      name: 'Sofia Delgado',
      email: 'sofia.delgado@crestlinerealty.test',
      phone: '(530) 555-0199',
      licenseNumber: 'CA-DRE-02123567',
    },
    {
      name: 'Grant Okafor',
      email: 'grant.okafor@crestlinerealty.test',
      phone: '(916) 555-0223',
      licenseNumber: 'CA-DRE-02045910',
    },
    {
      name: 'Hannah Whitfield',
      email: 'hannah.whitfield@crestlinerealty.test',
      phone: '(530) 555-0264',
      licenseNumber: 'CA-DRE-01978233',
    },
  ];

  const agentIds = agentDefs.map(() => uuid());

  await db.insert(schema.agents).values(
    agentDefs.map((a, i) => ({
      id: agentIds[i],
      tenantId,
      name: a.name,
      email: a.email,
      phone: a.phone,
      broker: 'Crestline Realty',
      licenseNumber: a.licenseNumber,
      isActive: true,
      isInHouse: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    })),
  );

  // Give each agent a matching login so the RBAC agent-scoped view can be
  // demoed (data only — reuses the existing `agent` role, no auth code touched).
  await db.insert(schema.users).values(
    agentDefs.map((a) => ({
      id: uuid(),
      tenantId,
      name: a.name,
      email: a.email,
      hashedPassword: demoPassword,
      role: 'agent' as const,
      createdAt: new Date(),
    })),
  );

  const [reneeId, marcusId, sofiaId, grantId, hannahId] = agentIds;

  // ── Template groups ──────────────────────────────────────────────────────
  console.log('  Seeding task template groups...');
  const listingGroupId = uuid();
  const purchaseGroupId = uuid();
  const dualGroupId = uuid();

  await db.insert(schema.taskTemplateGroups).values([
    {
      id: listingGroupId,
      tenantId,
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
      tenantId,
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
      tenantId,
      name: 'Dual Agency Template',
      description: 'Additional tasks specific to dual agency transactions',
      transactionType: 'dual',
      isDefault: true,
      isActive: true,
      sortOrder: 2,
      createdAt: new Date(),
    },
  ]);

  // ── Task templates (reuse the shared CA scaffold) ───────────────────────
  console.log('  Seeding task templates...');
  const templateRows = defaultTaskTemplates.map((t) => {
    const templateGroupId =
      t.transactionType === 'listing' ? listingGroupId : purchaseGroupId;
    return {
      id: uuid(),
      tenantId,
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
  console.log(`    -> ${templateRows.length} templates inserted`);

  // ── Transactions (12, fictional, across every stage) ────────────────────
  console.log('  Seeding transactions...');

  const now = new Date();
  const today = now.toISOString().split('T')[0];

  const transactionData: schema.NewTransaction[] = [
    // 1 — Renee, purchase, mid-escrow (healthy)
    {
      id: uuid(),
      tenantId,
      address: '1184 Almond Grove Way',
      city: 'Roseville',
      state: 'CA',
      zipCode: '95661',
      mlsNumber: 'BR26101',
      transactionType: 'purchase',
      status: 'in_escrow',
      propertyType: 'single_family',
      escrowNumber: 'ESC-26101',
      escrowCompany: 'Sierra Pacific Escrow',
      escrowOfficer: 'Donna Reyes',
      escrowOfficerPhone: '(916) 555-0310',
      escrowOfficerEmail: 'donna@sierrapacescrow.test',
      lenderName: 'Summit Mortgage',
      loanOfficer: 'Paul Hendricks',
      loanOfficerPhone: '(916) 555-0344',
      loanOfficerEmail: 'paul.h@summitmtg.test',
      buyerName: 'Eric & Maya Sandoval',
      sellerName: 'Gregory Bishop',
      sellerTcName: 'Priya Nair',
      buyerTcName: 'Priya Nair',
      purchasePrice: 68500000, // $685,000
      earnestMoneyDeposit: 2000000, // $20,000
      buyerCommissionPercent: '2.5',
      listingCommissionPercent: '2.5',
      contractDate: addDays(today, -25),
      acceptanceDate: addDays(today, -24),
      inspectionContingencyDate: addDays(today, -10),
      appraisalContingencyDate: addDays(today, -4),
      loanContingencyDate: addDays(today, 3),
      expectedCloseDate: addDays(today, 12),
      createdBy: tc1Id,
      createdAt: new Date(),
      updatedAt: new Date(),
    },
    // 2 — Renee, listing, active on market
    {
      id: uuid(),
      tenantId,
      address: '67 Larkspur Court',
      city: 'Folsom',
      state: 'CA',
      zipCode: '95630',
      mlsNumber: 'BR26102',
      transactionType: 'listing',
      status: 'listed',
      propertyType: 'single_family',
      escrowCompany: 'Sierra Pacific Escrow',
      sellerName: 'Carol & Allen Frye',
      sellerTcName: 'Priya Nair',
      purchasePrice: 79900000, // $799,000
      buyerCommissionPercent: '2.5',
      listingCommissionPercent: '2.5',
      listingActiveDate: addDays(today, -9),
      createdBy: tc1Id,
      createdAt: new Date(),
      updatedAt: new Date(),
    },
    // 3 — Marcus, dual agency, in escrow (note: contingencies upcoming)
    {
      id: uuid(),
      tenantId,
      address: '900 Riverbend Terrace',
      city: 'Sacramento',
      state: 'CA',
      zipCode: '95818',
      mlsNumber: 'BR26103',
      transactionType: 'dual',
      status: 'in_escrow',
      propertyType: 'single_family',
      escrowNumber: 'ESC-26103',
      escrowCompany: 'Capitol Title & Escrow',
      escrowOfficer: 'Lawrence Tan',
      escrowOfficerPhone: '(916) 555-0388',
      escrowOfficerEmail: 'ltan@capitoltitle.test',
      lenderName: 'Golden State Bank',
      loanOfficer: 'Yolanda Pierce',
      loanOfficerPhone: '(916) 555-0401',
      buyerName: 'Nathan & Olivia Reed',
      sellerName: 'The Whitaker Family Trust',
      sellerTcName: 'Devon Brooks',
      buyerTcName: 'Devon Brooks',
      purchasePrice: 112500000, // $1,125,000
      earnestMoneyDeposit: 3375000, // $33,750
      buyerCommissionPercent: '2.5',
      listingCommissionPercent: '2.5',
      contractDate: addDays(today, -12),
      acceptanceDate: addDays(today, -11),
      inspectionContingencyDate: addDays(today, 4),
      appraisalContingencyDate: addDays(today, 9),
      loanContingencyDate: addDays(today, 16),
      expectedCloseDate: addDays(today, 30),
      createdBy: tc2Id,
      createdAt: new Date(),
      updatedAt: new Date(),
    },
    // 4 — Marcus, purchase, OVERDUE pressure (acceptance long ago, close soon)
    {
      id: uuid(),
      tenantId,
      address: '305 Magnolia Bluff Rd',
      city: 'El Dorado Hills',
      state: 'CA',
      zipCode: '95762',
      mlsNumber: 'BR26104',
      transactionType: 'purchase',
      status: 'in_escrow',
      propertyType: 'single_family',
      escrowNumber: 'ESC-26104',
      escrowCompany: 'Capitol Title & Escrow',
      escrowOfficer: 'Brenda Schultz',
      escrowOfficerPhone: '(916) 555-0422',
      lenderName: 'Pinnacle Home Loans',
      loanOfficer: 'Derek Foss',
      buyerName: 'Aaron & Lily Tran',
      sellerName: 'Marion Esposito',
      sellerTcName: 'Devon Brooks',
      buyerTcName: 'Devon Brooks',
      purchasePrice: 94000000, // $940,000
      earnestMoneyDeposit: 2800000, // $28,000
      buyerCommissionPercent: '2.5',
      listingCommissionPercent: '2.5',
      contractDate: addDays(today, -40),
      acceptanceDate: addDays(today, -39),
      inspectionContingencyDate: addDays(today, -24),
      appraisalContingencyDate: addDays(today, -18),
      loanContingencyDate: addDays(today, -2),
      expectedCloseDate: addDays(today, 5),
      createdBy: tc2Id,
      createdAt: new Date(),
      updatedAt: new Date(),
    },
    // 5 — Sofia, purchase, closed last week
    {
      id: uuid(),
      tenantId,
      address: '2210 Briarcliff Lane',
      city: 'Rocklin',
      state: 'CA',
      zipCode: '95765',
      mlsNumber: 'BR26105',
      transactionType: 'purchase',
      status: 'closed',
      propertyType: 'townhouse',
      escrowNumber: 'ESC-26088',
      escrowCompany: 'Sierra Pacific Escrow',
      escrowOfficer: 'Donna Reyes',
      buyerName: 'Cody & Renata Mills',
      sellerName: 'Howard Pruitt',
      sellerTcName: 'Priya Nair',
      buyerTcName: 'Priya Nair',
      purchasePrice: 54900000, // $549,000
      earnestMoneyDeposit: 1500000, // $15,000
      buyerCommissionPercent: '2.5',
      listingCommissionPercent: '2.5',
      contractDate: addDays(today, -52),
      acceptanceDate: addDays(today, -51),
      inspectionContingencyDate: addDays(today, -37),
      appraisalContingencyDate: addDays(today, -30),
      loanContingencyDate: addDays(today, -20),
      expectedCloseDate: addDays(today, -7),
      actualCloseDate: addDays(today, -7),
      createdBy: tc1Id,
      createdAt: new Date(),
      updatedAt: new Date(),
    },
    // 6 — Sofia, purchase, just accepted (pending → early)
    {
      id: uuid(),
      tenantId,
      address: '418 Sutter Creek Dr',
      city: 'Lincoln',
      state: 'CA',
      zipCode: '95648',
      mlsNumber: 'BR26106',
      transactionType: 'purchase',
      status: 'pending',
      propertyType: 'single_family',
      buyerName: 'Jordan Castellano',
      sellerName: 'Greenfield Homes LLC',
      sellerTcName: 'Devon Brooks',
      buyerTcName: 'Devon Brooks',
      purchasePrice: 61200000, // $612,000
      earnestMoneyDeposit: 1800000, // $18,000
      buyerCommissionPercent: '2.5',
      listingCommissionPercent: '2.5',
      acceptanceDate: addDays(today, -2),
      expectedCloseDate: addDays(today, 33),
      createdBy: tc2Id,
      createdAt: new Date(),
      updatedAt: new Date(),
    },
    // 7 — Grant, listing, active (luxury)
    {
      id: uuid(),
      tenantId,
      address: '15 Vista Del Lago',
      city: 'Granite Bay',
      state: 'CA',
      zipCode: '95746',
      mlsNumber: 'BR26107',
      transactionType: 'listing',
      status: 'listed',
      propertyType: 'single_family',
      sellerName: 'Dr. Helen Yoon',
      sellerTcName: 'Priya Nair',
      purchasePrice: 168000000, // $1,680,000
      buyerCommissionPercent: '2.5',
      listingCommissionPercent: '2.75',
      listingActiveDate: addDays(today, -18),
      createdBy: tc1Id,
      createdAt: new Date(),
      updatedAt: new Date(),
    },
    // 8 — Grant, purchase, mid-escrow condo
    {
      id: uuid(),
      tenantId,
      address: '3471 Watt Ave #208',
      city: 'Sacramento',
      state: 'CA',
      zipCode: '95821',
      mlsNumber: 'BR26108',
      transactionType: 'purchase',
      status: 'in_escrow',
      propertyType: 'condo',
      escrowNumber: 'ESC-26108',
      escrowCompany: 'Capitol Title & Escrow',
      escrowOfficer: 'Lawrence Tan',
      lenderName: 'Riverstone Credit Union',
      loanOfficer: 'Tina Marsh',
      buyerName: 'Priscilla Adeyemi',
      sellerName: 'Vincent & Joan Carter',
      sellerTcName: 'Devon Brooks',
      buyerTcName: 'Devon Brooks',
      purchasePrice: 41500000, // $415,000
      earnestMoneyDeposit: 1000000, // $10,000
      buyerCommissionPercent: '2.5',
      listingCommissionPercent: '2.5',
      contractDate: addDays(today, -18),
      acceptanceDate: addDays(today, -17),
      hoaDocsDueDate: addDays(today, -3),
      inspectionContingencyDate: addDays(today, -2),
      appraisalContingencyDate: addDays(today, 5),
      loanContingencyDate: addDays(today, 11),
      expectedCloseDate: addDays(today, 22),
      createdBy: tc2Id,
      createdAt: new Date(),
      updatedAt: new Date(),
    },
    // 9 — Hannah, purchase, closing this week
    {
      id: uuid(),
      tenantId,
      address: '780 Cottonwood Pass',
      city: 'Auburn',
      state: 'CA',
      zipCode: '95603',
      mlsNumber: 'BR26109',
      transactionType: 'purchase',
      status: 'in_escrow',
      propertyType: 'single_family',
      escrowNumber: 'ESC-26109',
      escrowCompany: 'Foothill Escrow Services',
      escrowOfficer: 'Marcia Lloyd',
      escrowOfficerPhone: '(530) 555-0455',
      lenderName: 'Summit Mortgage',
      loanOfficer: 'Paul Hendricks',
      buyerName: 'Brett & Diane Holloway',
      sellerName: 'Raymond Sato',
      sellerTcName: 'Priya Nair',
      buyerTcName: 'Priya Nair',
      purchasePrice: 72500000, // $725,000
      earnestMoneyDeposit: 2200000, // $22,000
      buyerCommissionPercent: '2.5',
      listingCommissionPercent: '2.5',
      contractDate: addDays(today, -33),
      acceptanceDate: addDays(today, -32),
      inspectionContingencyDate: addDays(today, -18),
      appraisalContingencyDate: addDays(today, -12),
      loanContingencyDate: addDays(today, -5),
      expectedCloseDate: addDays(today, 2),
      createdBy: tc1Id,
      createdAt: new Date(),
      updatedAt: new Date(),
    },
    // 10 — Hannah, listing, active rural acreage
    {
      id: uuid(),
      tenantId,
      address: '14005 Bear Hollow Rd',
      city: 'Grass Valley',
      state: 'CA',
      zipCode: '95945',
      mlsNumber: 'BR26110',
      transactionType: 'listing',
      status: 'listed',
      propertyType: 'land',
      sellerName: 'Walter & June Crandall',
      sellerTcName: 'Devon Brooks',
      purchasePrice: 38500000, // $385,000
      buyerCommissionPercent: '2.5',
      listingCommissionPercent: '3.0',
      listingActiveDate: addDays(today, -27),
      createdBy: tc2Id,
      createdAt: new Date(),
      updatedAt: new Date(),
    },
    // 11 — Renee, purchase, closed a month ago (archive view)
    {
      id: uuid(),
      tenantId,
      address: '529 Heritage Oak Dr',
      city: 'Roseville',
      state: 'CA',
      zipCode: '95678',
      mlsNumber: 'BR26111',
      transactionType: 'purchase',
      status: 'closed',
      propertyType: 'single_family',
      escrowNumber: 'ESC-26072',
      escrowCompany: 'Sierra Pacific Escrow',
      buyerName: 'Felix & Andrea Moreno',
      sellerName: 'Patricia Lindqvist',
      sellerTcName: 'Priya Nair',
      buyerTcName: 'Priya Nair',
      purchasePrice: 58800000, // $588,000
      earnestMoneyDeposit: 1700000, // $17,000
      buyerCommissionPercent: '2.5',
      listingCommissionPercent: '2.5',
      contractDate: addDays(today, -75),
      acceptanceDate: addDays(today, -74),
      inspectionContingencyDate: addDays(today, -60),
      appraisalContingencyDate: addDays(today, -53),
      loanContingencyDate: addDays(today, -44),
      expectedCloseDate: addDays(today, -31),
      actualCloseDate: addDays(today, -30),
      createdBy: tc1Id,
      createdAt: new Date(),
      updatedAt: new Date(),
    },
    // 12 — Marcus, purchase, cancelled (fell through)
    {
      id: uuid(),
      tenantId,
      address: '6620 Pebblebrook Way',
      city: 'Citrus Heights',
      state: 'CA',
      zipCode: '95610',
      mlsNumber: 'BR26112',
      transactionType: 'purchase',
      status: 'cancelled',
      propertyType: 'multi_family',
      escrowCompany: 'Capitol Title & Escrow',
      buyerName: 'Crestline Holdings LLC',
      sellerName: 'Bernard Ashworth',
      sellerTcName: 'Devon Brooks',
      buyerTcName: 'Devon Brooks',
      purchasePrice: 99500000, // $995,000
      buyerCommissionPercent: '2.0',
      listingCommissionPercent: '2.0',
      contractDate: addDays(today, -28),
      acceptanceDate: addDays(today, -27),
      inspectionContingencyDate: addDays(today, -13),
      expectedCloseDate: addDays(today, -1),
      notes: 'Cancelled — buyer financing fell through after appraisal came in low.',
      createdBy: tc2Id,
      createdAt: new Date(),
      updatedAt: new Date(),
    },
  ];

  await db.insert(schema.transactions).values(transactionData);
  console.log(`    -> ${transactionData.length} transactions inserted`);

  // ── Transaction agents ───────────────────────────────────────────────────
  console.log('  Seeding transaction agents...');

  // txIndex -> agent + side (dual rows get both sides). Mirrors seed.ts shape.
  const agentAssignments: { txIndex: number; agentId: string; side: 'listing' | 'buyer' }[] = [
    { txIndex: 0, agentId: reneeId, side: 'buyer' },
    { txIndex: 1, agentId: reneeId, side: 'listing' },
    { txIndex: 2, agentId: marcusId, side: 'listing' }, // dual
    { txIndex: 2, agentId: marcusId, side: 'buyer' },   // dual
    { txIndex: 3, agentId: marcusId, side: 'buyer' },
    { txIndex: 4, agentId: sofiaId, side: 'buyer' },
    { txIndex: 5, agentId: sofiaId, side: 'buyer' },
    { txIndex: 6, agentId: grantId, side: 'listing' },
    { txIndex: 7, agentId: grantId, side: 'buyer' },
    { txIndex: 8, agentId: hannahId, side: 'buyer' },
    { txIndex: 9, agentId: hannahId, side: 'listing' },
    { txIndex: 10, agentId: reneeId, side: 'buyer' },
    { txIndex: 11, agentId: marcusId, side: 'buyer' },
  ];

  const transactionAgentRows: schema.NewTransactionAgent[] = agentAssignments.map(
    ({ txIndex, agentId, side }) => ({
      id: uuid(),
      tenantId,
      transactionId: transactionData[txIndex].id!,
      agentId,
      side,
      isPrimary: true,
      sortOrder: 0,
      createdAt: new Date(),
    }),
  );

  await db.insert(schema.transactionAgents).values(transactionAgentRows);
  console.log(`    -> ${transactionAgentRows.length} transaction agent rows inserted`);

  // ── Stamp transaction tasks (identical logic to seed.ts) ─────────────────
  console.log('  Stamping transaction tasks...');

  const allGroups = await db.select().from(schema.taskTemplateGroups);
  const allTemplates = await db.select().from(schema.taskTemplates);
  const allTasks: schema.NewTransactionTask[] = [];

  for (const tx of transactionData) {
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

      // Status: closed/cancelled => completed; past-due open tasks => overdue;
      // for active deals, mark tasks whose due date has comfortably passed as
      // completed so a live demo shows realistic in-progress checklists rather
      // than everything red.
      let status: schema.NewTransactionTask['status'] = 'pending';
      if (tx.status === 'closed' || tx.status === 'cancelled') {
        status = 'completed';
      } else if (dueDate && dueDate < today) {
        // Tasks that came due more than 3 days ago on a live deal are treated
        // as already handled; the most-recent past-due items stay 'overdue' to
        // demonstrate the overdue surfacing.
        status = dueDate < addDays(today, -3) ? 'completed' : 'overdue';
      }

      allTasks.push({
        id: uuid(),
        tenantId,
        transactionId: tx.id!,
        templateId: template.id,
        name: template.name,
        description: template.description,
        category: template.category,
        dueDate,
        completedDate:
          status === 'completed' ? tx.actualCloseDate ?? dueDate ?? today : null,
        status,
        priority: 'medium',
        sortOrder: template.sortOrder,
        createdAt: new Date(),
        updatedAt: new Date(),
      });
    }
  }

  const BATCH = 50;
  for (let i = 0; i < allTasks.length; i += BATCH) {
    await db.insert(schema.transactionTasks).values(allTasks.slice(i, i + BATCH));
  }
  console.log(`    -> ${allTasks.length} transaction tasks inserted`);

  // ── Activity log entries ─────────────────────────────────────────────────
  console.log('  Seeding activity log...');
  const activityEntries: schema.NewActivityLog[] = transactionData.map((tx) => ({
    id: uuid(),
    tenantId,
    transactionId: tx.id!,
    userId: tx.createdBy ?? adminId,
    action: 'created',
    details: JSON.stringify({ address: tx.address }),
    createdAt: new Date(),
  }));
  await db.insert(schema.activityLog).values(activityEntries);

  console.log('\nDemo seed complete (all data fictional).');
  console.log('   Admin login: demo.admin@crestlinerealty.test / demo1234');
  console.log('   TC logins:   priya.nair@crestlinerealty.test, devon.brooks@crestlinerealty.test / demo1234');
  console.log(`   Office:       Crestline Realty (1 admin, 2 TCs, ${agentDefs.length} agents)`);
  console.log(`   Transactions: ${transactionData.length}`);
  console.log(`   Transaction agents: ${transactionAgentRows.length}`);
  console.log(`   Task templates: ${templateRows.length}`);
  console.log(`   Transaction tasks: ${allTasks.length}`);

  process.exit(0);
}

seed().catch((err) => {
  console.error('Demo seed failed:', err);
  process.exit(1);
});
