import { NextRequest, NextResponse } from 'next/server';
import { getRequestContext } from '@cloudflare/next-on-pages';

export const runtime = 'edge';

function generateId(length = 6): string {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789';
    let result = '';
    const array = new Uint8Array(length);
    crypto.getRandomValues(array);
    for (let i = 0; i < length; i++) {
        result += chars[array[i] % chars.length];
    }
    return result;
}

export async function POST(request: NextRequest) {
    try {
        const { path, type } = await request.json() as { path: string; type: string };

        if (!path || !type) {
            return NextResponse.json({ error: 'path and type required' }, { status: 400 });
        }

        const { env } = getRequestContext();
        const db = (env as any).DB as D1Database;

        if (!db) {
            return NextResponse.json({ error: 'D1 not configured' }, { status: 500 });
        }

        // 이미 같은 path+type 조합이 있으면 기존 ID 반환
        const existing = await db.prepare(
            'SELECT id FROM short_links WHERE path = ? AND type = ?'
        ).bind(path, type).first();

        if (existing) {
            return NextResponse.json({ id: (existing as any).id });
        }

        // 새 ID 생성 (충돌 시 재시도)
        let id = '';
        for (let i = 0; i < 5; i++) {
            id = generateId();
            const conflict = await db.prepare(
                'SELECT id FROM short_links WHERE id = ?'
            ).bind(id).first();
            if (!conflict) break;
        }

        await db.prepare(
            'INSERT INTO short_links (id, path, type, created_at) VALUES (?, ?, ?, ?)'
        ).bind(id, path, type, Date.now()).run();

        return NextResponse.json({ id });
    } catch (error: any) {
        console.error('Shorten error:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
