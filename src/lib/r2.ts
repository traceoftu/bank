// Edge-compatible R2 client using aws4fetch
import { AwsClient } from 'aws4fetch';

const R2_ACCOUNT_ID = process.env.R2_ACCOUNT_ID!;
const R2_ACCESS_KEY_ID = process.env.R2_ACCESS_KEY_ID!;
const R2_SECRET_ACCESS_KEY = process.env.R2_SECRET_ACCESS_KEY!;
const R2_BUCKET_NAME = process.env.R2_BUCKET_NAME!;

const R2_ENDPOINT = `https://${R2_ACCOUNT_ID}.r2.cloudflarestorage.com`;

// Create aws4fetch client for R2
const r2 = new AwsClient({
    accessKeyId: R2_ACCESS_KEY_ID,
    secretAccessKey: R2_SECRET_ACCESS_KEY,
    service: 's3',
    region: 'auto',
});

export interface R2File {
    name: string;
    path: string;
    size: number;
    modified: Date;
    isDirectory: boolean;
}

/**
 * List files in R2 bucket
 */
export async function listR2Files(prefix: string = ''): Promise<R2File[]> {
    try {
        const params = new URLSearchParams({
            'list-type': '2',
            'delimiter': '/',
        });
        if (prefix) {
            params.set('prefix', prefix);
        }

        const url = `${R2_ENDPOINT}/${R2_BUCKET_NAME}?${params.toString()}`;
        const response = await r2.fetch(url);
        
        if (!response.ok) {
            throw new Error(`R2 API error: ${response.status} ${await response.text()}`);
        }

        const text = await response.text();
        const files: R2File[] = [];

        // Parse XML response manually (Edge-compatible)
        // Parse CommonPrefixes (directories)
        const prefixMatches = text.matchAll(/<CommonPrefixes><Prefix>([^<]+)<\/Prefix><\/CommonPrefixes>/g);
        for (const match of prefixMatches) {
            const prefixPath = match[1];
            const name = prefixPath.split('/').filter(Boolean).pop() || '';
            files.push({
                name,
                path: prefixPath,
                size: 0,
                modified: new Date(),
                isDirectory: true,
            });
        }

        // Parse Contents (files)
        const contentMatches = text.matchAll(/<Contents>[\s\S]*?<Key>([^<]+)<\/Key>[\s\S]*?<LastModified>([^<]+)<\/LastModified>[\s\S]*?<Size>([^<]+)<\/Size>[\s\S]*?<\/Contents>/g);
        for (const match of contentMatches) {
            const key = match[1];
            const lastModified = match[2];
            const size = parseInt(match[3], 10);
            
            if (!key.endsWith('/')) {
                const name = key.split('/').pop() || '';
                files.push({
                    name,
                    path: key,
                    size,
                    modified: new Date(lastModified),
                    isDirectory: false,
                });
            }
        }

        return files;
    } catch (error) {
        console.error('Error listing R2 files:', error);
        throw error;
    }
}

/**
 * Generate presigned URL for streaming video
 */
export async function getR2StreamUrl(filePath: string, expiresIn: number = 3600): Promise<string> {
    const encodedKey = filePath.split('/').map(encodeURIComponent).join('/');
    const url = `${R2_ENDPOINT}/${R2_BUCKET_NAME}/${encodedKey}`;
    
    const signedRequest = await r2.sign(url, {
        method: 'GET',
        aws: { signQuery: true },
    });
    
    return signedRequest.url;
}

/**
 * Generate presigned URL for downloading video
 */
export async function getR2DownloadUrl(filePath: string, filename: string, expiresIn: number = 3600): Promise<string> {
    const encodedKey = filePath.split('/').map(encodeURIComponent).join('/');
    const params = new URLSearchParams({
        'response-content-disposition': `attachment; filename="${filename}"`,
    });
    const url = `${R2_ENDPOINT}/${R2_BUCKET_NAME}/${encodedKey}?${params.toString()}`;
    
    const signedRequest = await r2.sign(url, {
        method: 'GET',
        aws: { signQuery: true },
    });
    
    return signedRequest.url;
}

/**
 * Search files in R2 bucket
 */
export async function searchR2Files(pattern: string): Promise<R2File[]> {
    try {
        const params = new URLSearchParams({
            'list-type': '2',
        });

        const url = `${R2_ENDPOINT}/${R2_BUCKET_NAME}?${params.toString()}`;
        const response = await r2.fetch(url);
        
        if (!response.ok) {
            throw new Error(`R2 API error: ${response.status} ${await response.text()}`);
        }

        const text = await response.text();
        const files: R2File[] = [];

        // Parse Contents (files)
        const contentMatches = text.matchAll(/<Contents>[\s\S]*?<Key>([^<]+)<\/Key>[\s\S]*?<LastModified>([^<]+)<\/LastModified>[\s\S]*?<Size>([^<]+)<\/Size>[\s\S]*?<\/Contents>/g);
        for (const match of contentMatches) {
            const key = match[1];
            const lastModified = match[2];
            const size = parseInt(match[3], 10);
            
            if (!key.endsWith('/')) {
                const name = key.split('/').pop() || '';
                if (name.toLowerCase().includes(pattern.toLowerCase())) {
                    files.push({
                        name,
                        path: key,
                        size,
                        modified: new Date(lastModified),
                        isDirectory: false,
                    });
                }
            }
        }

        return files;
    } catch (error) {
        console.error('Error searching R2 files:', error);
        throw error;
    }
}
