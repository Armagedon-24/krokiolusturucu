/**
 * PNG→WebP dönüşümü yapılan varlıklar (npm run assets:optimize üretir).
 * Eski kayıtlı projelerdeki .png yolları bu küme ile .webp sürümüne taşınır.
 */
export const LEGACY_PNG_TO_WEBP: ReadonlySet<string> = new Set([
  '/assets/kurum_logo_filigran_kontur.webp',
  '/assets/symbols/ak47.webp',
  '/assets/symbols/animals/bear.webp',
  '/assets/symbols/animals/cat.webp',
  '/assets/symbols/animals/chicken.webp',
  '/assets/symbols/animals/cow.webp',
  '/assets/symbols/animals/dog.webp',
  '/assets/symbols/animals/donkey.webp',
  '/assets/symbols/animals/duck.webp',
  '/assets/symbols/animals/fox.webp',
  '/assets/symbols/animals/horse.webp',
  '/assets/symbols/animals/pig.webp',
  '/assets/symbols/animals/rabbit.webp',
  '/assets/symbols/animals/sheep.webp',
  '/assets/symbols/animals/snake.webp',
  '/assets/symbols/animals/wolf.webp',
  '/assets/symbols/bat.webp',
  '/assets/symbols/blood_pool_realistic.webp',
  '/assets/symbols/blood_smear_realistic.webp',
  '/assets/symbols/blood_splatter_realistic.webp',
  '/assets/symbols/broken_wall_realistic.webp',
  '/assets/symbols/bullet_hole.webp',
  '/assets/symbols/bullet_hole_2.webp',
  '/assets/symbols/clothing/cl_wallet.webp',
  '/assets/symbols/crater_realistic.webp',
  '/assets/symbols/debris_pile_realistic.webp',
  '/assets/symbols/evidence/ei_body_bag.webp',
  '/assets/symbols/evidence/ei_bottle.webp',
  '/assets/symbols/evidence/ei_brick.webp',
  '/assets/symbols/evidence/ei_cigarette.webp',
  '/assets/symbols/evidence/ei_crowbar.webp',
  '/assets/symbols/evidence/ei_drug_bag.webp',
  '/assets/symbols/evidence/ei_evidence_bag.webp',
  '/assets/symbols/evidence/ei_hammer.webp',
  '/assets/symbols/evidence/ei_lock_broken.webp',
  '/assets/symbols/evidence/ei_syringe.webp',
  '/assets/symbols/evidence/scale_bar.webp',
  '/assets/symbols/explosion_blast_realistic.webp',
  '/assets/symbols/figures/p_child_lying.webp',
  '/assets/symbols/figures/p_crouch.webp',
  '/assets/symbols/figures/p_injured.webp',
  '/assets/symbols/figures/p_lateral.webp',
  '/assets/symbols/figures/p_officer.webp',
  '/assets/symbols/figures/p_run.webp',
  '/assets/symbols/fire_realistic.webp',
  '/assets/symbols/hanged_body_realistic.webp',
  '/assets/symbols/hanged_man_rope.webp',
  '/assets/symbols/in_burn.webp',
  '/assets/symbols/karakalem/column_square.webp',
  '/assets/symbols/karakalem/fingerprint_realistic.webp',
  '/assets/symbols/karakalem/garden_wall.webp',
  '/assets/symbols/karakalem/inline/arch-w1vi.webp',
  '/assets/symbols/karakalem/parapet.webp',
  '/assets/symbols/karakalem/rect_solid.webp',
  '/assets/symbols/karakalem/roads/st_parking_lot.webp',
  '/assets/symbols/karakalem/shutter.webp',
  '/assets/symbols/karakalem/ts_one_way.webp',
  '/assets/symbols/karakalem/wall_opening.webp',
  '/assets/symbols/knife.webp',
  '/assets/symbols/out_bus_stop.webp',
  '/assets/symbols/out_cctv.webp',
  '/assets/symbols/out_container.webp',
  '/assets/symbols/out_field.webp',
  '/assets/symbols/out_pool.webp',
  '/assets/symbols/out_ramp.webp',
  '/assets/symbols/out_street_light.webp',
  '/assets/symbols/pistol.webp',
  '/assets/symbols/rifle.webp',
  '/assets/symbols/roads/st_crossroad.webp',
  '/assets/symbols/roads/st_median.webp',
  '/assets/symbols/roads/st_parking_lot.webp',
  '/assets/symbols/roads/ust_gecit.webp',
  '/assets/symbols/rope.webp',
  '/assets/symbols/shattered_glass_realistic.webp',
  '/assets/symbols/shotgun.webp',
  '/assets/symbols/shotgun_shell.webp',
  '/assets/symbols/smoke_realistic.webp',
  '/assets/symbols/three_seater_sofa.webp',
  '/assets/symbols/tire_track_realistic.webp',
  '/assets/symbols/tr_magazine.webp',
  '/assets/symbols/ts_crossroads.webp',
  '/assets/symbols/ts_curve.webp',
  '/assets/symbols/ts_no_parking.webp',
  '/assets/symbols/ts_no_turn.webp',
  '/assets/symbols/ts_one_way.webp',
  '/assets/symbols/ts_pedestrian.webp',
  '/assets/symbols/ts_slippery.webp',
  '/assets/symbols/ts_speed.webp',
  '/assets/symbols/ts_speed_110.webp',
  '/assets/symbols/ts_speed_30.webp',
  '/assets/symbols/ts_speed_70.webp',
  '/assets/symbols/ts_speed_90.webp',
  '/assets/symbols/vehicles/v_burned.webp',
  '/assets/symbols/wall.webp',
  '/assets/symbols/wall_horizontal.webp',
  '/assets/symbols/wall_vertical.webp',
  '/assets/symbols/window.webp',
  '/assets/symbols/clothing/cl_vest.webp',
]);

/** Varlık yolunu eski .png sürümünden .webp sürümüne taşır (kümede yoksa olduğu gibi döner). */
export function migrateLegacyAssetUrl(url: unknown): string {
  if (typeof url !== 'string' || !url.startsWith('/assets/') || !url.toLowerCase().endsWith('.png')) return url as string;
  const dot = url.lastIndexOf('.');
  const candidate = url.slice(0, dot) + '.webp';
  return LEGACY_PNG_TO_WEBP.has(candidate) ? candidate : url;
}

/** Genel kaynak yolu: deploy köküne göre tam yol üretir.
 *  '/assets/...' → '/krokiolusturucu/assets/...' (GitHub Pages) veya '/assets/...' (kök dağıtım).
 *  Veri (/assets/...) her zaman öneklenmemiş saklanır; yalnızca tüketim anında öneklendir. */
export function withBase(url: unknown): string {
  if (typeof url !== 'string' || !url || url.startsWith('data:') || url.startsWith('blob:')) return (typeof url === 'string' ? url : '') as string;
  if (/^(https?:)?\/\//i.test(url) || !url.startsWith('/')) return url;
  const base = import.meta.env.BASE_URL || '/';
  return base.replace(/\/$/, '') + url;
}
