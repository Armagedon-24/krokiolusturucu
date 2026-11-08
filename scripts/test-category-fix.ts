/**
 * Kategori kayması düzeltmesi — mantık testleri (gerçek store kodu üzerinde).
 * Node'da çalıştırılır: esbuild ile bundle edilip çalıştırılır.
 */
import { useStore } from '../src/store/useStore';

// --- test yardımcıları -------------------------------------------------------
let pass = 0, fail = 0;
const check = (name: string, cond: boolean, extra?: any) => {
  if (cond) { pass++; console.log('  ✓ ' + name); }
  else { fail++; console.log('  ✗ ' + name, extra !== undefined ? JSON.stringify(extra) : ''); }
};

const reset = () => {
  useStore.setState({
    allSymbols: JSON.parse(JSON.stringify(DEFAULT_CATS)) as any,
    uploadedImages: [],
    symbolPlacements: { savedAt: 0, cats: {} },
    _placementsSavedAt: 0,
    allSymbolsSyncedAt: 0,
    cloudRevAt: 0,
    adminSettings: {},
    scenes: [],
    archiveScenes: [],
    objects: [],
    backgroundImage: null,
    activeSceneId: null,
    projectInfo: useStore.getState().projectInfo,
    visualSettings: useStore.getState().visualSettings,
  } as any);
};

// Varsayılan kategori haritası — reset için baştan yakalanır
const DEFAULT_CATS = JSON.parse(JSON.stringify(useStore.getState().allSymbols));

// Hazır sembol kimlikleri (ilk iki kategoriden ilk semboller)
const cats = () => useStore.getState().allSymbols as any[];
const firstCatId = () => cats()[0].id;
const secondCatId = () => cats()[1].id;
const firstSymId = () => cats()[0].symbols[0].id;

// 1) AÇILIŞ: kalıcı yerleşim haritası temel alınmalı (trustLocalPlacements)
console.log('TEST 1: Açılışta kalıcı yerleşim haritası korunur');
{
  reset();
  const sid = firstSymId();
  const from = firstCatId(), to = secondCatId();
  // Kullanıcı sembolü taşıdı, senkron BAŞARISIZ oldu → savedAt > syncedAt senaryosu
  useStore.setState({
    symbolPlacements: { savedAt: 5000, cats: { [from]: [], [to]: [sid] } },
    _placementsSavedAt: 5000,
    allSymbolsSyncedAt: 4000, // son başarılı senkron taşımadan önce
  } as any);
  useStore.getState().refreshSymbols({ trustLocalPlacements: true });
  const catAfter = cats().find((c: any) => c.symbols.some((s: any) => s.id === sid));
  check('sembol adminin atadığı kategoride', catAfter?.id === to, { found: catAfter?.id, expected: to });

  // syncedAt > savedAt olsa bile trust bayrağı yerleşimi temel almalı (açılış durumu)
  reset();
  useStore.setState({
    symbolPlacements: { savedAt: 1000, cats: { [from]: [], [to]: [sid] } },
    _placementsSavedAt: 1000,
    allSymbolsSyncedAt: 2000, // başarılı senkron sonrası — eski kod varsayılanlara dönerdi
  } as any);
  useStore.getState().refreshSymbols({ trustLocalPlacements: true });
  const catAfter2 = cats().find((c: any) => c.symbols.some((s: any) => s.id === sid));
  check('syncedAt daha taze olsa bile açılışta kalıcı düzen temel alınır', catAfter2?.id === to, { found: catAfter2?.id });
}

// 2) RESTORE BAYATLIK: _revAt küçükse kopya reddedilir
console.log('TEST 2: Bayat bulut kopyası reddedilir (yerel düzen korunur)');
{
  reset();
  const sid = firstSymId();
  const from = firstCatId(), to = secondCatId();
  // Senaryo: son başarılı YÜKLE sunucu saatinde 11000'de yapıldı (cloudRevAt=11000).
  // Kullanıcı 12000'de sembolü taşıdı ama senkron BAŞARISIZ oldu. CDN ise daha da
  // eski bir kopyayı (_revAt=8000) servis ediyor → kopya reddedilmeli.
  useStore.setState({
    symbolPlacements: { savedAt: 12000, cats: { [from]: [], [to]: [sid] } },
    _placementsSavedAt: 12000,
    allSymbolsSyncedAt: 11000,
    cloudRevAt: 11000,
  } as any);
  // Açılış normalizasyonu (App.tsx'in yaptığı gibi)
  useStore.getState().refreshSymbols({ trustLocalPlacements: true });
  // CDN bayat kopya: sembol eski kategorisinde, _revAt eski yazım
  (global as any).__mockCloudData = {
    _revAt: 8000,
    timestamp: 8000,
    uploadedImages: [],
    allSymbols: cats().map((c: any) => ({
      ...c,
      symbols: c.id === from ? [{ ...c.symbols[0] }] : c.symbols.filter((s: any) => s.id !== sid),
    })),
  };
  const ok = await useStore.getState().restoreFromCloud(true);
  check('bayat kopya reddedildi (false)', ok === false);
  const catNow = cats().find((c: any) => c.symbols.some((s: any) => s.id === sid));
  check('yerel düzen değişmedi', catNow?.id === to, { found: catNow?.id });
}

