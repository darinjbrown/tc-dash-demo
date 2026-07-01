'use client';
import { useTransition } from 'react';
import { exitTenant } from '@/actions/acting';

export function ActingBanner({ officeName }: { officeName: string }) {
  const [pending, start] = useTransition();
  return (
    <div style={{
      display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12,
      padding: '8px 16px', background: '#0A2620', color: '#F6F3EA', fontSize: 13.5,
    }}>
      <span>
        Acting as <strong style={{ color: '#3FE0A0' }}>{officeName}</strong> — you are operating this office as d20web.
      </span>
      <button type="button" disabled={pending} onClick={() => start(() => exitTenant())}
        style={{ background: '#3FE0A0', color: '#08231B', border: 'none', borderRadius: 8,
          padding: '6px 12px', fontWeight: 600, cursor: 'pointer' }}>
        Exit to platform
      </button>
    </div>
  );
}
