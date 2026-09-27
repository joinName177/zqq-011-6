/**
 * 统一日期来源（单一事实源）。
 *
 * 系统内所有“某一天”一律使用本地日历日 `YYYY-MM-DD`：
 * - 禁止 `Date#toISOString()`：它基于 UTC，午夜前后 / 跨时区会把记录推到前一天；
 * - 禁止 `±86400000` 毫秒做日期加减：夏令时切换当天并非 24 小时，会错位或重复；
 * - 非法日期一律经 `normalizeDateKey` 回退，不允许 NaN 时间戳进入排序与趋势计算。
 */

const DATE_KEY_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/;
const DAY_MS = 86400000;

/** 严格校验 YYYY-MM-DD，且必须是真实存在的日历日（拒绝 2026-02-30 之类）。 */
export function isValidDateKey(key: unknown): key is string {
  if (typeof key !== 'string') return false;
  const match = DATE_KEY_PATTERN.exec(key.trim());
  if (!match) return false;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  if (month < 1 || month > 12 || day < 1 || day > 31) return false;
  // 回读校验：非法日历日会被 Date 自动进位（如 02-30 → 03-02），借此识别
  const probe = new Date(year, month - 1, day);
  return probe.getFullYear() === year && probe.getMonth() === month - 1 && probe.getDate() === day;
}

/** 用本地年月日格式化，避免 toISOString 的 UTC 偏移。 */
export function formatLocalDateKey(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/** 全系统唯一的“今天”来源（本地日历日）。 */
export function todayDateKey(now: Date = new Date()): string {
  return formatLocalDateKey(now);
}

/** 非法日期回退：无法识别的输入统一回退到本地今天（或指定回退值）。 */
export function normalizeDateKey(key: unknown, fallback: string = todayDateKey()): string {
  return isValidDateKey(key) ? key.trim() : fallback;
}

/** 解析为本地午夜的 Date；非法日期返回 null 而不是 NaN。 */
export function parseDateKey(key: unknown): Date | null {
  if (!isValidDateKey(key)) return null;
  const [year, month, day] = key.trim().split('-').map(Number);
  return new Date(year, month - 1, day);
}

/** 安全比较器：非法日期稳定置前（视为最旧，不抢占“当前记录”），排序可复现，绝不产生 NaN。 */
export function compareDateKeys(a: unknown, b: unknown): number {
  const dateA = parseDateKey(a);
  const dateB = parseDateKey(b);
  if (dateA && dateB) return dateA.getTime() - dateB.getTime();
  if (dateA) return 1;
  if (dateB) return -1;
  return 0;
}

/** 日历日加减：走本地日历推算，跨夏令时仍落在正确的某一天。 */
export function addDaysToDateKey(key: string, deltaDays: number): string {
  const base = parseDateKey(key) ?? new Date();
  const next = new Date(base.getFullYear(), base.getMonth(), base.getDate() + deltaDays);
  return formatLocalDateKey(next);
}

/** 两个日历日相差的整天数；Math.round 吸收夏令时 23/25 小时那一天的误差。 */
export function diffDateKeysDays(later: unknown, earlier: unknown): number {
  const dateLater = parseDateKey(later);
  const dateEarlier = parseDateKey(earlier);
  if (!dateLater || !dateEarlier) return 0;
  return Math.round((dateLater.getTime() - dateEarlier.getTime()) / DAY_MS);
}

/** 界面展示用短标签（MM-DD）；非法日期给占位符而不是乱码切片。 */
export function formatDateKeyLabel(key: unknown): string {
  return isValidDateKey(key) ? key.trim().slice(5) : '--/--';
}
