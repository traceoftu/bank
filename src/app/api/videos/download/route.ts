import { NextRequest, NextResponse } from 'next/server';

export const runtime = 'edge';

const R2_PUBLIC_URL = 'https://videos.haebomsoft.com';

export async function GET(request: NextRequest) {
    const searchParams = request.nextUrl.searchParams;
    const path = searchParams.get('path');

    if (!path) {
        return NextResponse.json({ error: 'Path required' }, { status: 400 });
    }

    try {
        const encodedPath = path.split('/').map(encodeURIComponent).join('/');
        const downloadUrl = `${R2_PUBLIC_URL}/${encodedPath}`;
        
        // 파일명 추출
        const fileName = path.split('/').pop() || 'video.mp4';
        
        // R2에서 파일 가져오기
        const response = await fetch(downloadUrl);
        
        if (!response.ok) {
            return NextResponse.json({ error: 'File not found' }, { status: 404 });
        }
        
        // Content-Disposition 헤더로 다운로드 강제
        const headers = new Headers();
        headers.set('Content-Type', response.headers.get('Content-Type') || 'video/mp4');
        headers.set('Content-Disposition', `attachment; filename*=UTF-8''${encodeURIComponent(fileName)}`);
        headers.set('Content-Length', response.headers.get('Content-Length') || '');
        
        return new NextResponse(response.body, {
            status: 200,
            headers,
        });
    } catch (error: any) {
        console.error('Download Error:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
