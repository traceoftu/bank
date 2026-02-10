'use client';

import { useState, useRef, useEffect } from 'react';

interface VideoCardProps {
    name: string;
    path: string;
    size?: number;
    viewCount?: number;
    onPlay: (path: string) => void;
    vertical?: boolean;
}

const R2_PUBLIC_URL = 'https://videos.haebomsoft.com';

// 카테고리별 그라데이션 색상
const CATEGORY_COLORS: { [key: string]: string } = {
    '성인': 'from-blue-900/80 to-blue-950',
    '은장회': 'from-purple-900/80 to-purple-950',
    '청년회': 'from-green-900/80 to-green-950',
    '중고등부': 'from-orange-900/80 to-orange-950',
    '초등부': 'from-pink-900/80 to-pink-950',
    '생활&특별&기타': 'from-teal-900/80 to-teal-950',
};

function getCategoryColor(path: string): string {
    const category = path.split('/')[0];
    return CATEGORY_COLORS[category] || 'from-zinc-800 to-zinc-900';
}

export default function VideoCard({ name, path, size, viewCount, onPlay, vertical = false }: VideoCardProps) {
    const [isMobile, setIsMobile] = useState(true); // 기본값 모바일 (SSR 대응)
    const [isVisible, setIsVisible] = useState(false);
    const [isLoaded, setIsLoaded] = useState(false);
    const cardRef = useRef<HTMLDivElement>(null);

    const encodedPath = path.split('/').map(encodeURIComponent).join('/');
    const videoUrl = `${R2_PUBLIC_URL}/${encodedPath}`;
    const categoryColor = getCategoryColor(path);

    // 모바일 감지
    useEffect(() => {
        const checkMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
        setIsMobile(checkMobile);
    }, []);

    // Intersection Observer로 화면에 보일 때만 로드 (PC만)
    useEffect(() => {
        if (isMobile) return; // 모바일은 video 로드 안 함

        const observer = new IntersectionObserver(
            ([entry]) => {
                if (entry.isIntersecting) {
                    setIsVisible(true);
                    observer.disconnect();
                }
            },
            { rootMargin: '100px' }
        );

        if (cardRef.current) {
            observer.observe(cardRef.current);
        }

        return () => observer.disconnect();
    }, [isMobile]);

    return (
        <div
            ref={cardRef}
            className={`group relative rounded-xl overflow-hidden cursor-pointer bg-zinc-900 border border-white/5 hover:border-white/20 hover:scale-105 hover:z-10 transition-all duration-300 hover:shadow-2xl hover:shadow-black/50 ${vertical ? 'aspect-[2/3]' : 'aspect-video'}`}
            onClick={() => onPlay(path)}
        >
            {/* 모바일: 카테고리별 색상 플레이스홀더 / PC: video 로딩 전 플레이스홀더 */}
            {(isMobile || !isLoaded) && (
                <div className={`absolute inset-0 bg-gradient-to-br ${categoryColor} flex items-center justify-center`}>
                    <div className="w-12 h-12 rounded-full bg-black/30 flex items-center justify-center backdrop-blur-sm">
                        <svg className="w-6 h-6 text-white/70" fill="currentColor" viewBox="0 0 24 24">
                            <path d="M8 5v14l11-7z" />
                        </svg>
                    </div>
                </div>
            )}

            {/* PC만: 첫 프레임 이미지 (Lazy Load) */}
            {!isMobile && isVisible && (
                <video
                    src={`${videoUrl}#t=0.1`}
                    muted
                    playsInline
                    preload="metadata"
                    onLoadedData={() => setIsLoaded(true)}
                    className={`absolute inset-0 w-full h-full object-cover transition-opacity duration-300 ${isLoaded ? 'opacity-100' : 'opacity-0'}`}
                />
            )}

            {/* 재생 버튼 오버레이 */}
            <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent">
                <div className="absolute inset-0 flex items-center justify-center">
                    <div className="w-14 h-14 rounded-full bg-black/40 backdrop-blur-sm flex items-center justify-center border border-white/20 group-hover:scale-110 transition-transform">
                        <svg className="w-6 h-6 text-white ml-1" fill="currentColor" viewBox="0 0 24 24">
                            <path d="M8 5v14l11-7z" />
                        </svg>
                    </div>
                </div>
            </div>

            {/* 하단 정보 */}
            <div className="absolute bottom-0 left-0 right-0 p-3 bg-gradient-to-t from-black/90 to-transparent">
                <h3 className="text-sm font-medium text-white truncate mb-1">
                    {name.replace(/\.[^/.]+$/, '')}
                </h3>
                <div className="flex items-center gap-3 text-xs text-zinc-400">
                    {viewCount !== undefined && viewCount > 0 && (
                        <span className="flex items-center gap-1">
                            <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 24 24">
                                <path d="M12 4.5C7 4.5 2.73 7.61 1 12c1.73 4.39 6 7.5 11 7.5s9.27-3.11 11-7.5c-1.73-4.39-6-7.5-11-7.5zM12 17c-2.76 0-5-2.24-5-5s2.24-5 5-5 5 2.24 5 5-2.24 5-5 5zm0-8c-1.66 0-3 1.34-3 3s1.34 3 3 3 3-1.34 3-3-1.34-3-3-3z" />
                            </svg>
                            {viewCount}
                        </span>
                    )}
                </div>
            </div>
        </div>
    );
}
