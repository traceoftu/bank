'use client';

import { useEffect, useState } from 'react';

export default function LoadingScreen() {
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        // 페이지 로드 완료 후 로딩 화면 숨김
        const handleLoad = () => {
            setTimeout(() => setIsLoading(false), 300);
        };

        if (document.readyState === 'complete') {
            handleLoad();
        } else {
            window.addEventListener('load', handleLoad);
            return () => window.removeEventListener('load', handleLoad);
        }
    }, []);

    if (!isLoading) return null;

    return (
        <div className="fixed inset-0 z-[9999] bg-zinc-950 flex flex-col items-center justify-center transition-opacity duration-300">
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
