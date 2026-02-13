'use client';

import { useEffect, useState } from 'react';

const LOGO_TEXT = 'JBCH';
const SUB_TEXT = 'Word of Life Hub';

export default function LoadingScreen() {
    const [isLoading, setIsLoading] = useState(true);
    const [activeIndex, setActiveIndex] = useState(-1);
    const [showSub, setShowSub] = useState(false);
    const [fadeout, setFadeout] = useState(false);

    useEffect(() => {
        // body::before 오버레이 제거 (CSS에서 JS 로드 전 콘텐츠 숨김용)
        document.body.classList.add('splash-done');

        // 글자 하나씩 오른쪽→왼쪽으로 등장 (각 200ms 간격)
        const letterTimers = LOGO_TEXT.split('').map((_, i) =>
            setTimeout(() => setActiveIndex(i), 300 + i * 200)
        );
        // 서브 텍스트 등장
        const subTimer = setTimeout(() => setShowSub(true), 300 + LOGO_TEXT.length * 200 + 300);
        // 페이드아웃
        const fadeTimer = setTimeout(() => setFadeout(true), 2600);
        // 제거
        const removeTimer = setTimeout(() => setIsLoading(false), 3200);

        return () => {
            letterTimers.forEach(clearTimeout);
            clearTimeout(subTimer);
            clearTimeout(fadeTimer);
            clearTimeout(removeTimer);
        };
    }, []);

    if (!isLoading) return null;

    return (
        <div
            className="fixed inset-0 z-[9999] flex flex-col items-center justify-center select-none"
            style={{
                background: 'radial-gradient(ellipse at center, #0c0c14 0%, #09090b 100%)',
                transition: 'opacity 0.6s ease-out',
                opacity: fadeout ? 0 : 1,
            }}
        >
            {/* 메인 로고 글자 */}
            <div className="flex items-center justify-center overflow-hidden">
                {LOGO_TEXT.split('').map((char, i) => (
                    <span
                        key={i}
                        style={{
                            display: 'inline-block',
                            fontSize: 'clamp(48px, 15vw, 120px)',
                            fontWeight: 900,
                            letterSpacing: '0.05em',
                            background: 'linear-gradient(135deg, #3b82f6, #06b6d4)',
                            WebkitBackgroundClip: 'text',
                            WebkitTextFillColor: 'transparent',
                            opacity: i <= activeIndex ? 1 : 0,
                            transform: i <= activeIndex
                                ? 'translateX(0) scale(1)'
                                : 'translateX(40px) scale(1.8)',
                            filter: i === activeIndex
                                ? 'drop-shadow(0 0 20px rgba(59,130,246,0.8))'
                                : i < activeIndex
                                    ? 'drop-shadow(0 0 8px rgba(59,130,246,0.3))'
                                    : 'none',
                            transition: 'opacity 0.3s ease-out, transform 0.5s cubic-bezier(0.16, 1, 0.3, 1), filter 0.4s ease',
                        }}
                    >
                        {char}
                    </span>
                ))}
            </div>

            {/* 서브 텍스트 */}
            <p
                className="text-sm sm:text-base tracking-[0.3em] uppercase mt-2"
                style={{
                    color: 'rgba(148, 163, 184, 0.8)',
                    opacity: showSub ? 1 : 0,
                    transform: showSub ? 'translateY(0)' : 'translateY(8px)',
                    transition: 'opacity 0.6s ease, transform 0.6s ease',
                }}
            >
                {SUB_TEXT}
            </p>

            {/* 하단 글로우 라인 */}
            <div
                className="mt-6 h-[2px] rounded-full bg-gradient-to-r from-blue-500 to-cyan-400"
                style={{
                    width: showSub ? '180px' : '0px',
                    opacity: showSub ? 0.7 : 0,
                    transition: 'width 0.8s cubic-bezier(0.16, 1, 0.3, 1), opacity 0.4s ease',
                }}
            />
        </div>
    );
}
