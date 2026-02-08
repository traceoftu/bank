import { S3Client, ListObjectsV2Command, GetObjectCommand, PutObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';

const R2_ACCOUNT_ID = process.env.R2_ACCOUNT_ID!;
const R2_ACCESS_KEY_ID = process.env.R2_ACCESS_KEY_ID!;
const R2_SECRET_ACCESS_KEY = process.env.R2_SECRET_ACCESS_KEY!;
const R2_BUCKET_NAME = process.env.R2_BUCKET_NAME!;

// Create S3 client configured for Cloudflare R2
const r2Client = new S3Client({
    region: 'auto',
    endpoint: `https://${R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
    credentials: {
        accessKeyId: R2_ACCESS_KEY_ID,
        secretAccessKey: R2_SECRET_ACCESS_KEY,
    },
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
        const command = new ListObjectsV2Command({
            Bucket: R2_BUCKET_NAME,
            Prefix: prefix,
            Delimiter: '/',
        });

        const response = await r2Client.send(command);
        const files: R2File[] = [];

        // Add directories (CommonPrefixes)
        if (response.CommonPrefixes) {
            for (const prefix of response.CommonPrefixes) {
                if (prefix.Prefix) {
                    const name = prefix.Prefix.split('/').filter(Boolean).pop() || '';
                    files.push({
                        name,
                        path: prefix.Prefix,
                        size: 0,
                        modified: new Date(),
                        isDirectory: true,
                    });
                }
            }
        }

        // Add files (Contents)
        if (response.Contents) {
            for (const item of response.Contents) {
                if (item.Key && !item.Key.endsWith('/')) {
                    const name = item.Key.split('/').pop() || '';
                    files.push({
                        name,
                        path: item.Key,
                        size: item.Size || 0,
                        modified: item.LastModified || new Date(),
                        isDirectory: false,
                    });
                }
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
    try {
        const command = new GetObjectCommand({
            Bucket: R2_BUCKET_NAME,
            Key: filePath,
        });

        const url = await getSignedUrl(r2Client, command, { expiresIn });
        return url;
    } catch (error) {
        console.error('Error generating R2 stream URL:', error);
        throw error;
    }
}

/**
 * Generate presigned URL for downloading video
 */
export async function getR2DownloadUrl(filePath: string, filename: string, expiresIn: number = 3600): Promise<string> {
    try {
        const command = new GetObjectCommand({
            Bucket: R2_BUCKET_NAME,
            Key: filePath,
            ResponseContentDisposition: `attachment; filename="${filename}"`,
        });

        const url = await getSignedUrl(r2Client, command, { expiresIn });
        return url;
    } catch (error) {
        console.error('Error generating R2 download URL:', error);
        throw error;
    }
}

/**
 * Search files in R2 bucket
 */
export async function searchR2Files(pattern: string): Promise<R2File[]> {
    try {
        const command = new ListObjectsV2Command({
            Bucket: R2_BUCKET_NAME,
        });

        const response = await r2Client.send(command);
        const files: R2File[] = [];

        if (response.Contents) {
            for (const item of response.Contents) {
                if (item.Key && !item.Key.endsWith('/')) {
                    const name = item.Key.split('/').pop() || '';
                    // Simple pattern matching (case-insensitive)
                    if (name.toLowerCase().includes(pattern.toLowerCase())) {
                        files.push({
                            name,
                            path: item.Key,
                            size: item.Size || 0,
                            modified: item.LastModified || new Date(),
                            isDirectory: false,
                        });
                    }
                }
            }
        }

        return files;
    } catch (error) {
        console.error('Error searching R2 files:', error);
        throw error;
    }
}

/**
 * Check if file exists in R2
 */
export async function fileExistsInR2(filePath: string): Promise<boolean> {
    try {
        const command = new GetObjectCommand({
            Bucket: R2_BUCKET_NAME,
            Key: filePath,
        });

        await r2Client.send(command);
        return true;
    } catch (error: any) {
        if (error.name === 'NoSuchKey') {
            return false;
        }
        throw error;
    }
}
