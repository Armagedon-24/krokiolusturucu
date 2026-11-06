export type ObjectType = 'image' | 'text' | 'symbol' | 'rect' | 'line' | 'finding-list';

/** Uzatma motoru modu — görsel semboller esnetilirken desen bozulmasın.
 *  'auto'      : kütüphane metadata'sına düş (yoksa normal esnetme)
 *  'stretch'   : klasik esnetme (desen nesneyle birlikte esner)
 *  'strip-x'   : yatay şerit — desen X'te tekrar eder, kesit nesne yüksekliğine oturur
 *  'strip-y'   : dikey şerit — desen Y'de tekrar eder, kesit nesne genişliğine oturur
 *  'strip-auto': şerit, yön otomatik (yerel en >= boy → X, değilse Y)
 *  'tile'      : 2D karo — desen her iki eksende tekdüze ölçekte tekrar eder */
export type TileMode = 'auto' | 'stretch' | 'strip-x' | 'strip-y' | 'strip-auto' | 'tile';

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
  cornerRadius?: number;
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
  tileMode?: TileMode;
  ratioFixed?: boolean;
  dash?: number[];
  curvature?: number;
  curvatureX?: number;
  findingNo?: string;
  findingDesc?: string;
  /** Nesne çizimden gizli mi? (Katman/delil gizleme) */
  hidden?: boolean;
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
  /** Ok motoru — ok başı (pointer) uzunluğu; kenar/köşe tutamağıyla ölçeklemede orantılı değişir */
  arrowHead?: number;
  /** Mesafe etiketi (rakam) konum ofseti — otomatik konuma göre nesne-yerel dx/dy.
   *  Kullanıcı etiketi sürükleyince güncellenir; ekran ve PDF dışa aktarımı aynı ofseti kullanır. */
  labelOffset?: { dx: number; dy: number };
  /** SATIR ARALIĞI (kullanıcı isteği: satır ayarlama) — çok satırlı metin/etiketlerde
   *  satırlar arası boşluk çarpanı (1 = normal). Ekran ve PDF aynı kuralı izler. */
  lineHeight?: number;
  /** YAZI KONUMU (kullanıcı isteği) — metin kutusunda yazının dikey hizalaması:
   *  üst / orta / alt. Ekran (Konva verticalAlign) ve PDF aynı kuralı izler. */
  vAlign?: 'top' | 'middle' | 'bottom';
  /** Açıklama oku çerçevesi (ev-arrow-desc / -ellipse) — tutamakla büyütülüp küçültülür */
  frameWidth?: number;
  frameHeight?: number;
  /** Açıklama oku alt tutamak noktaları (lokal uzay) */
  textX?: number;
  textY?: number;
  markerX?: number;
  markerY?: number;
  /** Yol motoru (st-1 / st-cadde / st-sokak) — yol üzerine yazılan cadde/sokak adı */
  streetName?: string;
  /** Cadde/sokak adı punto boyutu */
  streetFontSize?: number;
  /** Yolun orta kesikli şerit çizgisi görünür mü? (st-1: varsayılan açık, cadde/sokak: varsayılan kapalı) */
  roadMiddleLine?: boolean;
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

export type EvasiveAction = 'none' | 'swerve_left' | 'swerve_right' | 'hard_brake';

export interface PedestrianData {
  id: string;
  name: string;
  startX: number;
  startY: number;
  endX: number;
  endY: number;
  speed: number; // walking speed km/h
  size: 'adult' | 'child';
  color: string;
  show: boolean;
  appearProgress: number; // 0-1 when pedestrian starts walking
}

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
  evasiveAction: EvasiveAction;
  evasiveOffset: number; // px offset for swerve
  evasiveStartProgress: number; // when evasive maneuver starts
}

export interface AccidentReconstruction {
  enabled: boolean;
  vehicles: [VehicleData, VehicleData?];
  pedestrians: PedestrianData[];
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
  /** Modal oynatıcı (AccidentAnimationPlayer) açıkken tuval döngüsünü kilitlemek için */
  playerOpen?: boolean;
}

export interface FallData {
  height: number;
  distance: number;
  velocity: number;
  impactVelocity: number;
  impactEnergy: number;
  time: number;
  weight: number;
  useDrag: boolean;
}

export interface FallAnimationState {
  isOpen: boolean;
  isPlaying: boolean;
  currentTime: number;
  speed: number;
  loop: boolean;
  duration: number;
  canvasData: FallData | null;  // Set when user clicks TUVALE AKTAR
}

export interface PedestrianLaunchData {
  vehicleSpeed: number;     // km/h
  pedestrianHeight: number; // cm
  pedestrianWeight: number; // kg
  launchSpeed: number;      // m/s (pedestrian's initial speed after impact)
  launchAngle: number;      // degrees
  throwDistance: number;    // m (total: flight + slide)
  flightDistance: number;   // m
  slideDistance: number;    // m (savrulma mesafesi)
  flightTime: number;       // seconds
  landingSpeed: number;     // km/h
  maxHeight: number;        // m (max height of center of mass during flight)
  pedestrianState: 'stationary' | 'walking_same' | 'walking_opposite' | 'running_same' | 'running_opposite';
}

export interface PedestrianLaunchAnimationState {
  isOpen: boolean;
  isPlaying: boolean;
  currentTime: number;
  speed: number;
  loop: boolean;
  duration: number;
  canvasData: PedestrianLaunchData | null;
}

export interface ShotDirectionData {
  entryX: number;          // cm from reference
  entryY: number;          // cm from reference
  entryZ: number;          // height cm
  exitX: number;           // cm from reference
  exitY: number;           // cm from reference
  exitZ: number;           // height cm
  hasExitWound: boolean;
  impactAngle: number;     // degrees (vertical impact angle)
  horizontalAngle: number; // degrees (shooter's horizontal bearing)
  shooterDistance: number; // estimated meters
  shooterHeight: number;   // estimated meters
  bulletType: string;
  deflectionAngle: number; // degrees
  entrySurface: 'glass' | 'metal' | 'drywall' | 'wood' | 'concrete' | 'other';
}

export interface SavedAnimation {
  id: string;
  name: string;
  createdAt: string;
  data: AccidentReconstruction;
}

export interface ShotDirectionAnimationState {
  isOpen: boolean;
  isPlaying: boolean;
  currentTime: number;
  speed: number;
  loop: boolean;
  duration: number;
  canvasData: ShotDirectionData | null;
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
  /** Arka plan görselinin Transformer ile yapılan ve kaydedilen konum/ölçek/dönüş */
  backgroundTransform?: { x: number; y: number; scaleX: number; scaleY: number; rotation: number };
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
