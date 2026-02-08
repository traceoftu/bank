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
        const kv = (env as any).VIEWS as KVNamespace;
        
        if (!kv) {
            return NextResponse.json({ views: 0 });
        }

        const views = await kv.get(`views:${path}`);
        return NextResponse.json({ views: views ? parseInt(views, 10) : 0 });
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
        const kv = (env as any).VIEWS as KVNamespace;
        
        if (!kv) {
            return NextResponse.json({ views: 0, message: 'KV not configured' });
        }

        const key = `views:${path}`;
        const currentViews = await kv.get(key);
        const newViews = (currentViews ? parseInt(currentViews, 10) : 0) + 1;
        
        await kv.put(key, newViews.toString());

        return NextResponse.json({ views: newViews });
    } catch (error: any) {
        console.error('Increment views error:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
