export const SYMBOL_CATEGORIES = [
  {
    id: 'evidence',
    name: 'Delil İşaretleri',
    symbols: [
      { 
        id: 'ev-shooting-trajectory', 
        name: 'Atış Yönü Tespiti', 
        src: 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="100" height="100" viewBox="0 0 100 100"><line x1="10" y1="90" x2="90" y2="10" stroke="%23ff0000" stroke-width="4" stroke-dasharray="8,4"/><circle cx="10" cy="90" r="8" fill="none" stroke="%23ff0000" stroke-width="2"/><circle cx="90" cy="10" r="4" fill="%23ff0000"/></svg>', 
        thumbnail: 'data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSIxMDAiIGhlaWdodD0iMTAwIiB2aWV3Qm94PSIwIDAgMTAwIDEwMCI+PGxpbmUgeDE9IjEwIiB5MT0iOTAiIHgyPSI5MCIgeTI9IjEwIiBzdHJva2U9InJlZCIgc3Ryb2tlLXdpZHRoPSI0IiBzdHJva2UtZGFzaGFycmF5PSI4LDQiLz48Y2lyY2xlIGN4PSIxMCIgY3k9IjkwIiByPSI4IiBmaWxsPSJub25lIiBzdHJva2U9InJlZCIgc3Ryb2tlLXdpZHRoPSIyIi8+PGNpcmNsZSBjeD0iOTAiIGN5PSIxMCIgcj0iNCIgZmlsbD0icmVkIi8+PC9zdmc+',
        type: 'symbol', 
        width: 200, 
        height: 200, 
        description: 'İnteraktif mermi yolu analizi. Kırmızı halka (namlu çıkışı) ve dolu nokta (isabet) sürüklenerek yön ayarlanır. Derece ve mesafe paralel bilgi panelinde otomatik gösterilir.' 
      },
      { id: 'ev-circle', name: 'Yuvarlak Numaratör', src: 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="100" height="100" viewBox="0 0 100 100"><circle cx="50" cy="50" r="40" fill="%23F5C518"/></svg>', type: 'symbol' },
      { id: 'ev-square', name: 'Kare Numaratör', src: 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="100" height="100" viewBox="0 0 100 100"><rect x="10" y="10" width="80" height="80" fill="none" stroke="%23F5C518" stroke-width="6"/></svg>', type: 'symbol' },
      { id: 'ev-ruler-straight', name: 'Düz Cetvel', src: 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="100" height="100" viewBox="0 0 100 100"><rect x="10" y="40" width="80" height="20" fill="none" stroke="%23F5C518" stroke-width="4"/><line x1="20" y1="40" x2="20" y2="48" stroke="%23F5C518" stroke-width="2"/><line x1="40" y1="40" x2="40" y2="52" stroke="%23F5C518" stroke-width="2"/><line x1="60" y1="40" x2="60" y2="48" stroke="%23F5C518" stroke-width="2"/><line x1="80" y1="40" x2="80" y2="52" stroke="%23F5C518" stroke-width="2"/></svg>', type: 'symbol', width: 200, height: 30 },
      { id: 'ev-ruler-l', name: 'L Cetvel', src: 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="100" height="100" viewBox="0 0 100 100"><path d="M 20 20 L 40 20 L 40 60 L 80 60 L 80 80 L 20 80 Z" fill="none" stroke="%23F5C518" stroke-width="4" stroke-linejoin="round"/><line x1="20" y1="40" x2="28" y2="40" stroke="%23F5C518" stroke-width="2"/><line x1="60" y1="80" x2="60" y2="72" stroke="%23F5C518" stroke-width="2"/></svg>', type: 'symbol', width: 120, height: 120 },
      { id: 'ev-arrow-l', name: 'Yön Oku (Sol-Boş)', src: 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="100" height="100" viewBox="0 0 100 100"><path d="M 70 20 L 30 50 L 70 80 Z" fill="none" stroke="%23F5C518" stroke-width="6"/></svg>', type: 'symbol' },
      { id: 'ev-arrow-r', name: 'Yön Oku (Sağ-Boş)', src: 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="100" height="100" viewBox="0 0 100 100"><path d="M 30 20 L 70 50 L 30 80 Z" fill="none" stroke="%23F5C518" stroke-width="6"/></svg>', type: 'symbol' },
      { id: 'ev-callout', name: 'Açıklama Balonu', src: 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="100" height="100" viewBox="0 0 100 100"><rect x="10" y="10" width="80" height="55" rx="8" fill="none" stroke="%23F5C518" stroke-width="5"/><path d="M 30 65 L 20 85 L 45 65 Z" fill="%23F5C518"/></svg>', type: 'symbol', width: 120, height: 60 },
      { id: 'ev-arrowhead', name: 'Ok Ucu (Boş)', src: 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="100" height="100" viewBox="0 0 100 100"><path d="M 30 20 L 70 50 L 30 80 Z" fill="none" stroke="%23F5C518" stroke-width="4" stroke-linejoin="round"/></svg>', type: 'symbol', width: 60, height: 60 },
      { id: 'ev-arrow-desc', name: 'Ok İşaretli Açıklama (Kare)', src: 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="100" height="100" viewBox="0 0 100 100"><line x1="20" y1="50" x2="60" y2="50" stroke="%23F5C518" stroke-width="4"/><polygon points="60,40 80,50 60,60" fill="%23F5C518"/><rect x="5" y="40" width="10" height="20" fill="%23F5C518"/></svg>', type: 'symbol', width: 200, height: 40 },
      { id: 'ev-arrow-desc-ellipse', name: 'Ok İşaretli Açıklama (Elips)', src: 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="100" height="100" viewBox="0 0 100 100"><line x1="20" y1="50" x2="60" y2="50" stroke="%23F5C518" stroke-width="4"/><polygon points="60,40 80,50 60,60" fill="%23F5C518"/><ellipse cx="10" cy="50" rx="8" ry="10" fill="%23F5C518"/></svg>', type: 'symbol', width: 200, height: 40 },
      { id: 'ev-angle-ruler', name: 'Açı Ölçer', src: 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="100" height="100" viewBox="0 0 100 100"><path d="M 10 90 L 90 90 M 10 90 L 10 90 L 70 30" fill="none" stroke="%23F5C518" stroke-width="4"/><path d="M 30 90 A 20 20 0 0 0 25 75" fill="none" stroke="%23F5C518" stroke-width="2"/><text x="35" y="80" fill="%23F5C518" font-size="12">45°</text></svg>', type: 'symbol', width: 100, height: 100, description: 'İki nokta arasındaki açıyı ölçmek için kullanılır. Köşe noktası ve kolların uçları sürüklenerek hassas açı ölçümü yapılabilir.' },
      { id: 'ev-camera-link', name: 'Fotoğraf Noktası (Kamera)', src: 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="100" height="100" viewBox="0 0 100 100"><rect x="10" y="30" width="80" height="55" rx="8" fill="%23F5C518"/><path d="M 35 30 L 42 18 L 58 18 L 65 30 Z" fill="%23F5C518"/><circle cx="50" cy="57" r="18" fill="black"/><circle cx="50" cy="57" r="12" fill="%23F5C518"/></svg>', type: 'symbol', width: 50, height: 50 },
      { id: 'ev-bpa-drop', name: 'Kan Sıçrama Analizi (BPA)', src: 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="100" height="100" viewBox="0 0 100 100"><path d="M 50 10 C 30 50 30 90 50 90 C 70 90 70 50 50 10" fill="%23990000" stroke="white" stroke-width="2"/><line x1="50" y1="90" x2="50" y2="150" stroke="%23990000" stroke-width="2" stroke-dasharray="5,5"/></svg>', type: 'symbol', width: 40, height: 80, description: 'Kan damlası sıçrama analizi için kullanılır. Kuyruk uzunluğu sürüklenerek isabet açısı ve yönü belirlenebilir.' },
    ]
  },
  {
    id: 'people',
    name: 'İnsan Figürleri',
    symbols: [
      { id: 'p-1', name: 'Ayakta (Erkek)', src: 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="100" height="100" viewBox="0 0 100 100"><circle cx="50" cy="20" r="10" fill="black"/><path d="M40 32 h20 v30 h-6 v33 h-8 v-33 h-6 Z" fill="black"/></svg>', type: 'symbol' },
      { id: 'p-2', name: 'Ayakta (Kadın)', src: 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="100" height="100" viewBox="0 0 100 100"><circle cx="50" cy="20" r="10" fill="black"/><path d="M42 32 h16 L65 65 H35 Z M44 65 v30 h12 v-30 Z" fill="black"/></svg>', type: 'symbol' },
      { id: 'p-3', name: 'Yerde (Sırtüstü)', src: 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="100" height="100" viewBox="0 0 100 100"><circle cx="50" cy="20" r="12" fill="black"/><path d="M30 40 h40 v40 h-10 v70 h-10 v-70 h-20 Z" fill="black"/></svg>', type: 'symbol', width: 80, height: 180 },
      { id: 'p-4', name: 'Yerde (Yüzüstü)', src: 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="100" height="100" viewBox="0 0 100 100"><circle cx="50" cy="20" r="12" fill="black"/><path d="M30 40 h40 v40 h-10 v70 h-10 v-70 h-20 Z" fill="black"/></svg>', type: 'symbol', width: 80, height: 180, rotation: 180 },
      { id: 'p-5', name: 'Vücut Haritası (Ön)', src: 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 200" width="100" height="200"><path d="M50 10c-5 0-9 4-9 9s4 9 9 9 9-4 9-9-4-9-9-9zm-15 30c-2 0-4 2-4 4v40c0 2 2 4 4 4h4l-2 80c0 4 3 7 7 7s7-3 7-7l3-60 3 60c0 4 3 7 7 7s7-3 7-7l-2-80h4c2 0 4-2 4-4V44c0-2-2-4-4-4H35z" fill="none" stroke="black" stroke-width="2"/></svg>', type: 'symbol', width: 100, height: 200, description: 'Yaralanma bölgelerini işaretlemek için kullanılan teknik insan şeması (Ön).' },
      { id: 'p-6', name: 'Vücut Haritası (Arka)', src: 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 200" width="100" height="200"><path d="M50 10c-5 0-9 4-9 9s4 9 9 9 9-4 9-9-4-9-9-9zm-15 30c-2 0-4 2-4 4v40c0 2 2 4 4 4h4l-2 80c0 4 3 7 7 7s7-3 7-7l3-60 3 60c0 4 3 7 7 7s7-3 7-7l-2-80h4c2 0 4-2 4-4V44c0-2-2-4-4-4H35z" fill="gray" opacity="0.2" stroke="black" stroke-width="2"/></svg>', type: 'symbol', width: 100, height: 200, description: 'Yaralanma bölgelerini işaretlemek için kullanılan teknik insan şeması (Arka).' },
    ]
  },
  {
    id: 'vehicles',
    name: 'Araçlar',
    symbols: [
      { id: 'v-sedan', name: 'Binek Otomobil', src: 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="180" height="80" viewBox="0 0 180 80"><rect x="10" y="25" width="160" height="35" rx="8" fill="black"/><path d="M40 25 L65 8 L125 8 L145 25 Z" fill="black"/><circle cx="40" cy="60" r="12" fill="black" stroke="white" stroke-width="3"/><circle cx="140" cy="60" r="12" fill="black" stroke="white" stroke-width="3"/></svg>', type: 'symbol', width: 180, height: 80 },
      { id: 'v-suv', name: 'SUV / Jeep', src: 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="200" height="90" viewBox="0 0 200 90"><rect x="10" y="20" width="180" height="45" rx="6" fill="black"/><path d="M35 20 L55 5 L145 5 L165 20 Z" fill="black"/><circle cx="45" cy="65" r="14" fill="black" stroke="white" stroke-width="3"/><circle cx="155" cy="65" r="14" fill="black" stroke="white" stroke-width="3"/></svg>', type: 'symbol', width: 200, height: 90 },
      { id: 'v-truck', name: 'Kamyon', src: 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="300" height="100" viewBox="0 0 300 100"><rect x="10" y="20" width="200" height="50" fill="black"/><rect x="215" y="30" width="75" height="40" rx="4" fill="black"/><circle cx="50" cy="70" r="14" fill="black" stroke="white" stroke-width="3"/><circle cx="150" cy="70" r="14" fill="black" stroke="white" stroke-width="3"/><circle cx="250" cy="70" r="14" fill="black" stroke="white" stroke-width="3"/></svg>', type: 'symbol', width: 300, height: 100 },
      { id: 'v-bus', name: 'Otobüs', src: 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="350" height="100" viewBox="0 0 350 100"><rect x="10" y="15" width="330" height="60" rx="10" fill="black"/><circle cx="70" cy="75" r="15" fill="black" stroke="white" stroke-width="3"/><circle cx="280" cy="75" r="15" fill="black" stroke="white" stroke-width="3"/></svg>', type: 'symbol', width: 350, height: 100 },
      { id: 'v-motor', name: 'Motosiklet', src: 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="100" height="40" viewBox="0 0 100 40"><circle cx="20" cy="25" r="12" fill="none" stroke="black" stroke-width="4"/><circle cx="80" cy="25" r="12" fill="none" stroke="black" stroke-width="4"/><path d="M20 25 L45 10 L65 10 L80 25 M45 10 L45 25" fill="none" stroke="black" stroke-width="4"/></svg>', type: 'symbol', width: 100, height: 40 },
      { id: 'v-police', name: 'Polis Aracı', src: 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="180" height="80" viewBox="0 0 180 80"><rect x="10" y="25" width="160" height="35" rx="8" fill="black"/><path d="M40 25 L65 8 L125 8 L145 25 Z" fill="black"/><rect x="85" y="2" width="10" height="6" fill="%233b82f6"/><circle cx="40" cy="60" r="12" fill="black" stroke="white" stroke-width="3"/><circle cx="140" cy="60" r="12" fill="black" stroke="white" stroke-width="3"/></svg>', type: 'symbol', width: 180, height: 80 },
      { id: 'v-ambulance', name: 'Ambulans', src: 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="220" height="90" viewBox="0 0 220 90"><rect x="10" y="20" width="200" height="50" rx="6" fill="black"/><path d="M60 45 h20 M70 35 v20" stroke="red" stroke-width="4"/><circle cx="50" cy="70" r="14" fill="black" stroke="white" stroke-width="3"/><circle cx="170" cy="70" r="14" fill="black" stroke="white" stroke-width="3"/></svg>', type: 'symbol', width: 220, height: 90 },
    ]
  },
  {
    id: 'traffic-signs',
    name: 'Trafik İşaretleri',
    symbols: [
      { id: 'ts-stop', name: 'Dur İşareti', src: 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="100" height="100" viewBox="0 0 100 100"><polygon points="30,5 70,5 95,30 95,70 70,95 30,95 5,70 5,30" fill="red"/><text x="50" y="62" font-size="28" font-family="Arial" font-weight="bold" fill="white" text-anchor="middle">DUR</text></svg>', type: 'symbol', width: 40, height: 40 },
      { id: 'ts-yield', name: 'Yol Ver', src: 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><path d="M50 10L90 80H10Z" fill="none" stroke="%23F5C518" stroke-width="8"/><path d="M50 25L75 70H25Z" fill="%23F5C518"/></svg>', type: 'symbol', width: 40, height: 40 },
      { id: 'ts-no-entry', name: 'Giriş Yasak', src: 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="100" height="100" viewBox="0 0 100 100"><circle cx="50" cy="50" r="45" fill="red"/><rect x="15" y="40" width="70" height="20" fill="white"/></svg>', type: 'symbol', width: 40, height: 40 },
      { id: 'ts-parking', name: 'Otopark', src: 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="100" height="100" viewBox="0 0 100 100"><rect x="5" y="5" width="90" height="90" rx="10" fill="%232563eb"/><text x="50" y="70" font-size="65" font-family="Arial" font-weight="bold" fill="white" text-anchor="middle">P</text></svg>', type: 'symbol', width: 40, height: 40 },
      { id: 'ts-cone', name: 'Trafik Dubası', src: 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><path d="M20 90 L80 90 M35 90 L50 20 L65 90" fill="none" stroke="%23F5C518" stroke-width="8" stroke-linejoin="round"/><rect x="42" y="50" width="16" height="10" fill="%23F5C518"/></svg>', type: 'symbol', width: 25, height: 25 },
      { id: 'ts-barrier', name: 'Güvenlik Bariyeri', src: 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><rect x="5" y="30" width="90" height="20" fill="%23F5C518"/><rect x="20" y="50" width="8" height="30" fill="%23F5C518"/><rect x="72" y="50" width="8" height="30" fill="%23F5C518"/><path d="M10 40 H90" stroke="black" stroke-width="2" stroke-dasharray="10,5"/></svg>', type: 'symbol', width: 100, height: 30 },
    ]
  },
  {
    id: 'clothing',
    name: 'Giysi Eşya',
    symbols: []
  },
  {
    id: 'weapons',
    name: 'Silahlar ve Parçaları',
    symbols: [
      { id: 'w-1', name: 'Tabanca', src: '/assets/symbols/pistol.png', type: 'symbol' },
      { id: 'w-2', name: 'Bıçak', src: '/assets/symbols/knife.png', type: 'symbol' },
      { id: 'w-3', name: 'Av Tüfeği (Pompalı)', src: '/assets/symbols/shotgun.png', type: 'symbol' },
      { id: 'w-4', name: 'Uzun Namlulu', src: '/assets/symbols/rifle.png', type: 'symbol' },
      { id: 'w-5', name: 'Sopa', src: '/assets/symbols/bat.png', type: 'symbol' },
      { id: 'w-6', name: 'AK-47 (Kalaşnikof)', src: '/assets/symbols/ak47.png', type: 'symbol' },
      { id: 'w-7', name: 'Av Tüfeği Fişeği', src: '/assets/symbols/shotgun_shell.png', type: 'symbol' },
    ]
  },
  {
    id: 'arrows',
    name: 'Oklar ve Yönler',
    symbols: [
      { id: 'a-4', name: 'Mesafe Oku', src: '/assets/symbols/distance_arrow.svg', type: 'symbol', isDistanceArrow: true, width: 150, height: 40, stroke: '#000000', fill: '#000000' },
      { id: 'a-5', name: 'Ok', src: '/assets/symbols/arrow_single.svg', type: 'symbol', width: 150, height: 40 },
      { id: 'st-5', name: 'Yol Yön Oku (Düz)', src: '/assets/symbols/road_arrow_up.svg', type: 'symbol', width: 40, height: 100 },
      { id: 'st-6', name: 'Yol Yön Oku (Sağa)', src: 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="100" height="100" viewBox="0 0 100 100"><path d="M20 50 H70 M50 30 L70 50 L50 70" fill="none" stroke="black" stroke-width="8" stroke-linecap="round"/></svg>', type: 'symbol' },
      { id: 'st-7', name: 'Yol Yön Oku (Sola)', src: 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="100" height="100" viewBox="0 0 100 100"><path d="M80 50 H30 M50 30 L30 50 L50 70" fill="none" stroke="black" stroke-width="8" stroke-linecap="round"/></svg>', type: 'symbol' },
      { id: 'st-8', name: 'Yol Yön Oku (Düz-Sağ)', src: 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="100" height="100" viewBox="0 0 100 100"><path d="M50 90 V20 M30 40 L50 20 L70 40 M50 50 H80 M65 35 L80 50 L65 65" fill="none" stroke="black" stroke-width="6" stroke-linecap="round"/></svg>', type: 'symbol' },
      { id: 'st-9', name: 'Yol Yön Oku (U Dönüşü)', src: '/assets/symbols/u_turn_arrow.svg', type: 'symbol', width: 60, height: 60 },
    ]
  },
  {
    id: 'architecture',
    name: 'Mimari Yapılar',
    symbols: [
      { id: 'arch-w1i', name: 'İç Duvar (Yatay)', src: 'data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSIxMDAiIGhlaWdodD0iMTAwIiB2aWV3Qm94PSIwIDAgMTAwIDEwMCI+PHJlY3QgeD0iMCIgeT0iNDYiIHdpZHRoPSIxMDAiIGhlaWdodD0iOCIgZmlsbD0iYmxhY2siLz48L3N2Zz4=', type: 'symbol', description: 'Oda bölmeleri ve iç duvarlar için kullanılır (8 birim kalınlık).' },
      { id: 'arch-w1vi', name: 'İç Duvar (Dikey)', src: 'data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSIxMDAiIGhlaWdodD0iMTAwIiB2aWV3Qm94PSIwIDAgMTAwIDEwMCI+PHJlY3QgeD0iNDYiIHk9IjAiIHdpZHRoPSI4IiBoZWlnaHQ9IjEwMCIgZmlsbD0iYmxhY2siLz48L3N2Zz4=', type: 'symbol', description: 'Oda bölmeleri için dikey iç duvar yapısı (8 birim kalınlık).' },
      { id: 'arch-7', name: 'Kavisli Duvar', src: 'data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSIxMDAiIGhlaWdodD0iMTAwIiB2aWV3Qm94PSIwIDAgMTAwIDEwMCI+PHBhdGggZD0iTSAxMCA5MCBBIDgwIDgwIDAgMCAxIDkwIDEwIiBzdHJva2U9ImJsYWNrIiBzdHJva2Utd2lkdGg9IjEwIiBmaWxsPSJub25lIi8+PC9zdmc+', type: 'symbol', description: 'Kavisli veya dairesel mimari alanları çizmek için kullanılır.' },
      { id: 'arch-w-square', name: 'Kare Duvar', src: 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="100" height="100" viewBox="0 0 100 100"><rect x="10" y="10" width="80" height="80" fill="none" stroke="black" stroke-width="8"/></svg>', type: 'symbol', description: 'Kare formunda kapalı duvar yapısı. Oda veya kolon oluşturmak için kullanılabilir.' },
      { id: 'arch-d1r', name: 'Kapı (Sağ)', src: 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="100" height="100" viewBox="0 0 100 100"><rect x="0" y="85" width="100" height="15" fill="white" stroke="black" stroke-width="4"/><line x1="95" y1="85" x2="95" y2="10" stroke="black" stroke-width="6"/><path d="M 95 10 A 85 85 0 0 0 10 85" stroke="black" stroke-width="2" fill="none" stroke-dasharray="5"/></svg>', type: 'symbol', description: 'Sağ yöne açılan standart oda kapısı. 90 derece açılı kanat ve kasa görünümü ile mimari standartlara uygundur.' },
      { id: 'arch-d1l', name: 'Kapı (Sol)', src: 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="100" height="100" viewBox="0 0 100 100"><rect x="0" y="85" width="100" height="15" fill="white" stroke="black" stroke-width="4"/><line x1="5" y1="85" x2="5" y2="10" stroke="black" stroke-width="6"/><path d="M 5 10 A 85 85 0 0 1 90 85" stroke="black" stroke-width="2" fill="none" stroke-dasharray="5"/></svg>', type: 'symbol', description: 'Sol yöne açılan standart oda kapısı. 90 derece açılı kanat ve kasa görünümü ile mimari standartlara uygundur.' },
      { id: 'arch-win', name: 'Pencere', src: 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="60" height="10" viewBox="0 0 60 10"><rect width="60" height="10" fill="white" stroke="black" stroke-width="2"/><line x1="0" y1="5" x2="60" y2="5" stroke="black" stroke-width="1"/></svg>', type: 'symbol', width: 60, height: 10, description: 'Olay yerindeki pencereleri belirtmek için kullanılır. Düzenleme alanında boyu (kalınlığı) değiştirilerek 3D görünümde aşağı-yukarı yüksekliği ayarlanabilir.' },
      { id: 'arch-d2', name: 'Çift Kapı', src: 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="100" height="100" viewBox="0 0 100 100"><rect x="0" y="85" width="100" height="15" fill="white" stroke="black" stroke-width="4"/><line x1="5" y1="85" x2="5" y2="25" stroke="black" stroke-width="6"/><line x1="95" y1="85" x2="95" y2="25" stroke="black" stroke-width="6"/><path d="M 5 25 A 45 45 0 0 1 50 85" stroke="black" stroke-width="2" fill="none" stroke-dasharray="4"/><path d="M 95 25 A 45 45 0 0 0 50 85" stroke="black" stroke-width="2" fill="none" stroke-dasharray="4"/></svg>', type: 'symbol', description: 'Geniş girişler için çift kanatlı kapı şeması.' },
      { 
        id: 'arch-6-v4', 
        name: 'Merdiven', 
        src: '/assets/symbols/stair_straight.svg', 
        thumbnail: 'data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSIxMDAiIGhlaWdodD0iMTAwIiB2aWV3Qm94PSIwIDAgMTAwIDEwMCI+PHJlY3QgeD0iMzAiIHk9IjEwIiB3aWR0aD0iNDAiIGhlaWdodD0iODAiIGZpbGw9Im5vbmUiIHN0cm9rZT0iYmxhY2siIHN0cm9rZS13aWR0aD0iNCIvPjxsaW5lIHgxPSIzMCIgeTE9IjI1IiB4Mj0iNzAiIHkyPSIyNSIgc3Ryb2tlPSJibGFjayIgc3Ryb2tlLXdpZHRoPSIyIi8+PGxpbmUgeDE9IjMwIiB5MT0iNDAiIHgyPSI3MCIgeTI9IjQwIiBzdHJva2U9ImJsYWNrIiBzdHJva2Utd2lkdGg9IjIiLz48bGluZSB4MT0iMzAiIHkxPSI1NSIgeDI9IjcwIiB5Mj0iNTUiIHN0cm9rZT0iYmxhY2siIHN0cm9rZS13aWR0aD0iMiIvPjxsaW5lIHgxPSIzMCIgeTE9IjcwIiB4Mj0iNzAiIHkyPSI3MCIgc3Ryb2tlPSJibGFjayIgc3Ryb2tlLXdpZHRoPSIyIi8+PC9zdmc+',
        type: 'symbol', 
        description: 'Prosedürel merdiven motoru. Yükseklik değiştikçe basamak sayısı otomatik hesaplanır. Katlar arası geçişleri gösterir.' 
      },
      { 
        id: 'arch-6l-v4', 
        name: 'Merdiven (L)', 
        src: '/assets/symbols/stair_l.svg', 
        thumbnail: 'data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSIxMDAiIGhlaWdodD0iMTAwIiB2aWV3Qm94PSIwIDAgMTAwIDEwMCI+PHBhdGggZD0iTSAyMCAxMCBMIDIwIDgwIEwgOTAgODAiIGZpbGw9Im5vbmUiIHN0cm9rZT0iYmxhY2siIHN0cm9rZS13aWR0aD0iOCIvPjxwYXRoIGQ9Ik0gNTAgMTAgTCA1MCA1MCBMIDkwIDUwIiBmaWxsPSJub25lIiBzdHJva2U9ImJsYWNrIiBzdHJva2Utd2lkdGg9IjgiLz48bGluZSB4MT0iMjAiIHkxPSIyNSIgeDI9IjUwIiB5Mj0iMjUiIHN0cm9rZS13aWR0aD0iNCIvPjxsaW5lIHgxPSI2NSIgeTE9IjUwIiB4Mj0iNjUiIHkyPSI4MCIgc3Ryb2tlPSJibGFjayIgc3Ryb2tlLXdpZHRoPSI0Ii8+PC9zdmc+',
        type: 'symbol',
        description: 'L şeklinde prosedürel merdiven. Boyutlandırıldığında basamak sayıları ve genişlikleri otomatik ayarlanır.'
      },
      { 
        id: 'arch-6u-v4', 
        name: 'Merdiven (U)', 
        src: '/assets/symbols/stair_u.svg', 
        thumbnail: 'data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSIxMDAiIGhlaWdodD0iMTAwIiB2aWV3Qm94PSIwIDAgMTAwIDEwMCI+PHBhdGggZD0iTSAxMCAxMCBMIDEwIDkwIEwgOTAgOTAgIEwgOTAgMTAiIGZpbGw9Im5vbmUiIHN0cm9rZT0iYmxhY2siIHN0cm9rZS13aWR0aD0iNiIvPjxwYXRoIGQ9Ik0gNDAgMTAgTCA0MCA2MCBMIDYwIDYwIEwgNjAgMTAiIGZpbGw9Im5vbmUiIHN0cm9rZT0iYmxhY2siIHN0cm9rZS13aWR0aD0iNiIvPjxsaW5lIHgxPSIxMCIgeTE9IjMwIiB4Mj0iNDAiIHkyPSIzMCIgc3Ryb2tlPSJibGFjayIgc3Ryb2tlLXdpZHRoPSIzIi8+PGxpbmUgeDE9IjYwIiB5MT0iMzAiIHgyPSI5MCIgeTI9IjMwIiBzdHJva2U9ImJsYWNrIiBzdHJva2Utd2lkdGg9IjMiLz48bGluZSB4MT0iNjAiIHkxPSI1MCIgeDI9IjkwIiB5Mj0iNTAiIHN0cm9rZT0iYmxhY2siIHN0cm9rZS13aWR0aD0iMyIvPjwvc3ZnPg==',
        type: 'symbol',
        description: 'U şeklinde prosedürel merdiven. Yükseklik ve genişlik değişimine göre basamak sayısı otomatik hesaplanır.'
      },
      { id: 'arch-house', name: 'Müstakil Ev', src: '/assets/symbols/house_detached.svg?v=2', type: 'symbol', fill: '#000000', description: 'Tek katlı veya müstakil ev yapıları.', isSketch: true },
      { id: 'arch-b1', name: 'Bina (1 Katlı)', src: '/assets/symbols/building_1_story_front.svg?v=2', type: 'symbol', fill: '#000000', description: 'Bir katlı binaların dış görünümü.', isSketch: true },
      { id: 'arch-b2', name: 'Bina (2 Katlı)', src: '/assets/symbols/building_2_story_front.svg?v=2', type: 'symbol', fill: '#000000', description: 'İki katlı binaların dış görünümü.', isSketch: true },
      { id: 'arch-b3', name: 'Bina (3 Katlı)', src: '/assets/symbols/building_3_story_front.svg?v=2', type: 'symbol', fill: '#000000', description: 'Üç katlı binaların dış görünümü.', isSketch: true },
      { id: 'arch-b4', name: 'Bina (4 Katlı)', src: '/assets/symbols/building_4_story_front.svg?v=2', type: 'symbol', fill: '#000000', description: 'Dört katlı binaların dış görünümü.', isSketch: true },
      { id: 'arch-b5', name: 'Bina (5 Katlı)', src: '/assets/symbols/building_5_story_front.svg?v=2', type: 'symbol', fill: '#000000', description: 'Beş katlı binaların dış görünümü.', isSketch: true },
      { id: 'arch-b6', name: 'Bina (6 Katlı)', src: '/assets/symbols/building_6_story_front.svg?v=2', type: 'symbol', fill: '#000000', description: 'Altı katlı binaların dış görünümü.', isSketch: true },
      { id: 'arch-b7', name: 'Bina (7 Katlı)', src: '/assets/symbols/building_7_story_front.svg?v=2', type: 'symbol', fill: '#000000', description: 'Yedi katlı binaların dış görünümü.', isSketch: true },
    ]
  },
  {
    id: 'streets',
    name: 'Cadde Sokak',
    symbols: [
      { id: 'st-1', name: 'Düz Yol', src: '/assets/symbols/roads/straight.svg', type: 'symbol', description: 'Standart iki şeritli düz yol segmenti.' },
      { id: 'st-2', name: 'T Kavşak', src: '/assets/symbols/roads/t_junction.svg', type: 'symbol', description: 'T tipi yol birleşimlerini çizmek için kullanılır.' },
      { id: 'st-3', name: 'Y Kavşak', src: '/assets/symbols/roads/y_junction.svg', type: 'symbol', description: 'Y tipi yol ayrımı veya birleşimi.' },
      { id: 'st-4', name: 'Ada (Döner)', src: '/assets/symbols/roads/roundabout.svg', type: 'symbol', description: 'Döner kavşakları ve trafik adalarını temsil eder.' },
      { id: 'st-drain', name: 'Rögar Kapağı', src: 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="100" height="100" viewBox="0 0 100 100"><circle cx="50" cy="50" r="40" fill="none" stroke="black" stroke-width="6"/><line x1="20" y1="50" x2="80" y2="50" stroke="black" stroke-width="4"/><line x1="50" y1="20" x2="50" y2="80" stroke="black" stroke-width="4"/></svg>', type: 'symbol', width: 40, height: 40, fill: '#000000', description: 'Yol üzerindeki kanalizasyon ve altyapı kapaklarını belirtir.' },
    ]
  },
  {
    id: 'furniture',
    name: 'Ev Eşyaları',
    symbols: [
      { id: 'f-1', name: 'Yatak (Tek)', src: '/assets/symbols/single_bed.svg', type: 'symbol', description: 'Tek kişilik yatak. Yatak odası yerleşimleri için kullanılır.' },
      { id: 'f-2', name: 'Yatak (Çift)', src: '/assets/symbols/double_bed.svg', type: 'symbol', description: 'Çift kişilik yatak. Ebeveyn banyolu odalar ve ana yatak odaları için.' },
      { id: 'f-3', name: 'Mutfak Tezgahı', src: '/assets/symbols/kitchen_counter.svg', type: 'symbol', description: 'Düz mutfak tezgahı ünitesi.' },
      { id: 'f-4', name: 'Mutfak Tezgahı (L)', src: '/assets/symbols/kitchen_counter_l_shape.svg', type: 'symbol', description: 'L tipi köşe mutfak tezgahı.' },
      { id: 'f-5', name: 'Koltuk (Tekli)', src: '/assets/symbols/one_seater_sofa.svg', type: 'symbol', description: 'Tek kişilik koltuk veya berjer.' },
      { id: 'f-8', name: 'Koltuk (İkili)', src: '/assets/symbols/two_seater_sofa.svg', type: 'symbol', description: 'İki kişilik koltuk ünitesi.' },
      { id: 'f-12', name: 'Gardırop (1 Kapılı)', src: '/assets/symbols/wardrobe_1_door.svg', type: 'symbol', description: 'Tek kapılı gardırop (Kuş bakışı görünüm).' },
      { id: 'f-12-f', name: 'Gardırop (1 Kapılı - Önden)', src: '/assets/symbols/wardrobe_1_door_front.svg', type: 'symbol', description: 'Tek kapılı gardırop (Önden görünüm).' },
      { id: 'f-13', name: 'Gardırop (2 Kapılı)', src: '/assets/symbols/wardrobe_2_door.svg', type: 'symbol', description: 'İki kapılı gardırop (Kuş bakışı görünüm).' },
      { id: 'f-13-f', name: 'Gardırop (2 Kapılı - Önden)', src: '/assets/symbols/wardrobe_2_door_front.svg', type: 'symbol', description: 'İki kapılı gardırop (Önden görünüm).' },
      { id: 'f-7', name: 'Gardırop (3 Kapılı)', src: '/assets/symbols/wardrobe_3_door.svg', type: 'symbol', description: 'Üç kapılı büyük gardırop (Kuş bakışı görünüm).' },
      { id: 'f-7-f', name: 'Gardırop (3 Kapılı - Önden)', src: '/assets/symbols/wardrobe_3_door_front.svg', type: 'symbol', description: 'Üç kapılı büyük gardırop (Önden görünüm).' },
      { id: 'f-9', name: 'Halı', src: '/assets/symbols/carpet.svg', type: 'symbol', description: 'Oda zeminindeki halıların alanını belirtir.' },
      { id: 'f-10', name: 'Yolluk', src: '/assets/symbols/runner_rug.svg', type: 'symbol' },
      { id: 'f-11', name: 'Paspas', src: '/assets/symbols/doormat.svg', type: 'symbol' },
    ]
  },
  {
    id: 'traces',
    name: 'İzler',
    symbols: [
      { id: 'tr-2', name: 'Lastik İzi', src: '/assets/symbols/tire_track_realistic.png', type: 'symbol', description: 'Olay yerinde tespit edilen araç lastik izi. Uzatılarak fren izi veya sürüklenme olarak kullanılabilir.' },
      { id: 'tr-3', name: 'Parmak İzi', src: '/assets/symbols/fingerprint_realistic.png', type: 'symbol', description: 'Yüzeylerden elde edilen parmak izi bulgusu.' },
      { 
        id: 'tr-bullet-glass', 
        name: 'İsabet İzi (Cam)', 
        src: '/assets/symbols/bullet_hole_1.png', 
        type: 'symbol', 
        width: 30, 
        height: 30,
        description: 'Cam yüzeylerdeki mermi giriş deliği ve dairesel/ışınsal çatlak izleri.'
      },
      { 
        id: 'tr-bullet-wall', 
        name: 'İsabet İzi (Duvar)', 
        src: '/assets/symbols/bullet_hole_2.png', 
        type: 'symbol', 
        width: 25, 
        height: 25,
        description: 'Duvar ve betonarme yüzeylerdeki mermi çarpma ve oyuk izi.'
      },
    ]
  },
  {
    id: 'outdoor',
    name: 'Açık Alan Sembolleri',
    symbols: [
      { id: 'out-fixed-point', name: 'Nirengi / Sabit Nokta', src: 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="100" height="100" viewBox="0 0 100 100"><circle cx="50" cy="50" r="40" fill="none" stroke="black" stroke-width="4"/><circle cx="50" cy="50" r="5" fill="black"/><line x1="50" y1="0" x2="50" y2="100" stroke="black" stroke-width="2"/><line x1="0" y1="50" x2="100" y2="50" stroke="black" stroke-width="2"/><path d="M 50 10 L 90 50 L 50 90 L 10 50 Z" fill="none" stroke="black" stroke-width="2"/></svg>', type: 'symbol', width: 40, height: 40, fill: '#000000', description: 'Ölçüm yapılacak sabit referans noktası. Elektrik direği, bina köşesi veya rögar kapağı gibi taşınamaz noktaları işaretlemek için kullanılır.', isTriangulation: true },
      { id: 'out-pole', name: 'Elektrik Direği', src: 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="100" height="100" viewBox="0 0 100 100"><rect x="46" y="5" width="8" height="90" fill="black"/><rect x="20" y="25" width="60" height="6" fill="black"/><rect x="25" y="40" width="50" height="4" fill="black"/></svg>', type: 'symbol', width: 30, height: 30, fill: '#000000', description: 'Elektrik ve telefon direklerinin konumunu belirtmek için kullanılır.', isTriangulation: true },
      { id: 'out-tree-1', name: 'Ağaç (Yatay Plan)', src: 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="100" height="100" viewBox="0 0 100 100"><circle cx="50" cy="50" r="40" fill="%2315803d" stroke="%23166534" stroke-width="4"/><circle cx="50" cy="50" r="10" fill="%23166534"/></svg>', type: 'symbol', width: 80, height: 80 },
      { id: 'out-tree-2', name: 'Çam Ağacı', src: 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="100" height="100" viewBox="0 0 100 100"><circle cx="50" cy="50" r="40" fill="%2315803d" stroke="%23166534" stroke-width="4"/><circle cx="50" cy="50" r="10" fill="%23166534"/></svg>', type: 'symbol', width: 60, height: 60 },
      { id: 'out-hydrant', name: 'Yangın Musluğu', src: 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="100" height="100" viewBox="0 0 100 100"><rect x="30" y="20" width="40" height="60" rx="8" fill="red"/><rect x="15" y="40" width="70" height="15" fill="red"/><rect x="40" y="10" width="20" height="10" fill="red"/></svg>', type: 'symbol', width: 30, height: 40, fill: '#000000', description: 'Sokaktaki yangın musluklarının yerini işaretlemek için kullanılır.', isTriangulation: true },
      { id: 'out-traffic-light', name: 'Trafik Işığı', src: 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="100" height="100" viewBox="0 0 100 100"><rect x="30" y="5" width="40" height="90" rx="10" fill="black"/><circle cx="50" cy="23" r="10" fill="red"/><circle cx="50" cy="50" r="10" fill="yellow"/><circle cx="50" cy="77" r="10" fill="green"/></svg>', type: 'symbol', width: 30, height: 60, fill: '#000000', description: 'Kavşaklardaki trafik sinyalizasyon sistemlerini belirtir.', isTriangulation: true },
      { id: 'out-zebra', name: 'Yaya Geçidi', src: 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="200" height="100" viewBox="0 0 200 100"><rect x="10" y="10" width="20" height="80" fill="black"/><rect x="40" y="10" width="20" height="80" fill="black"/><rect x="70" y="10" width="20" height="80" fill="black"/><rect x="100" y="10" width="20" height="80" fill="black"/><rect x="130" y="10" width="20" height="80" fill="black"/><rect x="160" y="10" width="20" height="80" fill="black"/></svg>', type: 'symbol', width: 200, height: 100 },
      { id: 'out-bench', name: 'Bank / Oturak', src: 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="100" height="100" viewBox="0 0 100 100"><rect x="10" y="30" width="80" height="15" fill="%2378350f"/><rect x="15" y="45" width="10" height="30" fill="black"/><rect x="75" y="45" width="10" height="30" fill="black"/></svg>', type: 'symbol', width: 100, height: 40 },
    ]
  },
  {
    id: 'shapes',
    name: 'Şekiller',
    symbols: [
      { id: 'ev-rect-solid', name: 'Dolu Dikdörtgen', src: '/assets/symbols/rect_solid.svg', type: 'symbol', width: 100, height: 60 },
      { id: 'ev-rect-hollow', name: 'Boş Dikdörtgen', src: '/assets/symbols/rect_hollow.svg', type: 'symbol', width: 100, height: 60 },
      { id: 'ev-square-solid', name: 'Dolu Kare', src: '/assets/symbols/square_solid.svg', type: 'symbol', width: 60, height: 60 },
      { id: 'ev-square-hollow', name: 'Boş Kare', src: '/assets/symbols/square_hollow.svg', type: 'symbol', width: 60, height: 60 },
      { id: 'ev-star', name: 'Yıldız', src: '/assets/symbols/star.svg', type: 'symbol', width: 60, height: 60 },
      { id: 'ev-crack', name: 'Çatlak / Kırık', src: '/assets/symbols/crack.svg', type: 'symbol', width: 80, height: 80 },
      { id: 'ev-triangle-solid', name: 'Dolu Üçgen', src: '/assets/symbols/triangle_solid.svg', type: 'symbol', width: 60, height: 60 },
      { id: 'ev-triangle-hollow', name: 'Boş Üçgen', src: '/assets/symbols/triangle_hollow.svg', type: 'symbol', width: 60, height: 60 },
      { id: 'ev-lshape-solid', name: 'Dolu L Şekli', src: '/assets/symbols/lshape_solid.svg', type: 'symbol', width: 80, height: 80 },
      { id: 'ev-lshape-hollow', name: 'Boş L Şekli', src: '/assets/symbols/lshape_hollow.svg', type: 'symbol', width: 80, height: 80 },
      { id: 'ev-rope', name: 'Şekillendirilebilir İp', src: '/assets/symbols/rope_flexible.svg', type: 'symbol', width: 200, height: 40 },
    ]
  },
  {
    id: 'injuries',
    name: 'Yara ve Yaralanmalar',
    symbols: [
      { 
        id: 'in-bullet-in', 
        name: 'Mermi Giriş Yarası', 
        src: 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="100" height="100" viewBox="0 0 100 100"><circle cx="50" cy="50" r="15" fill="%23000000"/><circle cx="50" cy="50" r="12" fill="none" stroke="%23990000" stroke-width="4"/></svg>', 
        type: 'symbol', 
        width: 30, 
        height: 30,
        description: 'Ateşli silah mermi giriş yarası. Siyah merkez ve barut izini temsil eden koyu halka.'
      },
      { 
        id: 'in-bullet-out', 
        name: 'Mermi Çıkış Yarası', 
        src: 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="100" height="100" viewBox="0 0 100 100"><path d="M 50 20 L 60 40 L 80 45 L 65 60 L 70 80 L 50 70 L 30 80 L 35 60 L 20 45 L 40 40 Z" fill="%23990000" stroke="%23660000" stroke-width="2"/></svg>', 
        type: 'symbol', 
        width: 45, 
        height: 45,
        description: 'Düzensiz kenarlı mermi çıkış yarası.'
      },
      { 
        id: 'in-stab', 
        name: 'Kesici Alet Yarası', 
        src: 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="100" height="100" viewBox="0 0 100 100"><ellipse cx="50" cy="50" rx="30" ry="8" fill="%23990000" stroke="%23660000" stroke-width="1" /></svg>', 
        type: 'symbol', 
        width: 60, 
        height: 20,
        description: 'Bıçak veya benzeri kesici aletle oluşmuş açık yara.'
      },
      { 
        id: 'in-bruise', 
        name: 'Ekimoz (Morluk)', 
        src: 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="100" height="100" viewBox="0 0 100 100"><ellipse cx="50" cy="50" rx="40" ry="30" fill="%234b0082" opacity="0.6"/><ellipse cx="45" cy="45" rx="20" ry="15" fill="%23ffff00" opacity="0.3"/></svg>', 
        type: 'symbol', 
        width: 50, 
        height: 40,
        description: 'Deri altı kanama ve morarmayı temsil eden ekimoz izi.'
      },
      { 
        id: 'in-scratch', 
        name: 'Sıyrık / Çizik', 
        src: 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="100" height="100" viewBox="0 0 100 100"><line x1="20" y1="20" x2="80" y2="30" stroke="%23990000" stroke-width="2"/><line x1="25" y1="40" x2="75" y2="45" stroke="%23990000" stroke-width="2"/><line x1="30" y1="60" x2="85" y2="70" stroke="%23990000" stroke-width="2"/></svg>', 
        type: 'symbol', 
        width: 50, 
        height: 50,
        description: 'Yüzeysel deri sıyrıkları ve tırnak izleri.'
      },
      { 
        id: 'in-blood-pool', 
        name: 'Kan Birikintisi (Gerçekçi)', 
        src: '/assets/symbols/blood_pool_realistic.png', 
        type: 'symbol', 
        width: 200, 
        height: 150, 
        description: 'Zemin üzerinde oluşan geniş ve yoğun kan birikintisi.' 
      },
      { 
        id: 'in-blood-splatter', 
        name: 'Kan Sıçraması (Gerçekçi)', 
        src: '/assets/symbols/blood_splatter_realistic.png', 
        type: 'symbol', 
        width: 150, 
        height: 150, 
        description: 'Yüksek hızla etrafa yayılan kan damlaları ve sıçrama paterni.' 
      },
      { 
        id: 'in-blood-smear', 
        name: 'Kan Sürtünmesi (Gerçekçi)', 
        src: '/assets/symbols/blood_smear_realistic.png', 
        type: 'symbol', 
        width: 200, 
        height: 80, 
        description: 'Vücudun veya bir nesnenin sürüklenmesi sonucu oluşan kan sürtünme izi.' 
      },
    ]
  },
  {
    id: 'explosion',
    name: 'Patlama ve Hasar',
    symbols: [
      { id: 'ex-1', name: 'Patlama Krateri', src: '/assets/symbols/crater_realistic.png', type: 'symbol' },
      { id: 'ex-2', name: 'Blast Efekti (Patlama)', src: '/assets/symbols/explosion_blast_realistic.png', type: 'symbol' },
      { id: 'ex-3', name: 'Enkaz Yığını', src: '/assets/symbols/debris_pile_realistic.png', type: 'symbol' },
      { id: 'ex-4', name: 'Kırık Camlar', src: '/assets/symbols/shattered_glass_realistic.png', type: 'symbol' },
      { id: 'ex-5', name: 'Yıkık Duvar', src: '/assets/symbols/broken_wall_realistic.png', type: 'symbol' },
      { id: 'ex-6', name: 'Duman Bulutu', src: '/assets/symbols/smoke_realistic.png', type: 'symbol' },
      { id: 'ex-7', name: 'Alev / Yangın', src: '/assets/symbols/fire_realistic.png', type: 'symbol' },
      { id: 'ex-9', name: 'Kimyasal Varil', src: 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="100" height="100" viewBox="0 0 100 100"><rect x="20" y="10" width="60" height="80" rx="8" fill="%23ca8a04"/><line x1="20" y1="35" x2="80" y2="35" stroke="black" stroke-width="4"/><line x1="20" y1="65" x2="80" y2="65" stroke="black" stroke-width="4"/></svg>', type: 'symbol' },
      { id: 'ex-10', name: 'Tehlike İşareti', src: 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="100" height="100" viewBox="0 0 100 100"><polygon points="50,10 90,85 10,85" fill="%23eab308" stroke="black" stroke-width="4"/><text x="50" y="75" font-size="50" font-family="Arial" font-weight="bold" fill="black" text-anchor="middle">!</text></svg>', type: 'symbol' },
      { id: 'ex-rb-1', name: 'Patlayıcı Blok (Gerçekçi)', src: 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="100" height="100" viewBox="0 0 100 100"><rect x="10" y="25" width="80" height="50" rx="4" fill="%23dc2626"/><text x="50" y="58" font-size="22" font-family="Arial" font-weight="bold" fill="white" text-anchor="middle">TNT</text></svg>', type: 'symbol', description: 'Kalıp şeklinde plastik patlayıcı veya TNT bloğu.' },
      { id: 'ex-rb-5', name: 'Kablolu Bağlantı Seti', src: 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="100" height="100" viewBox="0 0 100 100"><path d="M10 50 Q30 10 50 50 T90 50" fill="none" stroke="red" stroke-width="4"/><path d="M10 60 Q30 20 50 60 T90 60" fill="none" stroke="blue" stroke-width="4"/></svg>', type: 'symbol', description: 'Bomba düzeneğine ait kablo ve bağlantı parçaları.' },
    ]
  }
] as const;
