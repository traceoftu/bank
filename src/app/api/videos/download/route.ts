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
        const encodedPath = path.split('/').map(encodeURIComponent).join('/');
        const downloadUrl = `${R2_PUBLIC_URL}/${encodedPath}`;
        
        return NextResponse.redirect(downloadUrl);
    } catch (error: any) {
        console.error('Download Error:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
