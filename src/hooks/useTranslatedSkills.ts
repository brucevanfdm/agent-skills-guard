/**
 * Hook for manually translating skill content in the marketplace
 * Uses Tauri backend for translation (bypasses browser network restrictions)
 * Supports toggling between original and translated text
 */

import { useState, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { Skill } from '../types';
import { translateText, getCachedTranslation } from '../lib/translate';
import { appToast } from '@/lib/toast';

export interface TranslatedSkill extends Skill {
    translatedName?: string;
    translatedDescription?: string;
    isTranslated?: boolean;
    isTranslating?: boolean;
    showingTranslation?: boolean; // true = showing translated, false = showing original
}

export interface UseSkillTranslationResult {
    translateSkill: (skillId: string, skill: Skill) => Promise<void>;
    toggleTranslation: (skillId: string, skill?: Skill) => void;
    translatingSkillIds: Set<string>;
    getTranslatedSkill: (skill: Skill) => TranslatedSkill;
    targetLanguage: string;
}

/**
 * Hook to manually translate individual skills with toggle support
 * Uses the app's current language setting as target language
 */
export function useSkillTranslation(): UseSkillTranslationResult {
    const { i18n } = useTranslation();
    const [translatingSkillIds, setTranslatingSkillIds] = useState<Set<string>>(new Set());
    const [translatedSkills, setTranslatedSkills] = useState<Map<string, TranslatedSkill>>(new Map());

    // Get target language from app settings
    const targetLanguage = i18n.language === 'zh' ? 'zh-CN' : i18n.language;

    const translateSkill = useCallback(async (skillId: string, skill: Skill): Promise<void> => {
        const cacheKey = `${skillId}:${targetLanguage}`;

        // Check if already translated - just toggle to show translation
        const existing = translatedSkills.get(cacheKey);
        if (existing?.isTranslated) {
            setTranslatedSkills(prev => {
                const newMap = new Map(prev);
                newMap.set(cacheKey, { ...existing, showingTranslation: true });
                return newMap;
            });
            return;
        }

        // Mark as translating
        setTranslatingSkillIds(prev => new Set(prev).add(skillId));

        try {
            const [translatedDescription] = await Promise.all([
                skill.description ? translateText(skill.description, targetLanguage) : Promise.resolve(skill.description),
            ]);

            const translated: TranslatedSkill = {
                ...skill,
                translatedDescription,
                isTranslated: true,
                isTranslating: false,
                showingTranslation: true,
            };

            // Cache the translation
            setTranslatedSkills(prev => {
                const newMap = new Map(prev);
                newMap.set(cacheKey, translated);
                return newMap;
            });
        } catch (error) {
            console.error('Translation failed:', error);
            appToast.error(`翻译失败: ${error instanceof Error ? error.message : String(error)}`);
            // On error, mark as not translated
            setTranslatedSkills(prev => {
                const newMap = new Map(prev);
                newMap.set(cacheKey, { ...skill, isTranslating: false, isTranslated: false });
                return newMap;
            });
        } finally {
            setTranslatingSkillIds(prev => {
                const newSet = new Set(prev);
                newSet.delete(skillId);
                return newSet;
            });
        }
    }, [targetLanguage, translatedSkills]);

    const toggleTranslation = useCallback((skillId: string, skill?: Skill) => {
        const cacheKey = `${skillId}:${targetLanguage}`;
        let existing = translatedSkills.get(cacheKey);

        // If not in state but we have the skill object, try to hydrate from cache
        if (!existing && skill) {
            const cachedDescription = skill.description ? getCachedTranslation(skill.description, targetLanguage) : null;
            if (cachedDescription) {
                existing = {
                    ...skill,
                    translatedDescription: cachedDescription,
                    isTranslated: true,
                    isTranslating: false,
                    showingTranslation: false // Will be toggled to true below
                };
            }
        }

        if (existing?.isTranslated) {
            setTranslatedSkills(prev => {
                const newMap = new Map(prev);
                newMap.set(cacheKey, {
                    ...existing!,
                    showingTranslation: !existing!.showingTranslation
                });
                return newMap;
            });
        }
    }, [targetLanguage, translatedSkills]);

    const getTranslatedSkill = useCallback((skill: Skill): TranslatedSkill => {
        const cacheKey = `${skill.id}:${targetLanguage}`;
        const cached = translatedSkills.get(cacheKey);

        if (cached) {
            return cached;
        }

        // Check if there's a cached translation in localStorage
        const cachedDescription = skill.description ? getCachedTranslation(skill.description, targetLanguage) : null;

        if (cachedDescription) {
            // Found in localStorage cache, add to state
            const translatedSkill: TranslatedSkill = {
                ...skill,
                translatedDescription: cachedDescription || skill.description,
                isTranslated: true,
                isTranslating: false,
                showingTranslation: false, // Start with original, user can toggle
            };

            // Don't set state during render, just return the value
            return translatedSkill;
        }

        return {
            ...skill,
            isTranslating: translatingSkillIds.has(skill.id),
            showingTranslation: false,
        };
    }, [translatedSkills, translatingSkillIds, targetLanguage]);

    return {
        translateSkill,
        toggleTranslation,
        translatingSkillIds,
        getTranslatedSkill,
        targetLanguage,
    };
}

// Re-export TranslatedSkill type for convenience
export type { TranslatedSkill as TranslatedSkillType };
