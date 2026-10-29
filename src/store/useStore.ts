import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { CanvasObject, CanvasState, ProjectInfo, Symbol, ScaleCalibration, AccidentReconstruction, AccidentAnimationState, FallAnimationState, PedestrianLaunchAnimationState, ShotDirectionAnimationState, VehicleData, PedestrianData, SavedAnimation } from '../types';
import { v4 as uuidv4 } from 'uuid';
import { SYMBOL_CATEGORIES } from '../constants/symbols';
import { createKrokiTemplate, createDiagramTemplate } from '../constants/templates';
import { cloudinary as cloud, publicIdFromUrl } from '../lib/cloudinary';

const TODAY = new Date().toISOString().split('T')[0];
const DEFAULT_DRAWING_AREA = { x: 17, y: 167, width: 966, height: 1126 } as const;

export interface Notification {
  id: string;
  type: 'success' | 'error' | 'info' | 'warning';
  message: string;
  description?: string;
}

interface StoreState extends CanvasState {
  addObject: (obj: Partial<CanvasObject>) => void;
  addUploadedImage: (img: { id: string, src: string, name: string, category?: string, group?: string }, opts?: { allowDeletedName?: boolean }) => void;
  removeUploadedImage: (id: string) => void;
  updateUploadedImage: (id: string, category?: string, group?: string, name?: string) => void;
  updateObject: (id: string, updates: Partial<CanvasObject>, skipHistory?: boolean) => void;
  removeObject: (id: string) => void;
  removeObjects: (ids: string[]) => void;
  clearObjects: () => void;
  setSelectedId: (id: string | null) => void;
  setBackgroundImage: (src: string | null) => void;
  setBackgroundOpacity: (opacity: number) => void;
  setBackgroundGrayscale: (grayscale: boolean) => void;
  setCanvasBgColor: (color: string) => void;
  setCanvasOrientation: (orientation: 'landscape' | 'portrait') => void;
  isSidebarOpen: boolean;
  toggleSidebar: () => void;
  notifications: Notification[];
  addNotification: (notification: Omit<Notification, 'id'>) => void;
  removeNotification: (id: string) => void;
  undo: () => void;
  redo: () => void;
  saveHistory: () => void;
  loadProject: (data: { objects: CanvasObject[], backgroundImage: string | null }) => void;
  clearCanvas: () => void;
  updateProjectInfo: (updates: Partial<ProjectInfo>) => void;
  applyTemplate: (type: 'kroki' | 'diagram') => void;
  removeSymbol: (catId: string, symbolId: string) => void;
  setAllSymbols: (allSymbols: readonly { readonly id: string, readonly name: string, readonly symbols: readonly Symbol[] }[]) => void;
  isAdmin: boolean;
  setIsAdmin: (isAdmin: boolean, password?: string) => void;
  syncToCloud: (silent?: boolean) => void;
  restoreFromCloud: (silent?: boolean) => Promise<boolean>;
  adminSettings: {
    logoConfig?: {
      x: number;
      y: number;
      width: number;
      height: number;
      rotation: number;
      scaleX: number;
      scaleY: number;
    };
    hiddenSymbolIds?: string[];
    deletedAssetIds?: string[];
    deletedSceneIds?: string[];
  };
  updateAdminSettings: (settings: Partial<{ logoConfig?: { x: number; y: number; width: number; height: number; rotation: number; scaleX: number; scaleY: number }; hiddenSymbolIds?: string[]; deletedAssetIds?: string[]; deletedSceneIds?: string[] }>) => void;
  refreshSymbols: () => void;
  global3DDefaults: Record<string, { height: number, wallThickness?: number, textures?: Record<string, string> }>;
  updateGlobal3DDefault: (symbolId: string, data: { height: number, wallThickness?: number, textures?: Record<string, string> }) => void;

  recoverCloudinaryImages: () => Promise<void>;
  clearCloudConfig: () => Promise<void>;
  corporateLogoConfig?: {
    x: number;
    y: number;
    width: number;
    height: number;
    rotation: number;
    scaleX: number;
    scaleY: number;
  };

  // Case/Scene Management
  addScene: (name: string) => void;
  switchScene: (id: string) => void;
  removeScene: (id: string) => void;
  updateSceneName: (id: string, name: string) => void;
  addNewPage: (name: string, type: 'kroki' | 'diagram') => void;
  exportPDFRef: (() => void) | null;
  triggerExportPDF: () => void;

  // 3D Visual Settings
  updateVisualSettings: (updates: Partial<CanvasState['visualSettings']>) => void;

  // Canvas export callback for fall animation save
  fallAnimationExportRef: (() => Promise<void>) | null;
  triggerFallAnimationExport: () => Promise<void>;

  // Custom Confirm Dialog
  confirmDialog: {
    isOpen: boolean;
    title: string;
    message: string;
    onConfirm: () => void;
    onCancel?: () => void;
  };
  showConfirm: (data: { title: string; message: string; onConfirm: () => void; onCancel?: () => void }) => void;
  hideConfirm: () => void;

  // Scale Calibration
  scaleCalibration: ScaleCalibration;
  setScaleCalibration: (calibration: ScaleCalibration) => void;

  // Accident Reconstruction
  accidentReconstruction: AccidentReconstruction;
  accidentAnimation: AccidentAnimationState;
  fallAnimation: FallAnimationState;
  setAccidentData: (data: Partial<AccidentReconstruction>) => void;
  setAccidentVehicle: (index: 0 | 1, data: Partial<VehicleData>) => void;
  addPedestrian: (data?: Partial<PedestrianData>) => void;
  updatePedestrian: (id: string, data: Partial<PedestrianData>) => void;
  removePedestrian: (id: string) => void;
  setAccidentAnimation: (data: Partial<AccidentAnimationState>) => void;
  setFallAnimation: (data: Partial<FallAnimationState>) => void;
  resetAccidentReconstruction: () => void;

  // Pedestrian Launch
  pedestrianLaunch: PedestrianLaunchAnimationState;
  setPedestrianLaunch: (data: Partial<PedestrianLaunchAnimationState>) => void;

  // Shot Direction
  shotDirection: ShotDirectionAnimationState;
  setShotDirection: (data: Partial<ShotDirectionAnimationState>) => void;

  // Saved Animations
  savedAnimations: SavedAnimation[];
  saveAnimation: (name: string) => void;
  loadAnimation: (id: string) => void;
  deleteAnimation: (id: string) => void;
}

const MAX_HISTORY = 50;

// Bulut adminSettings önbelleği (60 sn) — her senkronda tam config indirmeyi önler
let _cloudAdminCache: { at: number; admin: any } | null = null;
const fetchCloudAdminSettings = async (): Promise<any> => {
  if (_cloudAdminCache && Date.now() - _cloudAdminCache.at < 60000) {
    return _cloudAdminCache.admin;
  }
  const data = await cloud.load();
  const admin = data?.projectState?.adminSettings || {};
  _cloudAdminCache = { at: Date.now(), admin };
  return admin;
};

