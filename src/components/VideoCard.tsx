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

export default function VideoCard({ name, path, size, viewCount, onPlay, vertical = false }: VideoCardProps) {
    const [isVisible, setIsVisible] = useState(false);
    const [isLoaded, setIsLoaded] = useState(false);
    const cardRef = useRef<HTMLDivElement>(null);

    const encodedPath = path.split('/').map(encodeURIComponent).join('/');
    const thumbUrl = `${R2_PUBLIC_URL}/thumbnails/${encodedPath}.jpg`;

    // Intersection Observer로 화면에 보일 때만 로드
    useEffect(() => {
        const observer = new IntersectionObserver(
            ([entry]) => {
                if (entry.isIntersecting) {
                    setIsVisible(true);
                    observer.disconnect();
                }
            },
            { rootMargin: '50px', threshold: 0.1 }
        );

        if (cardRef.current) {
            observer.observe(cardRef.current);
        }

        return () => observer.disconnect();
    }, []);

    return (
        <div
            ref={cardRef}
            className={`group relative rounded-xl overflow-hidden cursor-pointer bg-zinc-900 border border-white/5 hover:border-white/20 hover:scale-105 hover:z-10 transition-all duration-300 hover:shadow-2xl hover:shadow-black/50 ${vertical ? 'aspect-[2/3]' : 'aspect-video'}`}
            onClick={() => onPlay(path)}
        >
            {/* 로딩 전 플레이스홀더 */}
            {!isLoaded && (
                <div className="absolute inset-0 bg-gradient-to-br from-zinc-800 to-zinc-900 flex items-center justify-center">
                    <div className="w-12 h-12 rounded-full bg-zinc-700/50 flex items-center justify-center animate-pulse">
                        <svg className="w-6 h-6 text-zinc-500" fill="currentColor" viewBox="0 0 24 24">
                            <path d="M8 5v14l11-7z" />
                        </svg>
                    </div>
                </div>
            )}

            {/* 썸네일 이미지 */}
            {isVisible && (
                <img
                    src={thumbUrl}
                    alt={name}
                    loading="lazy"
                    onLoad={() => setIsLoaded(true)}
                    className={`absolute inset-0 w-full h-full object-cover transition-opacity duration-300 ${isLoaded ? 'opacity-100' : 'opacity-0'}`}
                />
            )}

            {/* 재생 버튼 오버레이 */}
            <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent">
                <div className="absolute inset-0 flex items-center justify-center">
                    <div className="w-10 h-10 rounded-full bg-black/40 backdrop-blur-sm flex items-center justify-center border border-white/20 group-hover:scale-110 transition-transform">
                        <svg className="w-4 h-4 text-white ml-0.5" fill="currentColor" viewBox="0 0 24 24">
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
