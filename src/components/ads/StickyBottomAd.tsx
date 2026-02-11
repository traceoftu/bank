'use client';

import { useState } from 'react';
import { useAd, R2_PUBLIC_URL } from './AdContext';

export default function StickyBottomAd() {
    const { config, getDeviceLink } = useAd();
    const [isLoaded, setIsLoaded] = useState(false);

    // config가 없거나 광고가 비활성화되면 표시하지 않음
    if (!config || config.enabled === false || config.bannerEnabled === false) {
        return null;
    }

    const targetLink = getDeviceLink();

    return (
        <div className="w-full max-w-4xl mx-auto px-4 py-8">
            <div className="bg-gradient-to-r from-zinc-900 to-zinc-800 rounded-2xl overflow-hidden border border-white/10 shadow-xl">
                <a 
                    href={targetLink} 
                    target="_blank" 
                    rel="noopener noreferrer"
                    className="block"
                >
                    <div className="flex flex-col md:flex-row items-center gap-6 p-6">
                        {/* 이미지 */}
                        <div className="w-full md:w-1/3 flex-shrink-0">
                            <img
                                src={`${R2_PUBLIC_URL}/ads/banner.jpg${config.version ? `?v=${config.version}` : ''}`}
                                alt={config.title}
                                onLoad={() => setIsLoaded(true)}
                                className={`w-full h-auto rounded-xl object-cover transition-opacity duration-300 ${isLoaded ? 'opacity-100' : 'opacity-0'}`}
                            />
                        </div>
                        
                        {/* 텍스트 */}
                        <div className="flex-1 text-center md:text-left">
                            <h3 className="text-xl font-bold text-white mb-2">
                                {config.title}
                            </h3>
                            <p className="text-zinc-400 text-sm mb-4 leading-relaxed">
                                {config.description}
                            </p>
                            <span className="inline-flex items-center gap-2 px-4 py-2 bg-green-600 hover:bg-green-500 text-white rounded-full text-sm font-medium transition-colors">
                                <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                                    <path d="M19 7h-3V6a4 4 0 0 0-8 0v1H5a1 1 0 0 0-1 1v11a3 3 0 0 0 3 3h10a3 3 0 0 0 3-3V8a1 1 0 0 0-1-1zm-9-1a2 2 0 0 1 4 0v1h-4V6zm8 13a1 1 0 0 1-1 1H7a1 1 0 0 1-1-1V9h2v1a1 1 0 0 0 2 0V9h4v1a1 1 0 0 0 2 0V9h2v10z"/>
                                </svg>
                                네이버 스토어에서 보기
                            </span>
                        </div>
                    </div>
                </a>
            </div>
        </div>
    );
}
