/**
 * Translation service for skill marketplace content
 * Uses Google Translate free public endpoint with local caching
 * No API key required - uses client: 'gtx' endpoint
 */

const TRANSLATION_CACHE_KEY = 'skillTranslationCache';
const CACHE_EXPIRY_DAYS = 30;
// Free Google Translate endpoint - no API key required
const GOOGLE_TRANSLATE_FREE_URL = 'https://translate.googleapis.com/translate_a/single';

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
function getCachedTranslation(text: string, targetLang: string): string | null {
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
 * Parse Google Translate free API response
 * Response format: [[["translated text","original text",null,null,10]],null,"en",...]
 */
function parseGoogleTranslateResponse(response: unknown): string | null {
    try {
        if (!Array.isArray(response) || !Array.isArray(response[0])) {
            return null;
        }

        let translatedText = '';
        for (const item of response[0]) {
            if (Array.isArray(item) && typeof item[0] === 'string') {
                translatedText += item[0];
            }
        }

        return translatedText || null;
    } catch {
        return null;
    }
}

/**
 * Translate a single text string using free Google Translate endpoint
 * No API key required
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
        const params = new URLSearchParams({
            client: 'gtx',
            sl: sourceLang,
            tl: targetLang,
            dt: 't',
            q: text,
        });

        const response = await fetch(`${GOOGLE_TRANSLATE_FREE_URL}?${params.toString()}`);

        if (!response.ok) {
            throw new Error(`Translation API error: ${response.status}`);
        }

        const data = await response.json();
        const translatedText = parseGoogleTranslateResponse(data);

        if (translatedText) {
            cacheTranslation(text, translatedText, targetLang);
            return translatedText;
        }

        return text;
    } catch (error) {
        console.error('Translation failed:', error);
        return text;
    }
}

/**
 * Translate multiple texts in batch (translates one by one for free API)
 * @param texts - Array of texts to translate
 * @param targetLang - Target language code
 * @param sourceLang - Source language code (default: 'auto')
 */
export async function translateBatch(
    texts: string[],
    targetLang: string = 'zh-CN',
    sourceLang: string = 'auto'
): Promise<string[]> {
    if (!texts.length) return [];

    const results: string[] = new Array(texts.length);
    const uncachedTexts: { index: number; text: string }[] = [];

    // Check cache for each text
    for (let i = 0; i < texts.length; i++) {
        const text = texts[i];
        if (!text || !text.trim()) {
            results[i] = text;
            continue;
        }

        const cached = getCachedTranslation(text, targetLang);
        if (cached) {
            results[i] = cached;
        } else {
            uncachedTexts.push({ index: i, text });
        }
    }

    // Translate uncached texts one by one (free API doesn't support batch)
    for (const { index, text } of uncachedTexts) {
        try {
            const translatedText = await translateText(text, targetLang, sourceLang);
            results[index] = translatedText;
        } catch {
            results[index] = text;
        }
    }

    return results;
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
