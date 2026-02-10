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

interface CategoryVideos {
    category: string;
    path: string;
    videos: PopularVideo[];
}

const CATEGORIES = [
    { name: '성인', path: '성인' },
    { name: '은장회', path: '은장회' },
    { name: '청년회', path: '청년회' },
    { name: '중고등부', path: '중고등부' },
    { name: '초등부', path: '초등부' },
    { name: '생활&특별&기타', path: '생활&특별&기타' },
];

function CategoryRow({ category, path, videos, onVideoClick, onHeaderClick }: {
    category: string;
    path: string;
    videos: PopularVideo[];
    onVideoClick: (path: string) => void;
    onHeaderClick: (path: string) => void;
}) {
    if (videos.length === 0) return null;

    return (
        <div className="mb-10 last:mb-0">
            <h2
                className="text-xl font-bold text-white mb-4 flex items-center gap-2 cursor-pointer hover:text-blue-400 transition-colors group"
                onClick={() => onHeaderClick(path)}
            >
                {category}
                <span className="text-sm font-normal text-zinc-500 group-hover:translate-x-1 transition-transform">모두 보기 ›</span>
            </h2>
            <div className="flex gap-4 overflow-x-auto overflow-y-hidden pb-4 scrollbar-hide -mx-2 px-2">
                {videos.map((video) => (
                    <div key={video.path} className="flex-shrink-0 w-44 sm:w-56">
                        <VideoCard
                            name={video.name}
                            path={video.path}
                            size={video.size}
                            viewCount={video.views}
                            onPlay={onVideoClick}
                        />
                    </div>
                ))}
            </div>
        </div>
    );
}

