import { NextRequest, NextResponse } from 'next/server';
import { getRequestContext } from '@cloudflare/next-on-pages';

export const runtime = 'edge';

export async function GET(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    const { id } = await params;

    try {
        const { env } = getRequestContext();
        const db = (env as any).DB as D1Database;

        if (!db) {
            return NextResponse.redirect(new URL('/', _request.url));
        }

        const row = await db.prepare(
            'SELECT path, type FROM short_links WHERE id = ?'
        ).bind(id).first();

        if (!row) {
            return NextResponse.redirect(new URL('/', _request.url));
        }

        const { path, type } = row as { path: string; type: string };
        const base = new URL('/', _request.url);

        if (type === 'play') {
            base.searchParams.set('play', path);
        } else {
            base.searchParams.set('path', path);
        }

        return NextResponse.redirect(base);
    } catch (error) {
        console.error('Short link error:', error);
        return NextResponse.redirect(new URL('/', _request.url));
    }
}
