// R2 client using Cloudflare Bindings (no signature required)
import { getRequestContext } from '@cloudflare/next-on-pages';

export interface R2File {
    name: string;
    path: string;
    size: number;
    modified: Date;
    isDirectory: boolean;
}

// Get R2 bucket from Cloudflare bindings
function getR2Bucket(): R2Bucket {
    const { env } = getRequestContext();
    return (env as any).VIDEOS as R2Bucket;
}

/**
 * List files in R2 bucket
 */
export async function listR2Files(prefix: string = ''): Promise<R2File[]> {
    try {
        const bucket = getR2Bucket();
        const listed = await bucket.list({
            prefix: prefix || undefined,
            delimiter: '/',
        });

        const files: R2File[] = [];

        // Add directories (delimitedPrefixes)
        if (listed.delimitedPrefixes) {
            for (const prefixPath of listed.delimitedPrefixes) {
                const name = prefixPath.split('/').filter(Boolean).pop() || '';
                files.push({
                    name,
                    path: prefixPath,
                    size: 0,
                    modified: new Date(),
                    isDirectory: true,
                });
            }
        }

        // Add files (objects)
        for (const object of listed.objects) {
            if (!object.key.endsWith('/')) {
                const name = object.key.split('/').pop() || '';
                files.push({
                    name,
                    path: object.key,
                    size: object.size,
                    modified: object.uploaded,
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
 * Get file from R2 and return Response for streaming
 */
export async function getR2Object(filePath: string): Promise<R2ObjectBody | null> {
    const bucket = getR2Bucket();
    return bucket.get(filePath);
}

/**
 * Search files in R2 bucket
 */
export async function searchR2Files(pattern: string): Promise<R2File[]> {
    try {
        const bucket = getR2Bucket();
        const listed = await bucket.list();

        const files: R2File[] = [];

        for (const object of listed.objects) {
            if (!object.key.endsWith('/')) {
                const name = object.key.split('/').pop() || '';
                if (name.toLowerCase().includes(pattern.toLowerCase())) {
                    files.push({
                        name,
                        path: object.key,
                        size: object.size,
                        modified: object.uploaded,
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
