import { notFound, redirect } from 'next/navigation';
import { getRequestContext } from '@cloudflare/next-on-pages';

export const runtime = 'edge';

export default async function ShortLinkPage({ params }: { params: Promise<{ id: string }> }) {
    const { id } = await params;

    try {
        const { env } = getRequestContext();
        const db = (env as any).DB as D1Database;

        if (!db) {
            return notFound();
        }

        const row = await db.prepare(
            'SELECT path, type FROM short_links WHERE id = ?'
        ).bind(id).first();

        if (!row) {
            return notFound();
        }

        const { path, type } = row as { path: string; type: string };

        if (type === 'play') {
            redirect(`/?play=${encodeURIComponent(path)}`);
        } else {
            redirect(`/?path=${encodeURIComponent(path)}`);
        }
    } catch (error) {
        console.error('Short link error:', error);
        return notFound();
    }
}
