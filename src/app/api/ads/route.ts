import { NextResponse } from 'next/server';

export const runtime = 'edge';

const R2_PUBLIC_URL = 'https://videos.haebomsoft.com';

export async function GET() {
    try {
        const res = await fetch(`${R2_PUBLIC_URL}/ads/config.json`, {
            headers: {
                'Cache-Control': 'no-cache'
            }
        });
        
        if (!res.ok) {
            return NextResponse.json({ error: 'Not found' }, { status: 404 });
        }
        
        const data = await res.json();
        return NextResponse.json(data);
    } catch {
        return NextResponse.json({ error: 'Failed to load ads config' }, { status: 500 });
    }
}
