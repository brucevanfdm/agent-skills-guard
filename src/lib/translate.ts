/**
 * Translation service for skill marketplace content
 * Uses Tauri backend to call Google Translate (bypasses browser network restrictions)
 * Includes local caching to avoid redundant API calls
 */

import { invoke } from '@tauri-apps/api/core';

const TRANSLATION_CACHE_KEY = 'skillTranslationCache';
const CACHE_EXPIRY_DAYS = 30;

interface TranslationCacheEntry {
    text: string;
    translatedAt: number;
}

interface TranslationCache {
    [cacheKey: string]: TranslationCacheEntry;
}

/**
 * Generate a simple hash for cache key
 */
function hashText(text: string): string {
    let hash = 0;
    for (let i = 0; i < text.length; i++) {
        const char = text.charCodeAt(i);
        hash = ((hash << 5) - hash) + char;
        hash = hash & hash;
    }
    return hash.toString(36);
}

/**
 * Get the translation cache from localStorage
 */
function getCache(): TranslationCache {
    try {
        const cached = localStorage.getItem(TRANSLATION_CACHE_KEY);
        if (!cached) return {};

        const cache: TranslationCache = JSON.parse(cached);
        const now = Date.now();
        const expiryMs = CACHE_EXPIRY_DAYS * 24 * 60 * 60 * 1000;

        const cleanedCache: TranslationCache = {};
        for (const [key, entry] of Object.entries(cache)) {
            if (now - entry.translatedAt < expiryMs) {
                cleanedCache[key] = entry;
            }
        }

        return cleanedCache;
    } catch (error) {
        console.warn('Failed to read translation cache:', error);
        return {};
    }
}

/**
 * Save the translation cache to localStorage
 */
function saveCache(cache: TranslationCache): void {
    try {
        localStorage.setItem(TRANSLATION_CACHE_KEY, JSON.stringify(cache));
    } catch (error) {
        console.warn('Failed to save translation cache:', error);
    }
}

/**
 * Get cached translation if available
 */
export function getCachedTranslation(text: string, targetLang: string): string | null {
    const cache = getCache();
    const cacheKey = `${targetLang}:${hashText(text)}`;
    const entry = cache[cacheKey];

    if (entry) {
        return entry.text;
    }
    return null;
}

/**
 * Save translation to cache
 */
function cacheTranslation(originalText: string, translatedText: string, targetLang: string): void {
    const cache = getCache();
    const cacheKey = `${targetLang}:${hashText(originalText)}`;

    cache[cacheKey] = {
        text: translatedText,
        translatedAt: Date.now(),
    };

    saveCache(cache);
}

/**
 * Translate text using Tauri backend (bypasses browser network restrictions)
 * @param text - Text to translate
 * @param targetLang - Target language code (e.g., 'zh-CN')
 * @param sourceLang - Source language code (default: 'auto')
 */
export async function translateText(
    text: string,
    targetLang: string = 'zh-CN',
    sourceLang: string = 'auto'
): Promise<string> {
    if (!text || !text.trim()) {
        return text;
    }

    // Check cache first
    const cached = getCachedTranslation(text, targetLang);
    if (cached) {
        return cached;
    }

    try {
        // Use Tauri backend to make the translation request
        const translated = await invoke<string>('translate_text', {
            text,
            target_lang: targetLang,
            source_lang: sourceLang,
        });

        // Cache the result
        cacheTranslation(text, translated, targetLang);

        return translated;
    } catch (error) {
        console.error('Translation failed:', error);
        throw error;
    }
}

/**
 * Clear all translation cache
 */
export function clearTranslationCache(): void {
    try {
        localStorage.removeItem(TRANSLATION_CACHE_KEY);
    } catch (error) {
        console.warn('Failed to clear translation cache:', error);
    }
}

/**
 * Get cache statistics
 */
export function getTranslationCacheStats(): { entryCount: number; sizeBytes: number } {
    try {
        const cached = localStorage.getItem(TRANSLATION_CACHE_KEY);
        if (!cached) return { entryCount: 0, sizeBytes: 0 };

        const cache: TranslationCache = JSON.parse(cached);
        return {
            entryCount: Object.keys(cache).length,
            sizeBytes: new Blob([cached]).size,
        };
    } catch {
        return { entryCount: 0, sizeBytes: 0 };
    }
}
