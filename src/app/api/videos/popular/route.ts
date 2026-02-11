import { NextRequest, NextResponse } from 'next/server';
import { getRequestContext } from '@cloudflare/next-on-pages';

export const runtime = 'edge';

// KV에서 인기 영상 조회 (R2 LIST 호출 안 함)
export async function GET(request: NextRequest) {
    try {
        const { env } = getRequestContext();
        const kv = (env as any).VIEWS as KVNamespace;

        const searchParams = request.nextUrl.searchParams;
        const prefix = searchParams.get('path') || '';
        const limit = parseInt(searchParams.get('limit') || '10', 10);

        // KV에서 파일 목록 가져오기
        const filesData = await kv.get('files:all', 'json') as { files: any[] } | null;
        let allFiles = filesData?.files || [];

        // prefix로 필터링
        if (prefix) {
            allFiles = allFiles.filter((f: any) => f.path.startsWith(prefix));
        }

        // 조회수 병렬 조회
        const videosWithViews = await Promise.all(
            allFiles.map(async (file: any) => {
                let views = 0;
                if (kv) {
                    const viewCount = await kv.get(`views:${file.path}`);
                    views = viewCount ? parseInt(viewCount, 10) : 0;
                }
                return {
                    path: file.path,
                    name: file.name,
                    size: file.size || 0,
                    views,
                };
            })
        );

        // 조회수 기준 정렬 후 상위 N개
        const topVideos = videosWithViews
            .sort((a, b) => b.views - a.views)
            .slice(0, limit);

        return NextResponse.json({
            success: true,
            data: {
                videos: topVideos,
            },
        });
    } catch (error: any) {
        console.error('Popular videos error:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
