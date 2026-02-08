'use client';

import { useState, useEffect, Suspense } from 'react';
import axios from 'axios';
import { useRouter, useSearchParams } from 'next/navigation';
import VideoCard from './VideoCard';

interface FileItem {
    name: string;
    path: string;
    isdir: boolean;
    size?: number;
}

interface PopularVideo {
    name: string;
    path: string;
    size: number;
    views: number;
}

function FolderBrowserContent() {
    const router = useRouter();
    const searchParams = useSearchParams();
    const currentPath = searchParams.get('path') || '';
    const searchQuery = searchParams.get('q') || '';

    const [items, setItems] = useState<FileItem[]>([]);
    const [popularVideos, setPopularVideos] = useState<PopularVideo[]>([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [playingUrl, setPlayingUrl] = useState<string | null>(null);
    const [playingPath, setPlayingPath] = useState<string | null>(null);
    const [isIOS, setIsIOS] = useState(false);

    useEffect(() => {
        // iOS 감지
        const checkIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);
        setIsIOS(checkIOS);
    }, []);

    const fetchItems = async (path: string, query: string) => {
        setLoading(true);
        setError(null);
        try {
            const params: any = {};
            if (query) {
                params.q = query;
            } else if (path) {
                params.path = path;
            }
            
            const response = await axios.get(`/api/videos/folders`, { params });
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

    // Fetch popular videos on home page
    const fetchPopularVideos = async () => {
        try {
            const response = await axios.get('/api/videos/popular');
            if (response.data.data?.videos) {
                setPopularVideos(response.data.data.videos);
            }
        } catch (err) {
            console.error('Failed to fetch popular videos:', err);
        }
    };

    useEffect(() => {
        fetchItems(currentPath, searchQuery);
        // Fetch popular videos only on home page
        if (!currentPath && !searchQuery) {
            fetchPopularVideos();
        }
    }, [currentPath, searchQuery]);

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

    const handleVideoClick = async (path: string) => {
        const streamApiUrl = `/api/videos/stream?path=${encodeURIComponent(path)}`;
        setPlayingUrl(streamApiUrl);
        setPlayingPath(path);
        
        // Increment view count
        try {
            await axios.post('/api/videos/views', { path });
        } catch (err) {
            console.error('Failed to increment view count:', err);
        }
    };

    return (
        <div className="w-full">
            {playingUrl && (
                <div 
                    className="fixed inset-0 z-50 flex items-center justify-center p-4 backdrop-blur-xl bg-black/60 animate-in fade-in duration-200"
                    onClick={() => {
                        setPlayingUrl(null);
                        setPlayingPath(null);
                    }}
                >
                    <div 
                        className="relative w-full max-w-5xl overflow-hidden bg-black rounded-2xl shadow-2xl ring-1 ring-white/10 group"
                        onClick={(e) => e.stopPropagation()}
                    >
                        <div className={`absolute top-4 right-4 z-50 flex items-center gap-2 transition-opacity ${isIOS ? '' : 'opacity-0 group-hover:opacity-100'}`}>
                            {/* iOS 전용 다운로드 버튼 */}
                            {isIOS && playingPath && (
                                <a
                                    href={`/api/videos/download?path=${encodeURIComponent(playingPath)}`}
                                    download
                                    className="flex items-center justify-center w-10 h-10 text-white transition-colors bg-zinc-800/50 hover:bg-zinc-700/80 rounded-full cursor-pointer backdrop-blur-md"
                                    aria-label="Download video"
                                >
                                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                                    </svg>
                                </a>
                            )}
                            {/* 닫기 버튼 */}
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
                            className="w-full h-auto max-h-[80vh] aspect-video bg-black"
                        />
                    </div>
                </div>
            )}

            {/* 브레드크럼 네비게이션 (홈이 아닐 때만 표시) */}
            {(currentPath || searchQuery) && (
                <div className="flex items-center justify-between mb-8">
                    <nav className="flex items-center text-sm font-medium text-zinc-400">
                        <span
                            className="cursor-pointer hover:text-white transition-colors"
                            onClick={() => router.push('/')}
                        >
                            홈
                        </span>
                        {searchQuery && (
                            <span className="flex items-center">
                                <span className="mx-2 text-zinc-600">/</span>
                                <span className="text-blue-400">검색: "{searchQuery}"</span>
                            </span>
                        )}
                        {!searchQuery && currentPath && currentPath.split('/').map((part, index, arr) => {
                            return (
                                <span key={index} className="flex items-center">
                                    <span className="mx-2 text-zinc-600">/</span>
                                    <span className="text-zinc-200">{part}</span>
                                </span>
                            )
                        })}
                    </nav>

                    <button
                        onClick={handleBackClick}
                        className="px-4 py-2 text-sm font-medium text-zinc-300 transition-colors bg-zinc-800/50 hover:bg-zinc-800 rounded-lg hover:text-white border border-white/5"
                    >
                        ← 뒤로
                    </button>
                </div>
            )}

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
                <>
                    {/* 인기 Top10 (홈 페이지에서만 표시) - 넷플릭스 스타일 */}
                    {!currentPath && !searchQuery && popularVideos.length > 0 && (
                        <div className="mb-10">
                            <h2 className="text-xl font-bold text-white mb-6">
                                오늘의 TOP 10
                            </h2>
                            <div className="flex gap-2 overflow-x-auto overflow-y-hidden pb-4 scrollbar-hide">
                                {popularVideos.map((video, index) => (
                                    <div key={video.path} className="relative flex-shrink-0 flex items-end">
                                        {/* 큰 순위 숫자 */}
                                        <div className="relative z-0 flex items-end justify-center w-16 sm:w-20">
                                            <span 
                                                className="text-[80px] sm:text-[100px] font-black leading-none select-none"
                                                style={{
                                                    color: 'transparent',
                                                    WebkitTextStroke: '3px #404040',
                                                    textShadow: '4px 4px 0 #000',
                                                }}
                                            >
                                                {index + 1}
                                            </span>
                                        </div>
                                        {/* 영상 카드 */}
                                        <div className="relative z-10 w-24 sm:w-28 -ml-4">
                                            <VideoCard
                                                name={video.name}
                                                path={video.path}
                                                size={video.size}
                                                viewCount={video.views}
                                                onPlay={handleVideoClick}
                                                vertical={true}
                                            />
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* 폴더 목록 */}
                    {items.filter(item => item.isdir).length > 0 && (
                        <div className="mb-8">
                            <h2 className="text-lg font-semibold text-zinc-300 mb-4">📁 폴더</h2>
                            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6">
                                {items.filter(item => item.isdir).map((item) => (
                                    <div
                                        key={item.path}
                                        onClick={() => handleFolderClick(item.path)}
                                        className="group flex items-center gap-3 p-3 rounded-lg bg-zinc-900/40 border border-white/5 hover:bg-zinc-800/60 hover:border-blue-500/30 cursor-pointer transition-all"
                                    >
                                        <span className="text-2xl">📁</span>
                                        <span className="text-sm font-medium text-zinc-300 truncate group-hover:text-white">
                                            {item.name}
                                        </span>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* 영상 목록 (넷플릭스 스타일) */}
                    {items.filter(item => !item.isdir).length > 0 && (
                        <div>
                            <h2 className="text-lg font-semibold text-zinc-300 mb-4">🎬 영상</h2>
                            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                                {items.filter(item => !item.isdir).map((item) => (
                                    <VideoCard
                                        key={item.path}
                                        name={item.name}
                                        path={item.path}
                                        size={item.size}
                                        onPlay={handleVideoClick}
                                    />
                                ))}
                            </div>
                        </div>
                    )}

                    {items.length === 0 && (
                        <div className="py-12 text-center text-zinc-500">
                            <p>No items found in this folder</p>
                        </div>
                    )}
                </>
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
