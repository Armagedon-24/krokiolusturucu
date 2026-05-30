import React, { useState } from 'react';
import { X, KeyRound, Loader2 } from 'lucide-react';

interface AdminLoginModalProps {
  isOpen: boolean;
  onClose: () => void;
  onLogin: (password: string) => void;
}

export const AdminLoginModal: React.FC<AdminLoginModalProps> = ({ isOpen, onClose, onLogin }) => {
  const [password, setPassword] = useState('');
  const [error, setError] = useState(false);
  const [isValidating, setIsValidating] = useState(false);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!password) return;

    setIsValidating(true);
    setError(false);

    try {
      const response = await fetch('/api/verify-auth', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password })
      });

      if (response.ok) {
        onLogin(password);
        setPassword('');
        setError(false);
        onClose();
      } else {
        setError(true);
        setTimeout(() => setError(false), 2000);
      }
    } catch (err) {
      console.error('Giriş hatası:', err);
      setError(true);
      setTimeout(() => setError(false), 2000);
    } finally {
      setIsValidating(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
      <div className="w-full max-w-sm bg-[#1a1a1a] border border-[#333] rounded-xl shadow-2xl overflow-hidden animate-in fade-in zoom-in duration-200">
        <div className="flex items-center justify-between p-4 border-b border-[#2a2a2a] bg-[#242424]">
          <div className="flex items-center gap-2">
            <div className="w-20 h-20 flex items-center justify-center">
              <img src="/logo.png" className="w-full h-full object-contain" alt="Logo" />
            </div>
            <h2 className="text-sm font-bold text-white uppercase tracking-wider">ADMİN GİRİŞİ</h2>
          </div>
          <button 
            onClick={onClose}
            className="text-gray-500 hover:text-white transition-colors"
          >
            <X size={20} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div className="space-y-2">
            <label className="text-[10px] font-bold text-gray-500 uppercase tracking-widest ml-1">
              ADMİN ŞİFRESİ
            </label>
            <div className="relative">
              <KeyRound size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" />
              <input
                autoFocus
                disabled={isValidating}
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className={`w-full bg-[#111] border ${error ? 'border-red-500' : 'border-[#333]'} rounded-lg py-3 pl-10 pr-4 text-white text-sm outline-none focus:border-[#F5C518] transition-all disabled:opacity-50`}
              />
            </div>
            {error && (
              <p className="text-red-500 text-[10px] font-bold mt-1 text-center animate-bounce">
                HATALI ŞİFRE! TEKRAR DENEYİN.
              </p>
            )}
          </div>

          <button
            type="submit"
            disabled={isValidating}
            className="w-full bg-[#F5C518] hover:bg-[#d4a017] text-black font-black py-3 rounded-lg transition-all shadow-lg active:scale-95 text-sm tracking-widest flex items-center justify-center gap-2 disabled:opacity-50"
          >
            {isValidating ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>DOĞRULANIYOR...</span>
              </>
            ) : (
              <span>GİRİŞ YAP</span>
            )}
          </button>
        </form>
        
        <div className="p-3 bg-[#111] border-t border-[#2a2a2a] text-center">
          <p className="text-[9px] text-gray-600 font-medium">
            Kroki Oluşturucu V2 - Güvenli Erişim
          </p>
        </div>
      </div>
    </div>
  );
};
