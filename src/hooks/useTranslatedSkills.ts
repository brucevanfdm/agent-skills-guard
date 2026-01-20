/**
 * Hook for manually translating skill content in the marketplace
 * Uses free Google Translate API - no API key required
 * Translation is triggered manually per skill
 */

import { useState, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { Skill } from '../types';
import { translateText } from '../lib/translate';

export interface TranslatedSkill extends Skill {
    translatedName?: string;
    translatedDescription?: string;
    isTranslated?: boolean;
    isTranslating?: boolean;
}

export interface UseSkillTranslationResult {
    translateSkill: (skillId: string, skill: Skill) => Promise<TranslatedSkill>;
    translatingSkillIds: Set<string>;
    translatedSkills: Map<string, TranslatedSkill>;
    getTranslatedSkill: (skill: Skill) => TranslatedSkill;
    targetLanguage: string;
}

/**
 * Hook to manually translate individual skills
 * Uses the app's current language setting as target language
 */
export function useSkillTranslation(): UseSkillTranslationResult {
    const { i18n } = useTranslation();
    const [translatingSkillIds, setTranslatingSkillIds] = useState<Set<string>>(new Set());
    const [translatedSkills, setTranslatedSkills] = useState<Map<string, TranslatedSkill>>(new Map());

    // Get target language from app settings
    // Google Translate uses language codes like 'zh-CN', 'en', etc.
    const targetLanguage = i18n.language === 'zh' ? 'zh-CN' : i18n.language;

    const translateSkill = useCallback(async (skillId: string, skill: Skill): Promise<TranslatedSkill> => {
        // Check if already translated for current language
        const existingTranslation = translatedSkills.get(`${skillId}:${targetLanguage}`);
        if (existingTranslation) {
            return existingTranslation;
        }

        // Mark as translating
        setTranslatingSkillIds(prev => new Set(prev).add(skillId));

        try {
            const [translatedName, translatedDescription] = await Promise.all([
                skill.name ? translateText(skill.name, targetLanguage) : Promise.resolve(skill.name),
                skill.description ? translateText(skill.description, targetLanguage) : Promise.resolve(skill.description),
            ]);

            const translated: TranslatedSkill = {
                ...skill,
                translatedName,
                translatedDescription,
                isTranslated: true,
                isTranslating: false,
            };

            // Cache the translation
            setTranslatedSkills(prev => {
                const newMap = new Map(prev);
                newMap.set(`${skillId}:${targetLanguage}`, translated);
                return newMap;
            });

            return translated;
        } catch (error) {
            console.error('Translation failed:', error);
            return { ...skill, isTranslating: false };
        } finally {
            setTranslatingSkillIds(prev => {
                const newSet = new Set(prev);
                newSet.delete(skillId);
                return newSet;
            });
        }
    }, [targetLanguage, translatedSkills]);

    const getTranslatedSkill = useCallback((skill: Skill): TranslatedSkill => {
        const cached = translatedSkills.get(`${skill.id}:${targetLanguage}`);
        if (cached) {
            return cached;
        }
        return {
            ...skill,
            isTranslating: translatingSkillIds.has(skill.id),
        };
    }, [translatedSkills, translatingSkillIds, targetLanguage]);

    return {
        translateSkill,
        translatingSkillIds,
        translatedSkills,
        getTranslatedSkill,
        targetLanguage,
    };
}

// Re-export TranslatedSkill type for convenience
export type { TranslatedSkill as TranslatedSkillType };
