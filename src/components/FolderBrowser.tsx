'use client';

import React, { useState, useEffect, Suspense, useRef, useCallback } from 'react';
import axios from 'axios';
import { useRouter, useSearchParams } from 'next/navigation';
import Hls from 'hls.js';
import VideoCard from './VideoCard';
import { InlineAdCard } from './ads';

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

// 카테고리 표시 순서 (이 목록에 없는 폴더는 마지막에 가나다순으로 표시)
const CATEGORY_ORDER = ['성인', '은장회', '청년회', '중고등부', '초등부', '생활&특별&기타'];

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
    const [showShareModal, setShowShareModal] = useState(false);
    const [canCast, setCanCast] = useState(false);
    const [isMp4Mode, setIsMp4Mode] = useState(false);
    const videoRef = useRef<HTMLVideoElement>(null);
    const hlsRef = useRef<Hls | null>(null);

    useEffect(() => {
        // iOS 감지
        const checkIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);
        setIsIOS(checkIOS);
    }, []);

    // HLS 재생 처리
    useEffect(() => {
        const video = videoRef.current;
        if (!video || !playingUrl) return;

        // 이전 HLS 인스턴스 정리
        if (hlsRef.current) {
            hlsRef.current.destroy();
            hlsRef.current = null;
        }

        const isHlsUrl = playingUrl.endsWith('.m3u8') || playingUrl.includes('.m3u8');

        if (isHlsUrl && Hls.isSupported()) {
            // HLS.js로 재생 (Android, Desktop)
            const hls = new Hls({
                maxBufferLength: 30,
                maxMaxBufferLength: 60,
            });
            hlsRef.current = hls;
            hls.loadSource(playingUrl);
            hls.attachMedia(video);
            hls.on(Hls.Events.MANIFEST_PARSED, () => {
                video.play().catch(() => {});
            });
            hls.on(Hls.Events.ERROR, (_event, data) => {
                if (data.fatal) {
                    console.error('HLS fatal error, falling back to MP4');
                    hls.destroy();
                    hlsRef.current = null;
                    // 폴백: 원본 MP4로 재생
                    if (playingPath) {
                        const mp4Encoded = playingPath.split('/').map(encodeURIComponent).join('/');
                        video.src = `https://videos.haebomsoft.com/${mp4Encoded}`;
                        video.play().catch(() => {});
                    }
                }
            });
        } else if (isHlsUrl && video.canPlayType('application/vnd.apple.mpegurl')) {
            // iOS Safari 네이티브 HLS 지원
            video.src = playingUrl;
            video.play().catch(() => {});
        } else {
            // 일반 MP4
            video.src = playingUrl;
            video.play().catch(() => {});
        }

        return () => {
            if (hlsRef.current) {
                hlsRef.current.destroy();
                hlsRef.current = null;
            }
        };
    }, [playingUrl]);

    // Remote Playback API 지원 확인 및 캐스팅 기능
    useEffect(() => {
        const video = videoRef.current;
        if (!video) return;

        // Remote Playback API 지원 확인
        if ('remote' in video) {
            const remote = (video as any).remote;
            remote.watchAvailability((available: boolean) => {
                setCanCast(available);
            }).catch(() => {
                // watchAvailability 지원 안 함
                setCanCast(false);
            });
        }
    }, [playingUrl]);

    const handleCast = useCallback(async () => {
        const video = videoRef.current;
        if (!video || !playingPath) return;

        // HLS 중지 → MP4 전환 (Remote Playback은 MP4에서만 동작)
        if (hlsRef.current) {
            hlsRef.current.destroy();
            hlsRef.current = null;
        }
        const currentTime = video.currentTime;
        const mp4Encoded = playingPath.split('/').map(encodeURIComponent).join('/');
        video.src = `https://videos.haebomsoft.com/${mp4Encoded}`;
        video.currentTime = currentTime;

        // MP4 로드 후 Remote Playback prompt
        if ('remote' in video) {
            try {
                const remote = (video as any).remote;
                await remote.prompt();
            } catch (err) {
                console.error('Cast error:', err);
            }
        }
        video.play().catch(() => {});
    }, [playingPath]);

    // 공유 링크로 접속 시 자동 재생
    useEffect(() => {
        if (playParam) {
            setPlayingPath(playParam);
            // 항상 HLS URL로 설정 (HEAD 요청 제거)
            const dir = playParam.substring(0, playParam.lastIndexOf('/'));
            const filename = playParam.substring(playParam.lastIndexOf('/') + 1);
            const nameWithoutExt = filename.replace(/\.[^.]+$/, '');
            const hlsPath = `${dir}/hls/${nameWithoutExt}/index.m3u8`;
            const hlsEncodedPath = hlsPath.split('/').map(encodeURIComponent).join('/');
            setPlayingUrl(`https://videos.haebomsoft.com/${hlsEncodedPath}`);

            // 조회수 증가 (중복 방지)
            incrementViewIfNeeded(playParam);
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

    // Fetch popular videos for home page - 단일 API 호출로 최적화
    const fetchHomeData = async () => {
        try {
            const res = await axios.get('/api/videos/home');
            if (res.data.data) {
                setPopularVideos(res.data.data.top10 || []);
                setCategoryData(res.data.data.categories || []);
            }
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

    const incrementViewIfNeeded = useCallback(async (path: string) => {
        try {
            const COOLDOWN = 5 * 60 * 1000; // 5분
            const storageKey = `viewed:${path}`;
            const lastViewed = localStorage.getItem(storageKey);
            if (lastViewed && Date.now() - parseInt(lastViewed, 10) < COOLDOWN) return;
            localStorage.setItem(storageKey, Date.now().toString());
            await axios.post('/api/videos/views', { path });
        } catch (err) {
            console.error('Failed to increment view count:', err);
        }
    }, []);

    const handleVideoClick = async (path: string) => {
        setPlayingPath(path);

        // 조회수 증가 (비동기, 독립 실행)
        incrementViewIfNeeded(path);

        // 항상 HLS URL로 설정 (HEAD 요청 제거 → 비용 절감)
        // HLS 로딩 실패 시 hls.js 에러 핸들러에서 MP4로 자동 폴백
        const dir = path.substring(0, path.lastIndexOf('/'));
        const filename = path.substring(path.lastIndexOf('/') + 1);
        const nameWithoutExt = filename.replace(/\.[^.]+$/, '');
        const hlsPath = `${dir}/hls/${nameWithoutExt}/index.m3u8`;
        const hlsEncodedPath = hlsPath.split('/').map(encodeURIComponent).join('/');
        const hlsUrl = `https://videos.haebomsoft.com/${hlsEncodedPath}`;
        setPlayingUrl(hlsUrl);
    };

    return (
        <div className="w-full">
            {playingUrl && (
                <div
                    className="fixed inset-0 z-50 flex items-center justify-center p-4 backdrop-blur-xl bg-black/60 animate-in fade-in duration-200"
                    onClick={() => {
                        if (hlsRef.current) {
                            hlsRef.current.destroy();
                            hlsRef.current = null;
                        }
                        setPlayingUrl(null);
                        setPlayingPath(null);
                        setIsMp4Mode(false);
                    }}
                >
                    <div
                        className="relative w-full max-w-5xl overflow-hidden bg-black rounded-2xl shadow-2xl ring-1 ring-white/10 group"
                        onClick={(e) => e.stopPropagation()}
                    >
                        <div className="absolute top-4 right-4 z-50 flex items-center gap-2 transition-opacity sm:opacity-0 sm:group-hover:opacity-100">
                            {playingPath && (
                                <button
                                    onClick={() => setShowShareModal(true)}
                                    className="flex items-center justify-center w-10 h-10 text-white transition-colors bg-zinc-800/50 hover:bg-zinc-700/80 rounded-full cursor-pointer backdrop-blur-md"
                                    aria-label="Share video"
                                >
                                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z" />
                                    </svg>
                                </button>
                            )}
                            {/* TV로 캐스팅 버튼 */}
                            {playingPath && (
                                <button
                                    onClick={handleCast}
                                    className="flex items-center justify-center w-10 h-10 text-white transition-colors bg-zinc-800/50 hover:bg-zinc-700/80 rounded-full cursor-pointer backdrop-blur-md"
                                    aria-label="Cast to TV"
                                >
                                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.25 3v1.5M4.5 8.25H3m18 0h-1.5M4.5 12H3m18 0h-1.5m-15 3.75H3m18 0h-1.5M8.25 19.5V21M12 3v1.5m0 15V21m3.75-18v1.5m0 15V21m-9-1.5h10.5a2.25 2.25 0 002.25-2.25V6.75a2.25 2.25 0 00-2.25-2.25H6.75A2.25 2.25 0 004.5 6.75v10.5a2.25 2.25 0 002.25 2.25z" />
                                    </svg>
                                </button>
                            )}
                            {playingPath && (
                                <button
                                    onClick={() => {
                                        const video = videoRef.current;
                                        if (!video) return;
                                        const mp4Encoded = playingPath.split('/').map(encodeURIComponent).join('/');
                                        const mp4Url = `https://videos.haebomsoft.com/${mp4Encoded}`;
                                        if (hlsRef.current) {
                                            // HLS.js → MP4 전환 (Android, Desktop)
                                            hlsRef.current.destroy();
                                            hlsRef.current = null;
                                            const currentTime = video.currentTime;
                                            video.src = mp4Url;
                                            video.currentTime = currentTime;
                                            setIsMp4Mode(true);
                                            alert('MP4로 전환되었습니다.\n영상 하단 ⋮ 메뉴에서 다운로드/전송할 수 있습니다.');
                                            video.play().catch(() => {});
                                        } else if (isIOS) {
                                            // iOS: 네이티브 HLS → MP4 전환 + 새 탭 다운로드
                                            const currentTime = video.currentTime;
                                            video.src = mp4Url;
                                            video.currentTime = currentTime;
                                            video.play().catch(() => {});
                                            setIsMp4Mode(true);
                                            window.open(`/api/videos/download?path=${encodeURIComponent(playingPath)}`, '_blank');
                                        } else if (isMp4Mode) {
                                            // 이미 MP4 전환됨 → 안내 반복
                                            setTimeout(() => alert('이미 MP4로 전환되었습니다.\n영상 하단 ⋮ 메뉴에서 다운로드/전송할 수 있습니다.'), 100);
                                        }
                                    }}
                                    className={`flex items-center justify-center w-10 h-10 text-white transition-colors rounded-full cursor-pointer backdrop-blur-md ${isMp4Mode ? 'bg-green-600/80 hover:bg-green-500/80' : 'bg-zinc-800/50 hover:bg-zinc-700/80'}`}
                                    aria-label="Download video"
                                >
                                    {isMp4Mode ? (
                                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                                        </svg>
                                    ) : (
                                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                                        </svg>
                                    )}
                                </button>
                            )}
                            <button
                                onClick={() => {
                                    if (hlsRef.current) {
                                        hlsRef.current.destroy();
                                        hlsRef.current = null;
                                    }
                                    setPlayingUrl(null);
                                    setPlayingPath(null);
                                    setIsMp4Mode(false);
                                }}
                                className="flex items-center justify-center w-10 h-10 text-xl font-bold text-white transition-colors bg-zinc-800/50 hover:bg-zinc-700/80 rounded-full cursor-pointer backdrop-blur-md"
                                aria-label="Close video"
                            >
                                ✕
                            </button>
                        </div>
                        <video
                            ref={videoRef}
                            controls
                            autoPlay
                            className="w-full h-auto max-h-[80vh] aspect-video bg-black"
                        />
                    </div>
                </div>
            )}

            {/* 공유 선택 모달 */}
            {showShareModal && playingPath && (
                <div
                    className="fixed inset-0 z-[60] flex items-center justify-center p-4 backdrop-blur-xl bg-black/70"
                    onClick={() => setShowShareModal(false)}
                >
                    <div
                        className="bg-zinc-900 rounded-2xl p-6 max-w-sm w-full border border-white/10 shadow-2xl"
                        onClick={(e) => e.stopPropagation()}
                    >
                        <h3 className="text-lg font-bold text-white mb-4 text-center">공유하기</h3>
                        <div className="space-y-3">
                            {/* 현재 영상만 공유 */}
                            <button
                                onClick={async () => {
                                    const videoName = playingPath.split('/').pop()?.replace(/\.[^.]+$/, '') || '영상';
                                    let shareUrl = `${window.location.origin}/?play=${encodeURIComponent(playingPath)}`;
                                    try {
                                        const res = await fetch('/api/shorten', {
                                            method: 'POST',
                                            headers: { 'Content-Type': 'application/json' },
                                            body: JSON.stringify({ path: playingPath, type: 'play' }),
                                        });
                                        if (res.ok) {
                                            const { id } = await res.json() as { id: string };
                                            shareUrl = `${window.location.origin}/s/${id}`;
                                        }
                                    } catch {}
                                    const canShare = typeof navigator.share === 'function' &&
                                        (typeof navigator.canShare !== 'function' || navigator.canShare({ url: shareUrl }));

                                    if (canShare) {
                                        try {
                                            await navigator.share({
                                                title: `${videoName} - JBCH Word of Life Hub`,
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
                                    setShowShareModal(false);
                                }}
                                className="w-full py-3 px-4 bg-blue-600 hover:bg-blue-500 text-white rounded-xl font-medium transition-colors flex items-center justify-center gap-2"
                            >
                                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
                                </svg>
                                현재 영상만 공유
                            </button>
                            
                            {/* 같은 폴더 전체 공유 */}
                            <button
                                onClick={async () => {
                                    const folderPath = playingPath.split('/').slice(0, -1).join('/');
                                    const folderParts = folderPath.split('/');
                                    const folderLabel = folderParts.join(' ');
                                    let shareUrl = `${window.location.origin}/?path=${encodeURIComponent(folderPath)}`;
                                    try {
                                        const res = await fetch('/api/shorten', {
                                            method: 'POST',
                                            headers: { 'Content-Type': 'application/json' },
                                            body: JSON.stringify({ path: folderPath, type: 'path' }),
                                        });
                                        if (res.ok) {
                                            const { id } = await res.json() as { id: string };
                                            shareUrl = `${window.location.origin}/s/${id}`;
                                        }
                                    } catch {}
                                    const canShare = typeof navigator.share === 'function' &&
                                        (typeof navigator.canShare !== 'function' || navigator.canShare({ url: shareUrl }));

                                    if (canShare) {
                                        try {
                                            await navigator.share({
                                                title: `${folderLabel} 전편 영상 공유 - JBCH`,
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
                                    setShowShareModal(false);
                                }}
                                className="w-full py-3 px-4 bg-zinc-700 hover:bg-zinc-600 text-white rounded-xl font-medium transition-colors flex items-center justify-center gap-2"
                            >
                                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
                                </svg>
                                같은 폴더 전체 공유
                            </button>
                        </div>
                        
                        <button
                            onClick={() => setShowShareModal(false)}
                            className="w-full mt-4 py-2 text-zinc-400 hover:text-white transition-colors text-sm"
                        >
                            취소
                        </button>
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

                    {/* 홈이 아닐 때만 폴더 목록 표시 */}
                    {(currentPath || searchQuery) && items.filter(item => item.isdir).length > 0 && (
                        <div className="mb-10">
                            <h2 className="text-xl font-bold text-white mb-4">📁 폴더</h2>
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
                                {items.filter(item => !item.isdir).map((item, index) => {
                                    const videos = items.filter(i => !i.isdir);
                                    return (
                                        <React.Fragment key={item.path}>
                                            <VideoCard
                                                name={item.name}
                                                path={item.path}
                                                size={item.size}
                                                onPlay={handleVideoClick}
                                            />
                                            {/* 모바일에서 2번째 영상 다음에 인라인 광고 표시 */}
                                            {index === 1 && videos.length >= 3 && (
                                                <div className="block md:hidden">
                                                    <InlineAdCard />
                                                </div>
                                            )}
                                        </React.Fragment>
                                    );
                                })}
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
