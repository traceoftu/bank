// Edge-compatible R2 client using native fetch with AWS Signature V4

const R2_ACCOUNT_ID = process.env.R2_ACCOUNT_ID!;
const R2_ACCESS_KEY_ID = process.env.R2_ACCESS_KEY_ID!;
const R2_SECRET_ACCESS_KEY = process.env.R2_SECRET_ACCESS_KEY!;
const R2_BUCKET_NAME = process.env.R2_BUCKET_NAME!;

const R2_ENDPOINT = `https://${R2_ACCOUNT_ID}.r2.cloudflarestorage.com`;

export interface R2File {
    name: string;
    path: string;
    size: number;
    modified: Date;
    isDirectory: boolean;
}

// AWS Signature V4 helper functions
async function hmacSha256(key: ArrayBuffer | string, message: string): Promise<ArrayBuffer> {
    const encoder = new TextEncoder();
    const keyData = typeof key === 'string' ? encoder.encode(key) : key;
    const cryptoKey = await crypto.subtle.importKey(
        'raw',
        keyData,
        { name: 'HMAC', hash: 'SHA-256' },
        false,
        ['sign']
    );
    return crypto.subtle.sign('HMAC', cryptoKey, encoder.encode(message));
}

async function sha256(message: string): Promise<string> {
    const encoder = new TextEncoder();
    const data = encoder.encode(message);
    const hash = await crypto.subtle.digest('SHA-256', data);
    return Array.from(new Uint8Array(hash))
        .map(b => b.toString(16).padStart(2, '0'))
        .join('');
}

function toHex(buffer: ArrayBuffer): string {
    return Array.from(new Uint8Array(buffer))
        .map(b => b.toString(16).padStart(2, '0'))
        .join('');
}

async function getSignatureKey(
    secretKey: string,
    dateStamp: string,
    region: string,
    service: string
): Promise<ArrayBuffer> {
    const kDate = await hmacSha256('AWS4' + secretKey, dateStamp);
    const kRegion = await hmacSha256(kDate, region);
    const kService = await hmacSha256(kRegion, service);
    return hmacSha256(kService, 'aws4_request');
}

