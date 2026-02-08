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
 * Search files in R2 bucket (searches in filename and full path)
 */
export async function searchR2Files(pattern: string): Promise<R2File[]> {
    try {
        const bucket = getR2Bucket();
        const files: R2File[] = [];
        let cursor: string | undefined;
        const searchPattern = pattern.toLowerCase();

        // Paginate through all objects
        do {
            const listed = await bucket.list({ cursor });

            for (const object of listed.objects) {
                if (!object.key.endsWith('/')) {
                    const name = object.key.split('/').pop() || '';
                    const fullPath = object.key.toLowerCase();
                    
                    // Search in both filename and full path
                    if (name.toLowerCase().includes(searchPattern) || fullPath.includes(searchPattern)) {
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

            cursor = listed.truncated ? listed.cursor : undefined;
        } while (cursor);

        return files;
    } catch (error) {
        console.error('Error searching R2 files:', error);
        throw error;
    }
}
