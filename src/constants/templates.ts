import { v4 as uuidv4 } from 'uuid';
import type { CanvasObject, ProjectInfo } from '../types';

// Helper to format date as DD.MM.YYYY
const formatDate = (dateStr: string) => {
  if (!dateStr) return '';
  const [year, month, day] = dateStr.split('-');
  if (!year || !month || !day) return dateStr;
  return `${day}.${month}.${year}`;
};

export const createKrokiTemplate = (canvasWidth: number, canvasHeight: number, info: ProjectInfo): { objects: CanvasObject[], drawingArea: { x: number, y: number, width: number, height: number } } => {
  const objects: CanvasObject[] = [];
  const padding = 15; // İçe çekilmiş kenar boşluğu
  // 0. PAPER BACKGROUND (White sheet)
  objects.push({
    id: 'paper-bg', type: 'rect', x: 0, y: 0, width: canvasWidth, height: canvasHeight,
    fill: 'white', stroke: '#ddd', strokeWidth: 1, rotation: 0, scaleX: 1, scaleY: 1, zIndex: -1, isTemplate: true,
    shadowColor: 'black', shadowBlur: 10, shadowOpacity: 0.1
  });

  // 1. FORM HEADER (Fixed Paper Lines)
  const headerY = padding;
  const col1W = (canvasWidth - padding * 2) * 0.65;
  const col2W = (canvasWidth - padding * 2) * 0.35;
  const rowH = 35; // Slightly taller rows
  
  // Title
  objects.push({
    id: uuidv4(), type: 'text', x: padding, y: headerY + 10, text: 'OLAY YERİ KROKİSİ',
    fontSize: 24, fontStyle: 'bold', fill: 'black', width: canvasWidth - padding * 2, height: 35,
    align: 'center', rotation: 0, scaleX: 1, scaleY: 1, zIndex: 1, isTemplate: true
  });

  const tableTop = headerY + 55;
  
  // Outer Box for Metadata
  objects.push({
    id: uuidv4(), type: 'rect', x: padding, y: tableTop, width: canvasWidth - padding * 2, height: rowH * 3,
    stroke: 'black', strokeWidth: 1.5, rotation: 0, scaleX: 1, scaleY: 1, zIndex: 0, isTemplate: true
  });

  // Internal Lines (Horizontal)
  [1, 2].forEach(i => {
    objects.push({
      id: uuidv4(), type: 'line', x: padding, y: tableTop + rowH * i, width: canvasWidth - padding * 2, height: 1,
      fill: 'black', rotation: 0, scaleX: 1, scaleY: 1, zIndex: 2, isTemplate: true
    });
  });

  // Internal Lines (Vertical Divider for top two rows)
  objects.push({
    id: uuidv4(), type: 'line', x: padding + col1W, y: tableTop, width: 1, height: rowH * 2,
    fill: 'black', rotation: 0, scaleX: 1, scaleY: 1, zIndex: 2, isTemplate: true
  });

  const formattedDate = formatDate(info.date);

  // Metadata Labels & Values
  const fields = [
    { label: 'Rapor No:', value: info.reportNo, x: padding + 10, y: tableTop + 10, w: col1W - 20 },
    { label: 'Tarih:', value: formattedDate, x: padding + col1W + 10, y: tableTop + 10, w: col2W - 20 },
    { label: 'Adres:', value: info.address, x: padding + 10, y: tableTop + rowH + 10, w: col1W - 20 },
    { label: 'Saat:', value: '', x: padding + col1W + 10, y: tableTop + rowH + 10, w: col2W - 20 },
    { label: 'Olay Adı:', value: info.eventName, x: padding + 10, y: tableTop + rowH * 2 + 10, w: canvasWidth - padding * 2 - 20 },
  ];

  fields.forEach(f => {
    // Label
    objects.push({
      id: uuidv4(), type: 'text', x: f.x, y: f.y, text: f.label,
      fontSize: 12, fontStyle: 'bold', fill: 'black', width: 85, height: 20, rotation: 0, scaleX: 1, scaleY: 1, zIndex: 3, isTemplate: true
    });
    // Value
    objects.push({
      id: uuidv4(), type: 'text', x: f.x + 90, y: f.y - 1, text: String(f.value || ''),
      fontSize: 13, fontStyle: 'bold', fill: 'black', width: f.w - 90, height: 20, rotation: 0, scaleX: 1, scaleY: 1, zIndex: 3, isTemplate: true
    });
  });

  // 2. DRAWING AREA (Starts exactly below Olay Adı bottom line)
  const drawingAreaY = tableTop + rowH * 3;
  const footerH = 100;
  const drawingAreaH = canvasHeight - drawingAreaY - footerH - padding;

  // Çizim alanı kenar çizgisi - tüm kenarlarda padding kadar içeride
  const drawingBorderX = padding;
  const drawingBorderW = canvasWidth - padding * 2;

  objects.push({
    id: uuidv4(), type: 'rect',
    x: drawingBorderX, y: drawingAreaY,
    width: drawingBorderW, height: drawingAreaH,
    stroke: 'black', strokeWidth: 2,
    rotation: 0, scaleX: 1, scaleY: 1, zIndex: 0, isTemplate: true
  });

  // Finding List Table (Part of template)
  objects.push({
    id: 'finding-list-canvas', type: 'finding-list',
    x: drawingBorderX + drawingBorderW - 210, y: drawingAreaY + 10,
    width: 200, height: 150, rotation: 0, scaleX: 1, scaleY: 1, zIndex: 50, isTemplate: true
  });

  // 3. FOOTER (Signatures & Page Info)
  const footerY = drawingAreaY + drawingAreaH + 5;
  
  // signature area
  objects.push({
    id: uuidv4(), type: 'text', x: canvasWidth - padding - 200, y: footerY,
    text: 'KROKİYİ ÇİZEN', fontSize: 12, fontStyle: 'bold', fill: 'black', width: 200, height: 20, rotation: 0, scaleX: 1, scaleY: 1, align: 'center', zIndex: 5, isTemplate: true
  });
  objects.push({
    id: uuidv4(), type: 'text', x: canvasWidth - padding - 200, y: footerY + 15,
    text: String(info.sketchedBy || ''), fontSize: 13, fontStyle: 'bold italic', fill: 'black', width: 200, height: 20, rotation: 0, scaleX: 1, scaleY: 1, align: 'center', zIndex: 5, isTemplate: true
  });

  objects.push({
    id: uuidv4(), type: 'text', x: padding, y: canvasHeight - padding - 10,
    text: 'Form No: OYI-K-001', fontSize: 9, fill: '#666', width: 200, height: 15, rotation: 0, scaleX: 1, scaleY: 1, zIndex: 5, isTemplate: true
  });

  // Sembollerin hareket edebileceği alan kenar çizgisinin 1px içi
  const innerPad = 2;
  return {
    objects,
    drawingArea: {
      x: drawingBorderX + innerPad,
      y: drawingAreaY + innerPad,
      width: drawingBorderW - innerPad * 2,
      height: drawingAreaH - innerPad * 2
    }
  };
};

