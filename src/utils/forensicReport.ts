/**
 * Adli bilirkişi raporu üretim altyapısı.
 * Hesaplayıcıların analiz çıktılarını standart bilirkişi raporu
 * biçimine (konu → deliller → yöntem → bulgular → ihtimaller →
 * sonuç ve kanaat → şerhler) dönüştürür.
 *
 * formatForensicReport: uzun bilirkişi metni (önizleme/kopya + PDF kaynağı),
 * ~46 karakterde sarılır.
 * formatForensicSummary: "TUVALE AKTAR" düğmesinin tuvale eklediği kısa
 * özet — yalnızca "anahtar: değer" veri satırları, en çok 60 karakter
 * (tuval metin kutusu 320px / fontSize 10 hedefiyle).
 */

export interface ForensicReport {
  /** Raporing başlığı, ör. "FREN İZİ İNCELEMESİ" */
  title: string;
  /** 1. İnceleme konusu (talep) */
  topic: string;
  /** 2. İncelenen deliller / kullanılan girdiler */
  evidence: string[];
  /** 3. Uygulanan yöntem (formüller, standartlar) */
  method: string[];
  /** 4. Bulgular (nokta tahmin + belirsizlik aralıkları) */
  findings: string[];
  /** 5. Değerlendirme — tüm ihtimaller / alternatif senaryolar */
  scenarios: string[];
  /** 6. Sonuç ve kanaat (bilirkişi görüşü) */
  conclusion: string[];
  /** 7. Şerhler / limitasyonlar */
  caveats: string[];
}

const RULER = '\u2500'.repeat(46);
const DOUBLE = '\u2550'.repeat(46);
const LINE_CHARS = 46;

export interface ReportMeta {
  /** KROKİ-YYYYMMDD-HHMMSS biçiminde dosya numarası */
  dosyaNo: string;
  /** gg.aa.yyyy */
  tarih: string;
  /** ss.dd (saat.dakika) */
  saat: string;
}

/** Rapor numarası ve tarih/saat — metin çıktısı ile PDF aynı numarayı paylaşır.
 * Tarih gg.aa.yyyy, saat ss.dd (saat.dakika) biçimindedir. */
export function reportMeta(now = new Date()): ReportMeta {
  const dosyaNo = `KROKİ-${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}${String(now.getDate()).padStart(2, '0')}-${String(now.getHours()).padStart(2, '0')}${String(now.getMinutes()).padStart(2, '0')}${String(now.getSeconds()).padStart(2, '0')}`;
  const p2 = (n: number) => String(n).padStart(2, '0');
  return {
    dosyaNo,
    tarih: `${p2(now.getDate())}.${p2(now.getMonth() + 1)}.${now.getFullYear()}`,
    saat: `${p2(now.getHours())}.${p2(now.getMinutes())}`,
  };
}

/** Metni verilen karakter sayısında sarar; devam satırlarını girintiler. */
export function wrapText(text: string, max = LINE_CHARS, indent = '    '): string[] {
  const out: string[] = [];
  text.split('\n').forEach((para) => {
    if (para.length <= max) {
      out.push(para);
      return;
    }
    const words = para.split(/\s+/);
    let line = '';
    words.forEach((w) => {
      const cand = line ? `${line} ${w}` : w;
      if (cand.length > max && line) {
        out.push(line);
        line = indent + w;
      } else {
        line = cand;
      }
    });
    if (line) out.push(line);
  });
  return out;
}

/** Numaralı madde: "5.3  metin" biçiminde sarılmış satırlar üretir. */
function numbered(prefix: string, text: string): string[] {
  const lines = wrapText(text, LINE_CHARS - 2);
  if (!lines.length) return [];
  return [`${prefix}. ${lines[0]}`, ...lines.slice(1).map((l) => `     ${l}`)];
}

function section(no: number, heading: string, items: string[]): string[] {
  const out: string[] = ['', `${no}. ${heading}`, RULER];
  if (!items.length) {
    out.push('     (Veri bulunamadı)');
    return out;
  }
  items.forEach((it, i) => {
    out.push(...numbered(`${no}.${i + 1}`, it));
  });
  return out;
}

