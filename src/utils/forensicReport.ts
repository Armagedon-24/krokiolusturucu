/**
 * Adli bilirkişi raporu üretim altyapısı.
 * Hesaplayıcıların analiz çıktılarını standart bilirkişi raporu
 * biçimine (konu → deliller → yöntem → bulgular → ihtimaller →
 * sonuç ve kanaat → şerhler) dönüştürür.
 *
 * Canvas'a eklenecek metin, genişlik 320px / fontSize 11 hedefiyle
 * ~46 karakterde sarılır (CanvasArea wrap yapmadığı için).
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

/** Raporu canvas'a uygun düz metne dönüştürür. */
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
