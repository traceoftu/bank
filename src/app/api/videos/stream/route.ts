import { NextRequest, NextResponse } from 'next/server';
import { synologyClient } from '@/lib/synology';
import axios from 'axios';

export async function GET(request: NextRequest) {
    const searchParams = request.nextUrl.searchParams;
    const path = searchParams.get('path');

    if (!path) {
        return NextResponse.json({ error: 'Path required' }, { status: 400 });
    }

    try {
        const sid = await synologyClient.getSid();
        const synologyUrl = process.env.SYNOLOGY_URL;

        // Proxy Implementation to fix Mixed Content (HTTP vs HTTPS)
        const targetUrl = `${synologyUrl}/webapi/entry.cgi`;

        // Forward Range header if present
        const range = request.headers.get('range');
        const headers: any = {
            'Cookie': `id=${sid}`
        };
        if (range) {
            headers['Range'] = range;
        }

        const response = await axios.get(targetUrl, {
            params: {
                api: 'SYNO.FileStation.Download',
                version: 2,
                method: 'download',
                path: path,
                mode: 'open',
                _sid: sid
            },
            headers: headers,
            responseType: 'stream',
            validateStatus: () => true, // Accept all status codes
            timeout: 0 // No timeout for stream
        });

        // Create a new response with the stream
        const newHeaders = new Headers();
        if (response.headers['content-type']) newHeaders.set('Content-Type', response.headers['content-type']);
        if (response.headers['content-length']) newHeaders.set('Content-Length', response.headers['content-length']);
        if (response.headers['content-range']) newHeaders.set('Content-Range', response.headers['content-range']);
        if (response.headers['accept-ranges']) newHeaders.set('Accept-Ranges', response.headers['accept-ranges']);

        // @ts-ignore - response.data is a stream
        return new NextResponse(response.data, {
            status: response.status,
            headers: newHeaders,
        });

    } catch (error: any) {
        console.error('Stream Proxy Error:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