/** Raporu canvas'a uygun düz metne dönüştürür (DETAYLI ANALİZ — PDF ile aynı içerik). */
export function formatForensicReport(r: ForensicReport): string {
  const { dosyaNo, tarih, saat } = reportMeta();

  const lines: string[] = [];
  lines.push(DOUBLE);
  wrapText(r.title, LINE_CHARS).forEach((l) => lines.push(`  ${l}`));
  lines.push('     ADLİ BİLİRKİŞİ ANALİZ RAPORU');
  lines.push(DOUBLE);
  lines.push(`Dosya No : ${dosyaNo}`);
  lines.push(`Tarih    : ${tarih} - ${saat}`);
  lines.push(RULER);

  lines.push(...section(1, 'İNCELEME KONUSU', [r.topic]));
  lines.push(...section(2, 'İNCELENEN DELİLLER VE GİRDİLER', r.evidence));
  lines.push(...section(3, 'UYGULANAN YÖNTEM', r.method));
  lines.push(...section(4, 'BULGULAR', r.findings));
  lines.push(...section(5, 'DEĞERLENDİRME (TÜM İHTİMALLER)', r.scenarios));
  lines.push(...section(6, 'SONUÇ VE KANAAT', r.conclusion));
  lines.push(...section(7, 'ŞERHLER VE LİMİTASYONLAR', r.caveats));

  lines.push('', RULER);
  lines.push('Bu rapor bilimsel yöntemlere dayalı bilirkişi');
  lines.push('görüşü niteliğindedir. Nihai kanaat, dosyanın');
  lines.push('bütüncül delilleri ile birlikte değerlendirilmelidir.');
  lines.push(DOUBLE);
  return lines.join('\n');
}

/** Sayıyı Türk formatında yazar (nokta binlik, virgül ondalık). */
export function trNum(v: number, digits = 1): string {
  return v.toLocaleString('tr-TR', { minimumFractionDigits: digits, maximumFractionDigits: digits });
}

/* ------------------------------------------------------------------ */
/* KISA ÖZET — hesaplayıcılardaki "TUVALE AKTAR" düğmesinin doğrudan   */
/* tuvale aktardığı kısa sonuç. Eski sade biçemdeki gibi yalnızca      */
/* veri satırlarından oluşur: girdiler + bulgular ("anahtar: değer").  */
/* Başlık/ayraç yoktur; yorum cümleleri ve uzun bilirkişi raporu       */
/* yalnızca PDF'te yer alır.                                           */
/* ------------------------------------------------------------------ */

/** Sondaki parantezli notun Ölçüm/tolerans/varsayım notu olup olmadığı. */
const TRAILING_NOTE_RE = /±|ölçüm|hata payı|belirsizlik|faktörü|varyasyon|varsayım|limit/i;

/** Sondaki parantezli ölçüm notunu kaldırır: "İz: 20 m (ölçüm ±%5)" → "İz: 20 m".
 *  Veri taşıyan parantezler korunur: "çarpma 45 km/s (30°)" aynen kalır. */
function stripTrailingNote(s: string): string {
  const t = s.replace(/\s+/g, ' ').trim();
  const m = t.match(/\s*\(([^()]*)\)\s*\.?\s*$/);
  return m && TRAILING_NOTE_RE.test(m[1]) ? t.slice(0, m.index).trim() : t;
}

/** Yorum/şerh cümlelerini ayıklar: tuvale yalnızca "anahtar: değer" veri satırları gider. */
function isDataLine(s: string): boolean {
  const t = s.trim();
  return t.includes(':') && !/^Not\s*:/i.test(t);
}

/** Satırı kelime sınırından kırparak tek satıra (en çok max karakter) indirger. */
function clipLine(s: string, max: number): string {
  const t = s.replace(/\s+/g, ' ').trim();
  if (t.length <= max) return t;
  const cut = t.slice(0, max - 1);
  const sp = cut.lastIndexOf(' ');
  return `${(sp > max * 0.5 ? cut.slice(0, sp) : cut).trimEnd()}…`;
}

const SUMMARY_LINE_CHARS = 60;

/** Rapor nesnesinden tuvale eklenecek KISA ÖZET metnini üretir:
 *  tüm girdi (delil) ve bulgu satırları — görseldeki sade liste biçemi. */
export function formatForensicSummary(r: ForensicReport): string {
  const lines = [...r.evidence, ...r.findings]
    .filter(isDataLine)
    .map((l) => clipLine(stripTrailingNote(l), SUMMARY_LINE_CHARS))
    .filter((l) => l.length > 0);
  return lines.length > 0 ? lines.join('\n') : clipLine(stripTrailingNote(r.title), SUMMARY_LINE_CHARS);
}
