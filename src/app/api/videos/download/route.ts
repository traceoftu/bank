import { NextRequest, NextResponse } from 'next/server';
import { getRequestContext } from '@cloudflare/next-on-pages';

export const runtime = 'edge';

export async function GET(request: NextRequest) {
    const searchParams = request.nextUrl.searchParams;
    const path = searchParams.get('path');

    if (!path) {
        return NextResponse.json({ error: 'Path required' }, { status: 400 });
    }

    try {
        const { env } = getRequestContext();
        const bucket = (env as any).VIDEOS as R2Bucket;
        const object = await bucket.get(path);

        if (!object) {
            return NextResponse.json({ error: 'File not found' }, { status: 404 });
        }

        const filename = path.split('/').pop() || 'video.mp4';
        const encodedFilename = encodeURIComponent(filename);

        return new Response(object.body as ReadableStream, {
            headers: {
                'Content-Type': 'video/mp4',
                'Content-Disposition': `attachment; filename="${encodedFilename}"; filename*=UTF-8''${encodedFilename}`,
                'Content-Length': object.size.toString(),
            },
        });
    } catch (error: any) {
        console.error('Download Error:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
