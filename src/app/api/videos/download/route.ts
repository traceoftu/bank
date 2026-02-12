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
        if (path.endsWith('.m3u8')) {
            // HLS 다운로드: ts 파일들을 합쳐서 하나의 파일로 제공
            const parts = path.split('/');
            parts.pop(); // index.m3u8 제거
            const videoName = parts.pop() || 'video';
            const hlsDir = [...parts, videoName].join('/');
            
            // m3u8 파일 가져오기
            const m3u8Encoded = path.split('/').map(encodeURIComponent).join('/');
            const m3u8Res = await fetch(`${R2_PUBLIC_URL}/${m3u8Encoded}`);
            if (!m3u8Res.ok) {
                return NextResponse.json({ error: 'HLS manifest not found' }, { status: 404 });
            }
            
            const m3u8Text = await m3u8Res.text();
            
            // ts 파일 목록 추출 (순서대로)
            const tsFiles = m3u8Text.split('\n')
                .filter(line => line.trim() && !line.startsWith('#'))
                .map(line => line.trim());
            
            if (tsFiles.length === 0) {
                return NextResponse.json({ error: 'No segments found' }, { status: 404 });
            }
            
            // ts 파일들을 순서대로 스트리밍
            const stream = new ReadableStream({
                async start(controller) {
                    try {
                        for (const tsFile of tsFiles) {
                            const tsEncoded = `${hlsDir}/${tsFile}`.split('/').map(encodeURIComponent).join('/');
                            const tsRes = await fetch(`${R2_PUBLIC_URL}/${tsEncoded}`);
                            if (tsRes.ok && tsRes.body) {
                                const reader = tsRes.body.getReader();
                                while (true) {
                                    const { done, value } = await reader.read();
                                    if (done) break;
                                    controller.enqueue(value);
                                }
                            }
                        }
                        controller.close();
                    } catch (err) {
                        controller.error(err);
                    }
                }
            });
            
            const fileName = `${videoName}.ts`;
            const headers = new Headers();
            headers.set('Content-Type', 'video/mp2t');
            headers.set('Content-Disposition', `attachment; filename*=UTF-8''${encodeURIComponent(fileName)}`);
            
            return new NextResponse(stream, { status: 200, headers });
        }
        
        // 일반 MP4 다운로드
        const encodedPath = path.split('/').map(encodeURIComponent).join('/');
        const downloadUrl = `${R2_PUBLIC_URL}/${encodedPath}`;
        
        const fileName = path.split('/').pop() || 'video.mp4';
        
        const response = await fetch(downloadUrl);
        
        if (!response.ok) {
            return NextResponse.json({ error: 'File not found' }, { status: 404 });
        }
        
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
