'use client';

import { useState, useEffect, Suspense } from 'react';
import axios from 'axios';
import { useRouter, useSearchParams } from 'next/navigation';

interface FileItem {
    name: string;
    path: string;
    isdir: boolean;
    size?: number;
}

function FolderBrowserContent() {
    const router = useRouter();
    const searchParams = useSearchParams();
    const currentPath = searchParams.get('path') || '';

    const [items, setItems] = useState<FileItem[]>([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [playingUrl, setPlayingUrl] = useState<string | null>(null);
    const [playingPath, setPlayingPath] = useState<string | null>(null);

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
        router.push(`/?path=${encodeURIComponent(path)}`);
    };

    const handleBackClick = () => {
        if (!currentPath) return;

        const parts = currentPath.split('/');
        parts.pop();
        const newPath = parts.join('/');

        if (!newPath) {
            router.push('/');
        } else {
            router.push(`/?path=${encodeURIComponent(newPath)}`);
        }
    };

    const handleVideoClick = (path: string) => {
        const streamApiUrl = `/api/videos/stream?path=${encodeURIComponent(path)}`;
        setPlayingUrl(streamApiUrl);
        setPlayingPath(path);
    };

    return (
        <div className="w-full">
            {playingUrl && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 backdrop-blur-xl bg-black/60 animate-in fade-in duration-200">
                    <div className="relative w-full max-w-5xl overflow-hidden bg-black rounded-2xl shadow-2xl ring-1 ring-white/10 group">
                        <div className="absolute top-4 right-4 z-50 flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                            <button
                                onClick={() => {
                                    if (playingPath) {
                                        const encodedPath = playingPath.split('/').map(encodeURIComponent).join('/');
                                        const url = `https://pub-cb95174e25324c44a23457198e4de7c5.r2.dev/${encodedPath}`;
                                        const filename = playingPath.split('/').pop() || 'video.mp4';
                                        
                                        // Create a temporary link and trigger download
                                        const link = document.createElement('a');
                                        link.href = url;
                                        link.download = filename;
                                        link.target = '_blank';
                                        document.body.appendChild(link);
                                        link.click();
                                        document.body.removeChild(link);
                                    }
                                }}
                                className="flex items-center justify-center w-10 h-10 text-xl font-bold text-white transition-colors bg-zinc-800/50 hover:bg-blue-600/80 rounded-full cursor-pointer backdrop-blur-md"
                                title="Download Video"
                            >
                                ⬇️
                            </button>
                            <button
                                onClick={() => {
                                    setPlayingUrl(null);
                                    setPlayingPath(null);
                                }}
                                className="flex items-center justify-center w-10 h-10 text-xl font-bold text-white transition-colors bg-zinc-800/50 hover:bg-zinc-700/80 rounded-full cursor-pointer backdrop-blur-md"
                                aria-label="Close video"
                            >
                                ✕
                            </button>
                        </div>
                        <video
                            src={playingUrl}
                            controls
                            autoPlay
                            controlsList="nodownload"
                            className="w-full h-auto max-h-[80vh] aspect-video bg-black"
                        />
                    </div>
                </div>
            )}

            <div className="flex items-center justify-between mb-8">
                <nav className="flex items-center text-sm font-medium text-zinc-400">
                    <span
                        className={`cursor-pointer hover:text-white transition-colors ${!currentPath ? 'text-blue-400' : ''}`}
                        onClick={() => router.push('/')}
                    >
                        Root
                    </span>
                    {currentPath && currentPath.split('/').map((part, index, arr) => {
                        return (
                            <span key={index} className="flex items-center">
                                <span className="mx-2 text-zinc-600">/</span>
                                <span className="text-zinc-200">{part}</span>
                            </span>
                        )
                    })}
                </nav>

                {currentPath && (
                    <button
                        onClick={handleBackClick}
                        className="px-4 py-2 text-sm font-medium text-zinc-300 transition-colors bg-zinc-800/50 hover:bg-zinc-800 rounded-lg hover:text-white border border-white/5"
                    >
                        ← Back
                    </button>
                )}
            </div>

            {loading && (
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                    {[...Array(8)].map((_, i) => (
                        <div key={i} className="h-24 rounded-xl bg-zinc-900/50 animate-pulse ring-1 ring-white/5" />
                    ))}
                </div>
            )}

            {error && (
                <div className="p-4 text-center text-red-400 bg-red-950/20 rounded-xl border border-red-500/20">
                    {error}
                </div>
            )}

            {!loading && !error && (
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                    {items.map((item) => (
                        <div
                            key={item.path}
                            onClick={() => item.isdir ? handleFolderClick(item.path) : handleVideoClick(item.path)}
                            className="group relative flex items-center p-4 gap-4 overflow-hidden transition-all duration-200 bg-zinc-900/40 border border-white/5 rounded-xl hover:bg-zinc-800/60 hover:border-white/10 hover:shadow-xl hover:shadow-black/20 hover:-translate-y-0.5 cursor-pointer backdrop-blur-sm"
                        >
                            <div className={`flex items-center justify-center w-12 h-12 text-2xl rounded-lg ${item.isdir ? 'bg-blue-500/10 text-blue-400' : 'bg-rose-500/10 text-rose-400'}`}>
                                {item.isdir ? '📁' : '▶'}
                            </div>

                            <div className="flex-1 min-w-0">
                                <h3 className="font-medium text-zinc-200 truncate group-hover:text-white transition-colors">
                                    {item.name}
                                </h3>
                                {!item.isdir && (
                                    <p className="mt-1 text-xs text-zinc-500 font-mono">
                                        {item.size ? (item.size / 1024 / 1024).toFixed(1) + ' MB' : ''}
                                    </p>
                                )}
                            </div>

                            {!item.isdir && (
                                <div className="absolute right-4 opacity-0 group-hover:opacity-100 transition-opacity text-zinc-400">
                                    <svg className="w-5 h-5 fill-current" viewBox="0 0 24 24"><path d="M8 5v14l11-7z" /></svg>
                                </div>
                            )}
                        </div>
                    ))}
                    {items.length === 0 && (
                        <div className="col-span-full py-12 text-center text-zinc-500">
                            <p>No items found in this folder</p>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}

export default function FolderBrowser() {
    return (
        <Suspense fallback={<div className="text-center py-8 text-zinc-500">Loading...</div>}>
            <FolderBrowserContent />
        </Suspense>
    );
}
