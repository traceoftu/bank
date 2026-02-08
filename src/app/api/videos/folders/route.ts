import { NextRequest, NextResponse } from 'next/server';
import { synologyClient } from '@/lib/synology';

export async function GET(request: NextRequest) {
    const searchParams = request.nextUrl.searchParams;
    const path = searchParams.get('path') || process.env.SYNOLOGY_ROOT_PATH || '/video';

    try {
        const data = await synologyClient.listFolder(path);
        return NextResponse.json(data);
    } catch (error: any) {
        console.error('API Error:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
