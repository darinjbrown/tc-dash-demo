'use client';

import { create } from 'zustand';

interface UIStore {
  // Sidebar
  sidebarCollapsed: boolean;
  setSidebarCollapsed: (collapsed: boolean) => void;
  toggleSidebar: () => void;

  // Expanded transaction rows
  expandedRows: Set<string>;
  toggleRow: (id: string) => void;

  // Active filters
  transactionStatusFilter: string[];
  setTransactionStatusFilter: (statuses: string[]) => void;
  transactionAgentFilter: string | null;
  setTransactionAgentFilter: (agentId: string | null) => void;
  transactionSearch: string;
  setTransactionSearch: (q: string) => void;
}

export const useUIStore = create<UIStore>((set) => ({
  sidebarCollapsed: false,
  setSidebarCollapsed: (collapsed) => set({ sidebarCollapsed: collapsed }),
  toggleSidebar: () =>
    set((state) => ({ sidebarCollapsed: !state.sidebarCollapsed })),

  expandedRows: new Set(),
  toggleRow: (id) =>
    set((state) => {
      const next = new Set(state.expandedRows);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return { expandedRows: next };
    }),

  transactionStatusFilter: [],
  setTransactionStatusFilter: (statuses) =>
    set({ transactionStatusFilter: statuses }),
  transactionAgentFilter: null,
  setTransactionAgentFilter: (agentId) =>
    set({ transactionAgentFilter: agentId }),
  transactionSearch: '',
  setTransactionSearch: (q) => set({ transactionSearch: q }),
}));