function FolderBrowserContent() {
    const router = useRouter();
    const searchParams = useSearchParams();
    const currentPath = searchParams.get('path') || '';
    const searchQuery = searchParams.get('q') || '';
    const playParam = searchParams.get('play') || '';

    const [items, setItems] = useState<FileItem[]>([]);
    const [popularVideos, setPopularVideos] = useState<PopularVideo[]>([]);
    const [categoryData, setCategoryData] = useState<CategoryVideos[]>([]);
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

    // 공유 링크로 접속 시 자동 재생
    useEffect(() => {
        if (playParam) {
            const streamApiUrl = `/api/videos/stream?path=${encodeURIComponent(playParam)}`;
            setPlayingUrl(streamApiUrl);
            setPlayingPath(playParam);
            // 조회수 증가
            axios.post('/api/videos/views', { path: playParam }).catch(console.error);
            // URL에서 play 파라미터 제거
            router.replace('/', { scroll: false });
        }
    }, [playParam]);

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

            if (response.data.data?.files) {
                // 특정 순서로 폴더 정렬
                const priority = ['성인', '은장회', '청년회', '중고등부', '초등부', '생활&특별&기타'];
                const sortedFiles = [...response.data.data.files].sort((a, b) => {
                    if (a.isdir && b.isdir) {
                        const indexA = priority.indexOf(a.name);
                        const indexB = priority.indexOf(b.name);
                        if (indexA !== -1 && indexB !== -1) return indexA - indexB;
                        if (indexA !== -1) return -1;
                        if (indexB !== -1) return 1;
                    }
                    return a.name.localeCompare(b.name);
                });
                setItems(sortedFiles);
            } else {
                setItems([]);
            }
        } catch (err: any) {
            setError(err.response?.data?.error || err.message || 'Failed to load folders');
        } finally {
            setLoading(false);
        }
    };

    // Fetch popular videos for home page
    const fetchHomeData = async () => {
        try {
            // Global Top 10
            const popularRes = await axios.get('/api/videos/popular');
            if (popularRes.data.data?.videos) {
                setPopularVideos(popularRes.data.data.videos);
            }

            // Categories
            const categoryResults = await Promise.all(
                CATEGORIES.map(async (cat) => {
                    try {
                        const res = await axios.get(`/api/videos/popular?path=${encodeURIComponent(cat.path)}`);
                        return {
                            category: cat.name,
                            path: cat.path,
                            videos: res.data.data?.videos || []
                        };
                    } catch (e) {
                        return { category: cat.name, path: cat.path, videos: [] };
                    }
                })
            );
            setCategoryData(categoryResults);
        } catch (err) {
            console.error('Failed to fetch home data:', err);
        }
    };

    useEffect(() => {
        fetchItems(currentPath, searchQuery);
        if (!currentPath && !searchQuery) {
            fetchHomeData();
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
                            {playingPath && (
                                <button
                                    onClick={async () => {
                                        const videoName = playingPath.split('/').pop() || '영상';
                                        const shareUrl = `${window.location.origin}/?play=${encodeURIComponent(playingPath)}`;
                                        const canShare = typeof navigator.share === 'function' &&
                                            (typeof navigator.canShare !== 'function' || navigator.canShare({ url: shareUrl }));

                                        if (canShare) {
                                            try {
                                                await navigator.share({
                                                    title: videoName,
                                                    text: `${videoName} - JBCH Word Bank`,
                                                    url: shareUrl,
                                                });
                                            } catch (err: any) {
                                                if (err.name !== 'AbortError') {
                                                    await navigator.clipboard.writeText(shareUrl);
                                                    alert('링크가 복사되었습니다!');
                                                }
                                            }
                                        } else {
                                            await navigator.clipboard.writeText(shareUrl);
                                            alert('링크가 복사되었습니다!');
                                        }
                                    }}
                                    className="flex items-center justify-center w-10 h-10 text-white transition-colors bg-zinc-800/50 hover:bg-zinc-700/80 rounded-full cursor-pointer backdrop-blur-md"
                                    aria-label="Share video"
                                >
                                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z" />
                                    </svg>
                                </button>
                            )}
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
                        {!searchQuery && currentPath && currentPath.split('/').map((part, index) => (
                            <span key={index} className="flex items-center">
                                <span className="mx-2 text-zinc-600">/</span>
                                <span className="text-zinc-200">{part}</span>
                            </span>
                        ))}
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
                    {!currentPath && !searchQuery && (
                        <>
                            {popularVideos.length > 0 && (
                                <div className="mb-14">
                                    <h2 className="text-2xl font-bold text-white mb-6">
                                        오늘의 TOP 10
                                    </h2>
                                    <div className="flex gap-3 overflow-x-auto overflow-y-hidden pb-4 scrollbar-hide">
                                        {popularVideos.map((video, index) => (
                                            <div key={video.path} className="relative flex-shrink-0 flex items-end">
                                                <div className="relative z-0 flex items-end justify-center w-12 sm:w-16">
                                                    <span
                                                        className="text-[100px] sm:text-[140px] font-black leading-none select-none"
                                                        style={{
                                                            color: 'transparent',
                                                            WebkitTextStroke: '3px #404040',
                                                            textShadow: '4px 4px 0 #000',
                                                        }}
                                                    >
                                                        {index + 1}
                                                    </span>
                                                </div>
                                                <div className="relative z-10 w-32 sm:w-40 -ml-3">
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

                            {categoryData.map((row) => (
                                <CategoryRow
                                    key={row.category}
                                    category={row.category}
                                    path={row.path}
                                    videos={row.videos}
                                    onVideoClick={handleVideoClick}
                                    onHeaderClick={handleFolderClick}
                                />
                            ))}
                        </>
                    )}

                    {items.filter(item => item.isdir).length > 0 && (
                        <div className="mb-10">
                            <h2 className="text-xl font-bold text-white mb-4">📁 카테고리</h2>
                            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6">
                                {items.filter(item => item.isdir).map((item) => (
                                    <div
                                        key={item.path}
                                        onClick={() => handleFolderClick(item.path)}
                                        className="group flex items-center gap-3 p-4 rounded-xl bg-zinc-900/40 border border-white/5 hover:bg-zinc-800/60 hover:border-blue-500/30 cursor-pointer transition-all"
                                    >
                                        <span className="text-3xl text-blue-400 group-hover:scale-110 transition-transform">📁</span>
                                        <div className="flex flex-col">
                                            <span className="text-sm font-semibold text-zinc-100 truncate group-hover:text-blue-400 transition-colors">
                                                {item.name}
                                            </span>
                                            <span className="text-xs text-zinc-500">탐색하기 ›</span>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    {items.filter(item => !item.isdir).length > 0 && (
                        <div>
                            <h2 className="text-xl font-bold text-white mb-4">🎬 영상 목록</h2>
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

                    {items.length === 0 && !(!currentPath && !searchQuery) && (
                        <div className="py-20 text-center text-zinc-500 flex flex-col items-center">
                            <span className="text-5xl mb-4">🔍</span>
                            <p>표시할 항목이 없습니다.</p>
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
