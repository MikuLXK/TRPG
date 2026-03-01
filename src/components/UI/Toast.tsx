import React, { useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { AlertCircle, CheckCircle2, X } from 'lucide-react';

export type ToastType = 'success' | 'error' | 'info';

interface ToastProps {
  message: string;
  type?: ToastType;
  onClose: () => void;
  duration?: number;
}

export default function Toast({ message, type = 'info', onClose, duration = 3000 }: ToastProps) {
  useEffect(() => {
    const timer = setTimeout(() => {
      onClose();
    }, duration);
    return () => clearTimeout(timer);
  }, [onClose, duration]);

  const bgColors = {
    success: 'bg-emerald-950/90 border-emerald-500/50 text-emerald-100',
    error: 'bg-red-950/90 border-red-500/50 text-red-100',
    info: 'bg-zinc-900/90 border-zinc-700/50 text-zinc-100',
  };

  const icons = {
    success: <CheckCircle2 size={20} className="text-emerald-500" />,
    error: <AlertCircle size={20} className="text-red-500" />,
    info: <AlertCircle size={20} className="text-zinc-500" />,
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: -50, scale: 0.9 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: -20, scale: 0.9 }}
      className={`fixed top-8 left-1/2 -translate-x-1/2 z-[100] flex items-center gap-3 px-6 py-4 rounded-xl border shadow-2xl backdrop-blur-md ${bgColors[type]}`}
    >
      {icons[type]}
      <span className="font-medium">{message}</span>
      <button onClick={onClose} className="ml-2 opacity-60 hover:opacity-100 transition-opacity">
        <X size={16} />
      </button>
    </motion.div>
  );
}
