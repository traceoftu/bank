import { NextRequest, NextResponse } from 'next/server';
import { getR2Object } from '@/lib/r2';

export const runtime = 'edge';

export async function GET(request: NextRequest) {
    const searchParams = request.nextUrl.searchParams;
    const path = searchParams.get('path');

    if (!path) {
        return NextResponse.json({ error: 'Path required' }, { status: 400 });
    }

    try {
        const filename = path.split('/').pop() || 'video.mp4';
        const object = await getR2Object(path);
        
        if (!object) {
            return NextResponse.json({ error: 'File not found' }, { status: 404 });
        }

        const headers = new Headers();
        headers.set('Content-Type', object.httpMetadata?.contentType || 'application/octet-stream');
        headers.set('Content-Length', object.size.toString());
        headers.set('Content-Disposition', `attachment; filename="${filename}"`);
        
        return new NextResponse(object.body, { headers });
    } catch (error: any) {
        console.error('Download Error:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
