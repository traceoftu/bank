'use client';

import { useState, useEffect } from 'react';
import { useAd, R2_PUBLIC_URL } from './AdContext';

export default function RightSidebarAd() {
    const { config, getDeviceLink } = useAd();
    const [isLoaded, setIsLoaded] = useState(false);
    const [isDismissed, setIsDismissed] = useState(false);
    const [isMobile, setIsMobile] = useState(true);

    useEffect(() => {
        // 모바일 체크
        const checkMobile = () => {
            setIsMobile(window.innerWidth < 1024);
        };
        
        checkMobile();
        window.addEventListener('resize', checkMobile);
        
        // localStorage에서 닫기 상태 확인
        const dismissed = localStorage.getItem('sidebar-ad-dismissed');
        if (dismissed) {
            const dismissedTime = parseInt(dismissed);
            // 24시간 후 다시 표시
            if (Date.now() - dismissedTime < 24 * 60 * 60 * 1000) {
                setIsDismissed(true);
            }
        }
        
        return () => window.removeEventListener('resize', checkMobile);
    }, []);

    const handleDismiss = (e: React.MouseEvent) => {
        e.preventDefault();
        e.stopPropagation();
        setIsDismissed(true);
        localStorage.setItem('sidebar-ad-dismissed', Date.now().toString());
    };

    // config가 없거나 광고가 비활성화되면 표시하지 않음
    if (!config || config.enabled === false || config.sidebarEnabled === false) {
        return null;
    }

    // 모바일이거나 닫혔으면 표시하지 않음
    if (isMobile || isDismissed) {
        return null;
    }

    const targetLink = getDeviceLink();

    return (
        <div className="fixed right-4 top-1/2 -translate-y-1/2 z-40 hidden lg:block">
            <div className="relative bg-zinc-900 border border-white/10 rounded-xl overflow-hidden shadow-2xl w-[200px]">
                {/* 닫기 버튼 */}
                <button
                    onClick={handleDismiss}
                    className="absolute top-2 right-2 z-10 w-6 h-6 flex items-center justify-center bg-black/50 hover:bg-black/70 rounded-full text-zinc-400 hover:text-white transition-colors"
                >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                </button>
                
                <a 
                    href={targetLink} 
                    target="_blank" 
                    rel="noopener noreferrer"
                    className="block"
                >
                    {/* 뱃지 */}
                    <div className="absolute top-2 left-2 z-10">
                        <span className="px-2 py-1 bg-gradient-to-r from-amber-500 to-orange-500 text-white text-xs font-bold rounded-full">
                            {config.cardBadge || '추천'}
                        </span>
                    </div>
                    
                    {/* 이미지 */}
                    <div className="w-full aspect-[1/2]">
                        <img
                            src={`${R2_PUBLIC_URL}/ads/sidebar.jpg${config.version ? `?v=${config.version}` : ''}`}
                            alt={config.title}
                            onLoad={() => setIsLoaded(true)}
                            className={`w-full h-full object-cover transition-opacity duration-300 ${isLoaded ? 'opacity-100' : 'opacity-0'}`}
                        />
                    </div>
                    
                    {/* 텍스트 */}
                    <div className="p-3">
                        <h4 className="text-sm font-bold text-white mb-1 line-clamp-2">
                            {config.cardTitle || config.title}
                        </h4>
                        <p className="text-xs text-zinc-400 mb-2 line-clamp-2">
                            {config.cardDescription || config.description}
                        </p>
                        <span className="block w-full py-2 bg-green-600 hover:bg-green-500 text-white text-xs font-medium rounded-lg text-center transition-colors">
                            자세히 보기
                        </span>
                    </div>
                </a>
            </div>
        </div>
    );
}
