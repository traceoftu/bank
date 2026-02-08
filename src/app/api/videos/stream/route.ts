import { NextRequest, NextResponse } from 'next/server';
import { synologyClient } from '@/lib/synology';

export async function GET(request: NextRequest) {
    const searchParams = request.nextUrl.searchParams;
    const path = searchParams.get('path');

    if (!path) {
        return NextResponse.json({ error: 'Path required' }, { status: 400 });
    }

    try {
        const sid = await synologyClient.getSid();
        const synologyUrl = process.env.SYNOLOGY_URL;

        // Direct Redirect (Fastest, requires valid SSL on Synology)
        const streamUrl = `${synologyUrl}/webapi/entry.cgi?api=SYNO.FileStation.Download&version=2&method=download&path=${encodeURIComponent(path)}&_sid=${sid}&mode=open`;

        return NextResponse.redirect(streamUrl);
    } catch (error: any) {
        console.error('Stream Error:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
