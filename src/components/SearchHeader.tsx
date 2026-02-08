'use client';

import { useState, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';

export default function SearchHeader() {
    const router = useRouter();
    const searchParams = useSearchParams();
    const [isOpen, setIsOpen] = useState(false);
    const [query, setQuery] = useState('');

    // Sync with URL
    useEffect(() => {
        const q = searchParams.get('q');
        if (q) {
            setQuery(q);
            setIsOpen(true);
        }
    }, [searchParams]);

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (query.trim()) {
            router.push(`/?q=${encodeURIComponent(query)}`);
        } else {
            router.push('/');
        }
    };

    return (
        <div className="relative flex items-center">
            <form
                onSubmit={handleSubmit}
                className={`flex items-center overflow-hidden transition-all duration-300 ease-in-out ${isOpen ? 'w-64 opacity-100' : 'w-0 opacity-0'}`}
            >
                <input
                    type="text"
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    placeholder="Search videos..."
                    className="w-full px-4 py-1.5 text-sm text-white bg-zinc-800/50 border border-white/10 rounded-full focus:outline-none focus:ring-1 focus:ring-blue-500 placeholder-zinc-500"
                    autoFocus={isOpen}
                />
            </form>

            <button
                onClick={() => {
                    if (isOpen && !query) setIsOpen(false);
                    else if (!isOpen) setIsOpen(true);
                    else handleSubmit({ preventDefault: () => { } } as React.FormEvent);
                }}
                className="ml-2 w-10 h-10 rounded-full bg-zinc-800/50 hover:bg-zinc-700/80 flex items-center justify-center text-zinc-400 hover:text-white transition-colors cursor-pointer"
                aria-label="Toggle search"
            >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
            </button>
        </div>
    );
}
