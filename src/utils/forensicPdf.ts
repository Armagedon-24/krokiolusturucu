/**
 * Adli bilirkişi analiz raporunun kurumsal PDF üretimi (jsPDF).
 *
 * Tasarım: A4 dikey, koyu kurumsal başlık bandı, gri vurgu çizgisi,
 * numaralı bölüm başlıkları, asılı girintili maddeler, sonuç kutusu,
 * bilirkişi imza alanı ve her sayfada rapor no + sayfa numarası altbilgisi.
 *
 * Türkçe karakterler (ğ ş ı İ ç ö ü) için Liberation Sans gömülür
 * (public/assets/fonts/). jsPDF standart Helvetica'sı Türkçe desteklemez.
 */

import { jsPDF, GState } from 'jspdf';
import type { ForensicReport } from './forensicReport';
import { reportMeta } from './forensicReport';

/* ------------------------------------------------------------------ */
/* Renk paleti — kurumsal koyu + altın vurgu (uygulama kimliğiyle uyumlu) */
/* ------------------------------------------------------------------ */
const C_INK = '#16181D'; // başlık bandı / ana metin başlıkları
const C_BODY = '#26282E'; // gövde metni
const C_GRAY = '#6B7280'; // ikincil metin
const C_ACCENT = '#6B7280'; // vurgu (nötr gri — tamamen tek renk kurumsal)
const C_BOX_BG = '#F3F4F6'; // sonuç kutusu dolgusu
const C_LINE = '#C9CDD4'; // ince çizgiler
const C_ZEBRA = '#F3F4F6'; // bilgi tablosu dolgusu
const C_WHITE = '#FFFFFF';
const C_HEADING = '#000000'; // bölüm başlıkları (en koyu)
const C_RULE = '#AEB3BB'; // bölüm başlığı altı çizgi (belirgin)

/* Sayfa geometrisi (mm) — A4 210×297 */
const PW = 210;
const PH = 297;
const ML = 20; // sol kenar boşluğu
const MR = 18; // sağ kenar boşluğu
const CW = PW - ML - MR; // içerik genişliği = 172
const BOTTOM = 268; // içerik alt sınırı (altbilgi bölgesi öncesi)
const TOP_PN = 24; // devam sayfaları içerik başlangıcı

const FONT_NAME = 'Liberation';
const FONT_REG = 'LiberationSans-Regular.ttf';
const FONT_BOLD = 'LiberationSans-Bold.ttf';
const LOGO_URL = `${import.meta.env.BASE_URL}assets/kurum_logo.png`;
/** Sayfa arkasına basılan içi boş (kontur) ve renksiz filigran. */
const LOGO_WM_URL = `${import.meta.env.BASE_URL}assets/kurum_logo_filigran_kontur.png`;

/** Belge başlığı — üst bant, devam sayfaları ve altbilgide ortak. */
const DOC_TITLE = 'KAZA ANALİZ VE REKONSTRÜKSİYON ANALİZİ';

let fontCache: Promise<{ reg: string; bold: string }> | null = null;
let logoCache: Promise<string> | null = null;
let logoWmCache: Promise<string> | null = null;

/** TTF / PNG indirip base64'e çevirir. */
async function fetchB64(url: string, what: string): Promise<string> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`${what} alınamadı: ${url} (${res.status})`);
  const buf = new Uint8Array(await res.arrayBuffer());
  let bin = '';
  const CHUNK = 0x8000;
  for (let i = 0; i < buf.length; i += CHUNK) {
    bin += String.fromCharCode(...buf.subarray(i, i + CHUNK));
  }
  return btoa(bin);
}

/** Font bayt'larını bir kez indirir; her yeni dokümana ayrıca kaydeder. */
function loadFontB64(): Promise<{ reg: string; bold: string }> {
  if (!fontCache) {
    fontCache = Promise.all([
      fetchB64(`${import.meta.env.BASE_URL}assets/fonts/${FONT_REG}`, 'Font'),
      fetchB64(`${import.meta.env.BASE_URL}assets/fonts/${FONT_BOLD}`, 'Font'),
    ]).then(([reg, bold]) => ({ reg, bold }));
  }
  return fontCache;
}

