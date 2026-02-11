import { NextRequest, NextResponse } from 'next/server';
import { getRequestContext } from '@cloudflare/next-on-pages';

export const runtime = 'edge';

const CATEGORY_ORDER = ['성인', '은장회', '청년회', '중고등부', '초등부', '생활&특별&기타'];

// 홈 화면 전용 API - 한 번의 호출로 모든 데이터 반환
export async function GET(request: NextRequest) {
    try {
        const { env } = getRequestContext();
        const kv = (env as any).VIEWS as KVNamespace;
        const bucket = (env as any).VIDEOS as R2Bucket;

        // 모든 비디오 파일과 조회수를 한 번에 가져오기
        const allVideos: { path: string; name: string; size: number; views: number; category: string }[] = [];
        const folders = new Set<string>();

        let cursor: string | undefined;
        do {
            const listed = await bucket.list({ cursor });

            for (const object of listed.objects) {
                // 폴더 수집
                const parts = object.key.split('/');
                if (parts.length > 1 && parts[0]) {
                    folders.add(parts[0]);
                }

                // 비디오 파일만 처리
                if (!object.key.endsWith('/') && /\.(mp4|mkv|avi|mov|wmv|flv|webm)$/i.test(object.key)) {
                    const name = parts.pop() || '';
                    const category = parts[0] || '';
                    
                    let views = 0;
                    if (kv) {
                        const viewCount = await kv.get(`views:${object.key}`);
                        views = viewCount ? parseInt(viewCount, 10) : 0;
                    }

                    allVideos.push({
                        path: object.key,
                        name,
                        size: object.size,
                        views,
                        category,
                    });
                }
            }

            cursor = listed.truncated ? listed.cursor : undefined;
        } while (cursor);

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

        // 카테고리별 TOP 5
        const categories = sortedFolders.map(folder => {
            const categoryVideos = allVideos
                .filter(v => v.category === folder)
                .sort((a, b) => b.views - a.views)
                .slice(0, 5)
                .map(({ category, ...rest }) => rest);

            return {
                category: folder,
                path: folder,
                videos: categoryVideos,
            };
        });

        return NextResponse.json({
            success: true,
            data: {
                top10,
                categories,
            },
        });
    } catch (error: any) {
        console.error('Home data error:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
