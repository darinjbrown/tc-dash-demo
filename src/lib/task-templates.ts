// Default CA real estate task templates
// These are blueprints stamped into transactionTasks when a transaction is created.
// relativeDueDays: positive = days AFTER milestone, negative = days BEFORE milestone

export interface TaskTemplateData {
  name: string;
  description?: string;
  category:
    | 'pre_escrow'
    | 'opening'
    | 'disclosures'
    | 'inspections'
    | 'contingencies'
    | 'loan'
    | 'appraisal'
    | 'title'
    | 'closing'
    | 'post_closing';
  transactionType: 'listing' | 'purchase' | 'both';
  relativeDueDays: number;
  relativeTo:
    | 'contract_date'
    | 'acceptance_date'
    | 'verification_of_funds_date'
    | 'earnest_money_due_date'
    | 'inspection_contingency_date'
    | 'insurance_contingency_date'
    | 'loan_contingency_date'
    | 'appraisal_contingency_date'
    | 'hoa_docs_due_date'
    | 'listing_active_date'
    | 'expected_close_date';
  sortOrder: number;
  isRequired?: boolean;
}

export const defaultTaskTemplates: TaskTemplateData[] = [
  // ── Pre-Escrow / Opening (relative to acceptance_date) ──────────────────
  {
    name: 'Execute purchase agreement',
    description: 'Ensure all parties have signed the purchase agreement.',
    category: 'pre_escrow',
    transactionType: 'purchase',
    relativeDueDays: 0,
    relativeTo: 'acceptance_date',
    sortOrder: 10,
  },
  {
    name: 'Open escrow',
    description: 'Contact escrow company and open escrow account.',
    category: 'pre_escrow',
    transactionType: 'both',
    relativeDueDays: 1,
    relativeTo: 'acceptance_date',
    sortOrder: 20,
  },
  {
    name: 'Deposit earnest money',
    description: 'Confirm buyer earnest money deposit is received by escrow.',
    category: 'pre_escrow',
    transactionType: 'purchase',
    relativeDueDays: 3,
    relativeTo: 'acceptance_date',
    sortOrder: 30,
  },
  {
    name: 'Order title search',
    description: 'Request preliminary title report from title company.',
    category: 'pre_escrow',
    transactionType: 'both',
    relativeDueDays: 2,
    relativeTo: 'acceptance_date',
    sortOrder: 40,
  },
  {
    name: 'Send transaction welcome packet',
    description:
      'Email introduction and next-steps packet to all parties (buyer, seller, agents, escrow).',
    category: 'pre_escrow',
    transactionType: 'both',
    relativeDueDays: 1,
    relativeTo: 'acceptance_date',
    sortOrder: 50,
  },

  // ── Disclosures (relative to acceptance_date) ───────────────────────────
  {
    name: 'Send TDS to buyer',
    description: 'Deliver Transfer Disclosure Statement (TDS) to buyer.',
    category: 'disclosures',
    transactionType: 'purchase',
    relativeDueDays: 3,
    relativeTo: 'acceptance_date',
    sortOrder: 60,
  },
  {
    name: 'Send SPQ to buyer',
    description: 'Deliver Seller Property Questionnaire (SPQ) to buyer.',
    category: 'disclosures',
    transactionType: 'purchase',
    relativeDueDays: 3,
    relativeTo: 'acceptance_date',
    sortOrder: 70,
  },
  {
    name: 'Send NHD report',
    description: 'Order and deliver Natural Hazard Disclosure (NHD) report to buyer.',
    category: 'disclosures',
    transactionType: 'both',
    relativeDueDays: 5,
    relativeTo: 'acceptance_date',
    sortOrder: 80,
  },
  {
    name: 'Send preliminary title report to buyer',
    description: 'Forward preliminary title report once received from title company.',
    category: 'disclosures',
    transactionType: 'purchase',
    relativeDueDays: 5,
    relativeTo: 'acceptance_date',
    sortOrder: 90,
  },
  {
    name: 'Agent visual inspection disclosure (AVID)',
    description: 'Ensure agent completes and delivers AVID to buyer.',
    category: 'disclosures',
    transactionType: 'purchase',
    relativeDueDays: 7,
    relativeTo: 'acceptance_date',
    sortOrder: 100,
  },

  // ── Inspections (relative to acceptance_date) ───────────────────────────
  {
    name: 'Schedule home inspection',
    description: 'Coordinate general home inspection with buyer and inspector.',
    category: 'inspections',
    transactionType: 'purchase',
    relativeDueDays: 3,
    relativeTo: 'acceptance_date',
    sortOrder: 110,
  },
  {
    name: 'Schedule pest/termite inspection',
    description: 'Arrange pest and termite inspection.',
    category: 'inspections',
    transactionType: 'purchase',
    relativeDueDays: 5,
    relativeTo: 'acceptance_date',
    sortOrder: 120,
  },
  {
    name: 'Review inspection reports',
    description: 'Review home and pest inspection reports with agent and buyer.',
    category: 'inspections',
    transactionType: 'purchase',
    relativeDueDays: 10,
    relativeTo: 'acceptance_date',
    sortOrder: 130,
  },
  {
    name: 'Submit repair request',
    description: 'Prepare and submit repair request addendum to seller (if applicable).',
    category: 'inspections',
    transactionType: 'purchase',
    relativeDueDays: 12,
    relativeTo: 'acceptance_date',
    sortOrder: 140,
    isRequired: false,
  },
  {
    name: 'Negotiate repair credits',
    description: 'Finalize repair or credit negotiations between buyer and seller.',
    category: 'inspections',
    transactionType: 'purchase',
    relativeDueDays: 14,
    relativeTo: 'acceptance_date',
    sortOrder: 150,
    isRequired: false,
  },
  {
    name: 'Inspection contingency removal',
    description: 'Obtain signed contingency removal for inspection.',
    category: 'inspections',
    transactionType: 'purchase',
    relativeDueDays: 0,
    relativeTo: 'inspection_contingency_date',
    sortOrder: 160,
  },

  // ── Contingencies ────────────────────────────────────────────────────────
  {
    name: 'Appraisal contingency removal',
    description: 'Obtain signed appraisal contingency removal from buyer.',
    category: 'contingencies',
    transactionType: 'purchase',
    relativeDueDays: 0,
    relativeTo: 'appraisal_contingency_date',
    sortOrder: 170,
  },
  {
    name: 'Loan contingency removal',
    description: 'Obtain signed loan contingency removal from buyer.',
    category: 'contingencies',
    transactionType: 'purchase',
    relativeDueDays: 0,
    relativeTo: 'loan_contingency_date',
    sortOrder: 180,
  },
  {
    name: 'Review HOA documents',
    description:
      'Ensure buyer receives and reviews HOA documents within the review period (if applicable).',
    category: 'contingencies',
    transactionType: 'purchase',
    relativeDueDays: 10,
    relativeTo: 'acceptance_date',
    sortOrder: 190,
    isRequired: false,
  },

  // ── Loan & Appraisal ────────────────────────────────────────────────────
  {
    name: 'Verify buyer pre-approval',
    description: 'Confirm buyer pre-approval letter is current and lender is engaged.',
    category: 'loan',
    transactionType: 'purchase',
    relativeDueDays: 7,
    relativeTo: 'acceptance_date',
    sortOrder: 200,
  },
  {
    name: 'Order appraisal',
    description: 'Lender orders property appraisal.',
    category: 'appraisal',
    transactionType: 'purchase',
    relativeDueDays: 7,
    relativeTo: 'acceptance_date',
    sortOrder: 210,
  },
  {
    name: 'Receive appraisal report',
    description: 'Confirm appraisal report received and reviewed.',
    category: 'appraisal',
    transactionType: 'purchase',
    relativeDueDays: 17,
    relativeTo: 'acceptance_date',
    sortOrder: 220,
  },
  {
    name: 'Loan docs to escrow',
    description: 'Confirm lender has sent loan documents to escrow.',
    category: 'loan',
    transactionType: 'purchase',
    relativeDueDays: -3,
    relativeTo: 'expected_close_date',
    sortOrder: 230,
  },
  {
    name: 'Buyer signs loan docs',
    description: 'Coordinate loan document signing appointment with escrow and buyer.',
    category: 'loan',
    transactionType: 'purchase',
    relativeDueDays: -2,
    relativeTo: 'expected_close_date',
    sortOrder: 240,
  },

  // ── Title & Closing (relative to expected_close_date) ───────────────────
  {
    name: 'Review title commitment',
    description: 'Review title commitment for exceptions and liens.',
    category: 'title',
    transactionType: 'both',
    relativeDueDays: -14,
    relativeTo: 'expected_close_date',
    sortOrder: 250,
  },
  {
    name: 'Clear title exceptions',
    description: 'Work with title company to resolve any title exceptions.',
    category: 'title',
    transactionType: 'both',
    relativeDueDays: -7,
    relativeTo: 'expected_close_date',
    sortOrder: 260,
  },
  {
    name: 'Confirm closing date with all parties',
    description: 'Confirm expected close date with escrow, agents, and principals.',
    category: 'closing',
    transactionType: 'both',
    relativeDueDays: -5,
    relativeTo: 'expected_close_date',
    sortOrder: 270,
  },
  {
    name: 'Schedule signing appointment',
    description: 'Schedule notary/escrow signing appointment for seller.',
    category: 'closing',
    transactionType: 'both',
    relativeDueDays: -3,
    relativeTo: 'expected_close_date',
    sortOrder: 280,
  },
  {
    name: 'Final walkthrough',
    description: 'Confirm buyer completes final walkthrough of property.',
    category: 'closing',
    transactionType: 'purchase',
    relativeDueDays: -1,
    relativeTo: 'expected_close_date',
    sortOrder: 290,
  },
  {
    name: 'Verify funds to close',
    description: 'Confirm buyer has wired closing funds to escrow.',
    category: 'closing',
    transactionType: 'purchase',
    relativeDueDays: -1,
    relativeTo: 'expected_close_date',
    sortOrder: 300,
  },
  {
    name: 'Record deed',
    description: 'Confirm deed is recorded with county recorder.',
    category: 'closing',
    transactionType: 'both',
    relativeDueDays: 0,
    relativeTo: 'expected_close_date',
    sortOrder: 310,
  },
  {
    name: 'Confirm recording',
    description: 'Receive confirmation number from county and notify all parties.',
    category: 'closing',
    transactionType: 'both',
    relativeDueDays: 0,
    relativeTo: 'expected_close_date',
    sortOrder: 320,
  },
  {
    name: 'Distribute closing statement',
    description: 'Send final HUD/ALTA closing statement to all parties.',
    category: 'closing',
    transactionType: 'both',
    relativeDueDays: 1,
    relativeTo: 'expected_close_date',
    sortOrder: 330,
  },
  {
    name: 'Release keys to buyer',
    description: 'Confirm keys and garage openers are delivered to buyer upon recording.',
    category: 'closing',
    transactionType: 'purchase',
    relativeDueDays: 0,
    relativeTo: 'expected_close_date',
    sortOrder: 340,
  },

  // ── Post-Closing ─────────────────────────────────────────────────────────
  {
    name: 'Update MLS status to sold',
    description: "Update the MLS listing status to 'Sold' with final sales price.",
    category: 'post_closing',
    transactionType: 'listing',
    relativeDueDays: 1,
    relativeTo: 'expected_close_date',
    sortOrder: 350,
  },
  {
    name: 'Confirm commission disbursement',
    description: 'Verify commissions are disbursed from escrow to all agents/brokers.',
    category: 'post_closing',
    transactionType: 'both',
    relativeDueDays: 3,
    relativeTo: 'expected_close_date',
    sortOrder: 360,
  },
  {
    name: 'Send closing gift',
    description: 'Arrange and send closing gift to buyer/seller.',
    category: 'post_closing',
    transactionType: 'both',
    relativeDueDays: 3,
    relativeTo: 'expected_close_date',
    sortOrder: 370,
    isRequired: false,
  },
  {
    name: 'Request client review/testimonial',
    description: 'Send review request link to client (Google, Yelp, Zillow).',
    category: 'post_closing',
    transactionType: 'both',
    relativeDueDays: 5,
    relativeTo: 'expected_close_date',
    sortOrder: 380,
    isRequired: false,
  },
  {
    name: 'Archive transaction file',
    description: 'File all transaction documents per brokerage retention policy.',
    category: 'post_closing',
    transactionType: 'both',
    relativeDueDays: 7,
    relativeTo: 'expected_close_date',
    sortOrder: 390,
  },
];
