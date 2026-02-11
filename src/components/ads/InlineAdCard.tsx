'use client';

import { useState } from 'react';
import { useAd, R2_PUBLIC_URL } from './AdContext';

export default function InlineAdCard() {
    const { config, getDeviceLink } = useAd();
    const [isLoaded, setIsLoaded] = useState(false);

    // config가 없거나 광고가 비활성화되면 표시하지 않음
    if (!config || config.enabled === false || config.inlineEnabled === false) {
        return null;
    }

    const targetLink = getDeviceLink();

    return (
        <div className="w-full">
            <a 
                href={targetLink} 
                target="_blank" 
                rel="noopener noreferrer"
                className="block group"
            >
                <div className="bg-gradient-to-br from-zinc-900 to-zinc-800 rounded-2xl overflow-hidden border border-white/10 hover:border-white/20 transition-all duration-300 shadow-lg hover:shadow-xl">
                    {/* 뱃지 */}
                    <div className="relative">
                        <div className="absolute top-3 left-3 z-10">
                            <span className="px-2.5 py-1 bg-gradient-to-r from-amber-500 to-orange-500 text-white text-xs font-bold rounded-full shadow-lg">
                                {config.cardBadge || '공식 굿즈'}
                            </span>
                        </div>
                        
                        {/* 이미지 */}
                        <div className="w-full aspect-[4/3] overflow-hidden">
                            <img
                                src={`${R2_PUBLIC_URL}/ads/card.jpg${config.version ? `?v=${config.version}` : ''}`}
                                alt={config.cardTitle || config.title}
                                onLoad={() => setIsLoaded(true)}
                                className={`w-full h-full object-cover transition-all duration-300 group-hover:scale-105 ${isLoaded ? 'opacity-100' : 'opacity-0'}`}
                            />
                        </div>
                    </div>
                    
                    {/* 텍스트 */}
                    <div className="p-4">
                        <h4 className="text-base font-bold text-white mb-1.5 line-clamp-1 group-hover:text-blue-400 transition-colors">
                            {config.cardTitle || config.title}
                        </h4>
                        <p className="text-sm text-zinc-400 mb-3 line-clamp-2">
                            {config.cardDescription || config.description}
                        </p>
                        <span className="inline-flex items-center gap-2 px-4 py-2 bg-green-600 group-hover:bg-green-500 text-white text-sm font-medium rounded-full transition-colors">
                            <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                                <path d="M19 7h-3V6a4 4 0 0 0-8 0v1H5a1 1 0 0 0-1 1v11a3 3 0 0 0 3 3h10a3 3 0 0 0 3-3V8a1 1 0 0 0-1-1zm-9-1a2 2 0 0 1 4 0v1h-4V6zm8 13a1 1 0 0 1-1 1H7a1 1 0 0 1-1-1V9h2v1a1 1 0 0 0 2 0V9h4v1a1 1 0 0 0 2 0V9h2v10z"/>
                            </svg>
                            구매하기
                        </span>
                    </div>
                </div>
            </a>
        </div>
    );
}
