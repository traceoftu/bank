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

        // 조회수 데이터 가져오기
        const viewCounts = new Map<string, number>();
        for (const file of filteredFiles) {
            if (!file.isdir) {
                const viewKey = `views:${file.path}`;
                const viewData = await kv.get(viewKey);
                viewCounts.set(file.path, viewData ? parseInt(viewData as string) : 0);
            }
        }

        for (const file of filteredFiles) {
            const relativePath = path ? file.path.replace(path + '/', '') : file.path;
            const parts = relativePath.split('/');
            
            if (parts.length > 1) {
                // 하위 폴더가 있음
                const folderName = parts[0];
                const folderPath = path ? `${path}/${folderName}` : folderName;
                
                if (!folderMap.has(folderPath)) {
                    folderMap.set(folderPath, {
                        name: folderName,
                        path: folderPath,
                        totalViews: 0,
                        thumbnailPath: ''
                    });
                }
                
                // 폴더 내 영상 조회수 집계
                if (!file.isdir) {
                    const folderInfo = folderMap.get(folderPath)!;
                    folderInfo.totalViews += viewCounts.get(file.path) || 0;
                    
                    // 가장 조회수 많은 영상을 썸네일로 설정
                    if (!folderInfo.thumbnailPath || viewCounts.get(file.path)! > viewCounts.get(folderInfo.thumbnailPath)!) {
                        folderInfo.thumbnailPath = file.path;
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
            .map(folder => ({
                name: folder.name,
                path: folder.path,
                isdir: true,
                totalViews: folder.totalViews,
                thumbnailPath: folder.thumbnailPath
            }));

        return NextResponse.json({
            success: true,
            data: {
                files: [...folders, ...videos],
            },
        });
    } catch (error: any) {
        console.error('API Error:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
