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

        // Construct the direct Synology URL with SID for streaming
        // Accessing this URL directly from client might fail if Mixed Content (HTTPS vs HTTP) or CORS, 
        // but usually <video> tags are permissive.
        // Ideally we would proxy the stream, but for video it's heavy for Next.js middleware.
        // We will try redirecting to the Synology download URL with SID.

        const streamUrl = `${synologyUrl}/webapi/entry.cgi?api=SYNO.FileStation.Download&version=2&method=download&path=${encodeURIComponent(path)}&_sid=${sid}&mode=open`;

        return NextResponse.redirect(streamUrl);
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
