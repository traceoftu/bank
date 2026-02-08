import axios from 'axios';

const SYNOLOGY_URL = process.env.SYNOLOGY_URL;
const SYNOLOGY_USER = process.env.SYNOLOGY_USER;
const SYNOLOGY_PASSWORD = process.env.SYNOLOGY_PASSWORD;

if (!SYNOLOGY_URL || !SYNOLOGY_USER || !SYNOLOGY_PASSWORD) {
    throw new Error('Missing Synology credentials in environment variables');
}

class SynologyClient {
    private sid: string | null = null;

    private async login() {
        try {
            const response = await axios.get(`${SYNOLOGY_URL}/webapi/auth.cgi`, {
                params: {
                    api: 'SYNO.API.Auth',
                    version: 3,
                    method: 'login',
                    account: SYNOLOGY_USER,
                    passwd: SYNOLOGY_PASSWORD,
                    session: 'FileStation',
                    format: 'cookie',
                },
                timeout: 10000, // 10s timeout
            });

            if (response.data.success) {
                this.sid = response.data.data.sid;
                console.log('Synology Login Successful');
            } else {
                console.error('Synology Login Failed:', response.data);
                throw new Error('Synology login failed');
            }
        } catch (error) {
            console.error('Synology Auth Error:', error);
            throw error;
        }
    }

    private async request(endpoint: string, params: any) {
        if (!this.sid) {
            await this.login();
        }

        try {
            // Retry once if SID is invalid
            let response = await axios.get(`${SYNOLOGY_URL}/webapi/${endpoint}`, {
                params: { ...params, _sid: this.sid },
            });

            if (response.data.error?.code === 105) { // Invalid Session
                console.log('Session expired, re-logging in...');
                await this.login();
                response = await axios.get(`${SYNOLOGY_URL}/webapi/${endpoint}`, {
                    params: { ...params, _sid: this.sid },
                });
            }

            return response.data;
        } catch (error) {
            console.error('Synology Request Error:', error);
            throw error;
        }
    }

    async listFolder(path: string) {
        return this.request('entry.cgi', {
            api: 'SYNO.FileStation.List',
            version: 2,
            method: 'list',
            folder_path: path,
            additional: 'real_path,size,owner,time,perm,type',
        });
    }

    async getFile(path: string) {
        // Get file details or stream
        return this.request('entry.cgi', {
            api: 'SYNO.FileStation.Download',
            version: 2,
            method: 'download',
            path: path,
            mode: 'open',
            _sid: this.sid
        });
    }

    async getSid() {
        if (!this.sid) {
            await this.login();
        }
        return this.sid;
    }
}

export const synologyClient = new SynologyClient();
