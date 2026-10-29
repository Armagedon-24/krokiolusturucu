import React, { useEffect } from 'react';
import { Topbar } from './components/Topbar/Topbar';
import { Sidebar } from './components/Sidebar/Sidebar';
import { CanvasArea } from './components/Canvas/CanvasArea';
import { useStore } from './store/useStore';
import { NotificationSystem } from './components/UI/NotificationSystem';
import { ConfirmModal } from './components/UI/ConfirmModal';
import { Loader2, Cloud } from 'lucide-react';

function App() {
  const { 
    addNotification, 
    undo, 
    redo, 
    removeObject, 
    selectedId,
    refreshSymbols,
    restoreFromCloud,
    clearCanvas
  } = useStore();

  const [isInitialLoading, setIsInitialLoading] = React.useState(true);

  // Automatic synchronization on startup
  useEffect(() => {
    const init = async () => {
      try {
        refreshSymbols();
        // Always restore cloud symbols/settings, but start with a blank canvas
        await restoreFromCloud();
        // Always clear to blank canvas on page load — user must open a file from Case Manager
        clearCanvas();
      } catch (error) {
        console.error('Initialization error:', error);
      } finally {
        setIsInitialLoading(false);
      }
    };
    
    init();
  }, [refreshSymbols, restoreFromCloud, clearCanvas]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) {
        return;
      }

      if (e.ctrlKey || e.metaKey) {
        if (e.key.toLowerCase() === 'z') {
          e.preventDefault();
          undo();
        } else if (e.key.toLowerCase() === 'y') {
          e.preventDefault();
          redo();
        }
      } else if (e.key === 'Delete') {
        if (selectedId) {
          removeObject(selectedId);
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [undo, redo, removeObject, selectedId, addNotification]);

  useEffect(() => {
    // Security Measures: Prevent right-click, copying, and printing
    const handleContextMenu = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (!(target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement || target.closest('.konvajs-content'))) {
        e.preventDefault();
      }
    };

    const handleCopy = (e: ClipboardEvent) => {
      if (!(document.activeElement instanceof HTMLInputElement || document.activeElement instanceof HTMLTextAreaElement)) {
        e.preventDefault();
        addNotification({
          type: 'warning',
          message: 'Güvenlik Uyarısı',
          description: 'İçerik kopyalama bu alanda kısıtlanmıştır.'
        });
      }
    };

    const handleKeyDownSecurity = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's') {
        e.preventDefault();
      }
    };

    // Domain Check (Anti-Cloning)
    const checkDomain = () => {
      const allowedDomains = ['localhost', '127.0.0.1', 'kroki-olusturucu.vercel.app', 'kroki-olusturucu-yedek.vercel.app', 'kroki-olusturucu.com'];
      // Kendi Vercel hesabımıza ait tüm deployment URL'leri (üretim + önizlemeler) serbest:
      // ör. kroki-olusturucu-abc123-hakanvarlik242424-6523s(-projects).vercel.app
      const vercelAccountSuffixes = ['-hakanvarlik242424-6523s-projects.vercel.app', '-hakanvarlik242424-6523s.vercel.app'];
      const hostname = window.location.hostname;
      const isAllowed =
        allowedDomains.some(domain => hostname === domain || hostname.endsWith('.' + domain)) ||
        // Bu projeye ait tüm Vercel deployment/önizleme URL'leri: kroki-olusturucu-<hash>-<takim>.vercel.app
        (hostname.endsWith('.vercel.app') && hostname.startsWith('kroki-olusturucu-')) ||
        vercelAccountSuffixes.some(suffix => hostname.endsWith(suffix));
      if (!isAllowed) {
        const root = document.getElementById('root');
        if (root) {
          while (root.firstChild) root.removeChild(root.firstChild);
          const div = document.createElement('div');
          div.style.cssText = 'height: 100vh; background: #000; color: #ff0000; display: flex; flex-direction: column; align-items: center; justify-content: center; font-family: sans-serif; text-align: center; padding: 20px;';
          const h1 = document.createElement('h1');
          h1.style.cssText = 'font-size: 48px; margin-bottom: 20px;';
          h1.textContent = 'LISANS IHLALI';
          const p = document.createElement('p');
          p.style.cssText = 'font-size: 18px;';
          p.textContent = 'Bu uygulama yetkisiz bir domain üzerinden çalıştırılmaktadır. Lütfen orijinal adresi kullanın.';
          div.appendChild(h1);
          div.appendChild(p);
          root.appendChild(div);
        }
      }
    };

    checkDomain();
    document.addEventListener('contextmenu', handleContextMenu);
    document.addEventListener('copy', handleCopy);
    window.addEventListener('keydown', handleKeyDownSecurity);

    return () => {
      document.removeEventListener('contextmenu', handleContextMenu);
      document.removeEventListener('copy', handleCopy);
      window.removeEventListener('keydown', handleKeyDownSecurity);
    };
  }, [addNotification]);

  return (
    <div className="flex flex-col h-full bg-[#111111] font-sans text-gray-100 overflow-hidden">
      {isInitialLoading && (
        <div className="fixed inset-0 z-[99999] bg-[#0a0a0a] flex flex-col items-center justify-center gap-6 animate-in fade-in duration-500">
          <div className="relative">
            <div className="absolute inset-0 bg-[#F5C518]/20 blur-3xl rounded-full animate-pulse" />
            <div className="relative p-6 bg-[#111] border border-[#222] rounded-3xl shadow-2xl">
              <Cloud className="text-[#F5C518] animate-bounce" size={64} />
              <Loader2 className="absolute -bottom-2 -right-2 text-[#F5C518] animate-spin" size={32} />
            </div>
          </div>
          <div className="flex flex-col items-center gap-2">
            <h2 className="text-xl font-black tracking-widest text-white uppercase italic">KROKİ OLUŞTURUCU</h2>
            <div className="flex items-center gap-3 px-4 py-2 bg-white/5 rounded-full border border-white/10">
              <div className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse" />
              <span className="text-[10px] font-bold text-gray-400 uppercase tracking-tighter">Bulut Verileri Senkronize Ediliyor...</span>
            </div>
          </div>
          <p className="text-[9px] text-gray-600 font-medium max-w-[200px] text-center leading-relaxed">
            Kütüphane, favoriler ve kişisel ayarlarınız en güncel haliyle yükleniyor.
          </p>
        </div>
      )}

      <Topbar />
      <main className="flex flex-1 overflow-hidden relative" id="main-content">
        <Sidebar />
        <CanvasArea />
      </main>
      <NotificationSystem />
      <ConfirmModal />
      
      {/* Global SVG Filters */}
      <svg style={{ position: 'absolute', width: 0, height: 0 }}>
        <filter id="remove-white-svg">
          <feColorMatrix type="matrix" values="
            1 0 0 0 0
            0 1 0 0 0
            0 0 1 0 0
            -3 -3 -3 8 0
          " />
        </filter>
      </svg>
    </div>
  );
}

export default App;
