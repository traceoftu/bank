import { NextRequest, NextResponse } from 'next/server';
import { listR2Files, searchR2Files } from '@/lib/r2';

export const runtime = 'edge';

export async function GET(request: NextRequest) {
    const searchParams = request.nextUrl.searchParams;
    const path = searchParams.get('path') || '';
    const query = searchParams.get('q');

    try {
        let files;

        if (query) {
            // Search mode
            files = await searchR2Files(query);
        } else {
            // List mode
            files = await listR2Files(path);
        }

        // Transform R2 files to match expected format
        const folders = files
            .filter(f => f.isDirectory)
            .map(f => ({
                name: f.name,
                path: f.path,
                isdir: true,
            }));

        const videos = files
            .filter(f => !f.isDirectory && /\.(mp4|mkv|avi|mov|wmv|flv|webm)$/i.test(f.name))
            .map(f => ({
                name: f.name,
                path: f.path,
                isdir: false,
                additional: {
                    size: f.size,
                    time: {
                        mtime: Math.floor(f.modified.getTime() / 1000),
                    },
                },
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
