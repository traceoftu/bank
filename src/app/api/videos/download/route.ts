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
        const fileName = path.split('/').pop() || 'video.mp4';
        const encodedPath = path.split('/').map(encodeURIComponent).join('/');
        const downloadUrl = `${R2_PUBLIC_URL}/${encodedPath}`;
        
        // 1. 먼저 원본 MP4 다운로드 시도
        const response = await fetch(downloadUrl);
        
        if (response.ok) {
            const headers = new Headers();
            headers.set('Content-Type', response.headers.get('Content-Type') || 'video/mp4');
            headers.set('Content-Disposition', `attachment; filename*=UTF-8''${encodeURIComponent(fileName)}`);
            headers.set('Content-Length', response.headers.get('Content-Length') || '');
            
            return new NextResponse(response.body, { status: 200, headers });
        }
        
        // 2. MP4가 없으면 HLS 경로 추론하여 ts 합침 다운로드
        const dir = path.substring(0, path.lastIndexOf('/'));
        const nameWithoutExt = fileName.replace(/\.[^.]+$/, '');
        const m3u8Path = `${dir}/hls/${nameWithoutExt}/index.m3u8`;
        const m3u8Encoded = m3u8Path.split('/').map(encodeURIComponent).join('/');
        const m3u8Res = await fetch(`${R2_PUBLIC_URL}/${m3u8Encoded}`);
        
        if (!m3u8Res.ok) {
            return NextResponse.json({ error: 'File not found' }, { status: 404 });
        }
        
        const m3u8Text = await m3u8Res.text();
        const tsFiles = m3u8Text.split('\n')
            .filter(line => line.trim() && !line.startsWith('#'))
            .map(line => line.trim());
        
        if (tsFiles.length === 0) {
            return NextResponse.json({ error: 'No segments found' }, { status: 404 });
        }
        
        const hlsDir = `${dir}/hls/${nameWithoutExt}`;
        
        // ts 파일들을 순서대로 합쳐서 하나의 스트림으로 제공
        const { readable, writable } = new TransformStream();
        const writer = writable.getWriter();
        
        // 백그라운드에서 ts 파일들을 순차적으로 스트리밍
        (async () => {
            try {
                for (const tsFile of tsFiles) {
                    const tsEncoded = `${hlsDir}/${tsFile}`.split('/').map(encodeURIComponent).join('/');
                    const tsRes = await fetch(`${R2_PUBLIC_URL}/${tsEncoded}`);
                    if (tsRes.ok && tsRes.body) {
                        const reader = tsRes.body.getReader();
                        while (true) {
                            const { done, value } = await reader.read();
                            if (done) break;
                            await writer.write(value);
                        }
                    }
                }
            } catch (err) {
                console.error('Download stream error:', err);
            } finally {
                await writer.close();
            }
        })();
        
        const downloadFileName = `${nameWithoutExt}.mp4`;
        const headers = new Headers();
        headers.set('Content-Type', 'video/mp4');
        headers.set('Content-Disposition', `attachment; filename*=UTF-8''${encodeURIComponent(downloadFileName)}`);
        
        return new NextResponse(readable, { status: 200, headers });
    } catch (error: any) {
        console.error('Download Error:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
