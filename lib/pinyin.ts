import { pinyin } from "pinyin-pro";

/**
 * 获取文本的完整拼音（不带声调）
 */
export function getFullPinyin(text: string): string {
  return pinyin(text, { toneType: "none", type: "array" }).join("");
}

/**
 * 获取文本的拼音首字母
 */
export function getPinyinInitials(text: string): string {
  return pinyin(text, { pattern: "first", toneType: "none", type: "array" }).join("");
}

/**
 * 检查查询是否匹配文本（支持中文、拼音全拼、拼音首字母）
 */
export function matchPinyin(text: string, query: string): boolean {
  const lowerQuery = query.toLowerCase();
  const lowerText = text.toLowerCase();

  // 直接匹配
  if (lowerText.includes(lowerQuery)) return true;

  // 拼音全拼匹配
  const fullPinyin = getFullPinyin(text);
  if (fullPinyin.includes(lowerQuery)) return true;

  // 拼音首字母匹配
  const initials = getPinyinInitials(text);
  if (initials.includes(lowerQuery)) return true;

  return false;
}
