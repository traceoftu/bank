import { NextRequest, NextResponse } from 'next/server';
import { getRequestContext } from '@cloudflare/next-on-pages';

export const runtime = 'edge';

// KV에서 파일 목록 조회 (R2 LIST 호출 안 함)
export async function GET(request: NextRequest) {
    const searchParams = request.nextUrl.searchParams;
    const path = searchParams.get('path') || '';
    const query = searchParams.get('q');

    try {
        const { env } = getRequestContext();
        const kv = (env as any).VIEWS as KVNamespace;

        // KV에서 파일 목록 가져오기
        const filesData = await kv.get('files:all', 'json') as { files: any[] } | null;
        const allFiles = filesData?.files || [];

        let filteredFiles = allFiles;

        if (query) {
            // 검색 모드: 파일명에서 검색
            const searchPattern = query.toLowerCase();
            filteredFiles = allFiles.filter((f: any) => 
                f.name.toLowerCase().includes(searchPattern) || 
                f.path.toLowerCase().includes(searchPattern)
            );
        } else if (path) {
            // 특정 경로의 파일만 필터링
            filteredFiles = allFiles.filter((f: any) => f.path.startsWith(path));
        }

        // 폴더 목록 추출 (path에서 하위 폴더 찾기)
        const folderMap = new Map<string, { name: string; path: string; totalViews: number; thumbnailPath: string }>();
        const videos: any[] = [];

        // 조회수 데이터 가져오기 (D1 집계 쿼리로 한 번에 처리)
        const viewCounts = new Map<string, number>();
        const folderStats = new Map<string, { totalViews: number; topVideoPath: string }>();
        
        try {
            const db = (env as any).DB as D1Database;
            if (db) {
                // 먼저 D1에 데이터가 있는지 확인
                const countResult = await db.prepare('SELECT COUNT(*) as count FROM views').first();
                console.log('📊 D1 views 테이블 레코드 수:', countResult?.count || 0);
                
                // 샘플 데이터 확인
                const sampleResult = await db.prepare('SELECT path, count FROM views LIMIT 5').all();
                console.log('📊 D1 샘플 데이터:', sampleResult.results);
                
                // 현재 경로의 하위 폴더들만 집계
                const pathPrefix = path ? `${path}/` : '';
                const result = await db.prepare(`
                    SELECT 
                        SUBSTR(path, ${pathPrefix.length + 1}, 
                               INSTR(SUBSTR(path, ${pathPrefix.length + 1}), '/') - 1) as folder_name,
                        SUM(count) as total_views,
                        (SELECT path FROM views v2 
                         WHERE v2.path LIKE ? || '%' 
                         AND SUBSTR(v2.path, ${pathPrefix.length + 1}, 
                                   INSTR(SUBSTR(v2.path, ${pathPrefix.length + 1}), '/') - 1) = folder_name
                         ORDER BY count DESC LIMIT 1) as top_video_path
                    FROM views
                    WHERE path LIKE ?
                    GROUP BY folder_name
                    ORDER BY total_views DESC
                `).bind(pathPrefix, `${pathPrefix}%`).all();
                
                console.log('📊 D1 집계 결과:', result.results);
                
                if (result.results) {
                    for (const row of result.results as any[]) {
                        const folderPath = path ? `${path}/${row.folder_name}` : row.folder_name;
                        folderStats.set(folderPath, {
                            totalViews: row.total_views,
                            topVideoPath: row.top_video_path
                        });
                        viewCounts.set(row.top_video_path, row.total_views);
                    }
                }
            }
        } catch (e) {
            console.error('D1 aggregation query error:', e);
        }
        
        // D1에 데이터가 없으면 KV 폴백
        if (folderStats.size === 0) {
            console.log('🔄 KV 폴백 사용');
            for (const file of filteredFiles) {
                if (!file.isdir) {
                    const viewKey = `views:${file.path}`;
                    const viewData = await kv.get(viewKey);
                    const views = viewData ? parseInt(viewData as string) : 0;
                    viewCounts.set(file.path, views);
                    
                    // 폴더별 집계
                    const pathParts = file.path.split('/');
                    if (pathParts.length >= 3) {
                        const folderPath = `${pathParts[0]}/${pathParts[1]}`;
                        if (!folderStats.has(folderPath)) {
                            folderStats.set(folderPath, { totalViews: 0, topVideoPath: '' });
                        }
                        const stats = folderStats.get(folderPath)!;
                        stats.totalViews += views;
                        if (!stats.topVideoPath || views > (viewCounts.get(stats.topVideoPath) || 0)) {
                            stats.topVideoPath = file.path;
                        }
                    }
                }
            }
        }

        for (const file of filteredFiles) {
            const relativePath = path ? file.path.replace(path + '/', '') : file.path;
            const parts = relativePath.split('/');
            
            // 현재 폴더의 직접 하위 폴더만 처리 (성인 → 이정국, 배현기 등)
            if (parts.length >= 2) {
                const folderName = parts[0];
                const folderPath = path ? `${path}/${folderName}` : folderName;
                
                if (!folderMap.has(folderPath)) {
                    // D1 집계 데이터 사용
                    const stats = folderStats.get(folderPath);
                    folderMap.set(folderPath, {
                        name: folderName,
                        path: folderPath,
                        totalViews: stats?.totalViews || 0,
                        thumbnailPath: ''
                    });
                }
                
                // D1에서 찾은 최상위 영상으로 썸네일 설정
                const stats = folderStats.get(folderPath);
                if (stats && stats.topVideoPath) {
                    const folderInfo = folderMap.get(folderPath)!;
                    if (!folderInfo.thumbnailPath) {
                        // 썸네일 경로 계산
                        const pathParts = stats.topVideoPath.split('/');
                        const filename = pathParts[pathParts.length - 1];
                        const folderPath = pathParts.slice(0, -1).join('/');
                        folderInfo.thumbnailPath = `${folderPath}/${filename}.jpg`;
                    }
                }
            } else {
                // 현재 경로의 파일
                videos.push({
                    name: file.name,
                    path: file.path,
                    isdir: false,
                    additional: {
                        size: file.size || 0,
                        time: {
                            mtime: Math.floor((file.uploadedAt || Date.now()) / 1000),
                        },
                    },
                });
            }
        }

        // 조회수 많은 순으로 폴더 정렬
        const folders = Array.from(folderMap.values())
            .sort((a, b) => b.totalViews - a.totalViews)
            .map(folder => {
                console.log(`📁 폴더: ${folder.name}, 조회수: ${folder.totalViews}, 썸네일: ${folder.thumbnailPath}`);
                return {
                    name: folder.name,
                    path: folder.path,
                    isdir: true,
                    totalViews: folder.totalViews,
                    thumbnailPath: folder.thumbnailPath
                };
            });

        return NextResponse.json({
            success: true,
            data: {
                files: [...folders, ...videos],
            },
        }, {
            headers: {
                'Cache-Control': 'no-store, no-cache, must-revalidate, max-age=0',
            }
        });
    } catch (error: any) {
        console.error('API Error:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
