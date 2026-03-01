// NextAuth configuration — implemented in Phase 5
// Placeholder exports to satisfy TypeScript until auth is wired up
import { NextResponse } from 'next/server';

export const GET = () => NextResponse.json({ error: 'Auth not configured' }, { status: 501 });
export const POST = () => NextResponse.json({ error: 'Auth not configured' }, { status: 501 });
