
import React, { useEffect } from 'react';
import clsx from 'clsx';
import { useFocusTrap } from '../hooks/useFocusTrap';

interface ConfirmDialogProps {
  open: boolean;
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  destructive?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

export const ConfirmDialog: React.FC<ConfirmDialogProps> = ({
  open,
  title,
  message,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  destructive = false,
  onConfirm,
  onCancel,
}) => {
  const trapRef = useFocusTrap(open);

  // Escape key dismisses dialog
  useEffect(() => {
    if (!open) return;
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onCancel();
    };
    document.addEventListener('keydown', handleKey);
    return () => document.removeEventListener('keydown', handleKey);
  }, [open, onCancel]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[200] flex items-center justify-center p-6"
      role="alertdialog"
      aria-modal="true"
      aria-labelledby="confirm-dialog-title"
      aria-describedby="confirm-dialog-message"
    >
      <div className="absolute inset-0 bg-black/40" onClick={onCancel} />
      <div ref={trapRef} className="relative bg-white/95 dark:bg-slate-800/95 backdrop-blur-xl rounded-2xl w-full max-w-[270px] overflow-hidden shadow-2xl animate-in zoom-in-95 fade-in duration-200">
        <div className="px-4 pt-5 pb-4 text-center">
          <h3 id="confirm-dialog-title" className="font-bold text-headline text-slate-900 dark:text-slate-50 mb-1">{title}</h3>
          <p id="confirm-dialog-message" className="text-footnote text-slate-500 dark:text-slate-400 leading-snug">{message}</p>
        </div>
        <div className="border-t border-slate-200/80 dark:border-slate-700/80">
          <button
            onClick={onCancel}
            className="w-full py-3 text-headline text-sky-500 font-normal border-b border-slate-200/80 dark:border-slate-700/80 active:bg-slate-100 dark:active:bg-slate-700 transition-colors"
          >
            {cancelLabel}
          </button>
          <button
            onClick={onConfirm}
            className={clsx(
              "w-full py-3 text-headline font-semibold active:bg-slate-100 dark:active:bg-slate-700 transition-colors",
              destructive ? "text-red-500" : "text-sky-500"
            )}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
};
