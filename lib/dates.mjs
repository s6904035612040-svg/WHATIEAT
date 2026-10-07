// ใช้เวลาไทย (UTC+7) เสมอ เพื่อให้วันหมดอายุตรงกับที่ผู้ใช้เห็น
const BKK_OFFSET_MS = 7 * 60 * 60 * 1000;

export function todayBangkok() {
  return new Date(Date.now() + BKK_OFFSET_MS).toISOString().slice(0, 10);
}

export function addDays(dateStr, days) {
  const d = new Date(`${dateStr}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + Math.round(Number(days) || 0));
  return d.toISOString().slice(0, 10);
}

export function daysBetween(fromStr, toStr) {
  const a = new Date(`${fromStr}T00:00:00Z`).getTime();
  const b = new Date(`${toStr}T00:00:00Z`).getTime();
  return Math.round((b - a) / 86400000);
}
