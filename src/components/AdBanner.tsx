'use client';

import { useState, useEffect } from 'react';

interface AdConfig {
    imageUrl?: string;
    linkUrl: string;
    // 기본 기기별 링크
    linkUrlSamsung?: string;
    linkUrlIphone?: string;
    linkUrlAndroid?: string;
    // 삼성 모델별 링크 (S22~S26)
    linkUrlSamsungS22?: string;
    linkUrlSamsungS22Plus?: string;
    linkUrlSamsungS22Ultra?: string;
    linkUrlSamsungS23?: string;
    linkUrlSamsungS23Plus?: string;
    linkUrlSamsungS23Ultra?: string;
    linkUrlSamsungS24?: string;
    linkUrlSamsungS24Plus?: string;
    linkUrlSamsungS24Ultra?: string;
    linkUrlSamsungS25?: string;
    linkUrlSamsungS25Plus?: string;
    linkUrlSamsungS25Ultra?: string;
    linkUrlSamsungS26?: string;
    linkUrlSamsungS26Plus?: string;
    linkUrlSamsungS26Ultra?: string;
    // 아이폰 모델별 링크
    linkUrlIphone13?: string;
    linkUrlIphone14?: string;
    linkUrlIphone14Plus?: string;
    linkUrlIphone14Pro?: string;
    linkUrlIphone14ProMax?: string;
    linkUrlIphone15?: string;
    linkUrlIphone15Plus?: string;
    linkUrlIphone15Pro?: string;
    linkUrlIphone15ProMax?: string;
    linkUrlIphone16?: string;
    linkUrlIphone16Plus?: string;
    linkUrlIphone16Pro?: string;
    linkUrlIphone16ProMax?: string;
    title: string;
    description: string;
    version?: string;
    [key: string]: string | undefined;
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

    // 삼성 모델 코드 매핑 (S22 ~ S26 시리즈)
    const samsungModels: Record<string, string> = {
        // Galaxy S26 시리즈 (2026)
        'sm-s941': 'S26', 'sm-s946': 'S26Plus', 'sm-s948': 'S26Ultra',
        // Galaxy S25 시리즈 (2025)
        'sm-s931': 'S25', 'sm-s936': 'S25Plus', 'sm-s938': 'S25Ultra',
        // Galaxy S24 시리즈 (2024)
        'sm-s921': 'S24', 'sm-s926': 'S24Plus', 'sm-s928': 'S24Ultra',
        // Galaxy S23 시리즈 (2023)
        'sm-s911': 'S23', 'sm-s916': 'S23Plus', 'sm-s918': 'S23Ultra',
        // Galaxy S22 시리즈 (2022)
        'sm-s901': 'S22', 'sm-s906': 'S22Plus', 'sm-s908': 'S22Ultra',
    };

    // 아이폰 화면 해상도 매핑
    const getIphoneModel = (): string | null => {
        const w = window.screen.width;
        const h = window.screen.height;
        const ratio = window.devicePixelRatio;
        
        // 논리 해상도 기준 (세로 모드)
        const width = Math.min(w, h);
        const height = Math.max(w, h);
        
        // iPhone 16 Pro Max (440x956 @3x)
        if (width === 440 && height === 956) return 'iPhone16ProMax';
        // iPhone 16 Pro (402x874 @3x)
        if (width === 402 && height === 874) return 'iPhone16Pro';
        // iPhone 16 Plus (430x932 @3x)
        if (width === 430 && height === 932 && ratio === 3) return 'iPhone16Plus';
        // iPhone 16 (393x852 @3x)
        if (width === 393 && height === 852) return 'iPhone16';
        // iPhone 15 Pro Max (430x932 @3x)
        if (width === 430 && height === 932) return 'iPhone15ProMax';
        // iPhone 15 Pro (393x852 @3x)
        if (width === 393 && height === 852) return 'iPhone15Pro';
        // iPhone 15 Plus (430x932 @3x)
        if (width === 430 && height === 932) return 'iPhone15Plus';
        // iPhone 15 (393x852 @3x)
        if (width === 393 && height === 852) return 'iPhone15';
        // iPhone 14 Pro Max (430x932 @3x)
        if (width === 430 && height === 932) return 'iPhone14ProMax';
        // iPhone 14 Pro (393x852 @3x)
        if (width === 393 && height === 852) return 'iPhone14Pro';
        // iPhone 14 Plus (428x926 @3x)
        if (width === 428 && height === 926) return 'iPhone14Plus';
        // iPhone 14 (390x844 @3x)
        if (width === 390 && height === 844) return 'iPhone14';
        // iPhone 13 Pro Max / 12 Pro Max (428x926 @3x)
        if (width === 428 && height === 926) return 'iPhone13ProMax';
        // iPhone 13 Pro / 13 / 12 Pro / 12 (390x844 @3x)
        if (width === 390 && height === 844) return 'iPhone13';
        
        return null;
    };

    // 삼성 모델 코드 추출
    const getSamsungModel = (ua: string): string | null => {
        for (const [code, model] of Object.entries(samsungModels)) {
            if (ua.includes(code)) return model;
        }
        return null;
    };

    // 기기별 링크 선택
    const getDeviceLink = () => {
        const ua = navigator.userAgent.toLowerCase();
        
        // 삼성 갤럭시 - 정확한 모델 매칭
        const samsungModel = getSamsungModel(ua);
        if (samsungModel) {
            const key = `linkUrlSamsung${samsungModel}` as keyof AdConfig;
            return (config[key] as string) || config.linkUrlSamsung || config.linkUrl;
        }
        
        // 기타 삼성
        if (ua.includes('samsung') || ua.includes('sm-')) {
            return config.linkUrlSamsung || config.linkUrl;
        }
        
        // 아이폰 - 해상도 기반 모델 추정
        if (ua.includes('iphone')) {
            const iphoneModel = getIphoneModel();
            if (iphoneModel) {
                const key = `linkUrl${iphoneModel}` as keyof AdConfig;
                return (config[key] as string) || config.linkUrlIphone || config.linkUrl;
            }
            return config.linkUrlIphone || config.linkUrl;
        }
        
        // 기타 안드로이드
        if (ua.includes('android')) {
            return config.linkUrlAndroid || config.linkUrl;
        }
        
        // 기본 (PC 등)
        return config.linkUrl;
    };

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
