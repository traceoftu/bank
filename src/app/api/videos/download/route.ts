import { NextRequest, NextResponse } from 'next/server';

export const runtime = 'edge';

const R2_PUBLIC_URL = 'https://pub-cb95174e25324c44a23457198e4de7c5.r2.dev';

export async function GET(request: NextRequest) {
    const searchParams = request.nextUrl.searchParams;
    const path = searchParams.get('path');

    if (!path) {
        return NextResponse.json({ error: 'Path required' }, { status: 400 });
    }

    try {
        // Redirect to R2 public URL for download
        const encodedPath = path.split('/').map(encodeURIComponent).join('/');
        const downloadUrl = `${R2_PUBLIC_URL}/${encodedPath}`;
        
        return NextResponse.redirect(downloadUrl);
    } catch (error: any) {
        console.error('Download Error:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
