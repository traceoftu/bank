'use client';

import { useEffect, useState } from 'react';

const LOGO_TEXT = 'JBCH';
const SUB_TEXT = 'Word of Life Hub';

export default function LoadingScreen() {
    const [visible, setVisible] = useState(false);
    const [activeIndex, setActiveIndex] = useState(-1);
    const [showSub, setShowSub] = useState(false);
    const [fadeout, setFadeout] = useState(false);

    useEffect(() => {
        // body::before 오버레이 제거
        document.body.classList.add('splash-done');
        
        const hasVisited = sessionStorage.getItem('jbch-visited');

        if (!hasVisited) {
            sessionStorage.setItem('jbch-visited', 'true');
            setVisible(true);

            // 애니메이션 타이머들
            const timers: NodeJS.Timeout[] = [];
            
            LOGO_TEXT.split('').forEach((_, i) => {
                timers.push(
                    setTimeout(() => setActiveIndex(i), 300 + i * 200)
                );
            });

            timers.push(
                setTimeout(() => setShowSub(true), 300 + LOGO_TEXT.length * 200 + 300)
            );

            timers.push(
                setTimeout(() => setFadeout(true), 2600)
            );

            timers.push(
                setTimeout(() => setVisible(false), 3200)
            );

            return () => timers.forEach(clearTimeout);
        }
    }, []);

    if (!visible) return null;

    return (
        <div
            className="fixed inset-0 z-[9999] flex flex-col items-center justify-center select-none"
            style={{
                background: 'radial-gradient(ellipse at center, #0c0c14 0%, #09090b 100%)',
                transition: 'opacity 0.6s ease-out',
                opacity: fadeout ? 0 : 1,
            }}
        >
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
                            transform:
                                i <= activeIndex
                                    ? 'translateX(0) scale(1)'
                                    : 'translateX(40px) scale(1.8)',
                            transition:
                                'opacity 0.3s ease-out, transform 0.5s cubic-bezier(0.16, 1, 0.3, 1)',
                        }}
                    >
                        {char}
                    </span>
                ))}
            </div>

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

            <div
                className="mt-6 h-[2px] rounded-full bg-gradient-to-r from-blue-500 to-cyan-400"
                style={{
                    width: showSub ? '180px' : '0px',
                    opacity: showSub ? 0.7 : 0,
                    transition:
                        'width 0.8s cubic-bezier(0.16, 1, 0.3, 1), opacity 0.4s ease',
                }}
            />
        </div>
    );
}
