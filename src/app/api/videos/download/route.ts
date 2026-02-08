import { NextRequest, NextResponse } from 'next/server';
import { getR2DownloadUrl } from '@/lib/r2';

export const runtime = 'edge';

export async function GET(request: NextRequest) {
    const searchParams = request.nextUrl.searchParams;
    const path = searchParams.get('path');

    if (!path) {
        return NextResponse.json({ error: 'Path required' }, { status: 400 });
    }

    try {
        // Extract filename from path
        const filename = path.split('/').pop() || 'video.mp4';
        
        // Generate presigned URL for R2 download (valid for 1 hour)
        const downloadUrl = await getR2DownloadUrl(path, filename, 3600);

        return NextResponse.redirect(downloadUrl);
    } catch (error: any) {
        console.error('Download Error:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