export const createDiagramTemplate = (canvasWidth: number, canvasHeight: number, info: ProjectInfo): { objects: CanvasObject[], drawingArea: { x: number, y: number, width: number, height: number } } => {
  const objects: CanvasObject[] = [];
  const padding = 20;
  const contentWidth = canvasWidth - padding * 2;
  const contentHeight = canvasHeight - padding * 2;

  // --- OUTER BORDER (Drawn as lines to allow gaps) ---
  let line1Y = padding + 15 + 50;
  const line2Y = line1Y + 10 + 45;
  let infoY = line2Y + 8;
  let line3Y = infoY + 22;

  // Bottom Line
  objects.push({
    id: uuidv4(), type: 'line', x: padding, y: padding + contentHeight, width: contentWidth, height: 1.5, fill: 'black', rotation: 0, scaleX: 1, scaleY: 1, zIndex: 0, isTemplate: true
  });
  // Left Line (Broken at Row 1, 2, and 3)
  objects.push({
    id: uuidv4(), type: 'line', x: padding, y: line3Y, width: 1.5, height: (padding + contentHeight) - line3Y, fill: 'black', rotation: 0, scaleX: 1, scaleY: 1, zIndex: 0, isTemplate: true
  });
  // Right Line (Broken at Row 1, 2, and 3)
  objects.push({
    id: uuidv4(), type: 'line', x: padding + contentWidth, y: line3Y, width: 1.5, height: (padding + contentHeight) - line3Y, fill: 'black', rotation: 0, scaleX: 1, scaleY: 1, zIndex: 0, isTemplate: true
  });

  // --- HEADER ROW 1 ---
  const headerY1 = padding + 15;
  
  // Left: Department Text
  objects.push({
    id: uuidv4(),
    type: 'text',
    x: padding + 40, // Logo küçüldüğü için yazıyı biraz daha yaklaştırdım
    y: padding + 15,
    text: 'KRİMİNAL\nPOLİS\nLABORATUVARLARI DAİ. BŞK.',
    fontSize: 9,
    fontStyle: 'bold',
    fill: 'black',
    width: 180,
    height: 45,
    rotation: 0, scaleX: 1, scaleY: 1, zIndex: 1, isTemplate: true
  });

  // Kurumsal Logo Kutusu ve Logo (Diyagram) - Daima oluştur (Admin direkt tuvalden yükleyebilsin)
  const config = info.corporateLogoConfig;
  const lx = config ? config.x : padding + 3;
  const ly = config ? config.y : padding + 15; // Yazı ile aynı hizada
  const lw = config ? config.width : 30; // Varsayılan Genişlik 30
  const lh = config ? config.height : 24; // Varsayılan Yükseklik 24

  // Logo Kutusu (Görünmez Kapsayıcı)
  objects.push({
    id: 'corporate-logo-box',
    type: 'rect',
    x: lx,
    y: ly,
    width: lw,
    height: lh,
    fill: 'transparent',
    stroke: 'transparent',
    strokeWidth: 0,
    rotation: config ? config.rotation : 0,
    scaleX: 1, scaleY: 1, zIndex: 9, isTemplate: true
  });

  // Logo (Admin tarafından sürüklenebilir)
  objects.push({
    id: 'corporate-logo',
    type: 'image',
    src: info.corporateLogo || '/logo.png', // Varsayılan olarak uygulama logosu
    x: lx,
    y: ly,
    width: lw,
    height: lh,
    rotation: config ? config.rotation : 0, 
    scaleX: config ? config.scaleX : 1, 
    scaleY: config ? config.scaleY : 1, 
    zIndex: 10, 
    isTemplate: true
  });

  // Center: Title + Reference
  objects.push({
    id: uuidv4(),
    type: 'text',
    x: padding,
    y: headerY1,
    text: (info.diagramType || 'OTOMOBİL DİYAGRAMI') + ' FORMU',
    fontSize: 18,
    fontStyle: 'bold',
    fill: 'black',
    width: contentWidth,
    height: 30,
    align: 'center',
    rotation: 0, scaleX: 1, scaleY: 1, zIndex: 1, isTemplate: true
  });
  objects.push({
    id: uuidv4(),
    type: 'text',
    x: padding,
    y: headerY1 + 25,
    text: 'Referans: [ OYI-TP-001 ]',
    fontSize: 10,
    fontStyle: 'bold',
    fill: '#444',
    width: contentWidth,
    height: 30,
    align: 'center',
    rotation: 0, scaleX: 1, scaleY: 1, zIndex: 1, isTemplate: true
  });

  // Right: Form Code
  objects.push({
    id: uuidv4(),
    type: 'text',
    x: padding + contentWidth - 150,
    y: headerY1 + 10,
    text: 'Form Kodu\n[ OYI-TF-013 ]',
    fontSize: 10,
    fontStyle: 'bold',
    fill: '#444',
    width: 140,
    height: 30,
    align: 'right',
    rotation: 0, scaleX: 1, scaleY: 1, zIndex: 1, isTemplate: true
  });

  // Line 1
  line1Y = headerY1 + 50;
  objects.push({
    id: uuidv4(),
    type: 'line',
    x: padding,
    y: line1Y,
    width: contentWidth,
    height: 1,
    fill: 'black',
    rotation: 0, scaleX: 1, scaleY: 1, zIndex: 2, isTemplate: true
  });

  // --- HEADER ROW 2 ---
  const headerY2 = line1Y + 10;
  objects.push({
    id: uuidv4(),
    type: 'text',
    x: padding,
    y: headerY2,
    text: 'ISPARTA EMNİYET MÜDÜRLÜĞÜ',
    fontSize: 14,
    fontStyle: 'bold',
    fill: 'black',
    width: contentWidth,
    height: 30,
    align: 'center',
    rotation: 0, scaleX: 1, scaleY: 1, zIndex: 1, isTemplate: true
  });
  objects.push({
    id: uuidv4(),
    type: 'text',
    x: padding,
    y: headerY2 + 20,
    text: 'Olay Yeri İnceleme Şube Müdürlüğü',
    fontSize: 14,
    fontStyle: 'bold',
    fill: 'black',
    width: contentWidth,
    height: 30,
    align: 'center',
    rotation: 0, scaleX: 1, scaleY: 1, zIndex: 1, isTemplate: true
  });

  // --- HEADER ROW 3 (Info) ---
  infoY = line2Y + 8;

  objects.push({
    id: 'diag-hdr3-date',
    type: 'text',
    x: padding + 5,
    y: infoY,
    text: `Tarih: ${formatDate(info.date)}`,
    fontSize: 11,
    fill: 'black',
    width: 250,
    height: 20,
    align: 'left',
    rotation: 0, scaleX: 1, scaleY: 1, zIndex: 2, isTemplate: true
  });
  objects.push({
    id: 'diag-hdr3-team',
    type: 'text',
    x: padding,
    y: infoY,
    text: `Görevli Ekip Kodu: ${info.eventName || ''}`,
    fontSize: 11,
    fill: 'black',
    width: contentWidth,
    height: 20,
    align: 'center',
    rotation: 0, scaleX: 1, scaleY: 1, zIndex: 2, isTemplate: true
  });
  objects.push({
    id: 'diag-hdr3-reportno',
    type: 'text',
    x: padding + contentWidth - 300,
    y: infoY,
    text: `Rapor No: ${info.reportNo || ''}`,
    fontSize: 11,
    fill: 'black',
    width: 295,
    height: 20,
    align: 'right',
    rotation: 0, scaleX: 1, scaleY: 1, zIndex: 2, isTemplate: true
  });

  // Line 3
  line3Y = infoY + 22;
  objects.push({
    id: uuidv4(),
    type: 'line',
    x: padding,
    y: line3Y,
    width: contentWidth,
    height: 1,
    fill: 'black',
    rotation: 0, scaleX: 1, scaleY: 1, zIndex: 2, isTemplate: true
  });

  // --- REST OF THE FORM ---
  const sidebarWidth1 = 30;
  const sidebarWidth2 = 25;
  const sidebarTotal = sidebarWidth1 + sidebarWidth2;
  // mainPadding removed as unused
  const startX = padding;
  const availableWidth = contentWidth;
  const line1X = startX + sidebarWidth1;
  const line2X = startX + sidebarTotal;
  
  const area3H = 90;
  const area2H = 80;
  const spacing = 0;
  const area3Y = padding + contentHeight - area3H;
  const area2Y = area3Y - area2H;
  const area1Y = line3Y;
  const area1H = area2Y - area1Y - spacing;

  const sections = [
    { id: '1', y: area1Y, h: area1H, label: '1', sideText: 'BULGU VEYA HASARLARIN TESPİT EDİLDİĞİ BÖLGELER' },
    { id: '2', y: area2Y, h: area2H, label: '2', sideText: 'AÇIKLAMA' },
    { id: '3', y: area3Y, h: area3H, label: '3', sideText: 'İMZA' }
  ];

  sections.forEach(s => {
    objects.push({
      id: `diag-rect-${s.id}`,
      type: 'rect',
      x: startX,
      y: s.y,
      width: availableWidth,
      height: s.h,
      stroke: 'black',
      strokeWidth: 1,
      rotation: 0, scaleX: 1, scaleY: 1, zIndex: 3, isTemplate: true
    });
    objects.push({
      id: `diag-line1-${s.id}`,
      type: 'line',
      x: line1X,
      y: s.y,
      width: 1,
      height: s.h,
      fill: 'black',
      dash: [5, 5],
      rotation: 0, scaleX: 1, scaleY: 1, zIndex: 4, isTemplate: true
    });
    objects.push({
      id: `diag-line2-${s.id}`,
      type: 'line',
      x: line2X,
      y: s.y,
      width: 1,
      height: s.h,
      fill: 'black',
      dash: [5, 5],
      rotation: 0, scaleX: 1, scaleY: 1, zIndex: 4, isTemplate: true
    });
    objects.push({
      id: `diag-num-${s.id}`,
      type: 'text',
      x: startX,
      y: s.y + s.h / 2 - 10,
      text: s.label,
      fontSize: 18,
      fontStyle: 'bold',
      fill: 'black',
      width: sidebarWidth1,
      height: 20,
      align: 'center',
      rotation: 0, scaleX: 1, scaleY: 1, zIndex: 5, isTemplate: true
    });

    const isMainLabel = s.label === '1';
    const fontSz = isMainLabel ? 12 : 11;
    const txtH = 16;
    const colX = line1X + (sidebarWidth2 - txtH) / 2;

    objects.push({
      id: `diag-sidetxt-${s.id}`,
      type: 'text',
      x: colX,
      y: s.y + s.h, 
      text: s.sideText,
      fontSize: fontSz,
      fontStyle: 'bold',
      fill: 'black',
      width: s.h, 
      height: txtH,
      align: 'center',
      rotation: -90,
      scaleX: 1, scaleY: 1, zIndex: 5, isTemplate: true
    });
  });

  objects.push({
    id: uuidv4(),
    type: 'text',
    x: line2X + 15,
    y: area2Y + 15,
    text: info.description || '',
    fontSize: 12,
    fill: 'black',
    width: availableWidth - sidebarTotal - 30,
    height: 60,
    rotation: 0, scaleX: 1, scaleY: 1, zIndex: 6, isTemplate: true
  });

  const sigAreaWidth = availableWidth - sidebarTotal;
  const half = sigAreaWidth / 2;

  objects.push({
    id: uuidv4(),
    type: 'line',
    x: line2X + half,
    y: area3Y,
    width: 1,
    height: area3H,
    fill: 'black',
    rotation: 0, scaleX: 1, scaleY: 1, zIndex: 5, isTemplate: true
  });

  const sigs = [
    { label: 'Uzman / Uzman Yrd.', value: info.sketchedBy, x: line2X },
    { label: 'Uzman / Uzman Yrd.', value: info.expert2, x: line2X + half },
  ];

  sigs.forEach(s => {
    objects.push({
      id: uuidv4(),
      type: 'text',
      x: s.x,
      y: area3Y + 8,
      text: s.label,
      fontSize: 9,
      fontStyle: 'bold',
      fill: 'black',
      width: half,
      height: 20,
      align: 'center',
      rotation: 0, scaleX: 1, scaleY: 1, zIndex: 6, isTemplate: true
    });
    objects.push({
      id: uuidv4(),
      type: 'text',
      x: s.x,
      y: area3Y + 35,
      text: s.value || '',
      fontSize: 11,
      fill: 'black',
      width: half,
      height: 20,
      align: 'center',
      rotation: 0, scaleX: 1, scaleY: 1, zIndex: 6, isTemplate: true
    });
  });

  // Bulgu Listesi Tablosu (Tuval Üzerinde Hareketli)
  objects.push({
    id: 'finding-list-canvas',
    type: 'finding-list',
    x: padding + contentWidth - 210,
    y: padding + 550, // Orta sağ bölge
    width: 200,
    height: 150,
    rotation: 0,
    scaleX: 1,
    scaleY: 1,
    zIndex: 50,
    isTemplate: true
  });

  return {
    objects,
    drawingArea: {
      x: line2X,
      y: area1Y,
      width: availableWidth - sidebarTotal,
      height: area1H
    }
  };
};
