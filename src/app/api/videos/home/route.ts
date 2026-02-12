import { NextRequest, NextResponse } from 'next/server';
import { getRequestContext } from '@cloudflare/next-on-pages';

export const runtime = 'edge';

const CATEGORY_ORDER = ['성인', '은장회', '청년회', '중고등부', '초등부', '생활&특별&기타'];

// 홈 화면 전용 API - KV에서 파일 목록 조회 (R2 LIST 호출 안 함)
export async function GET(request: NextRequest) {
    try {
        const { env } = getRequestContext();
        const kv = (env as any).VIEWS as KVNamespace;

        // 캐시된 홈 데이터 확인 (5분 캐시)
        const cachedHome = await kv.get('cache:home', 'json') as { data: any; timestamp: number } | null;
        const CACHE_TTL = 5 * 60 * 1000; // 5분

        if (cachedHome && (Date.now() - cachedHome.timestamp) < CACHE_TTL) {
            return NextResponse.json({
                success: true,
                data: cachedHome.data,
                cached: true
            });
        }

        // KV에서 파일 목록 가져오기 (R2 LIST 대신)
        const filesData = await kv.get('files:all', 'json') as { files: any[] } | null;
        const videoInfos = filesData?.files || [];

        // 파일 목록이 없으면 빈 결과 반환
        if (videoInfos.length === 0) {
            return NextResponse.json({
                success: true,
                data: {
                    top10: [],
                    categories: [],
                },
                message: 'No files in KV. Run sync first.'
            });
        }

        // 카테고리 목록 추출
        const folders = new Set<string>();
        for (const video of videoInfos) {
            if (video.category) {
                folders.add(video.category);
            }
        }

        // D1에서 조회수 일괄 조회
        const db = (env as any).DB as D1Database;
        let viewsMap: Record<string, number> = {};
        
        if (db) {
            try {
                const result = await db.prepare('SELECT path, count FROM views').all();
                if (result.results) {
                    for (const row of result.results as any[]) {
                        viewsMap[row.path] = row.count;
                    }
                }
            } catch (e) {
                console.error('D1 views query error:', e);
            }
        }

        // 조회수와 합치기
        const allVideos = videoInfos.map((video: any) => ({
            ...video,
            views: viewsMap[video.path] || 0,
        }));

        // 전체 TOP 10
        const top10 = [...allVideos]
            .sort((a, b) => b.views - a.views)
            .slice(0, 10)
            .map(({ category, ...rest }) => rest);

        // 폴더 정렬
        const sortedFolders = Array.from(folders).sort((a, b) => {
            const indexA = CATEGORY_ORDER.indexOf(a);
            const indexB = CATEGORY_ORDER.indexOf(b);
            if (indexA !== -1 && indexB !== -1) return indexA - indexB;
            if (indexA !== -1) return -1;
            if (indexB !== -1) return 1;
            return a.localeCompare(b);
        });

        // 카테고리별 TOP 10
        const categories = sortedFolders.map(folder => {
            const categoryVideos = allVideos
                .filter(v => v.category === folder)
                .sort((a, b) => b.views - a.views)
                .slice(0, 10)
                .map(({ category, ...rest }) => rest);

            return {
                category: folder,
                path: folder,
                videos: categoryVideos,
            };
        });

        const responseData = {
            top10,
            categories,
        };

        // 캐시에 저장 (5분간 유효)
        await kv.put('cache:home', JSON.stringify({
            data: responseData,
            timestamp: Date.now()
        }));

        return NextResponse.json({
            success: true,
            data: responseData,
        });
    } catch (error: any) {
        console.error('Home data error:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
