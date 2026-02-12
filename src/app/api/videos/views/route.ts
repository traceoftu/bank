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

        // IP 기반 중복 방지 (1시간 쿨다운)
        const ip = request.headers.get('cf-connecting-ip') || request.headers.get('x-forwarded-for') || 'unknown';
        const ipHash = ip.split('.').slice(0, 3).join('.'); // /24 서브넷
        const cooldownKey = `vc:${ipHash}:${path}`;
        const lastView = await kv.get(cooldownKey);
        
        if (lastView) {
            // 쿨다운 중 - KV 쓰기 없이 현재 조회수만 반환
            const currentViews = await kv.get(`views:${path}`);
            return NextResponse.json({ views: currentViews ? parseInt(currentViews, 10) : 0 });
        }

        // 쿨다운 키 설정 (1시간 TTL, 자동 삭제)
        await kv.put(cooldownKey, '1', { expirationTtl: 3600 });

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
