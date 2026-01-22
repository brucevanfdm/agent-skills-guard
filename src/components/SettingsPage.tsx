import { useTranslation } from "react-i18next";
import { Info, Github, RefreshCw, ExternalLink, Hash, Languages, Trash2 } from "lucide-react";
import { useEffect, useState } from "react";
import { appToast } from "@/lib/toast";
import { useUpdate } from "../contexts/UpdateContext";
import { GroupCard, GroupCardItem } from "./ui/GroupCard";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "./ui/alert-dialog";
import { clearWebPersistedData } from "@/lib/reset";
import { api } from "@/lib/api";
import { relaunchApp } from "@/lib/updater";

declare const __APP_VERSION__: string;

type MarkdownBlock =
  | { type: "heading"; level: number; text: string }
  | { type: "orderedList"; items: string[] }
  | { type: "unorderedList"; items: string[] }
  | { type: "paragraph"; text: string };

function parseSimpleMarkdown(markdown: string): MarkdownBlock[] {
  const lines = markdown.replace(/\r\n/g, "\n").split("\n");
  const blocks: MarkdownBlock[] = [];
  let pendingOrderedList: string[] = [];
  let pendingUnorderedList: string[] = [];
  let pendingParagraph: string[] = [];

  const flushLists = () => {
    if (pendingOrderedList.length > 0) {
      blocks.push({ type: "orderedList", items: pendingOrderedList });
      pendingOrderedList = [];
    }
    if (pendingUnorderedList.length > 0) {
      blocks.push({ type: "unorderedList", items: pendingUnorderedList });
      pendingUnorderedList = [];
    }
  };

  const flushParagraph = () => {
    if (pendingParagraph.length > 0) {
      blocks.push({ type: "paragraph", text: pendingParagraph.join("\n") });
      pendingParagraph = [];
    }
  };

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) {
      flushParagraph();
      flushLists();
      continue;
    }

    const headingMatch = trimmed.match(/^(#{1,6})\s+(.*)$/);
    if (headingMatch) {
      flushParagraph();
      flushLists();
      blocks.push({
        type: "heading",
        level: headingMatch[1].length,
        text: headingMatch[2],
      });
      continue;
    }

    const orderedMatch = trimmed.match(/^\d+\.\s+(.*)$/);
    if (orderedMatch) {
      flushParagraph();
      if (pendingUnorderedList.length > 0) {
        flushLists();
      }
      pendingOrderedList.push(orderedMatch[1]);
      continue;
    }

    const unorderedMatch = trimmed.match(/^[-*+]\s+(.*)$/);
    if (unorderedMatch) {
      flushParagraph();
      if (pendingOrderedList.length > 0) {
        flushLists();
      }
      pendingUnorderedList.push(unorderedMatch[1]);
      continue;
    }

    if (pendingOrderedList.length > 0 || pendingUnorderedList.length > 0) {
      flushLists();
    }
    pendingParagraph.push(trimmed);
  }

  flushParagraph();
  flushLists();
  return blocks;
}

function renderUpdateNotes(markdown: string) {
  const blocks = parseSimpleMarkdown(markdown);
  return (
    <div className="space-y-2">
      {blocks.map((block, index) => {
        if (block.type === "heading") {
          const HeadingTag = block.level <= 2 ? "h3" : "h4";
          return (
            <HeadingTag key={`heading-${index}`} className="text-sm font-semibold text-foreground">
              {block.text}
            </HeadingTag>
          );
        }

        if (block.type === "orderedList") {
          return (
            <ol key={`list-${index}`} className="list-decimal pl-5 space-y-1">
              {block.items.map((item, itemIndex) => (
                <li key={`item-${index}-${itemIndex}`}>{item}</li>
              ))}
            </ol>
          );
        }

        if (block.type === "unorderedList") {
          return (
            <ul key={`list-${index}`} className="list-disc pl-5 space-y-1">
              {block.items.map((item, itemIndex) => (
                <li key={`item-${index}-${itemIndex}`}>{item}</li>
              ))}
            </ul>
          );
        }

        return (
          <p key={`para-${index}`} className="whitespace-pre-line">
            {block.text}
          </p>
        );
      })}
    </div>
  );
}

