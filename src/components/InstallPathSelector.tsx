import { useState, useEffect } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { User, Clock, FolderPlus } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { getRecentInstallPaths } from '@/lib/storage';

interface InstallPathSelectorProps {
  onSelect: (path: string) => void;
  defaultPath?: string;
}

export function InstallPathSelector({ onSelect, defaultPath }: InstallPathSelectorProps) {
  const { t } = useTranslation();
  const [selectedPath, setSelectedPath] = useState<string>('');
  const [userPath, setUserPath] = useState<string>('');
  const [recentPaths, setRecentPaths] = useState<string[]>([]);
  const [customPath, setCustomPath] = useState<string>('');
  const [isSelecting, setIsSelecting] = useState(false);

  useEffect(() => {
    // 加载默认用户路径
    invoke<string>('get_default_install_path')
      .then(path => {
        setUserPath(path);
        // 使用 defaultPath 或默认用户路径
        const initial = defaultPath || path;
        setSelectedPath(initial);
        onSelect(initial);
      })
      .catch(error => {
        console.error('Failed to get default install path:', error);
      });

    // 从 localStorage 加载最近路径
    setRecentPaths(getRecentInstallPaths());
  }, [defaultPath, onSelect]);

  const handleSelect = (path: string) => {
    setSelectedPath(path);
    onSelect(path);
  };

  const handleCustomPath = async () => {
    setIsSelecting(true);
    try {
      const selectedCustomPath = await invoke<string | null>('select_custom_install_path');
      if (selectedCustomPath) {
        setCustomPath(selectedCustomPath);
        handleSelect(selectedCustomPath);
      }
    } catch (error: any) {
      console.error('Failed to select custom path:', error);
    } finally {
      setIsSelecting(false);
    }
  };

  return (
    <div className="space-y-3">
      <label className="text-sm font-mono text-terminal-cyan">
        {t('skills.pathSelection.selectPath')}:
      </label>

      {/* 用户目录选项 */}
      {userPath && (
        <PathOption
          icon={<User className="w-4 h-4" />}
          label={t('skills.pathSelection.userDirectory')}
          path={userPath}
          selected={selectedPath === userPath}
          onClick={() => handleSelect(userPath)}
        />
      )}

      {/* 最近使用的路径 */}
      {recentPaths.filter(path => path.toLowerCase() !== userPath.toLowerCase()).length > 0 && (
        <div className="border-t border-border pt-3 mt-3">
          <label className="text-xs font-mono text-muted-foreground mb-2 block">
            {t('skills.pathSelection.recentPaths')}:
          </label>
          {recentPaths
            .filter(path => path.toLowerCase() !== userPath.toLowerCase())
            .map((path, idx) => (
              <PathOption
                key={path}
                icon={<Clock className="w-4 h-4" />}
                label={`${t('skills.pathSelection.recent')} ${idx + 1}`}
                path={path}
                selected={selectedPath === path}
                onClick={() => handleSelect(path)}
              />
            ))}
        </div>
      )}

      {/* 显示已选择的自定义路径 */}
      {customPath && customPath !== userPath && !recentPaths.includes(customPath) && (
        <div className="border-t border-border pt-3 mt-3">
          <label className="text-xs font-mono text-muted-foreground mb-2 block">
            自定义路径:
          </label>
          <PathOption
            icon={<FolderPlus className="w-4 h-4" />}
            label="自定义"
            path={customPath}
            selected={selectedPath === customPath}
            onClick={() => handleSelect(customPath)}
          />
        </div>
      )}

      {/* 自定义路径按钮 */}
      <button
        onClick={handleCustomPath}
        disabled={isSelecting}
        className="w-full flex items-center gap-2 px-4 py-3 border border-dashed border-terminal-cyan/50 rounded hover:bg-terminal-cyan/10 transition-colors disabled:opacity-50"
      >
        <FolderPlus className="w-4 h-4 text-terminal-cyan" />
        <span className="text-sm font-mono text-terminal-cyan">
          {isSelecting ? t('skills.pathSelection.selecting') : t('skills.pathSelection.customPath')}
        </span>
      </button>
    </div>
  );
}

// PathOption 子组件（单选样式的路径选项）
function PathOption({ icon, label, path, selected, onClick }: {
  icon: React.ReactNode;
  label: string;
  path: string;
  selected: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={`w-full flex items-start gap-3 px-4 py-3 border rounded transition-colors ${
        selected
          ? 'border-terminal-cyan bg-terminal-cyan/10'
          : 'border-border hover:border-terminal-cyan/50'
      }`}
    >
      <div className={`mt-0.5 ${selected ? 'text-terminal-cyan' : 'text-muted-foreground'}`}>
        {icon}
      </div>
      <div className="flex-1 text-left">
        <div className="text-sm font-mono font-medium">{label}</div>
        <div className="text-xs font-mono text-muted-foreground break-all">{path}</div>
      </div>
      {selected && (
        <div className="w-5 h-5 rounded-full border-2 border-terminal-cyan flex items-center justify-center flex-shrink-0">
          <div className="w-2.5 h-2.5 rounded-full bg-terminal-cyan"></div>
        </div>
      )}
    </button>
  );
}
