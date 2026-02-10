'use client';

import { useEffect, useState } from 'react';

interface BeforeInstallPromptEvent extends Event {
    prompt: () => Promise<void>;
    userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

export default function PWAInstall() {
    const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
    const [showInstall, setShowInstall] = useState(false);
    const [isIOS, setIsIOS] = useState(false);

    useEffect(() => {
        // Service Worker 등록
        if ('serviceWorker' in navigator) {
            navigator.serviceWorker.register('/sw.js').catch(() => {});
        }

        // 24시간 내에 닫았으면 표시하지 않음
        const dismissed = localStorage.getItem('pwa-dismissed');
        if (dismissed) {
            const dismissedTime = parseInt(dismissed);
            if (Date.now() - dismissedTime < 24 * 60 * 60 * 1000) {
                return; // 24시간 내에 닫았으면 아무것도 표시하지 않음
            }
        }

        // 이미 standalone 모드면 표시하지 않음
        const isInStandaloneMode = window.matchMedia('(display-mode: standalone)').matches;
        if (isInStandaloneMode) return;

        // iOS 감지
        const isIOSDevice = /iPad|iPhone|iPod/.test(navigator.userAgent) && !(window as unknown as { MSStream?: unknown }).MSStream;
        
        if (isIOSDevice) {
            setIsIOS(true);
            setShowInstall(true);
            return;
        }

        // 설치 프롬프트 이벤트 캡처 (Android/Chrome/Windows)
        const handleBeforeInstall = (e: Event) => {
            e.preventDefault();
            setDeferredPrompt(e as BeforeInstallPromptEvent);
            setShowInstall(true);
        };

        window.addEventListener('beforeinstallprompt', handleBeforeInstall);

        return () => {
            window.removeEventListener('beforeinstallprompt', handleBeforeInstall);
        };
    }, []);

    const handleInstall = async () => {
        if (!deferredPrompt) return;

        deferredPrompt.prompt();
        const { outcome } = await deferredPrompt.userChoice;
        
        if (outcome === 'accepted') {
            setShowInstall(false);
        }
        setDeferredPrompt(null);
    };

    const handleDismiss = () => {
        setShowInstall(false);
        // 24시간 동안 다시 표시하지 않음
        localStorage.setItem('pwa-dismissed', Date.now().toString());
    };

    if (!showInstall) return null;

    return (
        <div className="fixed bottom-4 left-4 right-4 md:left-auto md:right-4 md:w-80 z-50 animate-in slide-in-from-bottom-4">
            <div className="bg-zinc-900 border border-white/10 rounded-2xl p-4 shadow-2xl">
                <div className="flex items-start gap-3">
                    <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-blue-500 to-cyan-500 flex items-center justify-center flex-shrink-0">
                        <span className="text-white font-bold text-lg">J</span>
                    </div>
                    <div className="flex-1 min-w-0">
                        <h3 className="text-sm font-semibold text-white">앱 설치하기</h3>
                        <p className="text-xs text-zinc-400 mt-0.5">
                            {isIOS 
                                ? '공유 버튼 → "홈 화면에 추가"를 눌러주세요' 
                                : '홈 화면에 추가하여 더 빠르게 접속하세요'}
                        </p>
                    </div>
                    <button
                        onClick={handleDismiss}
                        className="text-zinc-500 hover:text-zinc-300 transition-colors"
                    >
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                    </button>
                </div>
                {!isIOS && (
                    <button
                        onClick={handleInstall}
                        className="w-full mt-3 py-2 px-4 bg-blue-600 hover:bg-blue-500 text-white text-sm font-medium rounded-xl transition-colors"
                    >
                        설치
                    </button>
                )}
            </div>
        </div>
    );
}
