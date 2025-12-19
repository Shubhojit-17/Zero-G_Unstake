'use client';

import { useState, useEffect, createContext, useContext, useCallback, ReactNode } from 'react';

type ToastType = 'success' | 'error' | 'info' | 'warning';

interface Toast {
  id: string;
  message: string;
  type: ToastType;
  duration?: number;
}

interface ToastContextType {
  showToast: (message: string, type?: ToastType, duration?: number) => void;
}

const ToastContext = createContext<ToastContextType | undefined>(undefined);

export function useToast() {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error('useToast must be used within a ToastProvider');
  }
  return context;
}

interface ToastProviderProps {
  children: ReactNode;
}

export function ToastProvider({ children }: ToastProviderProps) {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const showToast = useCallback((message: string, type: ToastType = 'info', duration: number = 5000) => {
    const id = Math.random().toString(36).substring(7);
    setToasts((prev) => [...prev, { id, message, type, duration }]);
  }, []);

  const removeToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((toast) => toast.id !== id));
  }, []);

  return (
    <ToastContext.Provider value={{ showToast }}>
      {children}
      <ToastContainer toasts={toasts} removeToast={removeToast} />
    </ToastContext.Provider>
  );
}

interface ToastContainerProps {
  toasts: Toast[];
  removeToast: (id: string) => void;
}

function ToastContainer({ toasts, removeToast }: ToastContainerProps) {
  return (
    <div className="fixed top-4 right-4 z-[100] flex flex-col gap-3 max-w-sm">
      {toasts.map((toast) => (
        <ToastItem key={toast.id} toast={toast} onRemove={() => removeToast(toast.id)} />
      ))}
    </div>
  );
}

interface ToastItemProps {
  toast: Toast;
  onRemove: () => void;
}

function ToastItem({ toast, onRemove }: ToastItemProps) {
  const [isVisible, setIsVisible] = useState(false);
  const [isLeaving, setIsLeaving] = useState(false);

  useEffect(() => {
    // Trigger entrance animation
    requestAnimationFrame(() => setIsVisible(true));

    // Auto-remove after duration
    const timer = setTimeout(() => {
      setIsLeaving(true);
      setTimeout(onRemove, 300);
    }, toast.duration || 5000);

    return () => clearTimeout(timer);
  }, [toast.duration, onRemove]);

  const icons = {
    success: (
      <div className="toast-icon-success">
        <svg viewBox="0 0 24 24" className="w-5 h-5">
          <path
            fill="currentColor"
            d="M12,0A12,12,0,1,0,24,12,12.014,12.014,0,0,0,12,0Zm6.927,8.2-6.845,9.289a1.011,1.011,0,0,1-1.43.188L5.764,13.769a1,1,0,1,1,1.25-1.562l4.076,3.261,6.227-8.451A1,1,0,1,1,18.927,8.2Z"
          />
        </svg>
      </div>
    ),
    error: (
      <div className="toast-icon-error">
        <svg viewBox="0 0 24 24" className="w-5 h-5">
          <path
            fill="currentColor"
            d="M12,0A12,12,0,1,0,24,12,12.014,12.014,0,0,0,12,0Zm5.656,16.243a.93.93,0,0,1-1.313,1.313L12,13.313,7.657,17.657a.928.928,0,0,1-1.313-1.313L10.687,12,6.343,7.657A.928.928,0,0,1,7.657,6.343L12,10.687l4.343-4.343a.928.928,0,0,1,1.313,1.313L13.313,12Z"
          />
        </svg>
      </div>
    ),
    warning: (
      <div className="toast-icon-warning">
        <svg viewBox="0 0 24 24" className="w-5 h-5">
          <path
            fill="currentColor"
            d="M23.32,17.191L15.438,2.184C14.728.833,13.416,0,12,0S9.272.833,8.562,2.184L.68,17.191A4.462,4.462,0,0,0,4.463,24H19.537a4.462,4.462,0,0,0,3.783-6.809ZM11,6h2V15H11Zm1,13a1.5,1.5,0,1,1,1.5-1.5A1.5,1.5,0,0,1,12,19Z"
          />
        </svg>
      </div>
    ),
    info: (
      <div className="toast-icon-info">
        <svg viewBox="0 0 24 24" className="w-5 h-5">
          <path
            fill="currentColor"
            d="M12,0A12,12,0,1,0,24,12,12.013,12.013,0,0,0,12,0Zm.25,5a1.5,1.5,0,1,1-1.5,1.5A1.5,1.5,0,0,1,12.25,5ZM14.5,18.5h-4a1,1,0,0,1,0-2h.75a.25.25,0,0,0,.25-.25v-4.5a.25.25,0,0,0-.25-.25H10.5a1,1,0,0,1,0-2h1a2,2,0,0,1,2,2v4.75a.25.25,0,0,0,.25.25h.75a1,1,0,1,1,0,2Z"
          />
        </svg>
      </div>
    ),
  };

  const bgColors = {
    success: 'bg-gradient-to-r from-green-500/20 to-emerald-500/20 border-green-500/50',
    error: 'bg-gradient-to-r from-red-500/20 to-rose-500/20 border-red-500/50',
    warning: 'bg-gradient-to-r from-amber-500/20 to-yellow-500/20 border-amber-500/50',
    info: 'bg-gradient-to-r from-blue-500/20 to-cyan-500/20 border-blue-500/50',
  };

  return (
    <div
      className={`
        toast-notification
        ${bgColors[toast.type]}
        ${isVisible && !isLeaving ? 'toast-enter' : ''}
        ${isLeaving ? 'toast-leave' : ''}
      `}
    >
      <div className="flex items-start gap-3">
        {icons[toast.type]}
        <div className="flex-1">
          <p className="text-sm font-medium text-white">{toast.message}</p>
        </div>
        <button
          onClick={() => {
            setIsLeaving(true);
            setTimeout(onRemove, 300);
          }}
          className="toast-close-btn"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>
      
      {/* Progress bar */}
      <div className="toast-progress">
        <div
          className="toast-progress-bar"
          style={{ animationDuration: `${toast.duration || 5000}ms` }}
        />
      </div>
    </div>
  );
}
