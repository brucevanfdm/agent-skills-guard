import "./types";
import i18n from "i18next";
import { initReactI18next } from "react-i18next";
import zh from "./locales/zh.json";
import en from "./locales/en.json";

// 安全获取语言偏好
let savedLanguage = "zh";
try {
  const stored = localStorage.getItem("language");
  if (stored && ["zh", "en"].includes(stored)) {
    savedLanguage = stored;
  }
} catch (error) {
  // localStorage 可能在某些环境不可用
  console.warn("localStorage access failed, using default language");
}

i18n.use(initReactI18next).init({
  resources: {
    zh: { translation: zh },
    en: { translation: en },
  },
  lng: savedLanguage,
  fallbackLng: "zh",
  interpolation: {
    escapeValue: false, // React 已经处理了 XSS
  },
});

export default i18n;