export const useStore = create<StoreState>()(
  persist(
    (set, get) => ({
      objects: [],
      allSymbols: SYMBOL_CATEGORIES,
      uploadedImages: [],
      backgroundImage: null,
      backgroundOpacity: 1,
      backgroundGrayscale: false,
      selectedId: null,
      canvasBgColor: '#ffffff',
      canvasOrientation: 'portrait',
      isSidebarOpen: true,
      notifications: [],
      scenes: [],
      archiveScenes: [],
      activeSceneId: null,
      visualSettings: {
        nightMode: false,
        flashlight: false,
        exposure: 1,
        showGrid: true,
        ambientIntensity: 0.5,
        sunAngle: 45,
        floorTexture: 'none',
        showWalkthrough: false,
      },
      projectInfo: {
        type: 'kroki',
        eventName: '',
        reportNo: '',
        address: '',
        date: TODAY,
        sketchedBy: '',
        diagramType: 'OTOMOBİL DİYAGRAMI',
        description: '',
        expert2: '',
        corporateLogoConfig: undefined,
      },
      diagramInfo: {
        type: 'diagram',
        eventName: '',
        reportNo: '',
        address: '',
        date: TODAY,
        sketchedBy: '',
        diagramType: 'OTOMOBİL DİYAGRAMI',
        description: '',
        expert2: '',
        corporateLogoConfig: undefined,
      },
      drawingArea: DEFAULT_DRAWING_AREA,
      krokiInfo: {
        type: 'kroki',
        eventName: '',
        reportNo: '',
        address: '',
        date: TODAY,
        sketchedBy: '',
        diagramType: '',
        description: '',
        expert2: '',
        corporateLogoConfig: undefined,
      },
      adminSettings: {
        logoConfig: undefined,
        hiddenSymbolIds: [],
        deletedAssetIds: [],
        deletedSceneIds: [],
      },
      global3DDefaults: {},
      confirmDialog: {
        isOpen: false,
        title: '',
        message: '',
        onConfirm: () => {},
      },
      scaleCalibration: {
        pixelDistance: 50,
        realDistance: 100,
        unit: 'cm',
      },
      savedAnimations: [],
      accidentReconstruction: {
        enabled: false,
        vehicles: [
          {
            id: 'v1',
            type: 'car',
            name: 'Araç 1',
            color: '#E53935',
            startX: 200,
            startY: 500,
            startRotation: 0,
            initialSpeed: 60,
            brakeReactionTime: 0.8,
            brakeEfficiency: 85,
            brakeMarkLength: 20,
            brakeMarkWidth: 0.3,
            brakeMarkType: 'straight',
            brakeMarkCurvature: 0,
            collisionX: 600,
            collisionY: 500,
            impactSpeed: 30,
            impactAngle: 0,
            finalX: 700,
            finalY: 500,
            finalRotation: 0,
            showPath: true,
            showBrakeMarks: true,
            showVehicle: true,
            evasiveAction: 'none',
            evasiveOffset: 0,
            evasiveStartProgress: 0.3,
          },
        ],
        pedestrians: [],
        roadSurface: 'asphalt_dry',
        frictionCoefficient: 0.7,
        speedLimit: 50,
        weather: 'clear',
        lighting: 'daylight',
        roadType: 'urban',
        animationDuration: 5,
        autoCalculateBraking: false,
        notes: '',
      },
      accidentAnimation: {
        isPlaying: false,
        currentTime: 0,
        speed: 1,
        loop: false,
        showTimeline: false,
      },
      fallAnimation: {
        isOpen: false,
        isPlaying: false,
        currentTime: 0,
        speed: 1,
        loop: false,
        duration: 2,
        canvasData: null,
      },
      pedestrianLaunch: {
        isOpen: false,
        isPlaying: false,
        currentTime: 0,
        speed: 1,
        loop: false,
        duration: 3,
        canvasData: null,
      },
      shotDirection: {
        isOpen: false,
        isPlaying: false,
        currentTime: 0,
        speed: 1,
        loop: false,
        duration: 3,
        canvasData: null,
      },
      showConfirm: (data) => set({ 
        confirmDialog: { ...data, isOpen: true } 
      }),
      hideConfirm: () => set((state) => ({ 
        confirmDialog: { ...state.confirmDialog, isOpen: false } 
      })),
      updateGlobal3DDefault: (symbolId, data) => {
        set((state) => ({
          global3DDefaults: {
            ...state.global3DDefaults,
            [symbolId]: data
          }
        }));
      },
      updateAdminSettings: (updates) => {
        set((state) => ({
          adminSettings: { ...state.adminSettings, ...updates }
        }));
      },
      symbolUsage: {},
      history: [[]],
      historyIndex: 0,
      isAdmin: false,
      adminPassword: null,

      addObject: (obj) => {
        let width = obj.type === 'text' ? 200 : 100;
        let height = obj.type === 'text' ? 50 : 100;

        if (obj.symbolId === 'arch-w1') { width = 200; height = 10; }
        else if (obj.symbolId === 'arch-w1v') { width = 10; height = 200; }
        else if (obj.symbolId === 'arch-w1i') { width = 200; height = 8; }
        else if (obj.symbolId === 'arch-w1vi') { width = 8; height = 200; }
        else if (obj.symbolId === 'arch-win') { width = 60; height = 15; } // Window
        else if (['arch-d1r', 'arch-d1l'].includes(obj.symbolId || '')) { width = 60; height = 60; } // Single Doors
        else if (obj.symbolId === 'arch-d2') { width = 120; height = 60; } // Double Door
        else if (obj.symbolId === 'arch-6') { width = 70; height = 150; }
        else if (obj.symbolId === 'arch-6l') { width = 100; height = 100; }
        else if (obj.symbolId === 'arch-6u') { width = 80; height = 120; }
        else if (obj.symbolId === 'arch-6s') { width = 100; height = 100; }
        else if (obj.symbolId === 'arch-6sf') { width = 80; height = 150; }
        else if (obj.symbolId === 'arch-villa-f') { width = 200; height = 100; }
        else if (obj.symbolId === 'arch-villa-t') { width = 200; height = 150; }

        const existingObjects = get().objects;
        const maxZ = existingObjects.reduce((max, o) => Math.max(max, o.zIndex || 0), -1);

        const newObj: CanvasObject = {
          id: uuidv4(),
          type: 'image',
          x: 150,
          y: 150,
          width,
          height,
          rotation: 0,
          scaleX: obj.defaultScaleX || 1,
          scaleY: obj.defaultScaleY || 1,
          distanceColor: '#000000',
          ratioFixed: false,
          zHeight: 0,
          ...obj,
          zIndex: maxZ + 1,
        };

        const drawingArea = get().drawingArea;
        if (drawingArea && !obj.isTemplate) {
          let w = obj.width || width;
          let h = obj.height || height;
          
          if (w > drawingArea.width - 10 || h > drawingArea.height - 10) {
            const scale = Math.min(
              (drawingArea.width - 10) / w,
              (drawingArea.height - 10) / h
            );
            w = w * scale;
            h = h * scale;
            newObj.width = w;
            newObj.height = h;
          }

          // Grid Snapping (20px)
          const gridSize = 20;
          newObj.x = Math.round((newObj.x - drawingArea.x) / gridSize) * gridSize + drawingArea.x;
          newObj.y = Math.round((newObj.y - drawingArea.y) / gridSize) * gridSize + drawingArea.y;

          // Katı sınır: sembol tam olarak çizim alanı içine yerleştir
          newObj.x = Math.max(drawingArea.x, Math.min(newObj.x, drawingArea.x + drawingArea.width - w));
          newObj.y = Math.max(drawingArea.y, Math.min(newObj.y, drawingArea.y + drawingArea.height - h));
        }

        set((state) => ({
          objects: [...state.objects, newObj],
          selectedId: newObj.id,
          symbolUsage: obj.symbolId 
            ? { ...state.symbolUsage, [obj.symbolId]: (state.symbolUsage[obj.symbolId] || 0) + 1 }
            : state.symbolUsage
        }));
        get().saveHistory();
      },

      addUploadedImage: async (img, opts) => {
        // Mükerrer kontrolü: isim, ham src VE Cloudinary public_id üzerinden
        // (transform parametreleri farklı URL'ler aynı görsel olarak sayılır)
        const imgPid = publicIdFromUrl(img.src);
        const isDuplicateInUploads = get().uploadedImages.some(existing => {
          if (existing.name === img.name || existing.src === img.src) return true;
          if (imgPid && publicIdFromUrl(existing.src) === imgPid) return true;
          return false;
        });

        const isDuplicateInPredefined = get().allSymbols.some(cat =>
          cat.symbols.some((s: any) => {
            if (s.name === img.name || s.src === img.src) return true;
            if (imgPid && publicIdFromUrl(s.src) === imgPid) return true;
            return false;
          })
        );

        // Daha önce kalıcı olarak silinmiş bir görsel aynı adla tekrar eklenemez
        // (Bulut Galerisi'nden açık talep ile geri yükleme istisnadır)
        if (!opts?.allowDeletedName) {
          const deletedKeys = new Set<string>(get().adminSettings.deletedAssetIds || []);
          if (img.name && deletedKeys.has('name:' + img.name.trim().toLowerCase())) {
            get().addNotification({
              type: 'warning',
              message: 'Mükerrer Kayıt Engellendi',
              description: `"${img.name}" daha önce kalıcı olarak silindi. Geri yüklemek için Bulut Galerisi'nden seçin.`
            });
            return;
          }
        }

        if (isDuplicateInUploads || isDuplicateInPredefined) {
          get().addNotification({
            type: 'warning',
            message: 'Mükerrer Kayıt Engellendi',
            description: `"${img.name}" isimli görsel veya benzer bir kayıt kütüphanede zaten mevcut.`
          });
          return;
        }

        let finalSrc = img.src;

        if (get().isAdmin && img.src.startsWith('data:')) {
          try {
            const response = await fetch(img.src);
            const blob = await response.blob();
            
            const cleanName = img.name;

            const publicUrl = await cloud.upload(blob, cleanName, img.category);
            finalSrc = publicUrl;
          } catch (error: unknown) {
            console.error('Bulut yükleme hatası:', error);
            get().addNotification({
              type: 'error',
              message: 'Görsel Buluta Yüklenemedi',
              description: error instanceof Error ? error.message : 'İnternet bağlantınızı kontrol edin ve admin oturumunuzun açık olduğundan emin olun. Görsel şimdilik sadece yerel olarak eklendi.'
            });
          }
        }

        if (get().uploadedImages.some(existing => existing.src === finalSrc)) {
          return;
        }

        set((state) => ({
          uploadedImages: [...state.uploadedImages, { 
            ...img, 
            src: finalSrc, 
            category: img.category || 'uncategorized',
            group: img.group || ''
          }]
        }));

        if (get().isAdmin) {
          get().syncToCloud(true);
        }
      },

      removeUploadedImage: async (id) => {
        const isAdmin = get().isAdmin;
        const targetImg = get().uploadedImages.find(img => img.id === id);

        if (isAdmin && targetImg) {
          try {
            // Buluttan da kalıcı olarak sil (yetkilendirme token'ı ile)
            await cloud.delete(targetImg.src, get().adminPassword || '');
          } catch (error: unknown) {
            console.error('Bulut silme hatası:', error);
          }
        }

        // Kalıcı silme anahtarları: yerel id + Cloudinary public_id + ham src + dosya adı.
        // Bulut taraması (recoverCloudinaryImages) bu anahtarlarla eşleşen görselleri
        // ASLA geri getirmez; "sildiğim görseller tekrar gelmesin" garantisi.
        const graveKeys: string[] = [id];
        if (targetImg) {
          const pid = publicIdFromUrl(targetImg.src);
          if (pid) graveKeys.push(pid);
          if (targetImg.src) graveKeys.push(targetImg.src);
          if (targetImg.name) graveKeys.push('name:' + targetImg.name.trim().toLowerCase());
        }

        set((state) => ({
          uploadedImages: state.uploadedImages.filter((img) => img.id !== id),
          adminSettings: {
            ...state.adminSettings,
            deletedAssetIds: Array.from(new Set([...(state.adminSettings.deletedAssetIds || []), ...graveKeys]))
          }
        }));

        if (isAdmin) {
          get().syncToCloud(true);
          get().addNotification({
            type: 'info',
            message: 'Görsel Silindi',
            description: 'Görsel kütüphaneden ve bulut deposundan kalıcı olarak kaldırıldı.'
          });
        }
      },

      updateUploadedImage: (id, category, group, name) => {
        set((state) => ({
          uploadedImages: state.uploadedImages.map((img) =>
            img.id === id ? { 
              ...img, 
              category: category !== undefined ? category : img.category, 
              group: group !== undefined ? group : img.group,
              name: name !== undefined ? name : img.name
            } : img
          )
        }));
        if (get().isAdmin) {
          get().syncToCloud(true);
        }
      },

      updateObject: (id, updates, skipHistory = false) => {
        set((state) => {
          const newObjects = state.objects.map((obj) =>
            obj.id === id ? { ...obj, ...updates } : obj
          );

          if (id === 'corporate-logo') {
            const logo = newObjects.find(obj => obj.id === 'corporate-logo');
            if (logo) {
              const config = {
                x: logo.x,
                y: logo.y,
                width: logo.width,
                height: logo.height,
                rotation: logo.rotation,
                scaleX: logo.scaleX || 1,
                scaleY: logo.scaleY || 1,
              };
              
              const updatedInfo = { ...state.projectInfo, corporateLogoConfig: config };
              
              return { 
                objects: newObjects,
                corporateLogoConfig: config,
                projectInfo: updatedInfo,
                adminSettings: { ...state.adminSettings, logoConfig: config },
                krokiInfo: { ...state.krokiInfo, corporateLogo: updatedInfo.corporateLogo, corporateLogoConfig: config },
                diagramInfo: { ...state.diagramInfo, corporateLogo: updatedInfo.corporateLogo, corporateLogoConfig: config }
              };
            }
          }

          return { objects: newObjects };
        });
        if (!skipHistory) get().saveHistory();
      },

      removeObject: (id) => {
        set((state) => ({
          objects: state.objects.filter((obj) => obj.id !== id),
          selectedId: state.selectedId === id ? null : state.selectedId,
        }));
        get().saveHistory();
      },

      removeObjects: (ids) => {
        set((state) => ({
          objects: state.objects.filter((obj) => !ids.includes(obj.id)),
          selectedId: state.selectedId && ids.includes(state.selectedId) ? null : state.selectedId,
        }));
        get().saveHistory();
      },

      clearObjects: () => {
        set({ objects: [], selectedId: null });
        get().saveHistory();
      },

      setSelectedId: (id) => set({ selectedId: id }),

      setBackgroundImage: (src) => {
        set({ backgroundImage: src });
        get().saveHistory();
      },

      setBackgroundOpacity: (opacity) => {
        set({ backgroundOpacity: opacity });
      },

      setBackgroundGrayscale: (grayscale) => {
        set({ backgroundGrayscale: grayscale });
        get().saveHistory();
      },

      setCanvasBgColor: (color) => {
        set({ canvasBgColor: color });
        get().saveHistory();
      },

      setCanvasOrientation: (orientation) => {
        set({ canvasOrientation: orientation });
        get().saveHistory();
      },

      toggleSidebar: () => {
        set((state) => ({ isSidebarOpen: !state.isSidebarOpen }));
      },

      addNotification: (n) => {
        const id = uuidv4();
        set((state) => ({
          notifications: [...state.notifications, { ...n, id }]
        }));
        setTimeout(() => {
          get().removeNotification(id);
        }, 5000);
      },

      removeNotification: (id) => {
        set((state) => ({
          notifications: state.notifications.filter((n) => n.id !== id)
        }));
      },

      saveHistory: () => {
        const { objects, history, historyIndex, activeSceneId, scenes, archiveScenes, backgroundImage, projectInfo, drawingArea } = get();
        
        // Don't save if nothing changed
        if (historyIndex >= 0 && JSON.stringify(objects) === JSON.stringify(history[historyIndex])) {
          return;
        }

        const newHistory = history.slice(0, historyIndex + 1);
        newHistory.push([...objects]);
        
        if (newHistory.length > MAX_HISTORY) {
          newHistory.shift();
        }

        let updatedScenes = scenes;
        let updatedArchive = archiveScenes || [];
        if (activeSceneId && scenes.length > 0) {
          updatedScenes = scenes.map((s: any) => s.id === activeSceneId ? { ...s, objects: [...objects], backgroundImage, projectInfo: { ...projectInfo }, drawingArea } : s);
          updatedArchive = updatedArchive.map((s: any) => s.id === activeSceneId ? { ...s, objects: [...objects], backgroundImage, projectInfo: { ...projectInfo }, drawingArea } : s);
        }

        set({
          history: newHistory,
          historyIndex: newHistory.length - 1,
          scenes: updatedScenes,
          archiveScenes: updatedArchive,
        });
      },

      undo: () => {
        const { history, historyIndex } = get();
        if (historyIndex > 0) {
          const prevIndex = historyIndex - 1;
          set({
            objects: [...history[prevIndex]],
            historyIndex: prevIndex,
            selectedId: null,
          });
        }
      },

      redo: () => {
        const { history, historyIndex } = get();
        if (historyIndex < history.length - 1) {
          const nextIndex = historyIndex + 1;
          set({
            objects: [...history[nextIndex]],
            historyIndex: nextIndex,
            selectedId: null,
          });
        }
      },

      loadProject: (data: any) => {
        if (!data) return;
        
        set({
          objects: data.objects || [],
          backgroundImage: data.backgroundImage || null,
          backgroundOpacity: data.backgroundOpacity ?? 1,
          backgroundGrayscale: data.backgroundGrayscale ?? false,
          canvasBgColor: data.canvasBgColor || '#ffffff',
          canvasOrientation: data.canvasOrientation || 'portrait',
          drawingArea: data.drawingArea,
          projectInfo: data.projectInfo || {
            type: 'kroki',
            eventName: '',
            reportNo: '',
            address: '',
            date: TODAY,
            sketchedBy: '',
            diagramType: 'OTOMOBİL DİYAGRAMI',
            description: '',
            expert2: '',
          },
          krokiInfo: data.krokiInfo || data.projectInfo || { ...get().krokiInfo },
          diagramInfo: data.diagramInfo || { ...get().diagramInfo },
          selectedId: null,
          history: [data.objects || []],
          historyIndex: 0,
        });
      },

      clearCanvas: () => {
        set({
          scenes: [],
          activeSceneId: null,
          objects: [],
          backgroundImage: null,
          selectedId: null,
      drawingArea: DEFAULT_DRAWING_AREA,
          projectInfo: {
            type: 'kroki',
            eventName: '',
            reportNo: '',
            address: '',
            date: TODAY,
            sketchedBy: '',
            diagramType: 'OTOMOBİL DİYAGRAMI',
            description: '',
            expert2: '',
          },
          krokiInfo: {
            type: 'kroki',
            eventName: '',
            reportNo: '',
            address: '',
            date: TODAY,
            sketchedBy: '',
            diagramType: '',
            description: '',
            expert2: '',
          },
          diagramInfo: {
            type: 'diagram',
            eventName: '',
            reportNo: '',
            address: '',
            date: TODAY,
            sketchedBy: '',
            diagramType: 'OTOMOBİL DİYAGRAMI',
            description: '',
            expert2: '',
          },
        });
        get().saveHistory();
      },

      updateProjectInfo: (updates) => {
        set((state) => {
          const isTypeSwitchOnly = Object.keys(updates).length === 1 && updates.type;
          
          let newProjectInfo;
          if (isTypeSwitchOnly && updates.type !== state.projectInfo.type) {
            const type = updates.type as 'kroki' | 'diagram';
            const savedInfo = type === 'kroki' ? state.krokiInfo : state.diagramInfo;
            newProjectInfo = { ...savedInfo, type };
          } else {
            newProjectInfo = { ...state.projectInfo, ...updates };
          }

          const corporateLogo = updates.corporateLogo !== undefined ? updates.corporateLogo : state.projectInfo.corporateLogo;
          const corporateLogoConfig = updates.corporateLogoConfig !== undefined ? updates.corporateLogoConfig : (state.projectInfo.corporateLogoConfig || state.corporateLogoConfig);

          const syncedInfo = { 
            ...newProjectInfo, 
            corporateLogo,
            corporateLogoConfig
          };

          // Info'lar arası senkronizasyon yaparken type alanını koru
          const pureUpdates = { ...updates } as any;
          delete pureUpdates.type;

          // Propagate the pure updates to all scenes so all pages/attachments stay perfectly in sync
          const updatedScenes = (state.scenes || []).map(s => {
            return {
              ...s,
              projectInfo: {
                ...s.projectInfo,
                ...pureUpdates,
                corporateLogo,
                corporateLogoConfig
              }
            };
          });

          // Also propagate updates to matching scenes in archiveScenes
          const updatedArchiveScenes = (state.archiveScenes || []).map(s => {
            const isActiveBeingUpdated = (state.scenes || []).some(activeS => activeS.id === s.id);
            if (isActiveBeingUpdated) {
              return {
                ...s,
                projectInfo: {
                  ...s.projectInfo,
                  ...pureUpdates,
                  corporateLogo,
                  corporateLogoConfig
                }
              };
            }
            return s;
          });

          return {
            projectInfo: syncedInfo,
            scenes: updatedScenes,
            archiveScenes: updatedArchiveScenes,
            krokiInfo: { ...(state.krokiInfo || {}), ...pureUpdates, type: 'kroki', corporateLogo, corporateLogoConfig },
            diagramInfo: { ...(state.diagramInfo || {}), ...pureUpdates, type: 'diagram', corporateLogo, corporateLogoConfig },
            corporateLogoConfig
          };
        });
        get().applyTemplate(get().projectInfo.type);
      },
      applyTemplate: (type) => {
        const orientation = get().canvasOrientation;
        const width = orientation === 'landscape' ? 1400 : 1000;
        const height = orientation === 'landscape' ? 1000 : 1400;
        const info = { ...get().projectInfo };
        
        // Eğer global bir logo ayarı varsa onu kullan
        if (get().adminSettings.logoConfig) {
          info.corporateLogoConfig = get().adminSettings.logoConfig;
        }
        
        let result: { objects: CanvasObject[], drawingArea: { x: number; y: number; width: number; height: number } };
        if (type === 'kroki') {
          result = createKrokiTemplate(width, height, info);
        } else {
          result = createDiagramTemplate(width, height, info);
        }

        set((state) => {
          const existingObjects = state.objects || [];
          // Preserve ONLY non-template user-drawn objects (symbols, lines, texts added by user) and corporate logo
          const userDrawnObjects = existingObjects.filter(
            (obj) => !obj.isTemplate || obj.id === 'corporate-logo' || obj.id?.startsWith('logo-')
          );
          
          const userHasLogo = userDrawnObjects.some(u => u.id === 'corporate-logo');
          const newTemplateObjects = result.objects.filter(
            t => !userHasLogo || (t.id !== 'corporate-logo' && t.id !== 'corporate-logo-box')
          );

          return {
            objects: [...newTemplateObjects, ...userDrawnObjects],
            drawingArea: result.drawingArea,
            selectedId: null,
          };
        });
        get().saveHistory();
      },
      removeSymbol: async (catId, symbolId) => {
        const isAdmin = get().isAdmin;
        let targetSrc = '';
        
        const category = get().allSymbols.find(c => c.id === catId);
        if (category) {
          const symbol = category.symbols.find((s: any) => s.id === symbolId);
          if (symbol) targetSrc = symbol.src;
        }

        if (isAdmin && targetSrc) {
          try {
            // Support for both Cloudinary and Vercel Blob
            if (targetSrc.includes('cloudinary.com') || targetSrc.includes('public.blob.vercel-storage.com')) {
              await cloud.delete(targetSrc, get().adminPassword || '');
            }
          } catch (error: unknown) {
            console.error('Bulut varlığı silinirken hata:', error);
          }
        }

        set((state) => ({
          allSymbols: state.allSymbols.map((cat) =>
            cat.id === catId
              ? { ...cat, symbols: cat.symbols.filter((s: any) => s.id !== symbolId) }
              : cat
          ),
          adminSettings: {
            ...state.adminSettings,
            hiddenSymbolIds: [...(state.adminSettings.hiddenSymbolIds || []), symbolId]
          }
        }));
        
        if (isAdmin) {
          get().syncToCloud(true);
        }
},

      setAllSymbols: (allSymbols) => {
        set({ allSymbols });
        if (get().isAdmin) {
          get().syncToCloud(true);
        }
      },

      setIsAdmin: (isAdmin: boolean, password?: string) => set({ isAdmin, adminPassword: isAdmin ? (password || null) : null }),

      syncToCloud: async (silent = false) => {
        const isLocalhost = typeof window !== 'undefined' &&
          (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1');
        if (isLocalhost) {
          return;
        }

        try {
          const { uploadedImages, allSymbols, objects, backgroundImage, projectInfo, scenes, archiveScenes = [], activeSceneId, visualSettings } = get();

          // KRİTİK: Silme listelerini buluttaki son haliyle BİRLEŞTİR.
          // Yeni sekme/cihazda yerel adminSettings boş olabilir; birleştirme yapılmadan
          // kaydedilirse buluttaki silme kayıtları silinir ve silinen SVG görseller geri gelir.
          let adminSettings = get().adminSettings;
          try {
            const cloudAdmin = await fetchCloudAdminSettings();
            adminSettings = {
              ...adminSettings,
              hiddenSymbolIds: Array.from(new Set([...(adminSettings.hiddenSymbolIds || []), ...(cloudAdmin.hiddenSymbolIds || [])])),
              deletedAssetIds: Array.from(new Set([...(adminSettings.deletedAssetIds || []), ...(cloudAdmin.deletedAssetIds || [])])),
              deletedSceneIds: Array.from(new Set([...(adminSettings.deletedSceneIds || []), ...(cloudAdmin.deletedSceneIds || [])])),
            };
            // Birleşik listeyi kalıcı hafızaya da yaz (sonraki senkronlarda birikir)
            set({ adminSettings });
          } catch (mergeErr) {
            console.warn('Bulut silme listeleri birleştirilemedi, yerel liste ile devam ediliyor:', mergeErr);
          }

          const hardBlacklist = new Set([
            'ex-11', 'ex-12', 'ex-13', 'ex-14', 'ex-15', 'ex-16', 'ex-17', 'ex-18', 
            'p-4', 'p-10', 'p-11', 'p-12',
            ...(adminSettings.deletedAssetIds || []),
            ...(adminSettings.hiddenSymbolIds || [])
          ]);

          // Clean uploadedImages — büyük base64'leri çıkar (sadece URL referanslarını tut)
          const cleanUploads = uploadedImages
            .filter(img => !hardBlacklist.has(img.id))
            .map(img => ({
              ...img,
              // 50KB'dan büyük base64 src'leri payload'dan çıkar
              src: (img.src && img.src.startsWith('data:') && img.src.length > 50000) ? '' : img.src
            }))
            .filter(img => img.src);
          
          // Clean allSymbols before saving
          const cleanAllSymbols = allSymbols.map(cat => ({
            ...cat,
            symbols: cat.symbols.filter((s: any) => !hardBlacklist.has(s.id))
          }));

          // Merge current active scenes into the archiveScenes list to ensure all changes are saved
          const archiveMap = new Map();
          const cleanArchive = archiveScenes.filter(s => !(adminSettings.deletedSceneIds || []).includes(s.id));
          cleanArchive.forEach((s: any) => archiveMap.set(s.id, s));
          
          const cleanActive = scenes.filter(s => !(adminSettings.deletedSceneIds || []).includes(s.id));
          cleanActive.forEach((s: any) => archiveMap.set(s.id, s));
          
          const finalArchiveToSync = Array.from(archiveMap.values());

          await cloud.save(
            cleanUploads, 
            cleanAllSymbols, 
            { objects, backgroundImage, projectInfo, adminSettings },
            finalArchiveToSync,
            activeSceneId,
            visualSettings,
            get().adminPassword || ''
          );
          
          if (!silent) {
            get().addNotification({
              type: 'success',
              message: '☁️ Bulut Senkronizasyonu Tamamlandı',
              description: `Kütüphane ve çalışma durumu başarıyla buluta kaydedildi.`
            });
          }
        } catch (error: unknown) {
          console.error('Sync Error:', error);
          if (!silent) {
            get().addNotification({
              type: 'error',
              message: 'Bulut Senkronizasyon Hatası',
              description: 'Veriler buluta aktarılamadı.'
            });
          }
        }
      },

      restoreFromCloud: async (silent = false) => {
        try {
          const data = await cloud.load();
          
          if (!data) {
            if (!silent) {
              get().addNotification({
                type: 'info',
                message: 'Bulut Boş',
                description: 'Henüz buluta kaydedilmiş bir yapılandırma bulunamadı.'
              });
            }
            return false;
          }

          const updates: any = {};
          const cloudAdminSettings = data.projectState?.adminSettings || {};
          const mergedAdminSettings = {
            ...get().adminSettings,
            ...cloudAdminSettings,
            hiddenSymbolIds: Array.from(new Set([...(get().adminSettings.hiddenSymbolIds || []), ...(cloudAdminSettings.hiddenSymbolIds || [])])),
            deletedAssetIds: Array.from(new Set([...(get().adminSettings.deletedAssetIds || []), ...(cloudAdminSettings.deletedAssetIds || [])])),
            deletedSceneIds: Array.from(new Set([...(get().adminSettings.deletedSceneIds || []), ...(cloudAdminSettings.deletedSceneIds || [])])),
          };

          if (data.uploadedImages && Array.isArray(data.uploadedImages)) {
            const blacklist = new Set(mergedAdminSettings.deletedAssetIds);
            updates.uploadedImages = data.uploadedImages.filter((img: any) => !blacklist.has(img.id));
          }

          if (data.allSymbols && Array.isArray(data.allSymbols)) {
            const blacklist = new Set(mergedAdminSettings.hiddenSymbolIds);
            updates.allSymbols = data.allSymbols.map((cat: any) => ({
              ...cat,
              symbols: cat.symbols.filter((s: any) => !blacklist.has(s.id))
            }));
          }

          // INTELLIGENT SCENE MERGING (Prevent data loss from overwriting)
          if (data.scenes && Array.isArray(data.scenes)) {
            const blacklist = new Set(mergedAdminSettings.deletedSceneIds);
            const cloudScenes = data.scenes.filter((s: any) => !blacklist.has(s.id));
            const localArchive = get().archiveScenes || [];

            // Merge: Cloud takes priority for existing IDs, but new Local IDs are kept in the global archiveScenes
            const archiveMap = new Map();
            localArchive.forEach((s: any) => archiveMap.set(s.id, s));
            cloudScenes.forEach((s: any) => archiveMap.set(s.id, s));

            const mergedArchive = Array.from(archiveMap.values());
            updates.archiveScenes = mergedArchive;

            // Load the current active scenes (tabs shown at the bottom) based on the reportNo of the selected active scene!
            const activeId = data.activeSceneId || get().activeSceneId || (mergedArchive.length > 0 ? mergedArchive[0].id : null);
            const activeScene = mergedArchive.find((s: any) => s.id === activeId);
            
            if (activeScene) {
              const activeReportNo = activeScene.projectInfo?.reportNo;
              if (activeReportNo) {
                // Filter scenes belonging to the same project/case so bottom tabs show only pages of this case
                updates.scenes = mergedArchive.filter((s: any) => s.projectInfo?.reportNo === activeReportNo);
              } else {
                updates.scenes = [activeScene];
              }
              updates.activeSceneId = activeScene.id;

              const currentLocalObjects = get().objects || [];
              const currentLocalBg = get().backgroundImage;
              const hasUnsavedLocalWork = silent && (currentLocalObjects.length > 0 || !!currentLocalBg);

              if (!hasUnsavedLocalWork) {
                if (Array.isArray(activeScene.objects)) {
                  updates.objects = [...activeScene.objects];
                  updates.history = [[...activeScene.objects]];
                  updates.historyIndex = 0;
                }
                if (activeScene.backgroundImage !== undefined) {
                  updates.backgroundImage = activeScene.backgroundImage;
                }
                if (activeScene.drawingArea) {
                  updates.drawingArea = activeScene.drawingArea;
                }
              }

              if (activeScene.projectInfo) {
                updates.projectInfo = { ...get().projectInfo, ...activeScene.projectInfo };
              }
            } else {
              updates.scenes = [];
              updates.activeSceneId = null;
            }
          }

          if (data.visualSettings) {
            updates.visualSettings = data.visualSettings;
          }

          if (data.projectState) {
            updates.projectInfo = data.projectState.projectInfo || get().projectInfo;
          }
          
          updates.adminSettings = mergedAdminSettings;

          const syncedInfo = updates.projectInfo || get().projectInfo;

          set({
            ...updates,
            projectInfo: syncedInfo,
            corporateLogoConfig: syncedInfo.corporateLogoConfig || get().corporateLogoConfig,
            krokiInfo: { ...get().krokiInfo, corporateLogo: syncedInfo.corporateLogo, corporateLogoConfig: syncedInfo.corporateLogoConfig },
            diagramInfo: { ...get().diagramInfo, corporateLogo: syncedInfo.corporateLogo, corporateLogoConfig: syncedInfo.corporateLogoConfig },
          });
          
          get().refreshSymbols();
          
          if (!silent) {
            get().addNotification({
              type: 'success',
              message: 'Geri Yükleme Başarılı',
              description: 'Bulut verileri yerel verilerle başarıyla birleştirildi.'
            });
          }
          
          return true;

        } catch (error: unknown) {
          console.error('Restore Error:', error);
          if (!silent) {
            get().addNotification({
              type: 'error',
              message: 'Geri Yükleme Başarısız',
              description: error instanceof Error ? error.message : 'Buluttan veriler çekilemedi.'
            });
          }
          return false;
        }
      },

      refreshSymbols: () => {
        set((state) => {
          // Hard-Blacklist: Silinen sembollerin hiçbir şekilde geri gelmemesi için en başta tanımlıyoruz
          const hardBlacklist = new Set([
            'ex-11', 'ex-12', 'ex-13', 'ex-14', 'ex-15', 'ex-16', 'ex-17', 'ex-18', 
            'p-4', 'p-10', 'p-11', 'p-12', // Silinen İnsan Figürleri (Kesin Yasaklı)
            ...(state.adminSettings.deletedAssetIds || []),
            ...(state.adminSettings.hiddenSymbolIds || [])
          ]);

          // 1. uploadedImages Deduplication (By Source URL + Cloudinary public_id) and Filtering
          const uniqueUploads: any[] = [];
          const seenUrls = new Set();
          const seenPids = new Set<string>();

          state.uploadedImages.forEach(img => {
            if (img.src.startsWith('blob:') || hardBlacklist.has(img.id)) return;
            if (seenUrls.has(img.src)) return;
            const pid = publicIdFromUrl(img.src);
            if (pid && seenPids.has(pid)) return; // aynı bulut görseli (farklı transform URL) — mükerrer
            uniqueUploads.push(img);
            seenUrls.add(img.src);
            if (pid) seenPids.add(pid);
          });

          // 2. allSymbols Deduplication and Merging
          const categoryMap = new Map();
          state.allSymbols.forEach(cat => {
            const cleanSymbols = cat.symbols.filter((s: any) => !hardBlacklist.has(s.id));
            categoryMap.set(cat.id, { ...cat, symbols: cleanSymbols });
          });

          // SYMBOL_CATEGORIES (Hardcoded) ile birleştir ve yasaklıları filtrele
          SYMBOL_CATEGORIES.forEach(hardCat => {
            const existingCat = categoryMap.get(hardCat.id);
            
            if (!existingCat) {
              // Yeni kategori, yasaklıları filtreleyerek ekle
              const cleanHardSymbols = hardCat.symbols.filter(s => !hardBlacklist.has(s.id));
              categoryMap.set(hardCat.id, { ...hardCat, symbols: cleanHardSymbols });
            } else {
              // Kategori zaten var, sembolleri merge et
              const symbolMap = new Map();
              
              // Önce mevcut sembolleri ekle (yasaklı olmayanları)
              existingCat.symbols.forEach((s: any) => {
                if (!hardBlacklist.has(s.id)) {
                  symbolMap.set(s.id, s);
                }
              });

              // Sonra hardcoded sembolleri ekle (yasaklı olmayanları)
              hardCat.symbols.forEach(hardSym => {
                if (!hardBlacklist.has(hardSym.id)) {
                  const existingSym = symbolMap.get(hardSym.id);
                  // Merge: Hardcoded veriler güncel kalsın ama mevcut özellikler (varsa) korunsun
                  symbolMap.set(hardSym.id, existingSym ? { ...existingSym, ...hardSym } : hardSym);
                }
              });

              categoryMap.set(hardCat.id, {
                ...existingCat,
                name: hardCat.name,
                symbols: Array.from(symbolMap.values())
              });
            }
          });

          return { 
            allSymbols: Array.from(categoryMap.values()), 
            uploadedImages: uniqueUploads 
          };
        });
      },



      recoverCloudinaryImages: async () => {
        const { isAdmin, uploadedImages } = get();
        if (!isAdmin) return;

        get().addNotification({ 
          type: 'info', 
          message: 'Bulut Taraması', 
          description: 'Cloudinary üzerindeki tüm fiziksel görseller taranıyor (84+)...' 
        });

        try {
          const response = await fetch('/api/list-cloudinary', {
            headers: {
              'x-auth-token': get().adminPassword || ''
            }
          });
          const data = await response.json().catch(() => ({}));

          if (!response.ok || data.error || !data.assets || !Array.isArray(data.assets)) {
            throw new Error(data.error || 'Görsel listesi alınamadı');
          }

          const cloudAssets = data.assets;
          // Mevcut kaynaklar: ham URL + public_id (transform parametreleri farklı olsa da
          // aynı Cloudinary görseli mükerrer olarak eklenmez)
          const currentUrls = new Set<string>();
          const currentPids = new Set<string>();
          get().allSymbols.forEach(cat => cat.symbols.forEach((s: any) => {
            currentUrls.add(s.src);
            const pid = publicIdFromUrl(s.src);
            if (pid) currentPids.add(pid);
          }));
          get().uploadedImages.forEach(img => {
            currentUrls.add(img.src);
            const pid = publicIdFromUrl(img.src);
            if (pid) currentPids.add(pid);
          });

          // Kalıcı silme anahtarları: id, public_id, ham src ve name: önekli dosya adı
          const deletedKeys = new Set<string>(get().adminSettings.deletedAssetIds || []);
          const hiddenIds = new Set(get().adminSettings.hiddenSymbolIds || []);

          let recoveredCount = 0;
          const newImages = [...uploadedImages];

          cloudAssets.forEach((asset: any) => {
            const assetPid = publicIdFromUrl(asset.src) || asset.id;
            const nameKey = asset.name ? 'name:' + String(asset.name).trim().toLowerCase() : null;
            // Silinmiş / gizlenmiş görseller ASLA geri getirilmez
            const isDeleted = deletedKeys.has(asset.id) || deletedKeys.has(assetPid) ||
                              deletedKeys.has(asset.src) || (nameKey ? deletedKeys.has(nameKey) : false) ||
                              hiddenIds.has(asset.id) || hiddenIds.has(assetPid);
            // Zaten kütüphanede varsa (URL veya public_id eşleşmesi) tekrar eklenmez
            const isAlreadyPresent = currentUrls.has(asset.src) || currentPids.has(asset.id) || currentPids.has(assetPid);

            if (!isAlreadyPresent && !isDeleted) {
              newImages.push({
                id: asset.id,
                src: asset.src,
                name: asset.name,
                category: asset.category || 'uncategorized'
              });
              currentUrls.add(asset.src);
              currentPids.add(assetPid);
              recoveredCount++;
            }
          });

          if (recoveredCount > 0) {
            set({ uploadedImages: newImages });
            get().syncToCloud(true);
            get().addNotification({
              type: 'success',
              message: 'Tarama Tamamlandı',
              description: `${recoveredCount} adet eksik görsel bulut deposundan kurtarılarak kütüphaneye eklendi.`
            });
          } else {
            get().addNotification({
              type: 'info',
              message: 'Tarama Sonucu',
              description: 'Tüm bulut görselleri zaten kütüphanenizde mevcut.'
            });
          }
        } catch (error: unknown) {
          console.error('Recovery Error:', error);
          get().addNotification({
            type: 'error',
            message: 'Tarama Hatası',
            description: `Bulut listesi alınırken bir sorun oluştu: ${error instanceof Error ? error.message : String(error)}`
          });
        }
      },

      clearCloudConfig: async () => {
        const { isAdmin } = get();
        if (!isAdmin) return;

        get().showConfirm({
          title: 'BULUT VERİLERİNİ SIFIRLA',
          message: 'DİKKAT: Bulut üzerindeki tüm kütüphane ve yapılandırma yedeği kalıcı olarak silinecek ve varsayılana dönecek. Bu işlem geri alınamaz. Emin misiniz?',
          onConfirm: async () => {
            try {
              // Overwrite cloud with initial state
              await cloud.save([], SYMBOL_CATEGORIES, { 
                objects: [], 
                backgroundImage: null, 
                projectInfo: { ...get().projectInfo }, 
                adminSettings: { logoConfig: undefined, hiddenSymbolIds: [], deletedAssetIds: [] } 
              }, [], null, get().visualSettings, get().adminPassword || '');
              
              set({
                uploadedImages: [],
                allSymbols: SYMBOL_CATEGORIES,
                adminSettings: {
                  logoConfig: undefined,
                  hiddenSymbolIds: [],
                  deletedAssetIds: [],
                }
              });

              get().addNotification({
                type: 'success',
                message: 'Bulut Temizlendi',
                description: 'Bulut üzerindeki tüm veriler sıfırlandı ve kütüphane varsayılan ayarlara döndürüldü.'
              });
            } catch (error: unknown) {
              console.error('Cloud Clear Error:', error);
              get().addNotification({
                type: 'error',
                message: 'Temizleme Hatası',
                description: 'Bulut verileri sıfırlanamadı.'
              });
            }
          }
        });
      },

      // Case/Scene Management Implementation
      addScene: (name) => {
        const { objects, backgroundImage, projectInfo, drawingArea } = get();
        const id = uuidv4();
        
        const newScene: any = {
          id,
          name,
          type: projectInfo.type,
          objects: [...objects],
          backgroundImage,
          projectInfo: { ...projectInfo },
          drawingArea: { ...drawingArea }
        };

        set((state) => ({
          scenes: [...state.scenes, newScene],
          activeSceneId: id
        }));
      },

      switchScene: (id) => {
        const { scenes, objects, backgroundImage, projectInfo, drawingArea, activeSceneId, archiveScenes = [] } = get();
        
        // 1. Save current state to the active scene before switching
        const updatedScenes = scenes.map(s => 
          s.id === activeSceneId 
            ? { ...s, type: projectInfo.type, objects: [...objects], backgroundImage, projectInfo: { ...projectInfo }, drawingArea } 
            : s
        );

        // Also save to archiveScenes
        const updatedArchiveScenes = archiveScenes.map(s => 
          s.id === activeSceneId 
            ? { ...s, type: projectInfo.type, objects: [...objects], backgroundImage, projectInfo: { ...projectInfo }, drawingArea } 
            : s
        );

        // 2. Load target scene from the UPDATED scenes list, or find in archiveScenes if switching cases
        let targetScene = updatedScenes.find(s => s.id === id);
        if (!targetScene) {
          targetScene = updatedArchiveScenes.find(s => s.id === id);
          
          if (targetScene) {
            // When switching cases, filter all scenes belonging to this new case (by reportNo)
            const reportNo = targetScene.projectInfo?.reportNo;
            let caseScenes = [targetScene];
            if (reportNo) {
              caseScenes = updatedArchiveScenes.filter(s => s.projectInfo?.reportNo === reportNo);
            }
            
            set({
              scenes: caseScenes,
              archiveScenes: updatedArchiveScenes,
              activeSceneId: id,
              objects: [...targetScene.objects],
              backgroundImage: targetScene.backgroundImage,
              projectInfo: { ...targetScene.projectInfo },
              drawingArea: targetScene.drawingArea || DEFAULT_DRAWING_AREA,
              history: [[...targetScene.objects]],
              historyIndex: 0
            });
            get().applyTemplate(targetScene.type || 'kroki');
            return;
          }
        }

        if (targetScene) {
          set({
            scenes: updatedScenes,
            archiveScenes: updatedArchiveScenes,
            activeSceneId: id,
            objects: [...targetScene.objects],
            backgroundImage: targetScene.backgroundImage,
            projectInfo: { ...targetScene.projectInfo },
            drawingArea: targetScene.drawingArea || DEFAULT_DRAWING_AREA,
            history: [[...targetScene.objects]],
            historyIndex: 0
          });
          // Apply template for the loaded scene type
          get().applyTemplate(targetScene.type || 'kroki');
        }
      },

      removeScene: async (id) => {
        const inScenes = (get().scenes || []).some(s => s.id === id);
        const inArchive = (get().archiveScenes || []).some(s => s.id === id);
        if (!inScenes && !inArchive) return;

        set((state) => {
          const newScenes = (state.scenes || []).filter(s => s.id !== id);
          const newArchiveScenes = (state.archiveScenes || []).filter(s => s.id !== id);
          let newActiveId = state.activeSceneId;
          if (state.activeSceneId === id) {
            newActiveId = newScenes.length > 0 ? newScenes[0].id : (newArchiveScenes.length > 0 ? newArchiveScenes[0].id : null);
          }
          return { 
            scenes: newScenes, 
            archiveScenes: newArchiveScenes,
            activeSceneId: newActiveId,
            adminSettings: {
              ...state.adminSettings,
              deletedSceneIds: Array.from(new Set([...(state.adminSettings.deletedSceneIds || []), id]))
            }
          };
        });

        const { activeSceneId } = get();
        if (activeSceneId && get().scenes.some(s => s.id === activeSceneId)) {
          get().switchScene(activeSceneId);
        }
        
        try {
          await get().syncToCloud(true);
        } catch (error: unknown) {
          console.error('Scene deletion sync failed:', error);
        }

        get().addNotification({
          type: 'success',
          message: 'Belge Silindi',
          description: 'Çizim/kroki arşivden başarıyla silindi.'
        });
      },

      updateSceneName: (id, name) => {
        set((state) => ({
          scenes: state.scenes.map(s => s.id === id ? { ...s, name } : s),
          archiveScenes: (state.archiveScenes || []).map(s => s.id === id ? { ...s, name } : s)
        }));
      },

      addNewPage: (name, type) => {
        const { objects, backgroundImage, projectInfo, drawingArea } = get();
        const id = uuidv4();
        
        // Generate template objects for the NEW page based on its type
        const orientation = get().canvasOrientation;
        const width = orientation === 'landscape' ? 1400 : 1000;
        const height = orientation === 'landscape' ? 1000 : 1400;
        
        const newProjectInfo = {
          ...projectInfo,
          type: type
        };
        
        if (get().adminSettings.logoConfig) {
          newProjectInfo.corporateLogoConfig = get().adminSettings.logoConfig;
        }
        
        let result: { objects: CanvasObject[], drawingArea: { x: number; y: number; width: number; height: number } };
        if (type === 'kroki') {
          result = createKrokiTemplate(width, height, newProjectInfo);
        } else {
          result = createDiagramTemplate(width, height, newProjectInfo);
        }
        
        const newScene: any = {
          id,
          name,
          type: type,
          objects: result.objects,
          backgroundImage: null,
          projectInfo: newProjectInfo,
          drawingArea: result.drawingArea
        };

        const currentActiveId = get().activeSceneId;
        const updatedScenes = get().scenes.map(s => 
          s.id === currentActiveId 
            ? { ...s, type: projectInfo.type, objects: [...objects], backgroundImage, projectInfo: { ...projectInfo }, drawingArea } 
            : s
        );

        // Also update archiveScenes
        const currentArchiveScenes = get().archiveScenes || [];
        const updatedArchiveScenes = currentArchiveScenes.map(s => 
          s.id === currentActiveId 
            ? { ...s, type: projectInfo.type, objects: [...objects], backgroundImage, projectInfo: { ...projectInfo }, drawingArea } 
            : s
        );
        const newArchiveScenes = [...updatedArchiveScenes, newScene];

        set({
          scenes: [...updatedScenes, newScene],
          archiveScenes: newArchiveScenes,
          activeSceneId: id,
          objects: result.objects,
          backgroundImage: null,
          projectInfo: newProjectInfo,
          drawingArea: result.drawingArea,
          history: [result.objects],
          historyIndex: 0,
          selectedId: null
        });
      },

      exportPDFRef: null,
      triggerExportPDF: () => {
        const ref = get().exportPDFRef;
        if (ref) {
          ref();
        } else {
          console.warn('PDF export function is not registered yet.');
        }
      },

      fallAnimationExportRef: null,
      triggerFallAnimationExport: async () => {
        const ref = get().fallAnimationExportRef;
        if (ref) {
          await ref();
        } else {
          console.warn('Fall animation export function is not registered yet.');
        }
      },

      updateVisualSettings: (updates) => {
        set((state) => ({
          visualSettings: { ...state.visualSettings, ...updates }
        }));
      },

      setScaleCalibration: (calibration) => {
        set({ scaleCalibration: calibration });
      },
      setAccidentData: (data) => {
        set((state) => ({
          accidentReconstruction: { ...state.accidentReconstruction, ...data }
        }));
      },
      setAccidentVehicle: (index, data) => {
        set((state) => {
          const vehicles = [...state.accidentReconstruction.vehicles] as [VehicleData, VehicleData?];
          vehicles[index] = { ...vehicles[index], ...data } as VehicleData;
          return {
            accidentReconstruction: { ...state.accidentReconstruction, vehicles }
          };
        });
      },
      addPedestrian: (data) => {
        set((state) => {
          const newPedestrian: PedestrianData = {
            id: uuidv4(),
            name: `Yaya ${(state.accidentReconstruction.pedestrians?.length || 0) + 1}`,
            startX: 800,
            startY: 300,
            endX: 800,
            endY: 700,
            speed: 5,
            size: 'adult',
            color: '#4CAF50',
            show: true,
            appearProgress: 0.2,
            ...data,
          };
          return {
            accidentReconstruction: {
              ...state.accidentReconstruction,
              pedestrians: [...(state.accidentReconstruction.pedestrians || []), newPedestrian]
            }
          };
        });
      },
      updatePedestrian: (id, data) => {
        set((state) => ({
          accidentReconstruction: {
            ...state.accidentReconstruction,
            pedestrians: (state.accidentReconstruction.pedestrians || []).map((p) =>
              p.id === id ? { ...p, ...data } : p
            )
          }
        }));
      },
      removePedestrian: (id) => {
        set((state) => ({
          accidentReconstruction: {
            ...state.accidentReconstruction,
            pedestrians: (state.accidentReconstruction.pedestrians || []).filter((p) => p.id !== id)
          }
        }));
      },
      setAccidentAnimation: (data) => {
        set((state) => ({
          accidentAnimation: { ...state.accidentAnimation, ...data }
        }));
      },
      setFallAnimation: (data) => {
        set((state) => ({
          fallAnimation: { ...state.fallAnimation, ...data }
        }));
      },
      setPedestrianLaunch: (data) => {
        set((state) => ({
          pedestrianLaunch: { ...state.pedestrianLaunch, ...data }
        }));
      },
      setShotDirection: (data) => {
        set((state) => ({
          shotDirection: { ...state.shotDirection, ...data }
        }));
      },
      saveAnimation: (name) => {
        set((state) => {
          const newSaved: SavedAnimation = {
            id: uuidv4(),
            name,
            createdAt: new Date().toISOString(),
            data: JSON.parse(JSON.stringify(state.accidentReconstruction)),
          };
          return { savedAnimations: [...state.savedAnimations, newSaved] };
        });
      },
      loadAnimation: (id) => {
        set((state) => {
          const found = state.savedAnimations.find(a => a.id === id);
          if (!found) return state;
          return {
            accidentReconstruction: JSON.parse(JSON.stringify(found.data)),
            accidentAnimation: {
              isPlaying: false, currentTime: 0, speed: 1, loop: false, showTimeline: false,
            },
          };
        });
      },
      deleteAnimation: (id) => {
        set((state) => ({
          savedAnimations: state.savedAnimations.filter(a => a.id !== id),
        }));
      },
      resetAccidentReconstruction: () => {
        set(() => ({
          accidentReconstruction: {
            enabled: false,
            vehicles: [
              {
                id: 'v1',
                type: 'car',
                name: 'Araç 1',
                color: '#E53935',
                startX: 200,
                startY: 500,
                startRotation: 0,
                initialSpeed: 60,
                brakeReactionTime: 0.8,
                brakeEfficiency: 85,
                brakeMarkLength: 20,
                brakeMarkWidth: 0.3,
                brakeMarkType: 'straight',
                brakeMarkCurvature: 0,
                collisionX: 600,
                collisionY: 500,
                impactSpeed: 30,
                impactAngle: 0,
                finalX: 700,
                finalY: 500,
                finalRotation: 0,
                showPath: true,
                showBrakeMarks: true,
                showVehicle: true,
                evasiveAction: 'none' as const,
                evasiveOffset: 0,
                evasiveStartProgress: 0.3,
              },
            ],
            pedestrians: [],
            roadSurface: 'asphalt_dry',
            frictionCoefficient: 0.7,
            speedLimit: 50,
            weather: 'clear',
            lighting: 'daylight',
            roadType: 'urban',
            animationDuration: 5,
            autoCalculateBraking: false,
            notes: '',
          },
          accidentAnimation: {
            isPlaying: false,
            currentTime: 0,
            speed: 1,
            loop: false,
            showTimeline: false,
          },
        }));
      },
    }),
    {
      name: 'kroki-v2',
      version: 23,
      partialize: (state) => ({
        // allSymbols and uploadedImages are excluded to avoid localStorage quota issues (5MB limit)
        // They will be fetched from the cloud via restoreFromCloud/refreshSymbols
        // scenes and archiveScenes persist so saved cases survive app refresh.
        // objects are NOT persisted — canvas starts empty on page load.
        scaleCalibration: state.scaleCalibration,
        accidentReconstruction: state.accidentReconstruction,
        accidentAnimation: state.accidentAnimation,
        fallAnimation: state.fallAnimation,
        pedestrianLaunch: state.pedestrianLaunch,
        backgroundGrayscale: state.backgroundGrayscale,
        canvasBgColor: state.canvasBgColor,
        canvasOrientation: state.canvasOrientation,
        projectInfo: state.projectInfo,
        krokiInfo: state.krokiInfo,
        diagramInfo: state.diagramInfo,
        isAdmin: state.isAdmin,
        // KRİTİK: adminSettings (silme listeleri) + adminPassword kalıcı olmalı.
        // Aksi halde sayfa yenilenince silinen semböl/görsel kayıtları kaybolur ve
        // bulut taraması silinen SVG görselleri geri getirir; bulut senkronu da
        // şifre boş kaldığı için sessizce 401 ile başarısız olur.
        adminSettings: state.adminSettings,
        adminPassword: state.adminPassword,
        symbolUsage: state.symbolUsage,
        visualSettings: state.visualSettings,
        savedAnimations: state.savedAnimations,
        scenes: state.scenes,
        archiveScenes: state.archiveScenes,
        activeSceneId: state.activeSceneId,
      }),
      onRehydrateStorage: () => (state) => {
        if (state) {
          // On page refresh: restore user-drawn objects only (no template frames).
          // Template frames are regenerated dynamically by applyTemplate/switchScene.
          const activeScene = (state.scenes || []).find((s: any) => s.id === state.activeSceneId) || state.scenes?.[0];
          if (activeScene && Array.isArray(activeScene.objects)) {
            // Filter out pure template objects — keep user objects and corporate-logo
            const userObjects = activeScene.objects.filter(
              (obj: any) => !obj.isTemplate || obj.id === 'corporate-logo' || obj.id?.startsWith('logo-')
            );
            state.objects = userObjects;
            state.backgroundImage = activeScene.backgroundImage || null;
            if (activeScene.drawingArea) state.drawingArea = activeScene.drawingArea;
            if (activeScene.projectInfo) state.projectInfo = { ...state.projectInfo, ...activeScene.projectInfo };
            state.history = [userObjects];
          } else {
            state.objects = [];
            state.history = [[]];
          }
          state.historyIndex = 0;
          state.selectedId = null;
          // Reset all animation states so no stale data remains on refresh
          state.accidentAnimation = { isPlaying: false, currentTime: 0, speed: 1, loop: false, showTimeline: false };
          state.fallAnimation = { isOpen: false, isPlaying: false, currentTime: 0, speed: 1, loop: false, duration: 2, canvasData: null };
          state.pedestrianLaunch = { isOpen: false, isPlaying: false, currentTime: 0, speed: 1, loop: false, duration: 3, canvasData: null };
          state.shotDirection = { isOpen: false, isPlaying: false, currentTime: 0, speed: 1, loop: false, duration: 3, canvasData: null };
          // Reset accident reconstruction data so previous analysis doesn't persist
          state.accidentReconstruction = {
            enabled: false,
            vehicles: [
              {
                id: 'v1',
                type: 'car',
                name: 'Araç 1',
                color: '#E53935',
                startX: 200,
                startY: 500,
                startRotation: 0,
                initialSpeed: 60,
                brakeReactionTime: 0.8,
                brakeEfficiency: 85,
                brakeMarkLength: 20,
                brakeMarkWidth: 0.3,
                brakeMarkType: 'straight',
                brakeMarkCurvature: 0,
                collisionX: 600,
                collisionY: 500,
                impactSpeed: 30,
                impactAngle: 0,
                finalX: 700,
                finalY: 500,
                finalRotation: 0,
                showPath: true,
                showBrakeMarks: true,
                showVehicle: true,
                evasiveAction: 'none' as const,
                evasiveOffset: 0,
                evasiveStartProgress: 0.3,
              },
            ],
            pedestrians: [],
            roadSurface: 'asphalt_dry',
            frictionCoefficient: 0.7,
            speedLimit: 50,
            weather: 'clear',
            lighting: 'daylight',
            roadType: 'urban',
            animationDuration: 5,
            autoCalculateBraking: false,
            notes: '',
          };
        }
      },
    }
  )
);
