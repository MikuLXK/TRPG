import React from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { AlertTriangle, X } from 'lucide-react';

interface ConfirmDialogProps {
  isOpen: boolean;
  title: string;
  message: string;
  onConfirm: () => void;
  onCancel: () => void;
  confirmText?: string;
  cancelText?: string;
  type?: 'danger' | 'warning' | 'info';
}

export default function ConfirmDialog({
  isOpen,
  title,
  message,
  onConfirm,
  onCancel,
  confirmText = '确认',
  cancelText = '取消',
  type = 'warning'
}: ConfirmDialogProps) {
  if (!isOpen) return null;

  const colors = {
    danger: {
      bg: 'bg-red-950',
      border: 'border-red-500/50',
      icon: 'text-red-500',
      button: 'bg-red-600 hover:bg-red-500'
    },
    warning: {
      bg: 'bg-amber-950',
      border: 'border-amber-500/50',
      icon: 'text-amber-500',
      button: 'bg-amber-600 hover:bg-amber-500'
    },
    info: {
      bg: 'bg-zinc-900',
      border: 'border-zinc-700',
      icon: 'text-zinc-400',
      button: 'bg-zinc-700 hover:bg-zinc-600'
    }
  };

  const currentColors = colors[type];

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.95 }}
        className={`w-full max-w-md ${currentColors.bg} border ${currentColors.border} rounded-2xl shadow-2xl overflow-hidden`}
      >
        <div className="p-6">
          <div className="flex items-center gap-4 mb-4">
            <div className={`p-3 rounded-full bg-black/30 ${currentColors.icon}`}>
              <AlertTriangle size={24} />
            </div>
            <h3 className="text-xl font-bold text-zinc-100">{title}</h3>
          </div>
          
          <p className="text-zinc-400 mb-8 leading-relaxed">
            {message}
          </p>

          <div className="flex justify-end gap-3">
            <button
              onClick={onCancel}
              className="px-4 py-2 rounded-lg text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800 transition-colors"
            >
              {cancelText}
            </button>
            <button
              onClick={onConfirm}
              className={`px-6 py-2 rounded-lg text-white font-bold shadow-lg transition-all ${currentColors.button}`}
            >
              {confirmText}
            </button>
          </div>
        </div>
      </motion.div>
    </div>
  );
}