export function SettingsPage() {
  const { t, i18n } = useTranslation();
  const updateContext = useUpdate();
  const currentLang = i18n.language;
  const [resetDialogOpen, setResetDialogOpen] = useState(false);
  const [isResetting, setIsResetting] = useState(false);
  const updatePhase = updateContext.updatePhase;
  const isDownloading = updatePhase === "downloading";
  const isInstalling = updatePhase === "installing" || updatePhase === "restarting";
  const isRestartRequired = updatePhase === "restartRequired";
  const isUpdating = isDownloading || isInstalling || isRestartRequired;
  const downloadPercent = updateContext.updateProgress?.percent;

  const handleLanguageChange = (lang: string) => {
    i18n.changeLanguage(lang).catch((error) => {
      console.error("Failed to change language:", error);
    });
    try {
      localStorage.setItem("language", lang);
    } catch (error) {
      console.warn("Failed to save language preference:", error);
    }
  };

  const handleCheckUpdate = async () => {
    try {
      const hasNewUpdate = await updateContext.checkUpdate();
      if (hasNewUpdate) {
        updateContext.resetDismiss();
        appToast.success(
          t("update.newVersionAvailable") + ": " + updateContext.updateInfo?.availableVersion
        );
      } else {
        appToast.success(t("update.upToDate"));
      }
    } catch (error) {
      console.error("Check update error:", error);
      appToast.error(t("update.checkFailed"));
    }
  };

  const handleInstallUpdate = async () => {
    if (!updateContext.updateHandle) return;

    appToast.info(t("update.downloading"));

    const ok = await updateContext.installUpdate();
    if (!ok) {
      appToast.error(t("update.failed"));
    }
  };

  useEffect(() => {
    if (updatePhase === "installing") {
      appToast.success(t("update.installing"));
    }
    if (updatePhase === "restartRequired") {
      appToast.success(t("update.restartRequired"));
    }
  }, [updatePhase, t]);

  const handleResetAppData = async () => {
    if (isResetting) return;

    setIsResetting(true);
    try {
      appToast.info(t("settings.reset.working"));
      await clearWebPersistedData();
      await api.resetAppData();
      appToast.success(t("settings.reset.success"));
      await relaunchApp();
    } catch (error) {
      console.error("Reset app data error:", error);
      appToast.error(t("settings.reset.failed"));
    } finally {
      setIsResetting(false);
      setResetDialogOpen(false);
    }
  };

  return (
    <div className="space-y-8">
      {/* 页面标题 */}
      <div>
        <h1 className="text-headline text-foreground">{t("nav.settings")}</h1>
      </div>

      {/* 语言设置 */}
      <GroupCard>
        <GroupCardItem className="py-3">
          <div className="apple-section-title mb-0">{t("settings.language.title")}</div>
        </GroupCardItem>
        <GroupCardItem noBorder>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-purple-500 flex items-center justify-center">
                <Languages className="w-4 h-4 text-white" />
              </div>
              <span className="text-sm font-medium">{t("settings.language.label")}</span>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => handleLanguageChange("zh")}
                className={`h-8 px-4 text-sm font-medium rounded-lg transition-all ${
                  currentLang === "zh"
                    ? "bg-blue-500 text-white"
                    : "bg-secondary text-muted-foreground hover:bg-secondary/80"
                }`}
              >
                中文
              </button>
              <button
                onClick={() => handleLanguageChange("en")}
                className={`h-8 px-4 text-sm font-medium rounded-lg transition-all ${
                  currentLang === "en"
                    ? "bg-blue-500 text-white"
                    : "bg-secondary text-muted-foreground hover:bg-secondary/80"
                }`}
              >
                English
              </button>
            </div>
          </div>
        </GroupCardItem>
      </GroupCard>

      {/* 应用信息 */}
      <GroupCard>
        <GroupCardItem className="py-3">
          <div className="apple-section-title mb-0">{t("settings.appInfo.title")}</div>
        </GroupCardItem>
        <GroupCardItem>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-blue-500 flex items-center justify-center">
                <Hash className="w-4 h-4 text-white" />
              </div>
              <span className="text-sm font-medium">{t("settings.appInfo.version")}</span>
            </div>
            <span className="text-sm text-blue-500 font-semibold">{__APP_VERSION__}</span>
          </div>
        </GroupCardItem>

        <GroupCardItem>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-gray-800 flex items-center justify-center">
                <Github className="w-4 h-4 text-white" />
              </div>
              <span className="text-sm font-medium">{t("settings.appInfo.repository")}</span>
            </div>
            <a
              href="https://github.com/brucevanfdm/agent-skills-guard"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1.5 text-sm text-blue-500 hover:text-blue-600 transition-colors"
            >
              <span>agent-skills-guard</span>
              <ExternalLink className="w-3.5 h-3.5" />
            </a>
          </div>
        </GroupCardItem>

        <GroupCardItem noBorder>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-green-500 flex items-center justify-center">
                <RefreshCw className="w-4 h-4 text-white" />
              </div>
              <span className="text-sm font-medium">{t("settings.appInfo.updates")}</span>
            </div>
            <div className="flex items-center gap-2">
              {updateContext.hasUpdate && updateContext.updateHandle && !isUpdating && (
                <button
                  onClick={handleInstallUpdate}
                  disabled={updateContext.isChecking}
                  className="apple-button-primary h-8 px-3 text-xs"
                >
                  {t("update.downloadAndInstall")}
                </button>
              )}
              {isDownloading && (
                <span className="text-xs text-blue-500 font-medium">
                  {t("update.downloading")}
                  {typeof downloadPercent === "number" && downloadPercent > 0
                    ? ` ${downloadPercent}%`
                    : ""}
                </span>
              )}
              {isInstalling && (
                <span className="text-xs text-blue-500 font-medium">{t("update.installing")}</span>
              )}
              {isRestartRequired && (
                <span className="text-xs text-blue-500 font-medium">
                  {t("update.restartRequired")}
                </span>
              )}
              <button
                onClick={handleCheckUpdate}
                disabled={updateContext.isChecking || isUpdating}
                className="apple-button-secondary h-8 px-3 text-xs flex items-center gap-1.5"
              >
                <RefreshCw
                  className={`w-3.5 h-3.5 ${updateContext.isChecking ? "animate-spin" : ""}`}
                />
                {updateContext.isChecking ? t("update.checking") : t("update.check")}
              </button>
            </div>
          </div>
        </GroupCardItem>
      </GroupCard>

      {updateContext.hasUpdate && updateContext.updateInfo && (
        <GroupCard title={t("update.newVersionAvailable")}>
          <GroupCardItem noBorder>
            <div className="space-y-3">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-orange-500 flex items-center justify-center">
                  <Info className="w-4 h-4 text-white" />
                </div>
                <span className="text-sm font-semibold text-orange-500">
                  {updateContext.updateInfo.availableVersion}
                </span>
              </div>
              {updateContext.updateInfo.notes && (
                <div className="text-sm text-muted-foreground max-h-40 overflow-y-auto p-3 bg-secondary/50 rounded-xl">
                  {renderUpdateNotes(updateContext.updateInfo.notes)}
                </div>
              )}
            </div>
          </GroupCardItem>
        </GroupCard>
      )}

      {/* 重置应用数据 */}
      <GroupCard>
        <GroupCardItem className="py-3">
          <div className="apple-section-title mb-0">{t("settings.reset.title")}</div>
        </GroupCardItem>
        <GroupCardItem noBorder>
          <div className="flex items-start justify-between gap-4">
            <div className="flex items-start gap-3">
              <div className="w-8 h-8 rounded-lg bg-red-500 flex items-center justify-center flex-shrink-0 mt-0.5">
                <Trash2 className="w-4 h-4 text-white" />
              </div>
              <div className="space-y-1">
                <div className="text-sm font-medium">{t("settings.reset.label")}</div>
                <div className="text-xs text-muted-foreground">{t("settings.reset.description")}</div>
              </div>
            </div>

            <AlertDialog open={resetDialogOpen} onOpenChange={setResetDialogOpen}>
              <AlertDialogTrigger asChild>
                <button
                  disabled={isResetting}
                  className="apple-button-destructive h-8 px-3 text-xs flex items-center gap-1.5 disabled:opacity-50"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  {t("settings.reset.button")}
                </button>
              </AlertDialogTrigger>
              <AlertDialogContent className="max-w-xl">
                <AlertDialogHeader>
                  <AlertDialogTitle>{t("settings.reset.confirmTitle")}</AlertDialogTitle>
                  <AlertDialogDescription>{t("settings.reset.confirmDescription")}</AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel disabled={isResetting}>
                    {t("settings.reset.confirmCancel")}
                  </AlertDialogCancel>
                  <AlertDialogAction
                    onClick={() => void handleResetAppData()}
                    disabled={isResetting}
                    className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                  >
                    {isResetting ? t("settings.reset.working") : t("settings.reset.confirmConfirm")}
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </div>
        </GroupCardItem>
      </GroupCard>
    </div>
  );
}
