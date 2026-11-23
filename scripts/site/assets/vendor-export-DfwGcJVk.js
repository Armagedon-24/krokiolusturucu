// TEST SAHTESi — yalnızca yerel E2E doğrulama için (dağıtıma sokulmaz!)
// Gerçek vendor-export-DfwGcJVk.js yerine geçer; jsPDF arayüzünü taklit eder
// ve sayfa görsellerini window.__pdfPages'e kaydeder.
class FakeJsPDF {
  constructor(opts) {
    this.__pages = [[]];
    this.__cur = this.__pages[0];
    this.__opts = opts || {};
    if (typeof window !== 'undefined') {
      window.__pdfOpts = this.__opts;
      window.__pdfPages = this.__pages;
    }
  }
  addImage(data, fmt, x, y, w, h) { this.__cur.push({ data, fmt, x, y, w, h }); }
  addPage(sz, orient) { this.__cur = []; this.__pages.push(this.__cur); if (sz) this.__lastSize = sz; }
  getNumberOfPages() { return this.__pages.length; }
  setPage(n) { this.__cur = this.__pages[Math.max(0, n - 1)] || this.__cur; }
  setFillColor() {} setDrawColor() {} setTextColor() {} setFontSize() {} setFont() {}
  text() {} textWithLink() {} rect() {} link() {}
  save(name) { if (typeof window !== 'undefined') window.__pdfSaved = name; }
  output(type) {
    if (typeof window !== 'undefined') window.__pdfOutputType = type;
    return new Blob(['%PDF-FAKE'], { type: 'application/pdf' });
  }
  internal = { scaleFactor: 1 };
}

const t = { jsPDF: FakeJsPDF };
export { t };
