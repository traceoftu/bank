'use client';

import { useState, useEffect } from 'react';
import axios from 'axios';

interface FileItem {
    name: string;
    path: string;
    isdir: boolean;
    size?: number;
}

export default function FolderBrowser() {
    const [currentPath, setCurrentPath] = useState<string>(''); // Empty defaults to root env var
    const [items, setItems] = useState<FileItem[]>([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [playingUrl, setPlayingUrl] = useState<string | null>(null);

    const fetchItems = async (path: string) => {
        setLoading(true);
        setError(null);
        try {
            const response = await axios.get(`/api/videos/folders`, {
                params: { path: path || undefined }
            });
            console.log('API Response:', response.data);

            if (response.data.data?.files) {
                setItems(response.data.data.files);
            } else {
                setItems([]);
            }
        } catch (err: any) {
            console.error('Fetch error:', err);
            setError(err.response?.data?.error || err.message || 'Failed to load folders');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchItems(currentPath);
    }, [currentPath]);

    const handleFolderClick = (path: string) => {
        setCurrentPath(path);
    };

    const handleBackClick = () => {
        // Simple parent directory logic
        if (!currentPath) return; // Already at root (conceptually)

        // Check if we are at the "root" defined by env, if so, don't go back further?
        // For now, let's just split by '/' and pop.
        const parts = currentPath.split('/');
        parts.pop();
        const newPath = parts.join('/');
        // Check against env root path logic or just let API handle it? 
        // API uses 'path' param or defaults to env root. 
        // If we send empty string, API uses env root.
        // So if newPath is shorter than env root, we should probably send empty string?
        // Actually simpler: if we just navigated into subfolders, popping works.
        // If we are at the initial load state (empty string), we can't go back.

        // Better logic: store history or just rely on path.
        // If currentPath is empty, we are at root.
        // When we get the list, the items have full paths, e.g. "/video/church/2023"
        // So currentPath will become "/video/church/2023".

        // We need to know what the ROOT is to know when to stop going up.
        // Let's assume the first items we see are children of the root.

        setCurrentPath(newPath);
    };

    const handleVideoClick = (path: string) => {
        // Open video player
        const streamApiUrl = `/api/videos/stream?path=${encodeURIComponent(path)}`;
        setPlayingUrl(streamApiUrl);
    };

    return (
        <div className="w-full max-w-4xl mx-auto p-4">
            {playingUrl && (
                <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4">
                    <div className="bg-black w-full max-w-5xl rounded-lg overflow-hidden relative">
                        <button
                            onClick={() => setPlayingUrl(null)}
                            className="absolute top-4 right-4 text-white text-xl font-bold bg-gray-800 rounded-full w-10 h-10 flex items-center justify-center hover:bg-gray-700"
                        >
                            ✕
                        </button>
                        <video
                            src={playingUrl}
                            controls
                            autoPlay
                            className="w-full h-auto max-h-[80vh]"
                        />
                    </div>
                </div>
            )}

            <div className="flex justify-between items-center mb-6">
                <h2 className="text-xl font-semibold break-all">
                    {currentPath || 'Root'}
                </h2>
                {currentPath && (
                    <button
                        onClick={handleBackClick}
                        className="px-4 py-2 bg-gray-200 hover:bg-gray-300 rounded text-sm text-gray-800"
                    >
                        Back
                    </button>
                )}
            </div>

            {loading && <div className="text-center py-8">Loading...</div>}
            {error && <div className="text-center py-8 text-red-500">{error}</div>}

            {!loading && !error && (
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
                    {items.map((item) => (
                        <div
                            key={item.path}
                            onClick={() => item.isdir ? handleFolderClick(item.path) : handleVideoClick(item.path)}
                            className="p-4 border rounded-lg hover:shadow-lg transition-shadow cursor-pointer bg-white dark:bg-zinc-800 flex items-center gap-3"
                        >
                            <div className="text-2xl">
                                {item.isdir ? '📁' : '🎬'}
                            </div>
                            <div className="flex-1 min-w-0">
                                <p className="font-medium truncate">{item.name}</p>
                                {!item.isdir && (
                                    <p className="text-xs text-gray-500">
                                        {item.size ? (item.size / 1024 / 1024).toFixed(1) + ' MB' : ''}
                                    </p>
                                )}
                            </div>
                        </div>
                    ))}
                    {items.length === 0 && <div className="col-span-full text-center text-gray-400">No items found</div>}
                </div>
            )}
        </div>
    );
}
