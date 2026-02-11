'use client';

import { useEffect, useState } from 'react';

export default function LoadingScreen() {
    const [isLoading, setIsLoading] = useState(true);
    const [isFading, setIsFading] = useState(false);

    useEffect(() => {
        // 콘텐츠가 실제로 렌더링될 때까지 대기
        const checkContentLoaded = () => {
            // main 콘텐츠 영역에 실제 콘텐츠가 있는지 확인
            const mainContent = document.querySelector('main');
            const hasContent = mainContent && mainContent.children.length > 0;
            
            // 이미지들이 로드되었는지 확인
            const images = document.querySelectorAll('img');
            const loadedImages = Array.from(images).filter(img => img.complete);
            const imagesLoaded = images.length === 0 || loadedImages.length >= Math.min(images.length, 4);
            
            return hasContent && imagesLoaded;
        };

        const hideLoading = () => {
            setIsFading(true);
            setTimeout(() => setIsLoading(false), 300);
        };

        // 최소 800ms 대기 후 콘텐츠 로드 확인
        const minDelay = setTimeout(() => {
            if (checkContentLoaded()) {
                hideLoading();
            } else {
                // 콘텐츠가 아직 없으면 폴링
                const interval = setInterval(() => {
                    if (checkContentLoaded()) {
                        clearInterval(interval);
                        hideLoading();
                    }
                }, 100);
                
                // 최대 5초 후 강제 숨김
                setTimeout(() => {
                    clearInterval(interval);
                    hideLoading();
                }, 5000);
            }
        }, 800);

        return () => clearTimeout(minDelay);
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
