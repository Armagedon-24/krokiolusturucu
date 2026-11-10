// ÜRETİLEN DOSYA — scripts/gen_example_cases.py ile oluşturuldu (elle düzenlemeyin).
// 18 konu x 5 örnek olay; sayısal sonuçlar hesaplayıcı formülleriyle aynı yöntemle hesaplanmıştır.

export interface ExampleCase {
  id: string;
  title: string;
  scenario: string;
  inputs: string[];
  results: string[];
  note?: string;
}

export interface ExampleTopic {
  id: string;
  name: string;
  group: string;
  desc: string;
  icon: string;
  cases: ExampleCase[];
}

export const EXAMPLE_TOPICS: ExampleTopic[] = [
  {
    id: "skid",
    name: "Fren İzi / Hız",
    group: "Trafik ve Kaza",
    desc: "Fren (kilitli/ABS) izi boyundan araç hızının hesaplanması.",
    icon: "Zap",
    cases: [
      {
        id: "skid-1",
        title: "Kuru asfaltta 20 m fren izi — ABS binek",
        scenario: "Şehir dışı yolda binek otomobil tam frenlemede kilitlenmeden (ABS) durmuş; lastik izleri başlangıcından duruş noktasına kadar 20 m ölçülmüştür. Zemin kuru asfalttır.",
        inputs: [
          "Fren izi uzunluğu: 20,0 m",
          "Zemin: Asfalt (Kuru) — μ=0,75",
          "Araç: Binek (ABS) — verim %100",
        ],
        results: [
          "Nokta hız: 62 km/s",
          "Muhtemel aralık: 55 – 65 km/s",
        ],
        note: "Eğim düz kabul edilmiştir; yokuşta μ etkinine eğim bileşeni eklenmelidir.",
      },
      {
        id: "skid-2",
        title: "Islak asfaltta 35 m iz — yüklü kamyon",
        scenario: "Yağmur sonrası ıslak asfaltta yüklü kamyonun fren izi 35 m ölçülmüştür. Kamyonlarda katsayı ve verim bineğe göre düşüktür.",
        inputs: [
          "Fren izi uzunluğu: 35,0 m",
          "Zemin: Asfalt (Islak) — μ=0,50",
          "Araç: Kamyon/Tır — μ×0,85, verim %75",
        ],
        results: [
          "Nokta hız: 53 km/s",
          "Muhtemel aralık: 46 – 61 km/s",
        ],
        note: "Ağır vasıtada yük kayması ve fren fade verimi daha da düşürebilir; sonuç alt sınır olarak yorumlanmalıdır.",
      },
      {
        id: "skid-3",
        title: "Beton zeminde 12 m iz — motosiklet",
        scenario: "Kavşak içinde beton zeminde motosikletin arka tekerlek fren izi 12 m ölçülmüştür.",
        inputs: [
          "Fren izi uzunluğu: 12,0 m",
          "Zemin: Beton (Kuru) — μ=0,85",
          "Araç: Motosiklet — μ×0,95, verim %70",
        ],
        results: [
          "Nokta hız: 42 km/s",
          "Muhtemel aralık: 36 – 47 km/s",
        ],
        note: "Motosiklette ön/arka fren dengesi verimi belirler; tek teker izi verimi düşürür.",
      },
      {
        id: "skid-4",
        title: "Toprak yolda 28 m iz — otobüs",
        scenario: "Köy yolu (toprak) üzerinde seyreden otobüsün fren izi 28 m ölçülmüş, zemin kuru toprak olarak tespit edilmiştir.",
        inputs: [
          "Fren izi uzunluğu: 28,0 m",
          "Zemin: Toprak Yol — μ=0,50",
          "Araç: Otobüs — μ×0,90, verim %80",
        ],
        results: [
          "Nokta hız: 51 km/s",
          "Muhtemel aralık: 44 – 58 km/s",
        ],
        note: "Toprak zeminde iz sınırları bulanık olabilir; iz boyu ölçümünde fotoğraflı belgeleme şarttır.",
      },
      {
        id: "skid-5",
        title: "Çakıl yolda 16 m iz — ABS'siz binek",
        scenario: "Kilitli tekerleklerle (ABS'siz) çakıl yolda fren yapan binek aracın izi 16 m ölçülmüştür.",
        inputs: [
          "Fren izi uzunluğu: 16,0 m",
          "Zemin: Çakıl Yol — μ=0,60",
          "Araç: Binek (ABS'siz) — verim %85",
        ],
        results: [
          "Nokta hız: 46 km/s",
          "Muhtemel aralık: 40 – 51 km/s",
        ],
        note: "Çakılda tekerlek önünde malzeme birikmesi (bermith) iz boyunu kısaltabilir; gerçek hız daha yüksek olabilir.",
      },
    ],
  },
  {
    id: "collision",
    name: "Çarpışma Hızı (Momentum)",
    group: "Trafik ve Kaza",
    desc: "Sürüklenme mesafeleri ve kütlelerden momentum korunumuyla çarpışma öncesi hızlar.",
    icon: "GitMerge",
    cases: [
      {
        id: "col-1",
        title: "Kavşakta dik (T-bone) çarpışma",
        scenario: "Ana yoldan gelen hafif ticari ile tali yoldan giren sedan kavşakta dik açıyla çarpışmış; araçlar ayrılma açılarıyla (15° ve 45°) sürüklenerek durmuştur.",
        inputs: [
          "Kütleler: 1.500 kg / 1.200 kg",
          "Sürüklenme: 12,0 m / 18,0 m — μ=0,65",
          "Açılar: φ=90°, θ₁=15°, θ₂=45°",
        ],
        results: [
          "Araç 1 çarpışma öncesi: 74 km/s (67–80)",
          "Araç 2 çarpışma öncesi: 53 km/s (48–58)",
        ],
      },
      {
        id: "col-2",
        title: "Şehir içinde arkadan çarpma (aynı yön)",
        scenario: "Duraklayan araç öndeki araca aynı yönde arkadan çarpmış; iki araç da çarpışma yönünde kısa mesafelerde durmuştur (1D yaklaşım).",
        inputs: [
          "Kütleler: 1.700 kg / 1.300 kg",
          "Sürüklenme: 8,0 m / 14,0 m — μ=0,75",
          "Açılar: φ=0° (aynı yön, 1D)",
        ],
        results: [
          "Arka araç (1) çarpışma öncesi: 39 km/s (36–42)",
          "Öndeki araç (2): 52 km/s",
        ],
      },
      {
        id: "col-3",
        title: "Islak zeminde açılı çarpışma (60°)",
        scenario: "Yağmurlu havada ıslak asfaltta SUV ile hafif araç 60° açıyla çarpışmış; ayrılma açıları geniştir (30° ve 70°).",
        inputs: [
          "Kütleler: 2.200 kg / 1.100 kg",
          "Sürüklenme: 15,0 m / 22,0 m — μ=0,50",
          "Açılar: φ=60°, θ₁=30°, θ₂=70°",
        ],
        results: [
          "Araç 1 çarpışma öncesi: 20 km/s (18–22)",
          "Araç 2 çarpışma öncesi: 108 km/s (97–119)",
        ],
      },
      {
        id: "col-4",
        title: "Eşit kütleli araçların açılı çarpışması",
        scenario: "Aynı kütleli iki binek araç kavşakta 120° açıyla çarpışmış; izler simetrik ama ayrılma yönleri zıttır.",
        inputs: [
          "Kütleler: 1.400 kg / 1.400 kg",
          "Sürüklenme: 10,0 m / 10,0 m — μ=0,70",
          "Açılar: φ=120°, θ₁=20°, θ₂=160°",
        ],
        results: [
          "Araç 1 çarpışma öncesi: 17 km/s (13–21)",
          "Araç 2 çarpışma öncesi: 33 km/s (30–36)",
        ],
      },
      {
        id: "col-5",
        title: "Kamyonet – motosiklet benzeri hafif araç çarpışması",
        scenario: "Ağır kamyonet ile çok hafif araç çarpışmış; hafif araç uzun mesafe sürüklenirken ağır araç kısa mesafede durmuştur.",
        inputs: [
          "Kütleler: 1.900 kg / 800 kg",
          "Sürüklenme: 18,0 m / 6,0 m — μ=0,60",
          "Açılar: φ=90°, θ₁=10°, θ₂=80°",
        ],
        results: [
          "Araç 1 çarpışma öncesi: 54 km/s (49–59)",
          "Araç 2 çarpışma öncesi: 51 km/s (47–56)",
        ],
        note: "Kütle farkı büyükse hafif aracın ayrılma açısı ölçüm hatası sonucu güçlü etkiler; aralık geniş çıkar.",
      },
    ],
  },
  {
    id: "yaw",
    name: "Yayılma İzi (Kritik Hız)",
    group: "Trafik ve Kaza",
    desc: "Yayılma (yaw) izi yarıçapından viraj kritik hızının hesaplanması.",
    icon: "Spline",
    cases: [
      {
        id: "yaw-1",
        title: "Kiriş ölçüsünden yayılma izi (kuru asfalt)",
        scenario: "Virajda kayan aracın bıraktığı yayılma (yaw) izinin kirişi 30 m, orta tepe noktası 2,3 m ölçülmüştür.",
        inputs: [
          "Kiriş C: 30,0 m — Orta tepe M: 2,3 m",
          "Hesaplanan yarıçap R: 50,1 m",
          "Zemin: Asfalt (Kuru) — μ=0,75, eğim %0",
        ],
        results: [
          "Kritik hız: 69 km/s",
          "Muhtemel aralık: 62 – 77 km/s",
        ],
        note: "Yayılma izinde araç kontrollü ama sınırda seyretmektedir; hız kritik değerin üstündeyse iz oluşmaz.",
      },
      {
        id: "yaw-2",
        title: "Bilinen yarıçaplı virajda kritik hız",
        scenario: "Viraj yarıçapı haritadan 45 m olarak ölçülmüş; ıslak asfalta ait μ=0,70 değeriyle kritik hız aranmıştır.",
        inputs: [
          "Yarıçap R: 45,0 m (doğrudan giriş)",
          "Zemin: Asfalt (Islak) — μ=0,70, eğim %0",
        ],
        results: [
          "Kritik hız: 63 km/s",
          "Muhtemel aralık: 59 – 67 km/s",
        ],
      },
      {
        id: "yaw-3",
        title: "İçe bakımlı (supereüreli) viraj",
        scenario: "Virajda %2 içe bakım (superelevation) ölçülmüştür; eğim etkin katsayıyı artırır.",
        inputs: [
          "Kiriş C: 24,0 m — Orta tepe M: 1,8 m",
          "Zemin: Asfalt (Kuru) — μ=0,75, eğim +%2",
        ],
        results: [
          "Hesaplanan yarıçap R: 40,9 m",
          "Kritik hız: 63 km/s (57–70)",
        ],
      },
      {
        id: "yaw-4",
        title: "Çakıl yolda geniş yarıçaplı kayma",
        scenario: "Şehir dışı çakıl yolda geniş bir virajda uzun yayılma izi oluşmuş; kiriş 40 m, tepe 1,5 m ölçülmüştür.",
        inputs: [
          "Kiriş C: 40,0 m — Orta tepe M: 1,5 m",
          "Zemin: Çakıl — μ=0,55, eğim %0",
        ],
        results: [
          "Hesaplanan yarıçap R: 134,1 m",
          "Kritik hız: 97 km/s (86–109)",
        ],
      },
      {
        id: "yaw-5",
        title: "Beton kavşakta keskin manevra izi",
        scenario: "Kaçınma manevrası sırasında beton zeminde oluşan 30 m yarıçaplı yayılma izi için kritik hız hesaplanmıştır.",
        inputs: [
          "Yarıçap R: 30,0 m (doğrudan giriş)",
          "Zemin: Beton (Kuru) — μ=0,85, eğim %0",
        ],
        results: [
          "Kritik hız: 57 km/s",
          "Muhtemel aralık: 54 – 60 km/s",
        ],
      },
    ],
  },
  {
    id: "pedestrian",
    name: "Yaya Fırlatma (Searle)",
    group: "Trafik ve Kaza",
    desc: "Yaya savrulma mesafesinden Searle sınır formülleriyle araç hızı.",
    icon: "Footprints",
    cases: [
      {
        id: "ped-1",
        title: "20 m fırlatma mesafesi — kaput kenarı yüksekliği",
        scenario: "Yaya çarptıktan sonra 20 m savrularak durmuş; başlangıç ağırlık merkezi yüksekliği kaput kenarı (0,85 m) alınmıştır.",
        inputs: [
          "Fırlatma mesafesi: 20,0 m",
          "Yükseklik h: 0,85 m — μ=0,75",
        ],
        results: [
          "Alt sınır: 47 km/s",
          "Üst sınır: 80 km/s",
          "Orta değer: 63 km/s",
        ],
      },
      {
        id: "ped-2",
        title: "Uzun savrulma (35 m) — ağırlık merkezi",
        scenario: "Otoyol kenarında yayaya çarpan araç yayayı 35 m savurmuş; yükseklik ağırlık merkezi (0,95 m) seçilmiştir.",
        inputs: [
          "Fırlatma mesafesi: 35,0 m",
          "Yükseklik h: 0,95 m — μ=0,75",
        ],
        results: [
          "Alt sınır: 65 km/s",
          "Üst sınır: 101 km/s",
          "Orta değer: 83 km/s",
        ],
        note: "Uzun taşınmalarda sarılma/wrap etkisi hesaba katılmaz; gerçek hız üst sınıra yakın olabilir.",
      },
      {
        id: "ped-3",
        title: "Islak zeminde kısa savrulma (12 m)",
        scenario: "Şehir içi ıslak asfaltta düşük hızlı çarpışma; yaya 12 m yuvarlanarak durmuştur.",
        inputs: [
          "Fırlatma mesafesi: 12,0 m",
          "Yükseklik h: 0,75 m — μ=0,50 (ıslak)",
        ],
        results: [
          "Alt sınır: 28 km/s",
          "Üst sınır: 53 km/s",
          "Orta değer: 41 km/s",
        ],
      },
      {
        id: "ped-4",
        title: "Omuz hizasından fırlatma (28 m)",
        scenario: "Yüksek araç (kamyonet) çarpması sonucu yayanın omuz hizası (1,30 m) başlangıç noktası alınmıştır.",
        inputs: [
          "Fırlatma mesafesi: 28,0 m",
          "Yükseklik h: 1,30 m — μ=0,70",
        ],
        results: [
          "Alt sınır: 53 km/s",
          "Üst sınır: 92 km/s",
          "Orta değer: 73 km/s",
        ],
      },
      {
        id: "ped-5",
        title: "Çakıl yolda kısa mesafe temas (8 m)",
        scenario: "Yavaş hareket eden araçla temas eden yaya 8 m savrulmuştur; zemin çakıldır.",
        inputs: [
          "Fırlatma mesafesi: 8,0 m",
          "Yükseklik h: 0,85 m — μ=0,60 (çakıl)",
        ],
        results: [
          "Alt sınır: 23 km/s",
          "Üst sınır: 51 km/s",
          "Orta değer: 37 km/s",
        ],
      },
    ],
  },
  {
    id: "stopping",
    name: "Toplam Durma Mesafesi",
    group: "Trafik ve Kaza",
    desc: "Tepki + frenleme mesafesinin hesabı ve engel mesafesiyle karşılaştırma.",
    icon: "Gauge",
    cases: [
      {
        id: "stop-1",
        title: "Otoyolda 90 km/s — engel 60 m ileride",
        scenario: "Sürücü 90 km/s ile seyrederken yol ortasındaki engeli tespit etmiş; engelle arasındaki mesafe 60 m ölçülmüştür.",
        inputs: [
          "Hız: 90 km/s — Tepki: 1,0 sn",
          "Zemin: Asfalt (Kuru) μ=0,75 — Verim %100",
          "Engel mesafesi: 60,0 m",
        ],
        results: [
          "Tepki mesafesi: 25,0 m",
          "Frenleme mesafesi: 42,5 m",
          "TOPLAM: 67,5 m",
          "Sonuç: durma imkânı MEVCUT DEĞİL (7,5 m eksik)",
        ],
      },
      {
        id: "stop-2",
        title: "Şehir içi 50 km/s, dikkat dağınık sürücü (ıslak)",
        scenario: "Şehir içi yolda ıslak zeminde sürücünün tepki süresi 1,5 sn alınmıştır; yaya geçidindeki yayaya 45 m kala fark etmiştir.",
        inputs: [
          "Hız: 50 km/s — Tepki: 1,5 sn",
          "Zemin: Asfalt (Islak) μ=0,50 — Verim %100",
          "Engel mesafesi: 45,0 m",
        ],
        results: [
          "Tepki mesafesi: 20,8 m",
          "Frenleme mesafesi: 19,7 m",
          "TOPLAM: 40,5 m",
          "Sonuç: durma imkânı MEVCUT (4,5 m fazla)",
        ],
      },
      {
        id: "stop-3",
        title: "Yokuş aşağı %5 eğim — yüklü kamyon",
        scenario: "Yüklü kamyon %5 eğimli yokuş aşağı 80 km/s ile seyrederken frenlemiştir (%75 verim).",
        inputs: [
          "Hız: 80 km/s — Tepki: 1,0 sn",
          "μ=0,75 — Verim %75 — Eğim −%5 (aşağı)",
        ],
        results: [
          "Etkin katsayı f: 0,51",
          "Tepki: 22,2 m — Frenleme: 49,2 m",
          "TOPLAM: 71,4 m",
        ],
        note: "Yokuş aşağı eğim bileşeni frenlemeyi zorlaştırır; karşılaştırma için engel mesafesi girilmelidir.",
      },
      {
        id: "stop-4",
        title: "Karlı yolda 30 km/s — okul çıkışı",
        scenario: "Sıkışmış kar üzerinde (μ=0,20) 30 km/s ile gelen araç okul çıkışındaki grubu 15 m önceden fark etmiştir.",
        inputs: [
          "Hız: 30 km/s — Tepki: 0,75 sn",
          "Zemin: Kar (Sıkışmış) μ=0,20 — Verim %100",
          "Engel mesafesi: 15,0 m",
        ],
        results: [
          "Tepki: 6,2 m — Frenleme: 17,7 m",
          "TOPLAM: 24,0 m",
          "Sonuç: durma imkânı MEVCUT DEĞİL (9,0 m eksik)",
        ],
      },
      {
        id: "stop-5",
        title: "Buzlu yolda 20 km/s — kavşak yaklaşımı",
        scenario: "Buzlanma nedeniyle μ=0,10 olan yolda 20 km/s ile yaklaşan araç kavşağa 12 m kala frenlemiştir.",
        inputs: [
          "Hız: 20 km/s — Tepki: 1,0 sn",
          "Zemin: Buz μ=0,10 — Verim %100",
          "Engel mesafesi: 12,0 m",
        ],
        results: [
          "Tepki: 5,6 m — Frenleme: 15,7 m",
          "TOPLAM: 21,3 m",
          "Sonuç: durma imkânı MEVCUT DEĞİL (9,3 m eksik)",
        ],
      },
    ],
  },
  {
    id: "crush",
    name: "Deformasyon Enerjisi (CRASH3)",
    group: "Trafik ve Kaza",
    desc: "Deformasyon ölçülerinden emilen enerji ve eşdeğer bariyer hızı (EBS).",
    icon: "Hammer",
    cases: [
      {
        id: "crush-1",
        title: "Orta sınıf binek — ön çarpışma (25 cm ortalama)",
        scenario: "Orta sınıf binek aracın ön tarafında 120 cm genişliğinde, ortalama 25 cm derinliğinde deformasyon oluşmuştur.",
        inputs: [
          "Hasar genişliği L: 120 cm — c̄: 25,0 cm",
          "Sınıf: Orta Sınıf — A=450, B=45",
          "Kütle: 1.400 kg",
        ],
        results: [
          "Emilen enerji: 30,4 kJ",
          "EBS: 24 km/s (20–28)",
        ],
      },
      {
        id: "crush-2",
        title: "SUV — şiddetli ön temas (40 cm)",
        scenario: "Büyük sınıf araç sabit bariyere benzer temasla 150 cm genişlikte 40 cm ortalama deformasyona uğramıştır.",
        inputs: [
          "Hasar genişliği L: 150 cm — c̄: 40,0 cm",
          "Sınıf: Büyük/SUV — A=550, B=55",
          "Kütle: 2.100 kg",
        ],
        results: [
          "Emilen enerji: 99,0 kJ",
          "EBS: 35 km/s (29–42)",
        ],
      },
      {
        id: "crush-3",
        title: "Küçük sınıf araç — hafif temas (15 cm)",
        scenario: "Şehir içi düşük hızlı temasta küçük sınıf araçta 90 cm genişlikte 15 cm derinlikte hasar oluşmuştur.",
        inputs: [
          "Hasar genişliği L: 90 cm — c̄: 15,0 cm",
          "Sınıf: Küçük Sınıf — A=350, B=32",
          "Kütle: 1.100 kg",
        ],
        results: [
          "Emilen enerji: 8,0 kJ",
          "EBS: 14 km/s (11–16)",
        ],
      },
      {
        id: "crush-4",
        title: "Hafif ticari — yan ön kanat hasarı",
        scenario: "Hafif ticari aracın ön sol kısmında 130 cm genişlikte 30 cm ortalama deformasyon tespit edilmiştir.",
        inputs: [
          "Hasar genişliği L: 130 cm — c̄: 30,0 cm",
          "Sınıf: Hafif Ticari — A=500, B=50",
          "Kütle: 1.850 kg",
        ],
        results: [
          "Emilen enerji: 48,8 kJ",
          "EBS: 26 km/s (22–31)",
        ],
      },
      {
        id: "crush-5",
        title: "Derin deformasyon — motor bölgesine temas",
        scenario: "Orta sınıf binekte 55 cm gibi derin deformasyon ölçülmüştür; temas motor bölgesine kadar ilerlemiştir.",
        inputs: [
          "Hasar genişliği L: 110 cm — c̄: 55,0 cm",
          "Sınıf: Orta Sınıf — A=450, B=45",
          "Kütle: 1.450 kg",
        ],
        results: [
          "Emilen enerji: 102,1 kJ",
          "EBS: 43 km/s (35–51)",
        ],
        note: "Rijit motor bloğuna temas yerel derinliği artırır; c̄ ortalaması profil eğrisiyle doğrulanmalıdır.",
      },
    ],
  },
  {
    id: "moto",
    name: "Motosiklet Kayma Analizi",
    group: "Trafik ve Kaza",
    desc: "Motosiklet/sürücü kayma izinden düşme anındaki hız.",
    icon: "Bike",
    cases: [
      {
        id: "moto-1",
        title: "Yan yatmış motosiklet izi (25 m)",
        scenario: "Motosiklet düşükten sonra yan yatarak 25 m kaymış; sürükleme faktörü 0,28 alınmıştır.",
        inputs: [
          "Kayma izi: 25,0 m",
          "Faz: Yan Yatma — μ=0,28",
        ],
        results: [
          "Düşme anındaki hız: 42 km/s",
          "Muhtemel aralık: 37 – 47 km/s",
        ],
      },
      {
        id: "moto-2",
        title: "Taklama yapan motosiklet (40 m)",
        scenario: "Motosiklet düşme sonrası taklamalar atarak 40 m ilerlemiş; taklama fazı için μ=0,35 kullanılmıştır.",
        inputs: [
          "Kayma izi: 40,0 m",
          "Faz: Taklamalı — μ=0,35",
        ],
        results: [
          "Düşme anındaki hız: 60 km/s",
          "Muhtemel aralık: 54 – 65 km/s",
        ],
      },
      {
        id: "moto-3",
        title: "Deri kıyafetli sürücü kayması (18 m)",
        scenario: "Sürücü deri kıyafetli olduğundan sürükleme faktörü düşüktür (0,20); 18 m kayma izi ölçülmüştür.",
        inputs: [
          "Kayma izi: 18,0 m",
          "Faz: Sürücü — Deri Kıyafet — μ=0,20",
        ],
        results: [
          "Düşme anındaki hız: 30 km/s",
          "Muhtemel aralık: 26 – 35 km/s",
        ],
      },
      {
        id: "moto-4",
        title: "Normal kıyafetli sürücü savrulması (30 m)",
        scenario: "Normal kumaş kıyafetli sürücü 30 m savrulmuş; μ=0,30 ile hesap yapılmıştır.",
        inputs: [
          "Kayma izi: 30,0 m",
          "Faz: Sürücü — Normal Kıyafet — μ=0,30",
        ],
        results: [
          "Düşme anındaki hız: 48 km/s",
          "Muhtemel aralık: 43 – 53 km/s",
        ],
      },
      {
        id: "moto-5",
        title: "Şehir içi düşük hız düşüşü (12 m)",
        scenario: "Şehir içi kavşakta düşen motosikletin kısa kayma izi 12 m ölçülmüştür.",
        inputs: [
          "Kayma izi: 12,0 m",
          "Faz: Yan Yatma — μ=0,28",
        ],
        results: [
          "Düşme anındaki hız: 29 km/s",
          "Muhtemel aralık: 26 – 33 km/s",
        ],
      },
    ],
  },
  {
    id: "sight",
    name: "Görüş Üçgeni / Kavşak",
    group: "Trafik ve Kaza",
    desc: "Kavşak manevrası için gerekli görüş mesafesi (AASHTO ISD) ve yeterlilik.",
    icon: "Eye",
    cases: [
      {
        id: "sight-1",
        title: "Ana yoldan 90 km/s gelen araca sola dönüş",
        scenario: "Tali yoldan ana yola sola dönüş yapacak sürücü için gerekli görüş mesafesi; sahada 210 m görüş ölçülmüştür.",
        inputs: [
          "Ana yol hızı: 90 km/s — Manevra: Düz Geçiş/Sola Dönüş",
          "Ek şerit: 0 — Binek araç",
          "Ölçülen görüş: 210,0 m",
        ],
        results: [
          "Gerekli süre t: 7,5 sn — ISD: 187,5 m",
          "SSD: 108,1 m",
          "Sonuç: YETERLİ (22,5 m fazla)",
        ],
      },
      {
        id: "sight-2",
        title: "Ağır vasıta ile 2 şerit geçişi",
        scenario: "Tırın iki şeritli ana yoldan sola dönüşü; ek şeritler ve ağır vasıta boşluk süresini artırır.",
        inputs: [
          "Ana yol hızı: 70 km/s — Manevra: Sola Dönüş",
          "Ek şerit: 2 — Ağır vasıta (+1,0 sn)",
          "Ölçülen görüş: 150,0 m",
        ],
        results: [
          "Gerekli süre t: 9,5 sn — ISD: 184,7 m",
          "SSD: 76,2 m",
          "Sonuç: YETERSİZ (34,7 m eksik)",
        ],
      },
      {
        id: "sight-3",
        title: "Şehir içi sağa dönüş (ıslak zemin SSD)",
        scenario: "Şehir içi kavşakta sağa dönüş manevrası; SSD ıslak zemin katsayısıyla hesaplanmıştır.",
        inputs: [
          "Ana yol hızı: 50 km/s — Manevra: Sağa Dönüş",
          "Ek şerit: 0 — Binek araç",
          "Ölçülen görüş: 80,0 m",
        ],
        results: [
          "Gerekli süre t: 6,5 sn — ISD: 90,3 m",
          "SSD: 54,4 m",
          "Sonuç: YETERSİZ (10,3 m eksik)",
        ],
      },
      {
        id: "sight-4",
        title: "Bölünmüş yolda 110 km/s — yetersiz görüş",
        scenario: "Şehir dışı yolda yüksek hızla gelen araca karşı tali yol görüşü ölçülmüş, görüş üçgeninin yetersiz olduğu görülmüştür.",
        inputs: [
          "Ana yol hızı: 110 km/s — Manevra: Sola Dönüş",
          "Ek şerit: 0 — Binek araç",
          "Ölçülen görüş: 250,0 m",
        ],
        results: [
          "Gerekli süre t: 7,5 sn — ISD: 229,2 m",
          "SSD: 144,4 m",
          "Sonuç: YETERLİ (20,8 m fazla)",
        ],
      },
      {
        id: "sight-5",
        title: "Görüş ölçümü yapılmadan gerekli mesafe hesabı",
        scenario: "Sahada görüş ölçümü yapılamamış; yalnızca gerekli (ISD) ve durma (SSD) değerleri hesaplanmıştır.",
        inputs: [
          "Ana yol hızı: 90 km/s — Manevra: Sola Dönüş",
          "Ek şerit: 0 — Binek araç",
          "Ölçülen görüş: verilmedi",
        ],
        results: [
          "Gerekli süre t: 7,5 sn — ISD: 187,5 m",
          "SSD: 108,1 m",
          "Sonuç: karşılaştırma için saha ölçümü gerekir",
        ],
      },
    ],
  },
  {
    id: "friction",
    name: "Zemin μ Referans Tablosu",
    group: "Trafik ve Kaza",
    desc: "Zemin tipine göre tipik sürtünme katsayısı aralıkları ve frenleme ön hesabı.",
    icon: "Table2",
    cases: [
      {
        id: "fr-1",
        title: "Kuru asfaltta referans hesap",
        scenario: "Olay yerindeki kuru asfalt için literatür aralığı ve 90 km/s frenleme ön hesabı.",
        inputs: [
          "Zemin: Asfalt — Kuru",
          "Literatür aralığı: μ=0,70 – 0,85 (orta 0,75)",
          "Hız: 90 km/s",
        ],
        results: [
          "Frenleme mesafesi (μ_min ile): 45,6 m",
          "Frenleme mesafesi (orta μ ile): 42,5 m",
          "Frenleme mesafesi (μ_max ile): 37,5 m",
        ],
      },
      {
        id: "fr-2",
        title: "Islak asfalt — yağmur sonrası",
        scenario: "İlk yağmur sonrası ıslak asfaltta 60 km/s için katsayı aralığı ve mesafe ön hesabı.",
        inputs: [
          "Zemin: Asfalt — Islak",
          "Literatür aralığı: μ=0,40 – 0,65 (orta 0,50)",
          "Hız: 60 km/s",
        ],
        results: [
          "Frenleme mesafesi (μ_min ile): 35,4 m",
          "Frenleme mesafesi (orta μ ile): 28,3 m",
          "Frenleme mesafesi (μ_max ile): 21,8 m",
        ],
      },
      {
        id: "fr-3",
        title: "Karlı yol — sıkışmış kar",
        scenario: "Sıkışmış kar zeminde 40 km/s için tipik katsayılar ve frenleme mesafesi.",
        inputs: [
          "Zemin: Kar (Sıkışmış)",
          "Literatür aralığı: μ=0,15 – 0,30 (orta 0,20)",
          "Hız: 40 km/s",
        ],
        results: [
          "Frenleme mesafesi (μ_min ile): 42,0 m",
          "Frenleme mesafesi (orta μ ile): 31,5 m",
          "Frenleme mesafesi (μ_max ile): 21,0 m",
        ],
      },
      {
        id: "fr-4",
        title: "Buzlanma — köprü üstü",
        scenario: "Köprü üstünde buz tabakası; 30 km/s için çok düşük katsayı aralığı.",
        inputs: [
          "Zemin: Buz",
          "Literatür aralığı: μ=0,05 – 0,15 (orta 0,10)",
          "Hız: 30 km/s",
        ],
        results: [
          "Frenleme mesafesi (μ_min ile): 70,9 m",
          "Frenleme mesafesi (orta μ ile): 35,4 m",
          "Frenleme mesafesi (μ_max ile): 23,6 m",
        ],
      },
      {
        id: "fr-5",
        title: "Toprak/çamur yol — tarım aracı çıkışı",
        scenario: "Yağmur sonrası çamurlaşan toprak yolda 50 km/s için ön hesap.",
        inputs: [
          "Zemin: Toprak/Çamur — Islak",
          "Literatür aralığı: μ=0,30 – 0,50 (orta 0,40)",
          "Hız: 50 km/s",
        ],
        results: [
          "Frenleme mesafesi (μ_min ile): 32,8 m",
          "Frenleme mesafesi (orta μ ile): 24,6 m",
          "Frenleme mesafesi (μ_max ile): 19,7 m",
        ],
      },
    ],
  },
  {
    id: "bloodstain",
    name: "Kan Sıçrama (BPA)",
    group: "Balistik ve Adli",
    desc: "Kan lekesi ölçülerinden çarpma açısı ve kaynak konumu.",
    icon: "Droplets",
    cases: [
      {
        id: "bpa-1",
        title: "Duvarda 5×10 mm damla — 1,5 m yakınsama",
        scenario: "Duvarda tespit edilen eliptik kan lekesinin çekirdek ölçüleri 5×10 mm; yakınsama noktasına yatay mesafe 1,5 m.",
        inputs: [
          "Genişlik W: 5,0 mm — Uzunluk L: 10,0 mm",
          "Yatay mesafe D: 1,50 m",
        ],
        results: [
          "Çarpma açısı: 30,0° (25,4–35,4)",
          "Kaynak yüksekliği: 0,87 m (0,69–1,10)",
          "Sınıf: Düşük hız — damla/sıçrantı",
        ],
      },
      {
        id: "bpa-2",
        title: "Zeminde dar açılı leke (2,5×9 mm)",
        scenario: "Zemindeki uzun ekseni belirgin leke düşük açıya işaret eder; mesafe 2,0 m ölçülmüştür.",
        inputs: [
          "Genişlik W: 2,5 mm — Uzunluk L: 9,0 mm",
          "Yatay mesafe D: 2,00 m",
        ],
        results: [
          "Çarpma açısı: 16,1° (12,2–20,7)",
          "Kaynak yüksekliği: 0,58 m (0,42–0,77)",
          "Sınıf: Orta hız — darbe spatter",
        ],
      },
      {
        id: "bpa-3",
        title: "Yüksek hızlı küçük leke (1×8 mm)",
        scenario: "Çok küçük genişlikli leke yüksek enerjili kaynağa (ateşli silah/mekanik) işaret eder.",
        inputs: [
          "Genişlik W: 1,0 mm — Uzunluk L: 8,0 mm",
          "Yatay mesafe D: 1,00 m",
        ],
        results: [
          "Çarpma açısı: 7,2° (3,4–11,5)",
          "Kaynak yüksekliği: 0,13 m (0,06–0,21)",
          "Sınıf: Orta hız",
        ],
      },
      {
        id: "bpa-4",
        title: "Geniş damla (6×12 mm) — yerçekimi akıntısı",
        scenario: "Geniş çekirdekli damla düşük hızlı kaynağa işaret eder; mesafe 2,5 m.",
        inputs: [
          "Genişlik W: 6,0 mm — Uzunluk L: 12,0 mm",
          "Yatay mesafe D: 2,50 m",
        ],
        results: [
          "Çarpma açısı: 30,0° (26,1–34,4)",
          "Kaynak yüksekliği: 1,44 m (1,20–1,75)",
          "Sınıf: Düşük hız",
        ],
      },
      {
        id: "bpa-5",
        title: "Orta boy leke (3,5×7 mm) — yumruk/darbe",
        scenario: "Orta hız sınıfına giren leke ölçüleri; yakınsama mesafesi 1,2 m.",
        inputs: [
          "Genişlik W: 3,5 mm — Uzunluk L: 7,0 mm",
          "Yatay mesafe D: 1,20 m",
        ],
        results: [
          "Çarpma açısı: 30,0° (23,6–38,0)",
          "Kaynak yüksekliği: 0,69 m (0,50–0,98)",
          "Sınıf: Orta hız",
        ],
      },
    ],
  },
  {
    id: "bullet",
    name: "Atış Yönü / Atış Mesafesi",
    group: "Balistik ve Adli",
    desc: "Mermi izinin açı/mesafe/yükseklik üçlüsünden yörünge çözümü.",
    icon: "Target",
    cases: [
      {
        id: "blt-1",
        title: "9mm mermi — duvarda 5° yukarı iz (50 m)",
        scenario: "Duvardaki atış izinin 50 m ileride 5° yukarı açıyla devam ettiği ölçülmüş; atıcının tahmini atış noktası yüksekliği aranmıştır.",
        inputs: [
          "Silah: 9mm Tabanca (v₀=380 m/s)",
          "İz mesafesi: 50 m — Açı: 5°",
        ],
        results: [
          "Atış noktası yükseklik farkı: 4,46 m (3,51–5,45)",
          "Yerçekimi düşüşü: 0,09 m — Uçuş süresi: 0,132 sn",
        ],
      },
      {
        id: "blt-2",
        title: "2 m yükseklik farkından mesafe bulma (9mm)",
        scenario: "Camdan geçen mermi 2 m yükseklik farkı yaratarak duvara çarpmış; 5° açıyla mesafe hesaplanmıştır.",
        inputs: [
          "Silah: 9mm Tabanca (v₀=380 m/s)",
          "Yükseklik farkı: 2,0 m — Açı: 5°",
        ],
        results: [
          "Atış mesafesi: 22,7 m",
          "Düşüş: 0,02 m — Süre: 0,060 sn",
        ],
      },
      {
        id: "blt-3",
        title: "5.56mm tüfek — çatidan aşağı eğik iz",
        scenario: "Yüksek hızlı tüfek mermisinin 120 m uzakta 12° aşağı yönlü iz bıraktığı tespit edilmiştir.",
        inputs: [
          "Silah: 5.56mm NATO (v₀=900 m/s)",
          "İz mesafesi: 120 m — Açı: 12°",
        ],
        results: [
          "Yükseklik farkı: 25,60 m (22,95–28,35)",
          "Düşüş: 0,09 m — Süre: 0,136 sn",
        ],
      },
      {
        id: "blt-4",
        title: "7.62mm — kapı içinde kısa mesafe iz",
        scenario: "İç mekanda 30 m mesafede 3° açılı iz; düşük açıda yerçekimi düşüşünün payı küçüktür.",
        inputs: [
          "Silah: 7.62mm AK/G3 (v₀=715 m/s)",
          "İz mesafesi: 30 m — Açı: 3°",
        ],
        results: [
          "Yükseklik farkı: 1,58 m (1,03–2,15)",
          "Düşüş: 0,01 m — Süre: 0,042 sn",
        ],
      },
      {
        id: "blt-5",
        title: "Dik açılı cam deliklerinden mesafe (9mm)",
        scenario: "Ardışık iki camdaki delikler 1,2 m yükseklik farkı ve 8° eğim vermiştir.",
        inputs: [
          "Silah: 9mm Tabanca (v₀=380 m/s)",
          "Yükseklik farkı: 1,2 m — Açı: 8°",
        ],
        results: [
          "Atış mesafesi: 8,5 m",
          "Düşüş: 0,00 m — Süre: 0,023 sn",
        ],
      },
    ],
  },
  {
    id: "gunshot",
    name: "Atış Mesafesi (Barut İzi)",
    group: "Balistik ve Adli",
    desc: "Barut artığı bulgularından atış mesafesi sınıflaması.",
    icon: "Flame",
    cases: [
      {
        id: "gun-1",
        title: "Alev yanığı mevcut — bitişik atış",
        scenario: "Giriş çevresinde alev yanığı tespit edilmiş; tabanca ile bitişik mesafeden atış yapılmıştır.",
        inputs: [
          "Silah: Tabanca",
          "Alev yanığı: MEVCUT",
        ],
        results: [
          "Tahmini mesafe: 0 – 5 cm",
          "Sınıf: Bitişik veya Bitişiğe Yakın Atış",
        ],
      },
      {
        id: "gun-2",
        title: "İs + barut dövmesi — yakın atış",
        scenario: "Giriş çevresinde yoğun is ve belirgin barut dövmesi birlikte görülmüştür.",
        inputs: [
          "Silah: Tabanca",
          "İs: VAR — Barut dövmesi: VAR",
        ],
        results: [
          "Tahmini mesafe: 5 – 35 cm",
          "Sınıf: Yakın Atış (Yoğun İs ve Barut Dövmesi)",
        ],
      },
      {
        id: "gun-3",
        title: "Yalnız barut dövmesi — orta mesafe",
        scenario: "İs bulaşığı yok; dağınık barut dövmesi mevcut.",
        inputs: [
          "Silah: Tabanca",
          "İs: YOK — Barut dövmesi: VAR",
        ],
        results: [
          "Tahmini mesafe: 35 – 100 cm",
          "Sınıf: Orta Mesafe Atış",
        ],
      },
      {
        id: "gun-4",
        title: "Saçma dağılımı 30 cm — modified choke",
        scenario: "Yivsiz av tüfeğiyle hedefte 30 cm çapında saçma dağılımı ölçülmüştür (orta şok).",
        inputs: [
          "Silah: Yivsiz Av Tüfeği",
          "Dağılım çapı: 30 cm — Choke: Modified (1,25)",
        ],
        results: [
          "Tahmini mesafe: 8,6 – 10,6 m",
          "Sınıf: Saçma Dağılımına Bağlı Mesafe",
        ],
      },
      {
        id: "gun-5",
        title: "Yalnız giriş halkası — uzak atış",
        scenario: "Barut artığı bulgusu yok; yalnızca giriş halkası ve sıyrık mevcut.",
        inputs: [
          "Silah: Yivli Tüfek",
          "İs: YOK — Dövme: YOK — Halka: VAR",
        ],
        results: [
          "Tahmini mesafe: 100+ cm",
          "Sınıf: Uzak Atış",
        ],
      },
    ],
  },
  {
    id: "shadow",
    name: "Gölge / Zaman",
    group: "Zaman ve Ölüm",
    desc: "Gölge boyu ve güneş açısından nesne boyu ve zaman dilimi.",
    icon: "Sun",
    cases: [
      {
        id: "gölge-1",
        title: "5 m gölge, 45° güneş açısı",
        scenario: "Kroki üzerinde lamba direğinin gölgesi 5 m ölçülmüş; güneş yükseklik açısı 45° alınmıştır.",
        inputs: [
          "Gölge boyu: 5,0 m",
          "Güneş açısı: 45°",
        ],
        results: [
          "Nesne boyu: 5,00 m (4,62–5,42)",
          "Zaman dilimi: Sabah / Akşamüstü (08:30-10:00 veya 16:00-17:30)",
        ],
      },
      {
        id: "gölge-2",
        title: "Kısa gölge — öğle saati (yaz)",
        scenario: "Yaz gündönümünde öğle açısına yakın 73° ile oluşan kısa gölge; olay saatini öğle bandına yerleştirir.",
        inputs: [
          "Gölge boyu: 2,6 m",
          "Güneş açısı: 73°",
        ],
        results: [
          "Nesne boyu: 8,50 m (7,41–9,89)",
          "Zaman dilimi: Öğle (12:00 - 13:30)",
        ],
      },
      {
        id: "gölge-3",
        title: "Uzun gölge — gün doğumu/batımı",
        scenario: "Sabah erken saatte çok uzun gölge; 18° açı gün doğumu/batımı bandına işaret eder.",
        inputs: [
          "Gölge boyu: 12,0 m",
          "Güneş açısı: 18°",
        ],
        results: [
          "Nesne boyu: 3,90 m (3,43–4,39)",
          "Zaman dilimi: Gün Doğumu / Batımı (Yakın Saatler)",
        ],
      },
      {
        id: "gölge-4",
        title: "Kuşluk gölgesi — kamera direği",
        scenario: "Güvenlik kamerası direğinin gölgesi 6,4 m; 55° açı kuşluk/ikindi bandı verir.",
        inputs: [
          "Gölge boyu: 6,4 m",
          "Güneş açısı: 55°",
        ],
        results: [
          "Nesne boyu: 9,14 m (8,43–9,93)",
          "Zaman dilimi: Kuşluk / İkindi (10:00-11:30 veya 14:30-16:00)",
        ],
      },
      {
        id: "gölge-5",
        title: "Ağaç gölgesi — sabah/akşamüstü",
        scenario: "Ağaç gölgesi 8,2 m ölçülmüş; 30° açı sabah ya da akşamüstü saatlerine işaret eder (yön bilgisiyle ayrılır).",
        inputs: [
          "Gölge boyu: 8,2 m",
          "Güneş açısı: 30°",
        ],
        results: [
          "Nesne boyu: 4,73 m (4,33–5,16)",
          "Zaman dilimi: Sabah / Akşamüstü (08:30-10:00 veya 16:00-17:30)",
        ],
      },
    ],
  },
  {
    id: "algor",
    name: "Ölüm Saati (Vücut Isısı)",
    group: "Zaman ve Ölüm",
    desc: "Newton soğuma modeliyle ölüm zamanı (PMI) tahmini.",
    icon: "Thermometer",
    cases: [
      {
        id: "alg-1",
        title: "İnce giysili vücut — 30°C ölçüm",
        scenario: "Cesedin rektal ısısı 30°C; mahal sıcaklığı 20°C; giysi ince (K=1,0).",
        inputs: [
          "Vücut ısısı: 30°C — Ortam: 20°C",
          "Ortam: Çıplak/İnce Giysi (K=1,0)",
        ],
        results: [
          "PMI (nokta): 6,2 saat",
          "Aralık: 4,9 – 8,0 saat",
          "Güvenilirlik: YÜKSEK",
        ],
      },
      {
        id: "alg-2",
        title: "Kalın giysili vücut — yavaş soğuma",
        scenario: "Kalın giysi soğumayı yavaşlattığından K=0,5 uygulanmıştır.",
        inputs: [
          "Vücut ısısı: 28°C — Ortam: 18°C",
          "Ortam: Kalın Giysili (K=0,5)",
        ],
        results: [
          "PMI (nokta): 16,7 saat",
          "Aralık: 13,4 – 21,2 saat",
          "Güvenilirlik: YÜKSEK",
        ],
      },
      {
        id: "alg-3",
        title: "Göl/göl kenarında buluntu — durgun su",
        scenario: "Durgun suda ceset suyun 2 katı hızla soğur (K=2,0).",
        inputs: [
          "Vücut ısısı: 26°C — Ortam (su): 15°C",
          "Ortam: Durgun Su (K=2,0)",
        ],
        results: [
          "PMI (nokta): 5,2 saat",
          "Aralık: 4,2 – 6,5 saat",
          "Güvenilirlik: YÜKSEK",
        ],
      },
      {
        id: "alg-4",
        title: "Rüzgarlı açık alan — hızlı soğuma",
        scenario: "Açık alanda güçlü rüzgar soğumayı hızlandırmıştır (K=1,4).",
        inputs: [
          "Vücut ısısı: 29°C — Ortam: 10°C",
          "Ortam: Rüzgarlı (K=1,4)",
        ],
        results: [
          "PMI (nokta): 4,6 saat",
          "Aralık: 3,7 – 5,9 saat",
          "Güvenilirlik: YÜKSEK",
        ],
      },
      {
        id: "alg-5",
        title: "Isı farkı azaldı — düşük güvenilirlik",
        scenario: "Vücut ısısı ortama yaklaştığı için (fark 4°C) yöntemin güvenilirliği düşer; destekleyici bulgu gerekir.",
        inputs: [
          "Vücut ısısı: 24°C — Ortam: 20°C",
          "Ortam: Çıplak/İnce Giysi (K=1,0)",
        ],
        results: [
          "PMI (nokta): 16,7 saat",
          "Aralık: 13,4 – 21,5 saat",
          "Güvenilirlik: DÜŞÜK",
        ],
        note: "Fark ≤5°C olduğundan sıcaklık yöntemi tek başına kanaat vermez; livor/rigor ve entomoloji desteklenmelidir.",
      },
    ],
  },
  {
    id: "fall",
    name: "Yüksekten Düşme Analizi",
    group: "Zaman ve Ölüm",
    desc: "Düşme süresi, izdüşüm mesafesi, çarpma hızı ve enerjisi.",
    icon: "Activity",
    cases: [
      {
        id: "fall-1",
        title: "3. kat penceresi (10 m) — adım atma hızı",
        scenario: "Vücut 10 m yükseklikten 1,5 m/s yatay hızla ayrılmış; hava direnci modele dahildir.",
        inputs: [
          "Yükseklik: 10 m — Ayrılma hızı: 1,5 m/s",
          "Kütle: 75 kg — Hava direnci: Dahil",
        ],
        results: [
          "Düşme süresi: 1,44 sn",
          "Yatay mesafe: 2,15 m",
          "Çarpma hızı: 50 km/s",
          "Çarpma enerjisi: 7.115 J",
        ],
      },
      {
        id: "fall-2",
        title: "Aynı olay — vakum modeli karşılaştırma",
        scenario: "Hava direnci çıkarıldığında sonuçların nasıl değiştiğini gösteren karşılaştırma senaryosu.",
        inputs: [
          "Yükseklik: 10 m — Ayrılma hızı: 1,5 m/s",
          "Kütle: 75 kg — Hava direnci: Hariç",
        ],
        results: [
          "Düşme süresi: 1,43 sn",
          "Yatay mesafe: 2,14 m",
          "Çarpma hızı: 50 km/s",
          "Çarpma enerjisi: 7.358 J",
        ],
      },
      {
        id: "fall-3",
        title: "Köprüden koşarak atlama (25 m)",
        scenario: "Kişinin köprüden koşu hızıyla (5,5 m/s) atladığı değerlendirilmiş; izdüşüm mesafesi ayrılma biçiminin göstergesidir.",
        inputs: [
          "Yükseklik: 25 m — Ayrılma hızı: 5,5 m/s (koşu)",
          "Kütle: 80 kg — Hava direnci: Dahil",
        ],
        results: [
          "Düşme süresi: 2,29 sn",
          "Yatay mesafe: 12,59 m",
          "Çarpma hızı: 76 km/s",
          "Çarpma enerjisi: 18.059 J",
        ],
      },
      {
        id: "fall-4",
        title: "Alçak saçak düşmesi (4 m)",
        scenario: "Alçak yükseklikten yavaş ayrılma (adım atma 0,8 m/s); kısa sürede zemine ulaşım.",
        inputs: [
          "Yükseklik: 4 m — Ayrılma hızı: 0,8 m/s",
          "Kütle: 70 kg — Hava direnci: Dahil",
        ],
        results: [
          "Düşme süresi: 0,91 sn",
          "Yatay mesafe: 0,72 m",
          "Çarpma hızı: 32 km/s",
          "Çarpma enerjisi: 2.710 J",
        ],
      },
      {
        id: "fall-5",
        title: "Yüksek kat atlama (50 m) — terminal hıza yaklaşım",
        scenario: "50 m düşüşte hava direnci belirgindir; hız terminal değere (~195 km/s) yakınsar.",
        inputs: [
          "Yükseklik: 50 m — Ayrılma hızı: 2,5 m/s",
          "Kütle: 85 kg — Hava direnci: Dahil",
        ],
        results: [
          "Düşme süresi: 3,28 sn",
          "Yatay mesafe: 8,21 m",
          "Çarpma hızı: 104 km/s",
          "Çarpma enerjisi: 35.404 J",
        ],
      },
    ],
  },
  {
    id: "plaunch",
    name: "Yaya Fırlatma Analizi",
    group: "Trafik ve Kaza",
    desc: "Ters Searle çözümüyle araç hızı; yaya durumu düzeltmeli.",
    icon: "Zap",
    cases: [
      {
        id: "pl-1",
        title: "Duran yaya — 20 m savrulma",
        scenario: "Kuru asfaltta duran yayaya çarpan araç yayayı 20 m savurmuş; yaya boyu 175 cm.",
        inputs: [
          "Fırlatma mesafesi: 20,0 m",
          "Yaya: 175 cm — Duran",
          "μ=0,70 (kuru asfalt)",
        ],
        results: [
          "Çarpışma anındaki araç hızı: 50 km/s",
          "Uçuş/Savrulma: 6,1 m + 13,9 m",
          "Toplam süre: 2,45 sn",
        ],
      },
      {
        id: "pl-2",
        title: "Aynı yönde yürüyen yaya — 30 m",
        scenario: "Yaya araç yönünde 5 km/s yürürken çarpılmış; araç hızı kapanış hızına göre düzeltilir.",
        inputs: [
          "Fırlatma mesafesi: 30,0 m",
          "Yaya: 170 cm — Aynı yönde yürüyen (+5 km/s)",
          "μ=0,70",
        ],
        results: [
          "Çarpışma anındaki araç hızı: 68 km/s",
          "Uçuş/Savrulma: 7,6 m + 22,4 m",
          "Toplam süre: 2,99 sn",
        ],
      },
      {
        id: "pl-3",
        title: "Karşı yönde koşan yaya — 12 m",
        scenario: "Yaya karşı yönde 10 km/s koşarken çarpılmış; kapanış hızı düşük çıkar.",
        inputs: [
          "Fırlatma mesafesi: 12,0 m",
          "Yaya: 180 cm — Ters yönde koşan (−10 km/s)",
          "μ=0,70",
        ],
        results: [
          "Çarpışma anındaki araç hızı: 26 km/s",
          "Uçuş/Savrulma: 4,5 m + 7,5 m",
          "Toplam süre: 1,92 sn",
        ],
      },
      {
        id: "pl-4",
        title: "Uzun savrulma — 45 m (kısa boylu yaya)",
        scenario: "Yüksek hızdaki çarpmada yaya 45 m savrulmuş; boy 165 cm (h daha küçük).",
        inputs: [
          "Fırlatma mesafesi: 45,0 m",
          "Yaya: 165 cm — Duran",
          "μ=0,70",
        ],
        results: [
          "Çarpışma anındaki araç hızı: 79 km/s",
          "Uçuş/Savrulma: 9,5 m + 35,5 m",
          "Toplam süre: 3,65 sn",
        ],
      },
      {
        id: "pl-5",
        title: "Aynı yönde koşan uzun boylu yaya — 25 m",
        scenario: "182 cm boylundaki yaya aynı yönde 10 km/s koşarken çarpılmıştır.",
        inputs: [
          "Fırlatma mesafesi: 25,0 m",
          "Yaya: 182 cm — Aynı yönde koşan (+10 km/s)",
          "μ=0,70",
        ],
        results: [
          "Çarpışma anındaki araç hızı: 66 km/s",
          "Uçuş/Savrulma: 7,1 m + 17,9 m",
          "Toplam süre: 2,74 sn",
        ],
      },
    ],
  },
  {
    id: "shotdir",
    name: "Atış Yönü Tespiti",
    group: "Balistik ve Adli",
    desc: "Giriş-çıkış delik koordinatlarından atıcı yönü ve konumu.",
    icon: "Crosshair",
    cases: [
      {
        id: "shd-1",
        title: "Gövdede giriş-çıkış deliği çifti (cam pencere öncesi)",
        scenario: "Giriş (0, 0, 150 cm) ve çıkış (30, 10, 140 cm) koordinatlarından atıcı yönü ve konumu tahmin edilmiştir.",
        inputs: [
          "Giriş: (0, 0, 150) cm — Çıkış: (30, 10, 140) cm",
          "Yüzey: Cam — Silah: 9mm",
        ],
        results: [
          "Yatay yön açısı: 71,6°",
          "Dik çarpma açısı: 17,5° — Yörünge: 33,2 cm",
          "Atıcı mesafesi: ~5,4 m — Atıcı yüksekliği: 0,0 m",
          "Sapma (cam): 5,3°",
        ],
      },
      {
        id: "shd-2",
        title: "Metal sac delikleri — aracın kapısı",
        scenario: "Araç kapısındaki giriş-çıkış delikleri; metalde sapma azdır.",
        inputs: [
          "Giriş: (0, 0, 160) cm — Çıkış: (12, 0, 152) cm",
          "Yüzey: Metal Sac — Silah: 9mm",
        ],
        results: [
          "Yatay yön açısı: 90,0°",
          "Dik açı: 33,7° — Yörünge: 14,4 cm",
          "Atıcı mesafesi: ~5,1 m — Yükseklik: 0,0 m",
          "Sapma (metal): 5,1°",
        ],
      },
      {
        id: "shd-3",
        title: "Alçıpan duvarda geniş delik çifti",
        scenario: "İç duvarda iki delik arasında büyük koordinat farkı; alçıpan sapma faktörü yüksektir.",
        inputs: [
          "Giriş: (0, 0, 140) cm — Çıkış: (45, 20, 110) cm",
          "Yüzey: Alçıpan — Silah: 9mm",
        ],
        results: [
          "Yatay yön açısı: 66,0°",
          "Dik açı: 31,4° — Yörünge: 57,7 cm",
          "Atıcı mesafesi: ~5,6 m — Yükseklik: 0,0 m",
          "Sapma (alçıpan): 14,1°",
        ],
      },
      {
        id: "shd-4",
        title: "Beton duvarda yukarı yönlü yörünge",
        scenario: "Çıkış deliği girişten yukarıda; yörünge yukarı eğimlidir, betonda sapma düşüktür.",
        inputs: [
          "Giriş: (0, 0, 155) cm — Çıkış: (25, 15, 165) cm",
          "Yüzey: Beton — Silah: 9mm",
        ],
        results: [
          "Yatay yön açısı: 59,0°",
          "Dik açı: 18,9° — Yörünge: 30,8 cm",
          "Atıcı mesafesi: ~5,3 m — Yükseklik: 0,0 m",
          "Sapma (beton): 1,4°",
        ],
      },
      {
        id: "shd-5",
        title: "Ahşap kapıda yatay atış",
        scenario: "Giriş ve çıkış aynı yükseklikte (z farkı 0) → dik açı 0°, atıcı hizada ve aynı yüksekliktedir.",
        inputs: [
          "Giriş: (0, 0, 130) cm — Çıkış: (20, 0, 130) cm",
          "Yüzey: Ahşap — Silah: 9mm",
        ],
        results: [
          "Yatay yön açısı: 90,0°",
          "Dik açı: 0,0° — Yörünge: 20,0 cm",
          "Atıcı mesafesi: ~5,2 m — Yükseklik: 1,3 m",
          "Sapma (ahşap): 0,0°",
        ],
      },
    ],
  },
  {
    id: "accident",
    name: "Kaza Yeniden Canlandırma",
    group: "Trafik ve Kaza",
    desc: "İki araçlı kaza senaryosunun animasyonla yeniden canlandırılması.",
    icon: "Car",
    cases: [
      {
        id: "acc-1",
        title: "Kavşakta T-bone çarpışma (gündüz, kuru)",
        scenario: "Ana yoldan 60 km/s gelen otomobil ile kavşağa 40 km/s giren otomobilin dik çarpışması; animasyonla yeniden canlandırma.",
        inputs: [
          "Araç 1: Otomobil — 60 km/s",
          "Araç 2: Otomobil — 40 km/s",
          "Zemin: Asfalt (Kuru) μ=0,70 — Hava: Açık",
        ],
        results: [
          "Yol: Kavşak — Işık: Gün Işığı",
          "Canlandırma: gösterge niteliğinde animasyon",
        ],
      },
      {
        id: "acc-2",
        title: "Şehir içinde arkadan çarpma (yoğun trafik)",
        scenario: "Duraklamış araç arkadan 30 km/s ile çarpılan tipik şehir içi senaryo.",
        inputs: [
          "Araç 1: Otomobil — 30 km/s (arkadan)",
          "Araç 2: Otomobil — 0 km/s (duran)",
          "Zemin: Asfalt (Kuru) μ=0,70",
        ],
        results: [
          "Yol: Şehir İçi — Hava: Açık",
          "Canlandırma: gösterge niteliğinde animasyon",
        ],
      },
      {
        id: "acc-3",
        title: "Gece yağmurunda otoyol kaza senaryosu",
        scenario: "Islak zeminde (μ=0,50) gece görüş koşullarında 90 km/s ile 70 km/s araçların yandan teması.",
        inputs: [
          "Araç 1: Otomobil — 90 km/s",
          "Araç 2: Minibüs — 70 km/s",
          "Zemin: Asfalt (Islak) μ=0,50",
        ],
        results: [
          "Yol: Otoyol — Hava: Yağmurlu — Gece",
          "Canlandırma: gösterge niteliğinde animasyon",
        ],
      },
      {
        id: "acc-4",
        title: "Karlı yolda viraj çıkışında çarpışma",
        scenario: "Kar zeminde (μ=0,20) kontrollü kayma sonucu karşı yönden gelen araçla temas.",
        inputs: [
          "Araç 1: SUV — 50 km/s",
          "Araç 2: Kamyon — 30 km/s",
          "Zemin: Kar μ=0,20",
        ],
        results: [
          "Yol: Şehir Dışı — Hava: Karlı",
          "Canlandırma: gösterge niteliğinde animasyon",
        ],
      },
      {
        id: "acc-5",
        title: "Motosiklet – otomobil kavşak teması",
        scenario: "Kavşakta motosiklet ile sağa dönen otomobilin temas anı ve sonrasının canlandırılması.",
        inputs: [
          "Araç 1: Motosiklet — 55 km/s",
          "Araç 2: Otomobil — 20 km/s (sağa dönüş)",
          "Zemin: Asfalt (Kuru) μ=0,70",
        ],
        results: [
          "Yol: Kavşak — Işık: Gün Işığı",
          "Canlandırma: gösterge niteliğinde animasyon",
        ],
      },
    ],
  },
];