// 3) RESTORE TAZE: yerel yerleşim daha tazeyse yüklenen görselin kategorisi korunur
console.log('TEST 3: Yerel taze → yüklenen görselin kategorisi korunur');
{
  reset();
  const img = { id: 'img-1', src: 'https://res.cloudinary.com/dzen3qvgp/image/upload/v1/kroki-olusturucu/vehicles/test.png', name: 'test', category: secondCatId() };
  // Yerelde görsel 'vehicles' kategorisine taşındı; senkron başarısız
  useStore.setState({
    uploadedImages: [img],
    symbolPlacements: { savedAt: 9000, cats: {} },
    _placementsSavedAt: 9000,
    allSymbolsSyncedAt: 4000,
    cloudRevAt: 4000,
  } as any);
  (global as any).__mockCloudData = {
    _revAt: 4000, timestamp: 4000,
    // Bulutta görsel hâlâ eski kategorisinde (ilk kategori)
    uploadedImages: [{ ...img, category: firstCatId() }],
    allSymbols: cats(),
  };
  const ok = await useStore.getState().restoreFromCloud(true);
  check('taze kopya uygulandı', ok === true);
  const now = useStore.getState().uploadedImages.find((i: any) => i.id === 'img-1');
  check('yerel kategori korundu (taşıma senkronlanamamış)', now?.category === secondCatId(), { found: now?.category });
}

// 4) RESTORE TAZE + bulut daha taze: bulut kategorisi kazanır
console.log('TEST 4: Bulut taze → bulut kategorisi kazanır (başka cihaz düzenlemesi)');
{
  reset();
  const img = { id: 'img-1', src: 'https://res.cloudinary.com/dzen3qvgp/image/upload/v1/kroki-olusturucu/vehicles/test.png', name: 'test', category: firstCatId() };
  useStore.setState({
    uploadedImages: [img],
    symbolPlacements: { savedAt: 1000, cats: {} },
    _placementsSavedAt: 1000,
    allSymbolsSyncedAt: 1000,
    cloudRevAt: 1000,
  } as any);
  (global as any).__mockCloudData = {
    _revAt: 9000, timestamp: 9000,
    uploadedImages: [{ ...img, category: secondCatId() }],
    allSymbols: cats(),
  };
  const ok = await useStore.getState().restoreFromCloud(true);
  const now = useStore.getState().uploadedImages.find((i: any) => i.id === 'img-1');
  check('bulut kategorisi uygulandı', ok === true && now?.category === secondCatId(), { found: now?.category, ok });
  check('cloudRevAt bulut damgasına çekildi', (useStore.getState() as any).cloudRevAt === 9000);
}

// 5) SİLME: mezarlıktaki görsel buluttan geri gelmez
console.log('TEST 5: Silinen görsel bulut İNDİR ile geri gelmez');
{
  reset();
  const img = { id: 'img-del', src: 'https://res.cloudinary.com/dzen3qvgp/image/upload/v1/kroki-olusturucu/vehicles/silinen.png', name: 'silinen', category: firstCatId() };
  useStore.setState({
    uploadedImages: [],
    adminSettings: { deletedAssetIds: ['img-del', 'kroki-olusturucu/vehicles/silinen'] },
    symbolPlacements: { savedAt: 1000, cats: {} },
    _placementsSavedAt: 1000,
    allSymbolsSyncedAt: 1000,
    cloudRevAt: 1000,
  } as any);
  (global as any).__mockCloudData = {
    _revAt: 9000, timestamp: 9000,
    uploadedImages: [img], // bulutta hâlâ var (başka cihaz senkronu bayat)
    allSymbols: cats(),
  };
  await useStore.getState().restoreFromCloud(true);
  check('silinen görsel geri gelmedi', !useStore.getState().uploadedImages.some((i: any) => i.id === 'img-del'));
}

// 6) SİLME: hiddenSymbolIds'teki hazır sembol hardcoded birleşmeden geri gelmez
console.log('TEST 6: Silinen hazır sembol geri gelmez');
{
  reset();
  const sid = firstSymId();
  useStore.setState({
    adminSettings: { hiddenSymbolIds: [sid] },
    symbolPlacements: { savedAt: 1000, cats: {} },
    _placementsSavedAt: 1000,
    allSymbolsSyncedAt: 1000,
    cloudRevAt: 1000,
  } as any);
  useStore.getState().refreshSymbols();
  check('silinen hazır sembol kütüphanede yok', !cats().some((c: any) => c.symbols.some((s: any) => s.id === sid)));
}

// 7) updateUploadedImage kategori taşıması tazelik damgasını yükseltir
console.log('TEST 7: Kategori taşıması yerleşim tazeliğini yükseltir');
{
  reset();
  const img = { id: 'img-1', src: 'https://example.com/x.png', name: 'x', category: 'uncategorized' };
  useStore.setState({
    uploadedImages: [img],
    isAdmin: true,
    adminPassword: 't',
    symbolPlacements: { savedAt: 1000, cats: {} },
    _placementsSavedAt: 1000,
    allSymbolsSyncedAt: 2000,
  } as any);
  useStore.getState().updateUploadedImage('img-1', secondCatId());
  const st: any = useStore.getState();
  check('_placementsSavedAt yükseldi', st._placementsSavedAt > 2000, { now: st._placementsSavedAt });
  check('kategori güncellendi', st.uploadedImages[0].category === secondCatId());
}

console.log(`\nSONUÇ: ${pass} başarılı, ${fail} başarısız`);
process.exit(fail > 0 ? 1 : 0);
