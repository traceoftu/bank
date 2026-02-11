'use client';

import { createContext, useContext, useEffect, useState, ReactNode } from 'react';

export interface AdConfig {
    // 광고 활성화 여부
    enabled: boolean;
    bannerEnabled?: boolean;
    sidebarEnabled?: boolean;
    inlineEnabled?: boolean;
    
    // 이미지 URL
    imageUrl?: string;
    sidebarImageUrl?: string;
    cardImageUrl?: string;
    
    // 링크 URL
    linkUrl: string;
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
    
    // 텍스트
    title: string;
    description: string;
    cardTitle?: string;
    cardDescription?: string;
    cardBadge?: string;
    
    // 버전 (캐시 우회용)
    version?: string;
    
    [key: string]: string | boolean | undefined;
}

interface AdContextType {
    config: AdConfig | null;
    isLoading: boolean;
    getDeviceLink: () => string;
}

const AdContext = createContext<AdContextType | null>(null);

export const R2_PUBLIC_URL = 'https://videos.haebomsoft.com';

// 삼성 모델 코드 매핑 (S22 ~ S26 시리즈)
const samsungModels: Record<string, string> = {
    'sm-s941': 'S26', 'sm-s946': 'S26Plus', 'sm-s948': 'S26Ultra',
    'sm-s931': 'S25', 'sm-s936': 'S25Plus', 'sm-s938': 'S25Ultra',
    'sm-s921': 'S24', 'sm-s926': 'S24Plus', 'sm-s928': 'S24Ultra',
    'sm-s911': 'S23', 'sm-s916': 'S23Plus', 'sm-s918': 'S23Ultra',
    'sm-s901': 'S22', 'sm-s906': 'S22Plus', 'sm-s908': 'S22Ultra',
};

// 아이폰 화면 해상도 매핑
const getIphoneModel = (): string | null => {
    if (typeof window === 'undefined') return null;
    
    const w = window.screen.width;
    const h = window.screen.height;
    const ratio = window.devicePixelRatio;
    
    const width = Math.min(w, h);
    const height = Math.max(w, h);
    
    if (width === 440 && height === 956) return 'iPhone16ProMax';
    if (width === 402 && height === 874) return 'iPhone16Pro';
    if (width === 430 && height === 932 && ratio === 3) return 'iPhone16Plus';
    if (width === 393 && height === 852) return 'iPhone16';
    if (width === 430 && height === 932) return 'iPhone15ProMax';
    if (width === 428 && height === 926) return 'iPhone14Plus';
    if (width === 390 && height === 844) return 'iPhone14';
    
    return null;
};

// 삼성 모델 코드 추출
const getSamsungModel = (ua: string): string | null => {
    for (const [code, model] of Object.entries(samsungModels)) {
        if (ua.includes(code)) return model;
    }
    return null;
};

export function AdProvider({ children }: { children: ReactNode }) {
    const [config, setConfig] = useState<AdConfig | null>(null);
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        const loadConfig = async () => {
            try {
                const res = await fetch('/api/ads');
                if (!res.ok) throw new Error('Not found');
                const data = await res.json() as AdConfig;
                setConfig(data);
            } catch {
                setConfig(null);
            } finally {
                setIsLoading(false);
            }
        };
        loadConfig();
    }, []);

    const getDeviceLink = (): string => {
        if (!config) return '';
        
        const ua = typeof navigator !== 'undefined' ? navigator.userAgent.toLowerCase() : '';
        
        // 삼성 갤럭시
        const samsungModel = getSamsungModel(ua);
        if (samsungModel) {
            const key = `linkUrlSamsung${samsungModel}`;
            return (config[key] as string) || config.linkUrlSamsung || config.linkUrl;
        }
        
        if (ua.includes('samsung') || ua.includes('sm-')) {
            return config.linkUrlSamsung || config.linkUrl;
        }
        
        // 아이폰
        if (ua.includes('iphone')) {
            const iphoneModel = getIphoneModel();
            if (iphoneModel) {
                const key = `linkUrl${iphoneModel}`;
                return (config[key] as string) || config.linkUrlIphone || config.linkUrl;
            }
            return config.linkUrlIphone || config.linkUrl;
        }
        
        // 기타 안드로이드
        if (ua.includes('android')) {
            return config.linkUrlAndroid || config.linkUrl;
        }
        
        return config.linkUrl;
    };

    return (
        <AdContext.Provider value={{ config, isLoading, getDeviceLink }}>
            {children}
        </AdContext.Provider>
    );
}

export function useAd() {
    const context = useContext(AdContext);
    if (!context) {
        // AdProvider 외부에서 호출되면 기본값 반환 (에러 대신)
        return {
            config: null,
            isLoading: false,
            getDeviceLink: () => '',
        };
    }
    return context;
}
