import { NextResponse } from 'next/server';

export const runtime = 'edge';

const R2_PUBLIC_URL = 'https://videos.haebomsoft.com';

export async function GET() {
    try {
        // 캐시 우회를 위해 타임스탬프 추가
        const res = await fetch(`${R2_PUBLIC_URL}/ads/config.json?t=${Date.now()}`, {
            cache: 'no-store'
        });
        
        if (!res.ok) {
            return NextResponse.json({ error: 'Not found' }, { status: 404 });
        }
        
        const data = await res.json();
        
        // 응답에도 캐시 비활성화 헤더 추가
        return NextResponse.json(data, {
            headers: {
                'Cache-Control': 'no-store, no-cache, must-revalidate',
            }
        });
    } catch {
        return NextResponse.json({ error: 'Failed to load ads config' }, { status: 500 });
    }
}
