import { NextRequest, NextResponse } from 'next/server';
import { getRequestContext } from '@cloudflare/next-on-pages';

export const runtime = 'edge';

// CORS 헤더
const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
};

// KV 키: files:all - 전체 파일 목록 JSON
// 구조: { files: [{ path, name, size, category, uploadedAt }] }

// OPTIONS (CORS preflight)
export async function OPTIONS() {
    return new NextResponse(null, { headers: corsHeaders });
}

// 파일 목록 조회
export async function GET() {
    try {
        const { env } = getRequestContext();
        const kv = (env as any).VIEWS as KVNamespace;

        if (!kv) {
            return NextResponse.json({ error: 'KV not available' }, { status: 500 });
        }

        const data = await kv.get('files:all', 'json');
        
        return NextResponse.json({
            success: true,
            data: data || { files: [] }
        }, { headers: corsHeaders });
    } catch (error: any) {
        console.error('Get files error:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}

// 파일 추가/업데이트
export async function POST(request: NextRequest) {
    try {
        const { env } = getRequestContext();
        const kv = (env as any).VIEWS as KVNamespace;

        if (!kv) {
            return NextResponse.json({ error: 'KV not available' }, { status: 500 });
        }

        const body = await request.json() as { action?: string; file?: any; files?: any[] };
        const { action, file, files } = body;

        // 현재 파일 목록 가져오기
        const currentData = await kv.get('files:all', 'json') as { files: any[] } | null;
        const currentFiles = currentData?.files || [];

        if (action === 'add') {
            // 단일 파일 추가
            if (file) {
                const existingIndex = currentFiles.findIndex((f: any) => f.path === file.path);
                if (existingIndex >= 0) {
                    currentFiles[existingIndex] = { ...file, uploadedAt: Date.now() };
                } else {
                    currentFiles.push({ ...file, uploadedAt: Date.now() });
                }
            }
            // 여러 파일 추가
            if (files && Array.isArray(files)) {
                for (const f of files) {
                    const existingIndex = currentFiles.findIndex((cf: any) => cf.path === f.path);
                    if (existingIndex >= 0) {
                        currentFiles[existingIndex] = { ...f, uploadedAt: Date.now() };
                    } else {
                        currentFiles.push({ ...f, uploadedAt: Date.now() });
                    }
                }
            }
        } else if (action === 'remove') {
            // 파일 제거
            if (file) {
                const index = currentFiles.findIndex((f: any) => f.path === file.path);
                if (index >= 0) {
                    currentFiles.splice(index, 1);
                }
            }
        } else if (action === 'sync') {
            // 전체 동기화 (R2에서 한 번 가져와서 저장)
            // 이 작업은 관리자가 수동으로 실행
            const bucket = (env as any).VIDEOS as R2Bucket;
            const syncedFiles: any[] = [];

            let cursor: string | undefined;
            do {
                const listed = await bucket.list({ 
                    cursor,
                    prefix: 'thumbnails/'
                });

                for (const object of listed.objects) {
                    if (!object.key.endsWith('/') && object.key.endsWith('.jpg')) {
                        const thumbPath = object.key.replace('thumbnails/', '').replace('.jpg', '');
                        const parts = thumbPath.split('/');
                        
                        if (parts.length >= 2) {
                            const category = parts[0];
                            const name = parts[parts.length - 1];

                            syncedFiles.push({
                                path: thumbPath,
                                name,
                                size: object.size,
                                category,
                                uploadedAt: object.uploaded?.getTime() || Date.now(),
                            });
                        }
                    }
                }

                cursor = listed.truncated ? listed.cursor : undefined;
            } while (cursor);

            // KV에 저장
            await kv.put('files:all', JSON.stringify({ files: syncedFiles }));

            return NextResponse.json({
                success: true,
                message: `Synced ${syncedFiles.length} files`,
                count: syncedFiles.length
            }, { headers: corsHeaders });
        }

        // KV에 저장
        await kv.put('files:all', JSON.stringify({ files: currentFiles }));

        return NextResponse.json({
            success: true,
            count: currentFiles.length
        }, { headers: corsHeaders });
    } catch (error: any) {
        console.error('Update files error:', error);
        return NextResponse.json({ error: error.message }, { status: 500, headers: corsHeaders });
    }
}
