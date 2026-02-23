import { NextRequest, NextResponse } from 'next/server';

export const runtime = 'edge';

// iOS 다운로드를 위한 Cloudflare Worker URL
const R2_DOWNLOAD_WORKER = 'https://r2-download-worker.pts896.workers.dev';

export async function GET(request: NextRequest) {
    const searchParams = request.nextUrl.searchParams;
    const path = searchParams.get('path');

    if (!path) {
        return NextResponse.json({ error: 'Path required' }, { status: 400 });
    }

    try {
        // 파일명 추출
        const fileName = path.split('/').pop() || 'video.mp4';
        
        // Cloudflare Worker를 통한 다운로드 (Content-Disposition 헤더 포함)
        const encodedPath = path.split('/').map(encodeURIComponent).join('/');
        const downloadUrl = `${R2_DOWNLOAD_WORKER}/${encodedPath}`;
        
        // iOS를 위한 리다이렉트 (Content-Disposition 헤더는 Worker에서 처리)
        return NextResponse.redirect(downloadUrl, { status: 302 });
    } catch (error: any) {
        console.error('Download Error:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
