'use client';

import { useState, useEffect } from 'react';

interface AdConfig {
    imageUrl: string;
    linkUrl: string;
    title: string;
    description: string;
}

const R2_PUBLIC_URL = 'https://videos.haebomsoft.com';

export default function AdBanner() {
    const [config, setConfig] = useState<AdConfig | null>(null);
    const [isLoaded, setIsLoaded] = useState(false);

    useEffect(() => {
        const loadConfig = async () => {
            try {
                // API를 통해 config 로드 (CORS 우회)
                const res = await fetch('/api/ads');
                if (!res.ok) throw new Error('Not found');
                const data = await res.json() as AdConfig;
                setConfig(data);
            } catch {
                setConfig(null);
            }
        };
        loadConfig();
    }, []);

    if (!config) return null;

    return (
        <div className="w-full max-w-4xl mx-auto px-4 py-8">
            <div className="bg-gradient-to-r from-zinc-900 to-zinc-800 rounded-2xl overflow-hidden border border-white/10 shadow-xl">
                <a 
                    href={config.linkUrl} 
                    target="_blank" 
                    rel="noopener noreferrer"
                    className="block"
                >
                    <div className="flex flex-col md:flex-row items-center gap-6 p-6">
                        {/* 이미지 */}
                        <div className="w-full md:w-1/3 flex-shrink-0">
                            <img
                                src={config.imageUrl || `${R2_PUBLIC_URL}/ads/banner.jpg`}
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
