import { NextRequest, NextResponse } from 'next/server';
import { getRequestContext } from '@cloudflare/next-on-pages';

export const runtime = 'edge';

const CATEGORY_ORDER = ['성인', '은장회', '청년회', '중고등부', '초등부', '생활&특별&기타'];

// 홈 화면 전용 API - thumbnails 폴더만 스캔하여 빠르게 반환
export async function GET(request: NextRequest) {
    try {
        const { env } = getRequestContext();
        const kv = (env as any).VIEWS as KVNamespace;
        const bucket = (env as any).VIDEOS as R2Bucket;

        // thumbnails 폴더만 스캔 (KV 조회 없이 빠르게)
        const allVideos: { path: string; name: string; size: number; views: number; category: string }[] = [];
        const folders = new Set<string>();

        let cursor: string | undefined;
        do {
            const listed = await bucket.list({ 
                cursor,
                prefix: 'thumbnails/'  // 썸네일 폴더만 스캔
            });

            for (const object of listed.objects) {
                // thumbnails/카테고리/파일명.jpg 형태
                if (!object.key.endsWith('/') && object.key.endsWith('.jpg')) {
                    // thumbnails/ 제거하고 원본 비디오 경로 추출
                    const thumbPath = object.key.replace('thumbnails/', '').replace('.jpg', '');
                    const parts = thumbPath.split('/');
                    
                    if (parts.length >= 2) {
                        const category = parts[0];
                        const name = parts[parts.length - 1];
                        folders.add(category);

                        allVideos.push({
                            path: thumbPath,
                            name,
                            size: object.size,
                            views: 0,  // 조회수 조회 생략 (속도 최적화)
                            category,
                        });
                    }
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