/** Kurum logosunu bir kez indirir (antet). */
function loadLogoB64(): Promise<string> {
  if (!logoCache) logoCache = fetchB64(LOGO_URL, 'Logo');
  return logoCache;
}

/** Silüet filigranı bir kez indirir. */
function loadWatermarkB64(): Promise<string> {
  if (!logoWmCache) logoWmCache = fetchB64(LOGO_WM_URL, 'Filigran');
  return logoWmCache;
}

/** Fontları bu dokümana kaydeder. */
async function ensureFonts(doc: jsPDF): Promise<void> {
  const { reg, bold } = await loadFontB64();
  doc.addFileToVFS(FONT_REG, reg);
  doc.addFont(FONT_REG, FONT_NAME, 'normal');
  doc.addFileToVFS(FONT_BOLD, bold);
  doc.addFont(FONT_BOLD, FONT_NAME, 'bold');
}

/* ------------------------------------------------------------------ */
/* Yardımcılar                                                         */
/* ------------------------------------------------------------------ */

function hairline(doc: jsPDF, x: number, y: number, w: number, color = C_LINE, thick = 0.25) {
  doc.setDrawColor(color);
  doc.setLineWidth(thick);
  doc.line(x, y, x + w, y);
}

/** Yerelleştirilmiş büyük harf (i→İ, ı→I). */
function trUpper(s: string): string {
  return s.toLocaleUpperCase('tr-TR');
}

/** Dosya adında güvenli ASCII: Türkçe karakterleri sadeleştirir. */
function asciiSafe(s: string): string {
  const map: Record<string, string> = { 'İ': 'I', 'ı': 'i', 'ğ': 'g', 'Ğ': 'G', 'ş': 's', 'Ş': 'S', 'ç': 'c', 'Ç': 'C', 'ö': 'o', 'Ö': 'O', 'ü': 'u', 'Ü': 'U' };
  return s.replace(/[İığĞşŞçÇöÖüÜ]/g, (c) => map[c] ?? c).replace(/[^A-Za-z0-9._-]+/g, '_');
}

/* ------------------------------------------------------------------ */
/* Ana üretici                                                         */
/* ------------------------------------------------------------------ */

export interface ForensicPdfResult {
  fileName: string;
  blob: Blob;
}

