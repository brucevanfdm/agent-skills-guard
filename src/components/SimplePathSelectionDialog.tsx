import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogCancel,
} from '@/components/ui/alert-dialog';
import { InstallPathSelector } from './InstallPathSelector';

interface SimplePathSelectionDialogProps {
  open: boolean;
  skillName: string;
  onClose: () => void;
  onConfirm: (selectedPath: string) => void;
}

export function SimplePathSelectionDialog({
  open,
  skillName,
  onClose,
  onConfirm,
}: SimplePathSelectionDialogProps) {
  const { t } = useTranslation();
  const [selectedPath, setSelectedPath] = useState<string>('');

  return (
    <AlertDialog open={open} onOpenChange={onClose}>
      <AlertDialogContent className="max-w-2xl">
        <AlertDialogHeader>
          <AlertDialogTitle className="font-mono">
            {t('skills.pathSelection.selectInstallPath')}
          </AlertDialogTitle>
          <AlertDialogDescription className="font-mono">
            {t('skills.pathSelection.selectPathDescription', { skillName })}
          </AlertDialogDescription>
        </AlertDialogHeader>

        {/* 路径选择器 */}
        <div className="py-4">
          <InstallPathSelector onSelect={setSelectedPath} />
        </div>

        <AlertDialogFooter>
          <AlertDialogCancel onClick={onClose}>
            {t('skills.pathSelection.cancel')}
          </AlertDialogCancel>
          <button
            onClick={() => onConfirm(selectedPath)}
            disabled={!selectedPath}
            className="px-4 py-2 rounded font-mono bg-green-500 hover:bg-green-600 text-white disabled:opacity-50 transition-colors"
          >
            {t('skills.pathSelection.confirm')}
          </button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
