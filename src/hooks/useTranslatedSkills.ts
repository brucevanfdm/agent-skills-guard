/**
 * Hook for translating skill content in the marketplace
 * Uses free Google Translate API - no API key required
 */

import { useState, useEffect, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { Skill } from '../types';
import { translateBatch } from '../lib/translate';

export interface TranslatedSkill extends Skill {
    translatedName?: string;
    translatedDescription?: string;
    isTranslated?: boolean;
}

export interface UseTranslatedSkillsResult {
    skills: TranslatedSkill[];
    isTranslating: boolean;
    error: Error | null;
    translationEnabled: boolean;
}

/**
 * Hook to translate skill names and descriptions when language is Chinese
 * No API key required - uses free Google Translate endpoint
 */
export function useTranslatedSkills(skills: Skill[]): UseTranslatedSkillsResult {
    const { i18n } = useTranslation();
    const [translatedSkills, setTranslatedSkills] = useState<TranslatedSkill[]>([]);
    const [isTranslating, setIsTranslating] = useState(false);
    const [error, setError] = useState<Error | null>(null);

    const isChineseLanguage = i18n.language === 'zh';
    // Translation is enabled when language is Chinese (no API key needed)
    const translationEnabled = isChineseLanguage;

    // Generate a stable key for the skills array
    const skillsKey = useMemo(() => {
        return skills.map(s => s.id).join(',');
    }, [skills]);

    useEffect(() => {
        // If not Chinese, just return original skills
        if (!translationEnabled) {
            setTranslatedSkills(skills.map(skill => ({ ...skill })));
            setError(null);
            return;
        }

        // Skip if no skills
        if (skills.length === 0) {
            setTranslatedSkills([]);
            return;
        }

        let cancelled = false;

        async function translateSkills() {
            setIsTranslating(true);
            setError(null);

            try {
                // Collect all texts to translate
                const textsToTranslate: string[] = [];
                const textIndices: { skillIndex: number; field: 'name' | 'description' }[] = [];

                skills.forEach((skill, skillIndex) => {
                    if (skill.name) {
                        textsToTranslate.push(skill.name);
                        textIndices.push({ skillIndex, field: 'name' });
                    }
                    if (skill.description) {
                        textsToTranslate.push(skill.description);
                        textIndices.push({ skillIndex, field: 'description' });
                    }
                });

                // Translate in batch (uses free Google Translate API)
                const translations = await translateBatch(textsToTranslate, 'zh-CN');

                if (cancelled) return;

                // Map translations back to skills
                const result: TranslatedSkill[] = skills.map(skill => ({ ...skill }));

                textIndices.forEach(({ skillIndex, field }, i) => {
                    const translatedText = translations[i];
                    if (field === 'name') {
                        result[skillIndex].translatedName = translatedText;
                    } else {
                        result[skillIndex].translatedDescription = translatedText;
                    }
                    result[skillIndex].isTranslated = true;
                });

                setTranslatedSkills(result);
            } catch (err) {
                if (cancelled) return;
                console.error('Translation error:', err);
                setError(err instanceof Error ? err : new Error('Translation failed'));
                // On error, return original skills
                setTranslatedSkills(skills.map(skill => ({ ...skill })));
            } finally {
                if (!cancelled) {
                    setIsTranslating(false);
                }
            }
        }

        translateSkills();

        return () => {
            cancelled = true;
        };
    }, [skillsKey, translationEnabled, skills]);

    return {
        skills: translatedSkills,
        isTranslating,
        error,
        translationEnabled,
    };
}