/** Rapor nesnesinden kurumsal PDF üretip Blob olarak döndürür. */
export async function buildForensicPdf(report: ForensicReport): Promise<ForensicPdfResult> {
  const doc = new jsPDF({ unit: 'mm', format: 'a4', compress: true });
  await ensureFonts(doc);
  const logoB64 = await loadLogoB64();
  const wmB64 = await loadWatermarkB64();

  const meta = reportMeta();

  /* --- imleç durumu ---------------------------------------------- */
  let y = 0;
  let pageNo = 1;

  const setBody = () => { doc.setFont(FONT_NAME, 'normal'); doc.setFontSize(9.5); doc.setTextColor(C_BODY); };
  const setItemNo = () => { doc.setFont(FONT_NAME, 'bold'); doc.setFontSize(9.5); doc.setTextColor(C_ACCENT); };

  /** Sayfa sonuna sığmıyorsa yeni sayfa aç, devam üst bilgisini bas. */
  const ensure = (need: number) => {
    if (y + need > BOTTOM) {
      doc.addPage();
      pageNo += 1;
      drawContinuationHeader();
      y = TOP_PN;
    }
  };

  /** Devam sayfaları için kompakt antet. */
  const drawContinuationHeader = () => {
    doc.setFillColor(C_INK);
    doc.rect(0, 0, PW, 14, 'F');
    doc.setFillColor(C_ACCENT);
    doc.rect(0, 14, PW, 0.9, 'F');
    doc.addImage(logoB64, 'PNG', 12, 2.2, 9.6, 9.6);
    doc.setFont(FONT_NAME, 'bold');
    doc.setFontSize(9);
    doc.setTextColor(C_WHITE);
    doc.text(DOC_TITLE, 24.6, 8.6);
    doc.setFont(FONT_NAME, 'normal');
    doc.setFontSize(8);
    doc.setTextColor('#D1D5DB');
    doc.text(meta.dosyaNo, PW - MR, 8.6, { align: 'right' });
  };

  /** Bölüm başlığı: sayfada ortalanmış numara rozeti + en koyu büyük harf başlık + belirgin çizgi. */
  const sectionHeading = (no: number, title: string) => {
    ensure(16);
    doc.setFont(FONT_NAME, 'bold');
    doc.setFontSize(11);
    const t = trUpper(title);
    const tw = doc.getTextWidth(t);
    const bw = 6.5;
    const gap = 3.5;
    const x0 = (PW - (bw + gap + tw)) / 2;
    doc.setFillColor(C_ACCENT);
    doc.rect(x0, y, bw, bw, 'F');
    doc.setFontSize(9.5);
    doc.setTextColor(C_WHITE);
    doc.text(String(no), x0 + bw / 2, y + 4.6, { align: 'center' });
    doc.setFontSize(11);
    doc.setTextColor(C_HEADING);
    doc.text(t, x0 + bw + gap, y + 4.6);
    y += 8.6;
    hairline(doc, ML, y, CW, C_RULE, 0.35);
    y += 4;
  };

  /** Numaralı madde: "4.2  metin" — asılı girinti. */
  const item = (sec: number, idx: number, text: string) => {
    setBody();
    const lines = doc.splitTextToSize(text, CW - 12) as string[];
    ensure(lines.length * 4.35 + 2);
    setItemNo();
    doc.text(`${sec}.${idx + 1}`, ML + 1.5, y + 3.4);
    setBody();
    doc.text(lines, ML + 12, y + 3.4);
    y += lines.length * 4.35 + 1.7;
  };

  const emptyNote = () => {
    setBody();
    doc.setTextColor(C_GRAY);
    doc.text('(Veri bulunamadı)', ML + 1.5, y + 3.4);
    y += 6;
  };

  /* ================================================================ */
  /* 1. SAYFA ÜST BANDI (ANTET + LOGO)                                */
  /* ================================================================ */
  doc.setFillColor(C_INK);
  doc.rect(0, 0, PW, 30, 'F');
  doc.setFillColor(C_ACCENT);
  doc.rect(0, 30, PW, 1.1, 'F');

  // Sol: kurum logosu (antet) — daha sola hizalı
  const logoX = 11;
  doc.addImage(logoB64, 'PNG', logoX, 4.5, 21.5, 21.5 * (148 / 175));
  const tx = logoX + 21.5 + 4; // logo sonrası metin sütunu

  // Başlık: rozet alanına taşmayacak kadar sığana kadar punto küçült
  const badgeLeft = PW - MR - 52;
  const maxTitleW = badgeLeft - 4 - tx;
  doc.setFont(FONT_NAME, 'bold');
  doc.setTextColor(C_WHITE);
  let titleSize = 15.5;
  doc.setFontSize(titleSize);
  while (titleSize > 11 && doc.getTextWidth(DOC_TITLE) > maxTitleW) {
    titleSize -= 0.5;
    doc.setFontSize(titleSize);
  }
  doc.text(DOC_TITLE, tx, 13.5);
  doc.setFont(FONT_NAME, 'normal');
  doc.setFontSize(7.5);
  doc.setTextColor('#9CA3AF');
  doc.text('Bilimsel yöntemlere dayalı teknik değerlendirme belgesi', tx, 20);

  // Sağda rapor rozeti
  doc.setDrawColor('#4B5563');
  doc.setLineWidth(0.3);
  doc.roundedRect(badgeLeft, 7, 52, 17, 1.5, 1.5, 'S');
  doc.setFont(FONT_NAME, 'bold');
  doc.setFontSize(6.5);
  doc.setTextColor('#9CA3AF');
  doc.text('RAPOR NO', PW - MR - 48, 11.5);
  doc.setFontSize(9.5);
  doc.setTextColor('#D1D5DB');
  doc.text(meta.dosyaNo, PW - MR - 48, 17.5);
  doc.setFont(FONT_NAME, 'normal');
  doc.setFontSize(7);
  doc.setTextColor('#9CA3AF');
  doc.text(`${meta.tarih} · ${meta.saat}`, PW - MR - 48, 21.8);

  /* --- Bilgi tablosu ---------------------------------------------- */
  y = 37.5;
  const infoRows: Array<[string, string]> = [
    ['Rapor No', meta.dosyaNo],
    ['Rapor Tarihi', meta.tarih],
    ['Rapor Saati', meta.saat],
    ['İnceleme Türü', report.title],
    ['Adres', '.......................................................................................................'],
  ];
  infoRows.forEach(([k, v], i) => {
    doc.setFont(FONT_NAME, 'normal');
    doc.setFontSize(9);
    const vLines = doc.splitTextToSize(v, CW - 52 - 4) as string[];
    const rh = Math.max(6.6, vLines.length * 4.4 + 2.4);
    if (i % 2 === 0) {
      doc.setFillColor(C_ZEBRA);
      doc.rect(ML, y, CW, rh, 'F');
    }
    // Etiketler (başlıklar) en koyu tonda — girdiler normal ağırlıkta kalır
    doc.setFont(FONT_NAME, 'bold');
    doc.setFontSize(8.5);
    doc.setTextColor(C_INK);
    doc.text(trUpper(k), ML + 3, y + 4.5);
    doc.setFont(FONT_NAME, 'normal');
    doc.setFontSize(9);
    doc.setTextColor(C_BODY);
    doc.text(vLines, ML + 52, y + 4.5);
    y += rh;
  });
  hairline(doc, ML, y, CW);
  y += 8;

  /* ================================================================ */
  /* BÖLÜMLER                                                          */
  /* ================================================================ */
  const drawSections = () => {
    sectionHeading(1, 'İnceleme Konusu');
    item(1, 0, report.topic);

    sectionHeading(2, 'İncelenen Deliller ve Girdiler');
    if (report.evidence.length) report.evidence.forEach((e, i) => item(2, i, e)); else emptyNote();

    sectionHeading(3, 'Uygulanan Yöntem');
    if (report.method.length) report.method.forEach((m, i) => item(3, i, m)); else emptyNote();

    sectionHeading(4, 'Bulgular');
    if (report.findings.length) report.findings.forEach((f, i) => item(4, i, f)); else emptyNote();

    sectionHeading(5, 'Değerlendirme — Tüm İhtimaller');
    if (report.scenarios.length) report.scenarios.forEach((s, i) => item(5, i, s)); else emptyNote();
  };

  const drawConclusion = () => {
    sectionHeading(6, 'Sonuç ve Kanaat');
    setBody();
    const blocks = (report.conclusion.length ? report.conclusion : ['(Veri bulunamadı)'])
      .map((c) => doc.splitTextToSize(c, CW - 16) as string[]);
    const totalH = blocks.reduce((a, b) => a + b.length * 4.35, 0) + 9;
    ensure(totalH + 4);
    // Gri vurgu çubuğu + yumuşak dolgu
    const boxTop = y;
    doc.setFillColor(C_BOX_BG);
    doc.rect(ML, boxTop, CW, totalH, 'F');
    doc.setFillColor(C_ACCENT);
    doc.rect(ML, boxTop, 1.6, totalH, 'F');
    let ty = boxTop + 5.5;
    blocks.forEach((b) => {
      doc.setFont(FONT_NAME, 'normal');
      doc.setFontSize(9.5);
      doc.setTextColor(C_BODY);
      doc.text(b, ML + 6, ty);
      ty += b.length * 4.35;
    });
    y = boxTop + totalH + 4;
  };

  const drawCaveats = () => {
    sectionHeading(7, 'Şerhler ve Limitasyonlar');
    if (report.caveats.length) report.caveats.forEach((c, i) => item(7, i, c)); else emptyNote();
  };

  /** Bilirkişi imza bloğu (sağa hizalı). */
  const drawSignature = () => {
    ensure(52);
    y += 6;
    const bw = 78;
    const bh = 40;
    const bx = PW - MR - bw;
    hairline(doc, ML, y + bh / 2, CW - bw - 8, C_LINE);
    doc.setDrawColor(C_LINE);
    doc.setLineWidth(0.3);
    doc.roundedRect(bx, y, bw, bh, 1.5, 1.5, 'S');
    doc.setFillColor(C_INK);
    doc.roundedRect(bx, y, bw, 7, 1.5, 1.5, 'F');
    doc.setFont(FONT_NAME, 'bold');
    doc.setFontSize(8.5);
    doc.setTextColor(C_WHITE);
    doc.text('BİLİRKİŞİ', bx + bw / 2, y + 4.8, { align: 'center' });
    doc.setFont(FONT_NAME, 'normal');
    doc.setFontSize(8);
    doc.setTextColor(C_GRAY);
    doc.text('Adı Soyadı : ............................', bx + 5, y + 14);
    doc.text('Unvan / Sicil No : ....................', bx + 5, y + 20);
    doc.text('İmza / Paraf :', bx + 5, y + 34);
    y += bh + 8;
  };

  drawSections();
  drawConclusion();
  drawCaveats();
  drawSignature();

  /* ================================================================ */
  /* ALTBİLGİ — tüm sayfalara sonradan damgalanır                      */
  /* ================================================================ */
  const total = doc.getNumberOfPages();

  /* Filigran: sayfayı kaplayan içi boş (kontur) gri logo */
  const WM_W = 206;
  const WM_H = WM_W * (148 / 175);
  const wmX = (PW - WM_W) / 2;
  const wmY = (PH - WM_H) / 2; // sayfanın dikey ortası

  for (let p = 1; p <= total; p++) {
    doc.setPage(p);
    doc.saveGraphicsState();
    doc.setGState(new GState({ opacity: 0.16 }));
    doc.addImage(wmB64, 'PNG', wmX, wmY, WM_W, WM_H);
    doc.restoreGraphicsState();
    hairline(doc, ML, PH - 16, CW, C_LINE, 0.2);
    doc.setFont(FONT_NAME, 'normal');
    doc.setFontSize(7.5);
    doc.setTextColor(C_GRAY);
    doc.text(`${meta.dosyaNo} · Kaza Analiz ve Rekonstrüksiyon Analizi`, ML, PH - 12);
    doc.setFont(FONT_NAME, 'bold');
    doc.text(`Sayfa ${p} / ${total}`, PW - MR, PH - 12, { align: 'right' });
    doc.setFont(FONT_NAME, 'normal');
    doc.setFontSize(6.3);
    doc.text(
      'Bu rapor bilimsel yöntemlere dayalı bilirkişi görüşü niteliğindedir; nihai kanaat, dosyanın bütüncül delilleri ile birlikte değerlendirilmelidir.',
      ML,
      PH - 8.5,
    );
  }

  const blob = doc.output('blob');
  return { fileName: `Bilirkisi_Analiz_Raporu_${asciiSafe(meta.dosyaNo)}.pdf`, blob };
}

/** PDF'i üretip tarayıcı indirmesini tetikler. */
export async function downloadForensicPdf(report: ForensicReport): Promise<string> {
  const { fileName, blob } = await buildForensicPdf(report);
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 4000);
  return fileName;
}
