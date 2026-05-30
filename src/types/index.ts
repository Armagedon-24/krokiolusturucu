export type ObjectType = 'image' | 'text' | 'symbol' | 'rect' | 'line' | 'finding-list';

export interface CanvasObject {
  id: string;
  name?: string;
  type: ObjectType;
  x: number;
  y: number;
  width: number;
  height: number;
  rotation: number;
  scaleX: number;
  scaleY: number;
  src?: string;
  text?: string;
  fontSize?: number;
  fontFamily?: string;
  fontStyle?: string;
  fill?: string;
  stroke?: string;
  strokeWidth?: number;
  points?: number[];
  zIndex: number;
  label?: string;
  distance?: string;
  distanceFontSize?: number;
  distanceColor?: string;
  isDistanceArrow?: boolean;
  isTemplate?: boolean;
  align?: 'left' | 'center' | 'right';
  categoryId?: string;
  symbolId?: string;
  ratioFixed?: boolean;
  dash?: number[];
  curvature?: number;
  curvatureX?: number;
  findingNo?: string;
  findingDesc?: string;
  shadowColor?: string;
  shadowBlur?: number;
  shadowOpacity?: number;
  photo?: string;
  photos?: string[];
  injuries?: { x: number, y: number, type: string, subType?: string, severity?: string, notes?: string }[];
  defaultScaleX?: number;
  defaultScaleY?: number;
  tailLength?: number;
  startX?: number;
  startY?: number;
  endX?: number;
  endY?: number;
  zHeight?: number;
  wallThickness?: number;
  azimuth?: number;
  tilt?: number;
  isTriangulation?: boolean;
  yOffset?: number;
  rotationX?: number;
  rotationY?: number;
  rotationZ?: number;
  opacity?: number;
  logoAdjusted?: boolean;
  fixedPointNo?: string;
  measuredIds?: string[];
  impactAngle?: number; // Bloodstain impact angle (0-90)
  exitPoint?: { x: number, y: number, z: number }; // For trajectory analysis
  isBloodstain?: boolean;
  mu?: number;           // Friction coefficient
  efficiency?: number;   // Braking efficiency
  showSpeedInfo?: boolean; // Show calculated speed on canvas
}

export interface ProjectInfo {
  type: 'kroki' | 'diagram';
  eventName: string;
  reportNo: string;
  address: string;
  date: string;
  sketchedBy: string;
  diagramType?: string;
  description?: string;
  expert2?: string;
  corporateLogo?: string;
  corporateLogoConfig?: {
    x: number;
    y: number;
    width: number;
    height: number;
    rotation: number;
    scaleX: number;
    scaleY: number;
  };
}

export interface Symbol {
  id: string;
  name: string;
  src: string;
  thumbnail?: string;
  type: 'symbol';
  group?: string;
  isDistanceArrow?: boolean;
  category?: string;
}

export interface Scene {
  id: string;
  name: string;
  type: 'kroki' | 'diagram';
  objects: CanvasObject[];
  backgroundImage: string | null;
  projectInfo: ProjectInfo;
  drawingArea?: { x: number, y: number, width: number, height: number };
}

export interface ScaleCalibration {
  pixelDistance: number;
  realDistance: number;
  unit: string;
}

export type VehicleType = 'car' | 'suv' | 'truck' | 'bus' | 'motorcycle' | 'van' | 'pickup' | 'other';

export interface VehicleData {
  id: string;
  type: VehicleType;
  name: string;
  color: string;
  startX: number;
  startY: number;
  startRotation: number;
  initialSpeed: number;
  brakeReactionTime: number;
  brakeEfficiency: number;
  brakeMarkLength: number;
  brakeMarkWidth: number;
  brakeMarkType: 'straight' | 'curved' | 'yaw' | 'none';
  brakeMarkCurvature: number;
  collisionX: number;
  collisionY: number;
  impactSpeed: number;
  impactAngle: number;
  finalX: number;
  finalY: number;
  finalRotation: number;
  showPath: boolean;
  showBrakeMarks: boolean;
  showVehicle: boolean;
}

export interface AccidentReconstruction {
  enabled: boolean;
  vehicles: [VehicleData, VehicleData?];
  roadSurface: 'asphalt_dry' | 'asphalt_wet' | 'concrete_dry' | 'concrete_wet' | 'gravel' | 'soil' | 'snow' | 'ice';
  frictionCoefficient: number;
  speedLimit: number;
  weather: 'clear' | 'rain' | 'snow' | 'fog' | 'night' | 'dawn_dusk';
  lighting: 'daylight' | 'street_light' | 'no_lighting' | 'twilight';
  roadType: 'highway' | 'urban' | 'rural' | 'intersection' | 'parking_lot' | 'other';
  animationDuration: number;
  autoCalculateBraking: boolean;
  notes: string;
}

export interface AccidentAnimationState {
  isPlaying: boolean;
  currentTime: number;
  speed: number;
  loop: boolean;
  showTimeline: boolean;
}

export interface FallAnimationState {
  isOpen: boolean;
  isPlaying: boolean;
  currentTime: number;
  speed: number;
  loop: boolean;
  duration: number;
}

export interface SavedAnimation {
  id: string;
  name: string;
  createdAt: string;
  data: AccidentReconstruction;
}

export interface CanvasState {
  objects: CanvasObject[];
  scenes: Scene[]; // Multi-scene support within a case
  archiveScenes?: Scene[]; // Global archive of all saved scenes
  activeSceneId: string | null;
  allSymbols: readonly { readonly id: string, readonly name: string, readonly symbols: readonly Symbol[] }[];
  uploadedImages: { id: string, src: string, name: string, category?: string, group?: string }[];
  backgroundImage: string | null;
  backgroundOpacity: number;
  backgroundGrayscale: boolean;
  canvasBgColor: string;
  canvasOrientation: 'landscape' | 'portrait';
  selectedId: string | null;
  projectInfo: ProjectInfo; // Current active info (Case-wide)
  krokiInfo: ProjectInfo;
  diagramInfo: ProjectInfo;
  history: CanvasObject[][];
  historyIndex: number;
  drawingArea?: { x: number, y: number, width: number, height: number };
  symbolUsage: Record<string, number>;
  
  adminPassword: string | null;
  
  // 3D Visual Settings
  visualSettings: {
    nightMode: boolean;
    flashlight: boolean;
    exposure: number;
    showGrid: boolean;
    ambientIntensity: number;
    sunAngle: number;
    floorTexture: 'none' | 'parquet' | 'tile' | 'grass' | 'asphalt';
    showWalkthrough: boolean;
  };
}
