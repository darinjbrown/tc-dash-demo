# Multi-Agent Refactor Design

**Date:** 2026-04-18  
**Status:** Approved for implementation planning

---

## Problem

The current schema supports exactly one listing agent and one buyer's agent per transaction, each split between two modes (in-house FK or free-text). Real transactions often involve multiple agents per side. The free-text fallback also means frequently-encountered outside agents must be re-entered on every transaction.

---

## Goals

1. Support multiple agents per side (listing and buyer) on a transaction.
2. Replace free-text agent fields with a unified, reusable agent directory.
3. Show all contact info at a glance without extra clicks.
4. Support an optional "Primary" designation per side (one primary max per side).
5. "By Agent" grouping on the transactions list shows only in-house agents; transactions with multiple in-house agents appear under each one.

---

## Data Model

### `agents` table — add `isInHouse` flag

```
isInHouse: boolean (default false)
```

- `isInHouse = true` means the agent belongs to the brokerage (Bertolone Realty).
- In-house agents appear in the "By Agent" grouping on the transactions list.
- Outside (saved) agents do not appear in grouping but are still reusable across transactions.
- Existing `broker` field retained for display (brokerage name).

### New `transaction_agents` junction table

```
id:            text PK
transactionId: text FK → transactions.id (NOT NULL)
agentId:       text FK → agents.id (NOT NULL)
side:          text enum('listing', 'buyer') (NOT NULL)
isPrimary:     boolean default false
sortOrder:     integer default 0
createdAt:     timestamp
```

- All agents — in-house and outside — are linked through this table.
- `isPrimary` is enforced at the application layer: setting one agent as primary for a side clears `isPrimary` on all other agents for the same transaction + side.
- No unique constraint on `isPrimary` at DB level (SQLite partial index limitations); enforced in the server action.

### Columns dropped from `transactions`

The following columns are removed after migration:

- `sellerAgentId`, `sellerAgentIsInHouse`, `sellerAgentCompany`, `sellerAgentPhone`, `sellerAgentEmail`
- `buyerAgentId`, `buyerAgentIsInHouse`, `buyerAgentCompany`, `buyerAgentPhone`, `buyerAgentEmail`
- `sellerAgent` (legacy free-text), `buyerAgent` (legacy free-text)
- `agentId` (legacy column, already unused)

---

## Agent Directory

The existing `/agents` page becomes a full agent directory with two sections:

- **In-House Agents** (`isInHouse = true`) — Bertolone Realty staff
- **Outside Agents** (`isInHouse = false`) — saved external agents

Agents can be created, edited, and deactivated from this page. The `isInHouse` flag is set when creating or editing an agent.

---

## Add-Agent Dialog (Transaction Form & Detail)

A single reusable dialog used both when creating a transaction and when editing agents on an existing transaction.

**Flow:**
1. User clicks "Add Listing Agent" or "Add Buyer's Agent".
2. Dialog opens with a searchable list of active agents, grouped: In-House first, then Outside.
3. User selects an existing agent, OR clicks "Add new agent" to open a sub-form (name, email, phone, broker, isInHouse checkbox).
4. Newly created agent is immediately available and pre-selected.
5. Dialog includes a "Set as Primary" checkbox. Checking it clears primary status from any other agent on the same side.
6. Confirming adds the agent to the transaction (either saves immediately on the detail page, or queues for form submission on the create form).

---

## Transaction Detail — Agent Display

Each side (Listing Agents, Buyer's Agents) displays a **stacked list of agent cards** in the right column — all contact info visible at a glance, no clicks required.

**Agent card contains:**
- Name (bold if primary, or "Primary" badge)
- Brokerage name
- Phone (with copy button)
- Email (with copy button)
- Remove button (×)
- "Set as Primary" option (context menu or inline button)

**Primary indicator:** Blue "Primary" badge on the card. Setting a new primary via the dialog or inline action removes the badge from the previous primary on that side.

**"Add Agent" button** appears below the last agent card for each side.

---

## Transactions List — "By Agent" Grouping

- Grouping is driven by `transaction_agents` JOIN where `agents.isInHouse = true`.
- A transaction with two in-house listing agents appears in both agents' groups.
- Transactions with no in-house agents appear in an "Unassigned" group (existing behavior).
- Outside agents are never used for grouping.

---

## `getTransactions` Query Change

Replace the current scalar `sellerAgentId`/`buyerAgentId` join with a query that:
1. Fetches all transactions.
2. Fetches all `transaction_agents` rows joined to `agents` where `isInHouse = true`.
3. Groups transactions under each in-house agent found.

---

## Active Transactions Card (Dashboard)

The `active-transactions-card.tsx` currently shows `sellerAgentName · buyerAgentName`. This becomes the primary listing agent name · primary buyer agent name (falling back to first agent if no primary set).

---

## Task Stamping

Task stamping (`stampTasks`, `recalculateTaskDueDates`) uses milestone dates from the transaction, not agent data — no changes required.

---

## Migration Strategy

1. Add `isInHouse` to `agents` (default false). Mark existing in-house agents manually or via seed update.
2. Create `transaction_agents` table.
3. Write a one-time migration script that reads existing `sellerAgentId`/`buyerAgentId` values and inserts rows into `transaction_agents`.
4. Drop legacy agent columns from `transactions` after verifying migration.
5. Run `db:push` for schema changes (no migration files — project uses push workflow).

---

## Out of Scope

- Commission splits between multiple agents (future feature).
- Agent-level permissions or role assignments (future feature).
- Notification routing per agent (future feature).
