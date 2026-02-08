'use client';

import { useState, useRef } from 'react';

interface VideoCardProps {
    name: string;
    path: string;
    size?: number;
    viewCount?: number;
    onPlay: (path: string) => void;
    vertical?: boolean; // 넷플릭스 Top10 스타일 세로 비율
}

const R2_PUBLIC_URL = 'https://videos.haebomsoft.com';

export default function VideoCard({ name, path, size, viewCount, onPlay, vertical = false }: VideoCardProps) {
    const [isHovering, setIsHovering] = useState(false);
    const videoRef = useRef<HTMLVideoElement>(null);
    const hoverTimeoutRef = useRef<NodeJS.Timeout | null>(null);

    const encodedPath = path.split('/').map(encodeURIComponent).join('/');
    const videoUrl = `${R2_PUBLIC_URL}/${encodedPath}`;

    const handleMouseEnter = () => {
        hoverTimeoutRef.current = setTimeout(() => {
            setIsHovering(true);
            if (videoRef.current) {
                videoRef.current.currentTime = 0;
                videoRef.current.play().catch(() => {});
            }
        }, 500); // 0.5초 후 재생 시작
    };

    const handleMouseLeave = () => {
        if (hoverTimeoutRef.current) {
            clearTimeout(hoverTimeoutRef.current);
        }
        setIsHovering(false);
        if (videoRef.current) {
            videoRef.current.pause();
            videoRef.current.currentTime = 0;
        }
    };

    return (
        <div
            className={`group relative rounded-xl overflow-hidden cursor-pointer bg-zinc-900 border border-white/5 hover:border-white/20 hover:scale-105 hover:z-10 transition-all duration-300 hover:shadow-2xl hover:shadow-black/50 ${vertical ? 'aspect-[2/3]' : 'aspect-video'}`}
            onMouseEnter={handleMouseEnter}
            onMouseLeave={handleMouseLeave}
            onClick={() => onPlay(path)}
        >
            {/* 포스터 이미지 (영상 첫 프레임) */}
            <video
                src={`${videoUrl}#t=0.1`}
                muted
                playsInline
                preload="metadata"
                className={`absolute inset-0 w-full h-full object-cover transition-opacity duration-300 ${isHovering ? 'opacity-0' : 'opacity-100'}`}
            />

            {/* 미리보기 영상 (호버 시) */}
            <video
                ref={videoRef}
                src={videoUrl}
                muted
                loop
                playsInline
                preload="none"
                className={`absolute inset-0 w-full h-full object-cover transition-opacity duration-300 ${isHovering ? 'opacity-100' : 'opacity-0'}`}
            />

            {/* 재생 버튼 오버레이 */}
            <div className={`absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent transition-opacity duration-300 ${isHovering ? 'opacity-0' : 'opacity-100'}`}>
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
                    {size && (
                        <span>{(size / 1024 / 1024).toFixed(0)} MB</span>
                    )}
                    {viewCount !== undefined && viewCount > 0 && (
                        <span className="flex items-center gap-1">
                            <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 24 24">
                                <path d="M12 4.5C7 4.5 2.73 7.61 1 12c1.73 4.39 6 7.5 11 7.5s9.27-3.11 11-7.5c-1.73-4.39-6-7.5-11-7.5zM12 17c-2.76 0-5-2.24-5-5s2.24-5 5-5 5 2.24 5 5-2.24 5-5 5zm0-8c-1.66 0-3 1.34-3 3s1.34 3 3 3 3-1.34 3-3-1.34-3-3-3z"/>
                            </svg>
                            {viewCount}
                        </span>
                    )}
                </div>
            </div>

            {/* 호버 시 재생 표시 */}
            {isHovering && (
                <div className="absolute top-2 left-2 px-2 py-1 bg-red-600 rounded text-xs font-bold text-white">
                    미리보기
                </div>
            )}
        </div>
    );
}
