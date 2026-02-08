import { NextRequest, NextResponse } from 'next/server';
import { getRequestContext } from '@cloudflare/next-on-pages';
import { listR2Files } from '@/lib/r2';

export const runtime = 'edge';

// Get top 10 popular videos
export async function GET(request: NextRequest) {
    try {
        const { env } = getRequestContext();
        const kv = (env as any).VIEWS as KVNamespace;

        // Get all videos from R2
        const allFiles: { path: string; name: string; size: number; views: number }[] = [];
        
        // List all files recursively
        const bucket = (env as any).VIDEOS as R2Bucket;
        let cursor: string | undefined;

        do {
            const listed = await bucket.list({ cursor });

            for (const object of listed.objects) {
                if (!object.key.endsWith('/') && /\.(mp4|mkv|avi|mov|wmv|flv|webm)$/i.test(object.key)) {
                    const name = object.key.split('/').pop() || '';
                    let views = 0;
                    
                    if (kv) {
                        const viewCount = await kv.get(`views:${object.key}`);
                        views = viewCount ? parseInt(viewCount, 10) : 0;
                    }

                    allFiles.push({
                        path: object.key,
                        name,
                        size: object.size,
                        views,
                    });
                }
            }

            cursor = listed.truncated ? listed.cursor : undefined;
        } while (cursor);

        // Sort by views (descending) and take top 10
        const top10 = allFiles
            .sort((a, b) => b.views - a.views)
            .slice(0, 10);

        return NextResponse.json({
            success: true,
            data: {
                videos: top10,
            },
        });
    } catch (error: any) {
        console.error('Popular videos error:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
