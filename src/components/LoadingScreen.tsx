'use client';

import { useEffect, useState } from 'react';

export default function LoadingScreen() {
    const [isLoading, setIsLoading] = useState(true);
    const [isFading, setIsFading] = useState(false);

    useEffect(() => {
        let intervalId: ReturnType<typeof setInterval> | null = null;
        let timeoutId: ReturnType<typeof setTimeout> | null = null;

        const hideLoading = () => {
            setIsFading(true);
            setTimeout(() => setIsLoading(false), 300);
        };

        // 간단하게 1.5초 후 숨김 (콘텐츠 로드 대기)
        const minDelay = setTimeout(() => {
            hideLoading();
        }, 1500);

        return () => {
            clearTimeout(minDelay);
            if (intervalId) clearInterval(intervalId);
            if (timeoutId) clearTimeout(timeoutId);
        };
    }, []);

    if (!isLoading) return null;

    return (
        <div className={`fixed inset-0 z-[9999] bg-zinc-950 flex flex-col items-center justify-center transition-opacity duration-300 ${isFading ? 'opacity-0' : 'opacity-100'}`}>
            <img 
                src="/icons/icon-192x192.png" 
                alt="JBCH Hub" 
                className="w-24 h-24 mb-4 animate-pulse"
            />
            <h1 className="text-xl font-bold bg-gradient-to-r from-blue-400 to-cyan-400 bg-clip-text text-transparent">
                JBCH Word of Life Hub
            </h1>
            <div className="mt-6 w-8 h-8 border-2 border-blue-400 border-t-transparent rounded-full animate-spin" />
        </div>
    );
}