async function signRequest(
    method: string,
    url: string,
    headers: Record<string, string>,
    payload: string = ''
): Promise<Record<string, string>> {
    const urlObj = new URL(url);
    const now = new Date();
    const amzDate = now.toISOString().replace(/[:-]|\.\d{3}/g, '');
    const dateStamp = amzDate.slice(0, 8);
    const region = 'auto';
    const service = 's3';

    const payloadHash = await sha256(payload);
    
    const signedHeaders: Record<string, string> = {
        ...headers,
        'host': urlObj.host,
        'x-amz-date': amzDate,
        'x-amz-content-sha256': payloadHash,
    };

    const sortedHeaderKeys = Object.keys(signedHeaders).sort();
    const canonicalHeaders = sortedHeaderKeys
        .map(k => `${k.toLowerCase()}:${signedHeaders[k].trim()}`)
        .join('\n');
    const signedHeadersStr = sortedHeaderKeys.map(k => k.toLowerCase()).join(';');

    const canonicalQueryString = urlObj.searchParams.toString();
    const canonicalUri = urlObj.pathname;

    const canonicalRequest = [
        method,
        canonicalUri,
        canonicalQueryString,
        canonicalHeaders + '\n',
        signedHeadersStr,
        payloadHash,
    ].join('\n');

    const credentialScope = `${dateStamp}/${region}/${service}/aws4_request`;
    const stringToSign = [
        'AWS4-HMAC-SHA256',
        amzDate,
        credentialScope,
        await sha256(canonicalRequest),
    ].join('\n');

    const signingKey = await getSignatureKey(R2_SECRET_ACCESS_KEY, dateStamp, region, service);
    const signature = toHex(await hmacSha256(signingKey, stringToSign));

    const authHeader = `AWS4-HMAC-SHA256 Credential=${R2_ACCESS_KEY_ID}/${credentialScope}, SignedHeaders=${signedHeadersStr}, Signature=${signature}`;

    return {
        ...signedHeaders,
        'Authorization': authHeader,
    };
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
        const headers = await signRequest('GET', url, {});

        const response = await fetch(url, { headers });
        
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
    const now = new Date();
    const amzDate = now.toISOString().replace(/[:-]|\.\d{3}/g, '');
    const dateStamp = amzDate.slice(0, 8);
    const region = 'auto';
    const service = 's3';

    const credentialScope = `${dateStamp}/${region}/${service}/aws4_request`;
    const credential = `${R2_ACCESS_KEY_ID}/${credentialScope}`;

    const params = new URLSearchParams({
        'X-Amz-Algorithm': 'AWS4-HMAC-SHA256',
        'X-Amz-Credential': credential,
        'X-Amz-Date': amzDate,
        'X-Amz-Expires': expiresIn.toString(),
        'X-Amz-SignedHeaders': 'host',
    });

    const encodedKey = filePath.split('/').map(encodeURIComponent).join('/');
    const canonicalUri = `/${R2_BUCKET_NAME}/${encodedKey}`;
    const host = `${R2_ACCOUNT_ID}.r2.cloudflarestorage.com`;

    const canonicalRequest = [
        'GET',
        canonicalUri,
        params.toString(),
        `host:${host}\n`,
        'host',
        'UNSIGNED-PAYLOAD',
    ].join('\n');

    const stringToSign = [
        'AWS4-HMAC-SHA256',
        amzDate,
        credentialScope,
        await sha256(canonicalRequest),
    ].join('\n');

    const signingKey = await getSignatureKey(R2_SECRET_ACCESS_KEY, dateStamp, region, service);
    const signature = toHex(await hmacSha256(signingKey, stringToSign));

    params.set('X-Amz-Signature', signature);

    return `${R2_ENDPOINT}${canonicalUri}?${params.toString()}`;
}

/**
 * Generate presigned URL for downloading video
 */
export async function getR2DownloadUrl(filePath: string, filename: string, expiresIn: number = 3600): Promise<string> {
    const now = new Date();
    const amzDate = now.toISOString().replace(/[:-]|\.\d{3}/g, '');
    const dateStamp = amzDate.slice(0, 8);
    const region = 'auto';
    const service = 's3';

    const credentialScope = `${dateStamp}/${region}/${service}/aws4_request`;
    const credential = `${R2_ACCESS_KEY_ID}/${credentialScope}`;

    const params = new URLSearchParams({
        'X-Amz-Algorithm': 'AWS4-HMAC-SHA256',
        'X-Amz-Credential': credential,
        'X-Amz-Date': amzDate,
        'X-Amz-Expires': expiresIn.toString(),
        'X-Amz-SignedHeaders': 'host',
        'response-content-disposition': `attachment; filename="${filename}"`,
    });

    const encodedKey = filePath.split('/').map(encodeURIComponent).join('/');
    const canonicalUri = `/${R2_BUCKET_NAME}/${encodedKey}`;
    const host = `${R2_ACCOUNT_ID}.r2.cloudflarestorage.com`;

    const canonicalRequest = [
        'GET',
        canonicalUri,
        params.toString(),
        `host:${host}\n`,
        'host',
        'UNSIGNED-PAYLOAD',
    ].join('\n');

    const stringToSign = [
        'AWS4-HMAC-SHA256',
        amzDate,
        credentialScope,
        await sha256(canonicalRequest),
    ].join('\n');

    const signingKey = await getSignatureKey(R2_SECRET_ACCESS_KEY, dateStamp, region, service);
    const signature = toHex(await hmacSha256(signingKey, stringToSign));

    params.set('X-Amz-Signature', signature);

    return `${R2_ENDPOINT}${canonicalUri}?${params.toString()}`;
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
        const headers = await signRequest('GET', url, {});

        const response = await fetch(url, { headers });
        
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
