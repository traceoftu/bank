import { NextRequest, NextResponse } from 'next/server';
import { getR2StreamUrl } from '@/lib/r2';

export const runtime = 'edge';

export async function GET(request: NextRequest) {
    const searchParams = request.nextUrl.searchParams;
    const path = searchParams.get('path');

    if (!path) {
        return NextResponse.json({ error: 'Path required' }, { status: 400 });
    }

    try {
        // Generate presigned URL for R2 (valid for 1 hour)
        const streamUrl = await getR2StreamUrl(path, 3600);

        // Redirect to R2 CDN
        return NextResponse.redirect(streamUrl);
    } catch (error: any) {
        console.error('Stream Error:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
