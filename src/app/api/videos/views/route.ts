import { NextRequest, NextResponse } from 'next/server';
import { getRequestContext } from '@cloudflare/next-on-pages';

export const runtime = 'edge';

// Get view count for a video
export async function GET(request: NextRequest) {
    const searchParams = request.nextUrl.searchParams;
    const path = searchParams.get('path');

    if (!path) {
        return NextResponse.json({ error: 'Path required' }, { status: 400 });
    }

    try {
        const { env } = getRequestContext();
        const db = (env as any).DB as D1Database;
        
        if (!db) {
            return NextResponse.json({ views: 0 });
        }

        const row = await db.prepare('SELECT count FROM views WHERE path = ?').bind(path).first();
        return NextResponse.json({ views: row ? (row as any).count : 0 });
    } catch (error: any) {
        console.error('Get views error:', error);
        return NextResponse.json({ views: 0 });
    }
}

// Increment view count for a video
export async function POST(request: NextRequest) {
    try {
        const body = await request.json() as { path?: string };
        const { path } = body;

        if (!path) {
            return NextResponse.json({ error: 'Path required' }, { status: 400 });
        }

        const { env } = getRequestContext();
        const db = (env as any).DB as D1Database;
        
        if (!db) {
            return NextResponse.json({ views: 0, message: 'D1 not configured' });
        }

        // 원자적 증가 (INSERT OR UPDATE)
        await db.prepare(
            'INSERT INTO views (path, count, updated_at) VALUES (?, 1, ?) ON CONFLICT(path) DO UPDATE SET count = count + 1, updated_at = ?'
        ).bind(path, Date.now(), Date.now()).run();

        // 업데이트된 조회수 반환
        const row = await db.prepare('SELECT count FROM views WHERE path = ?').bind(path).first();
        return NextResponse.json({ views: row ? (row as any).count : 1 });
    } catch (error: any) {
        console.error('Increment views error:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
