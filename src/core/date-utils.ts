/**
 * 全系统唯一的日历日期来源（领域层统一基准）。
 *
 * 约定：
 * - 持久化与比较一律使用本地日历日字符串 `YYYY-MM-DD`（用户所在时区的那一天）。
 * - 禁止再使用 `toISOString()` 取日期：它返回 UTC 日，在午夜前后 / 跨时区会错位一天。
 * - 禁止用毫秒差（`ms - n * 86400000`）推算若干天前：夏令时切换日只有 23/25 小时。
 * - 所有进入系统的日期都必须经过 normalizeDate：非法日期统一回退到今天，
 *   避免脏数据产生 NaN 时间戳，污染排序与近 7 日历史趋势计算。
 */

const ISO_DATE_RE = /^(\d{4})-(\d{2})-(\d{2})$/;

/** 将任意 Date 格式化为本地日历日字符串 YYYY-MM-DD（按 UTC 槽位拼装，不做时区转换）。 */
export function formatLocalDate(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/** 全系统统一的“今天”：始终是用户本地日历日。 */
export function todayKey(): string {
  return formatLocalDate(new Date());
}

/** 严格判断是否为真实存在的 YYYY-MM-DD 日历日（拒绝 2026-02-31 之类）。 */
export function isValidDateKey(value: unknown): value is string {
  if (typeof value !== 'string') return false;
  const match = ISO_DATE_RE.exec(value);
  if (!match) return false;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  if (month < 1 || month > 12 || day < 1 || day > 31) return false;
  const probe = new Date(year, month - 1, day);
  return probe.getFullYear() === year && probe.getMonth() === month - 1 && probe.getDate() === day;
}

/**
 * 非法日期统一回退：合法则原样返回（归一为 YYYY-MM-DD），
 * 非法（缺失、格式错误、2 月 31 日、脏存储等）一律回退到今天。
 */
export function normalizeDate(value: unknown): string {
  return isValidDateKey(value) ? value : todayKey();
}

/**
 * 把 YYYY-MM-DD 解析为可安全比较的本地日历日整数。
 * 非法输入按回退到今天处理，保证不会产生 NaN。
 * 返回值为 `年*10000 + 月*100 + 日`，可直接做大小比较与差值计算。
 */
export function dayOrdinal(value: unknown): number {
  const key = normalizeDate(value);
  const [, year, month, day] = ISO_DATE_RE.exec(key) as RegExpExecArray;
  return Number(year) * 10000 + Number(month) * 100 + Number(day);
}

/** 日历日比较：a 早于/等于/晚于 b 分别返回 -1/0/1。非法日期先回退再比较。 */
export function compareDate(a: unknown, b: unknown): number {
  const diff = dayOrdinal(a) - dayOrdinal(b);
  return diff < 0 ? -1 : diff > 0 ? 1 : 0;
}

/**
 * 计算从今天起往前 offset 个本地日历日的日期（offset=0 即今天）。
 * 通过本地年月日字段推进，DST 切换、时区与月份长度都不会错天。
 */
export function daysAgoKey(offset: number, from: Date = new Date()): string {
  const target = new Date(from.getFullYear(), from.getMonth(), from.getDate() - offset);
  return formatLocalDate(target);
}

/** 面向界面展示的中文日期，与记录日期使用同一本地日历日来源。 */
export function formatDisplayDate(date: Date = new Date()): string {
  return `${date.getFullYear()}年${date.getMonth() + 1}月${date.getDate()}日`;
}
