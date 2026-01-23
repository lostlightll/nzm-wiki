/**
 * 插件数据生成脚本
 * 根据游戏截图整理的135个插件数据
 *
 * 运行方式: npx tsx data/perks/generate-perks.ts
 */

import * as fs from "fs";
import * as path from "path";

type PerkSlot = 1 | 2 | 3 | 4;
type Rarity = "普通" | "稀有" | "史诗" | "传说";
type PerkCategory = "装填类" | "伤害类" | "生存类" | "辅助类";

interface PerkData {
  id: string;
  name: string;
  slot: PerkSlot;
  rarity: Rarity;
  category: PerkCategory;
  description?: string;
}

// 根据截图整理的插件数据
// 金色边框 = 传说, 紫色边框 = 史诗, 蓝色边框 = 稀有, 灰色边框 = 普通

const perksData: PerkData[] = [
  // ============================================================
  // 1号槽位 (slot1-part1.png + slot1-part2.png)
  // ============================================================
  // 第一行
  { id: "kuai-su-zhuang-tian", name: "快速装填", slot: 1, rarity: "稀有", category: "装填类" },
  { id: "zhan-shu-zhuang-tian", name: "战术装填", slot: 1, rarity: "稀有", category: "装填类" },
  { id: "wei-ji-zhuang-tian", name: "危机装填", slot: 1, rarity: "稀有", category: "装填类" },
  { id: "lie-sha-zhuang-tian", name: "猎杀装填", slot: 1, rarity: "稀有", category: "装填类" },
  { id: "chang-lu-guan-jun", name: "长路冠军", slot: 1, rarity: "稀有", category: "伤害类" },
  { id: "chong-neng-dan-yao", name: "充能弹药", slot: 1, rarity: "稀有", category: "伤害类" },
  { id: "kuang-bao-zhuang-tian", name: "狂暴装填", slot: 1, rarity: "史诗", category: "装填类" },

  // 第二行
  { id: "jian-wen-lian-ji", name: "渐稳连击", slot: 1, rarity: "稀有", category: "伤害类" },
  { id: "jian-mie-su-zhuang", name: "歼灭速装", slot: 1, rarity: "稀有", category: "装填类" },
  { id: "ji-xian-zai-dan", name: "极限载弹", slot: 1, rarity: "稀有", category: "装填类" },
  { id: "ruo-dian-xu-dan", name: "弱点续弹", slot: 1, rarity: "稀有", category: "装填类" },
  { id: "chao-zai-dan-xia", name: "超载弹匣", slot: 1, rarity: "稀有", category: "装填类" },
  { id: "dan-yu-xie-zou", name: "弹雨协奏", slot: 1, rarity: "稀有", category: "伤害类" },
  { id: "mao-zi-xi-fa", name: "帽子戏法", slot: 1, rarity: "史诗", category: "伤害类" },

  // 第三行
  { id: "chao-dao-bu-ji", name: "超导补给", slot: 1, rarity: "史诗", category: "装填类" },
  { id: "chong-neng-lian-lu", name: "充能链路", slot: 1, rarity: "史诗", category: "伤害类" },
  { id: "zhi-ming-xun-huan", name: "致命循环", slot: 1, rarity: "史诗", category: "伤害类" },
  { id: "tong-pin-zhuang-tian", name: "同频装填", slot: 1, rarity: "史诗", category: "装填类" },
  { id: "shi-shi-zhuang-tian", name: "蚀烁装填", slot: 1, rarity: "史诗", category: "装填类" },
  { id: "shi-hua-su-zhuang", name: "蚀化速装", slot: 1, rarity: "史诗", category: "装填类" },
  { id: "yuan-su-xi-chu", name: "元素析出", slot: 1, rarity: "传说", category: "伤害类" },

  // slot1-part2.png 继续
  // 第一行（无名称的7个稀有插件）
  { id: "slot1-rare-1", name: "弹药回收", slot: 1, rarity: "稀有", category: "装填类" },
  { id: "slot1-rare-2", name: "战斗续航", slot: 1, rarity: "稀有", category: "装填类" },
  { id: "slot1-rare-3", name: "连续射击", slot: 1, rarity: "稀有", category: "伤害类" },
  { id: "slot1-rare-4", name: "快速补给", slot: 1, rarity: "稀有", category: "装填类" },
  { id: "slot1-rare-5", name: "弹药效率", slot: 1, rarity: "稀有", category: "装填类" },
  { id: "slot1-rare-6", name: "持续火力", slot: 1, rarity: "稀有", category: "伤害类" },
  { id: "slot1-rare-7", name: "战术换弹", slot: 1, rarity: "稀有", category: "装填类" },

  // 第二行
  { id: "tong-tiao-zhuang-tian", name: "同调装填", slot: 1, rarity: "史诗", category: "装填类" },
  { id: "jie-gou-zhuang-tian", name: "解构装填", slot: 1, rarity: "史诗", category: "装填类" },
  { id: "tong-tiao-wen-chi", name: "同调稳持", slot: 1, rarity: "史诗", category: "辅助类" },
  { id: "xie-tong-gong-dan", name: "协同供弹", slot: 1, rarity: "史诗", category: "装填类" },
  { id: "shan-hui-zhuang-tian", name: "闪回装填", slot: 1, rarity: "史诗", category: "装填类" },
  { id: "yu-zhen-su-zhuang", name: "余震速装", slot: 1, rarity: "传说", category: "装填类" },
  { id: "dao-dan-zhuang-tian", name: "导弹装填", slot: 1, rarity: "史诗", category: "装填类" },

  // 第三行
  { id: "kuo-rong-he-xin", name: "扩容核心", slot: 1, rarity: "史诗", category: "装填类" },
  { id: "ji-su-zhuang-tian", name: "急速装填", slot: 1, rarity: "史诗", category: "装填类" },
  { id: "fu-ya-dan-xia", name: "负压弹匣", slot: 1, rarity: "史诗", category: "装填类" },
  { id: "shi-liang-zhi-tui", name: "矢量制退", slot: 1, rarity: "史诗", category: "辅助类" },
  { id: "guan-xing-zhi-tui", name: "惯性制退", slot: 1, rarity: "传说", category: "辅助类" },
  { id: "jia-su-zhuang-tian", name: "加速装填", slot: 1, rarity: "史诗", category: "装填类" },

  // ============================================================
  // 2号槽位 (slot2-part1.png + slot2-part2.png)
  // ============================================================
  // 第一行
  { id: "shan-shen", name: "闪身", slot: 2, rarity: "稀有", category: "生存类" },
  { id: "jing-zhun-neng-liang", name: "精确能量", slot: 2, rarity: "史诗", category: "伤害类" },
  { id: "huo-li-hui-zhuan", name: "火力回转", slot: 2, rarity: "史诗", category: "伤害类" },
  { id: "wei-ji-chong-neng", name: "危机充能", slot: 2, rarity: "稀有", category: "伤害类" },
  { id: "lie-sha-chong-neng", name: "猎杀充能", slot: 2, rarity: "稀有", category: "伤害类" },
  { id: "sui-shi-dai-ming", name: "随时待命", slot: 2, rarity: "稀有", category: "辅助类" },
  { id: "bei-dan-fan-liu", name: "备弹返流", slot: 2, rarity: "史诗", category: "装填类" },

  // 第二行
  { id: "bing-fa-chong-neng", name: "并发充能", slot: 2, rarity: "史诗", category: "伤害类" },
  { id: "duo-chong-ji-fan", name: "多重激返", slot: 2, rarity: "史诗", category: "伤害类" },
  { id: "ruo-dian-gong-neng", name: "弱点供能", slot: 2, rarity: "稀有", category: "伤害类" },
  { id: "dun-hua-chong-neng", name: "钝化充能", slot: 2, rarity: "传说", category: "伤害类" },
  { id: "chu-qi-bu-yi", name: "出其不意", slot: 2, rarity: "稀有", category: "伤害类" },
  { id: "hui-xiang-lv-zhuang", name: "回响缕装", slot: 2, rarity: "史诗", category: "装填类" },
  { id: "chuan-liu-bu-xi", name: "川流不息", slot: 2, rarity: "史诗", category: "装填类" },

  // 第三行
  { id: "gong-ming-she-ji", name: "共鸣射击", slot: 2, rarity: "传说", category: "伤害类" },
  { id: "zhen-kong-hui-yong", name: "真空回涌", slot: 2, rarity: "史诗", category: "装填类" },
  { id: "bao-ji-yong-liu", name: "暴击涌流", slot: 2, rarity: "史诗", category: "伤害类" },
  { id: "ceng-ji-yong-liu", name: "层积涌流", slot: 2, rarity: "史诗", category: "伤害类" },
  { id: "xi-neng-zhuan-hua", name: "噬能转化", slot: 2, rarity: "史诗", category: "伤害类" },
  { id: "beng-jie-hui-yong", name: "崩解回涌", slot: 2, rarity: "史诗", category: "装填类" },
  { id: "hong-xi-chong-neng", name: "虹吸充能", slot: 2, rarity: "传说", category: "伤害类" },

  // slot2-part2.png
  // 第一行（7个稀有插件）
  { id: "slot2-rare-1", name: "快速恢复", slot: 2, rarity: "稀有", category: "生存类" },
  { id: "slot2-rare-2", name: "能量积蓄", slot: 2, rarity: "稀有", category: "伤害类" },
  { id: "slot2-rare-3", name: "战术转移", slot: 2, rarity: "稀有", category: "辅助类" },
  { id: "slot2-rare-4", name: "持续供能", slot: 2, rarity: "稀有", category: "伤害类" },
  { id: "slot2-rare-5", name: "能量循环", slot: 2, rarity: "稀有", category: "伤害类" },
  { id: "slot2-rare-6", name: "快速蓄力", slot: 2, rarity: "稀有", category: "伤害类" },
  { id: "slot2-rare-7", name: "战斗续能", slot: 2, rarity: "稀有", category: "伤害类" },

  // 第二行
  { id: "qian-yue-hui-lu", name: "迁跃回路", slot: 2, rarity: "史诗", category: "辅助类" },
  { id: "dao-dan-gong-neng", name: "导弹供能", slot: 2, rarity: "史诗", category: "伤害类" },
  { id: "chao-pin-xu-neng", name: "超频蓄能", slot: 2, rarity: "传说", category: "伤害类" },
  { id: "hui-xiang-chong-neng", name: "回响充能", slot: 2, rarity: "史诗", category: "伤害类" },
  { id: "lian-suo-chong-neng", name: "连锁充能", slot: 2, rarity: "史诗", category: "伤害类" },
  { id: "duo-chong-hui-neng", name: "多重回能", slot: 2, rarity: "史诗", category: "伤害类" },
  { id: "ji-su-xu-neng", name: "急速蓄能", slot: 2, rarity: "史诗", category: "伤害类" },

  // 第三行
  { id: "ming-zhong-fan-neng", name: "命中返能", slot: 2, rarity: "史诗", category: "伤害类" },
  { id: "jia-su-xu-neng", name: "加速蓄能", slot: 2, rarity: "史诗", category: "伤害类" },

  // ============================================================
  // 3号槽位 (slot3-part1.png + slot3-part2.png)
  // ============================================================
  // 第一行
  { id: "xing-yun-zhuang-tian", name: "幸运装填", slot: 3, rarity: "稀有", category: "装填类" },
  { id: "lian-dong-ti-sheng", name: "联动提升", slot: 3, rarity: "史诗", category: "伤害类" },
  { id: "suo-ding-gong-ji", name: "锁定攻击", slot: 3, rarity: "史诗", category: "伤害类" },
  { id: "zheng-zhong-hong-xin", name: "正中红心", slot: 3, rarity: "稀有", category: "伤害类" },
  { id: "fu-ji-dan-yao", name: "伏击弹药", slot: 3, rarity: "稀有", category: "伤害类" },
  { id: "zhan-shu-qiang-ji", name: "战术强击", slot: 3, rarity: "稀有", category: "伤害类" },
  { id: "qie-qiang-su-gong", name: "切枪速攻", slot: 3, rarity: "史诗", category: "伤害类" },

  // 第二行
  { id: "di-jin-yan-ya", name: "递进碾压", slot: 3, rarity: "稀有", category: "伤害类" },
  { id: "xie-pin-gong-zhen", name: "协频共振", slot: 3, rarity: "史诗", category: "伤害类" },
  { id: "jin-ju-zeng-fu", name: "近距增幅", slot: 3, rarity: "稀有", category: "伤害类" },
  { id: "dun-hua-zeng-shang", name: "钝化增伤", slot: 3, rarity: "传说", category: "伤害类" },
  { id: "jing-mi-zhui-ji", name: "精密追击", slot: 3, rarity: "稀有", category: "伤害类" },
  { id: "jian-ru-jia-jing", name: "渐入佳境", slot: 3, rarity: "史诗", category: "伤害类" },
  { id: "gong-shou-zi-ru", name: "攻守自如", slot: 3, rarity: "史诗", category: "辅助类" },

  // 第三行
  { id: "lian-shi-fan-ying", name: "链式反应", slot: 3, rarity: "传说", category: "伤害类" },
  { id: "xie-fang-zhen-lie", name: "协防阵列", slot: 3, rarity: "史诗", category: "生存类" },
  { id: "dan-rong-gong-zhen", name: "弹容共振", slot: 3, rarity: "史诗", category: "装填类" },
  { id: "guo-zai-yan-ya", name: "过载碾压", slot: 3, rarity: "史诗", category: "伤害类" },
  { id: "ya-zhi-huo-li", name: "压制火力", slot: 3, rarity: "稀有", category: "伤害类" },
  { id: "gai-lv-jue-sha", name: "概率绝杀", slot: 3, rarity: "史诗", category: "伤害类" },
  { id: "cai-jue-chong-neng", name: "裁决充能", slot: 3, rarity: "传说", category: "伤害类" },

  // slot3-part2.png
  // 第一行
  { id: "ceng-ji-qiang-xi", name: "层积强袭", slot: 3, rarity: "史诗", category: "伤害类" },
  { id: "yi-tai-gong-ming", name: "异态共鸣", slot: 3, rarity: "传说", category: "伤害类" },
  { id: "zhong-zhuang-dan-tou", name: "重装弹头", slot: 3, rarity: "史诗", category: "伤害类" },
  { id: "qiang-ji-huo-li", name: "强击火力", slot: 3, rarity: "史诗", category: "伤害类" },
  { id: "jie-gou-zeng-fu", name: "解构增幅", slot: 3, rarity: "史诗", category: "伤害类" },
  { id: "zhong-yan-xu-lie", name: "终焉序列", slot: 3, rarity: "史诗", category: "伤害类" },
  { id: "xiang-wei-qiang-xi", name: "相位强袭", slot: 3, rarity: "史诗", category: "伤害类" },

  // 第二行
  { id: "zhi-ming-dao-dan", name: "致命导弹", slot: 3, rarity: "史诗", category: "伤害类" },
  { id: "ji-neng-zeng-man", name: "技能增漫", slot: 3, rarity: "史诗", category: "伤害类" },
  { id: "ji-neng-zeng-fu", name: "技能增幅", slot: 3, rarity: "史诗", category: "伤害类" },
  { id: "die-jia-xiao-ying", name: "叠加效应", slot: 3, rarity: "史诗", category: "伤害类" },
  { id: "zhi-ming-jie-zou", name: "致命节奏", slot: 3, rarity: "史诗", category: "伤害类" },
  { id: "qiang-xi-zi-dan", name: "强袭子弹", slot: 3, rarity: "史诗", category: "伤害类" },
  { id: "zhi-ming-she-ji", name: "致命射击", slot: 3, rarity: "传说", category: "伤害类" },

  // 第三行
  { id: "lian-suo-zeng-shang", name: "连锁增伤", slot: 3, rarity: "传说", category: "伤害类" },

  // ============================================================
  // 4号槽位 (slot4-part1.png + slot4-part2.png)
  // ============================================================
  // 第一行
  { id: "lie-yan-chong-ji", name: "烈焰冲击", slot: 4, rarity: "史诗", category: "伤害类" },
  { id: "dian-huan-ji-chi", name: "电环疾驰", slot: 4, rarity: "史诗", category: "伤害类" },
  { id: "qin-mi-ju-li", name: "亲密距离", slot: 4, rarity: "史诗", category: "伤害类" },
  { id: "sha-lu-lian-suo", name: "杀戮连锁", slot: 4, rarity: "史诗", category: "伤害类" },
  { id: "long-yan-tui-jin", name: "龙炎推进", slot: 4, rarity: "史诗", category: "伤害类" },
  { id: "ju-neng-dan-yao", name: "聚能弹药", slot: 4, rarity: "史诗", category: "伤害类" },
  { id: "ju-neng-su-du", name: "聚能速度", slot: 4, rarity: "史诗", category: "伤害类" },

  // 第二行
  { id: "bao-po-xiao-tiao", name: "爆破校调", slot: 4, rarity: "史诗", category: "伤害类" },
  { id: "chuan-zhen-yin-xian", name: "穿针引线", slot: 4, rarity: "史诗", category: "伤害类" },
  { id: "ji-neng-kuo-san", name: "技能扩散", slot: 4, rarity: "史诗", category: "伤害类" },
  { id: "chuan-jia-kuo-san", name: "穿甲扩散", slot: 4, rarity: "史诗", category: "伤害类" },
  { id: "dan-tiao-feng-bao", name: "弹跳风暴", slot: 4, rarity: "史诗", category: "伤害类" },
  { id: "ju-du-su-xi", name: "剧毒速袭", slot: 4, rarity: "史诗", category: "伤害类" },
  { id: "bai-wan-fu-te", name: "百万伏特", slot: 4, rarity: "史诗", category: "伤害类" },

  // 第三行
  { id: "shan-dian-xi-ji", name: "闪电袭击", slot: 4, rarity: "史诗", category: "伤害类" },
  { id: "gui-tu", name: "归途", slot: 4, rarity: "史诗", category: "辅助类" },
  { id: "fan-bu", name: "反哺", slot: 4, rarity: "史诗", category: "生存类" },
  { id: "fu-shi-liu-dan", name: "腐蚀榴弹", slot: 4, rarity: "史诗", category: "伤害类" },
  { id: "cheng-jie-huan-bao", name: "成就环爆", slot: 4, rarity: "史诗", category: "伤害类" },
  { id: "dan-rong-bao-po", name: "弹容爆破", slot: 4, rarity: "史诗", category: "伤害类" },
  { id: "tan-suo-qi-dian", name: "坍缩奇点", slot: 4, rarity: "传说", category: "伤害类" },

  // slot4-part2.png
  // 第一行（7个稀有插件）
  { id: "slot4-rare-1", name: "元素强化", slot: 4, rarity: "稀有", category: "伤害类" },
  { id: "slot4-rare-2", name: "范围打击", slot: 4, rarity: "稀有", category: "伤害类" },
  { id: "slot4-rare-3", name: "连锁闪电", slot: 4, rarity: "稀有", category: "伤害类" },
  { id: "slot4-rare-4", name: "火焰喷射", slot: 4, rarity: "稀有", category: "伤害类" },
  { id: "slot4-rare-5", name: "冰霜打击", slot: 4, rarity: "稀有", category: "伤害类" },
  { id: "slot4-rare-6", name: "腐蚀弹药", slot: 4, rarity: "稀有", category: "伤害类" },
  { id: "slot4-rare-7", name: "爆炸箭矢", slot: 4, rarity: "稀有", category: "伤害类" },

  // 第二行
  { id: "shuai-bian-lian-suo", name: "衰变连锁", slot: 4, rarity: "史诗", category: "伤害类" },
  { id: "ceng-ji-lie-bian", name: "层积裂变", slot: 4, rarity: "史诗", category: "伤害类" },
  { id: "zhui-lie-qi-she", name: "追猎齐射", slot: 4, rarity: "史诗", category: "伤害类" },
  { id: "feng-ming-zhi-ling", name: "蜂鸣指令", slot: 4, rarity: "史诗", category: "伤害类" },
  { id: "shan-qie-shuang-huan", name: "闪切霜环", slot: 4, rarity: "史诗", category: "伤害类" },
  { id: "long-xi-ben-yong", name: "龙息奔涌", slot: 4, rarity: "史诗", category: "伤害类" },
  { id: "chao-pin", name: "超频", slot: 4, rarity: "传说", category: "伤害类" },

  // 第三行
  { id: "qiang-xi", name: "强袭", slot: 4, rarity: "史诗", category: "伤害类" },
  { id: "shi-neng-huo-huan", name: "释能火环", slot: 4, rarity: "史诗", category: "伤害类" },
  { id: "shuang-dong-xie-yi", name: "霜冻协议", slot: 4, rarity: "史诗", category: "伤害类" },
  { id: "shan-dian-xie-yi", name: "闪电协议", slot: 4, rarity: "史诗", category: "伤害类" },
  { id: "jing-zhun-dao-dan", name: "精确导弹", slot: 4, rarity: "史诗", category: "伤害类" },
  { id: "zhui-shen-dao-dan", name: "追身导弹", slot: 4, rarity: "史诗", category: "伤害类" },
  { id: "lian-suo-dian-huan", name: "连锁电环", slot: 4, rarity: "史诗", category: "伤害类" },
];

// 生成函数
function generatePerkJson(perk: PerkData): object {
  return {
    id: perk.name, // 使用中文名作为id
    name: perk.name,
    slot: perk.slot,
    rarity: perk.rarity,
    category: perk.category,
    icon: null, // 暂无图标
    effects: [
      {
        slot: perk.slot,
        description: `${perk.name}效果描述待补充`,
      },
    ],
    description: perk.description || null,
  };
}

// 主函数
function main() {
  const baseDir = path.join(__dirname);

  // 删除旧的单文件插件数据
  const oldFiles = ["lucky-reload.json", "headshot-master.json", "iron-skin.json", "fast-runner.json"];
  for (const file of oldFiles) {
    const filePath = path.join(baseDir, file);
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
      console.log(`删除旧文件: ${file}`);
    }
  }

  // 确保子目录存在
  for (let slot = 1; slot <= 4; slot++) {
    const slotDir = path.join(baseDir, `slot${slot}`);
    if (!fs.existsSync(slotDir)) {
      fs.mkdirSync(slotDir, { recursive: true });
    }
  }

  // 删除旧的英文名文件
  for (let slot = 1; slot <= 4; slot++) {
    const slotDir = path.join(baseDir, `slot${slot}`);
    if (fs.existsSync(slotDir)) {
      const files = fs.readdirSync(slotDir);
      for (const file of files) {
        fs.unlinkSync(path.join(slotDir, file));
      }
    }
  }

  // 生成插件JSON文件（使用中文名作为文件名）
  let count = 0;
  for (const perk of perksData) {
    const perkJson = generatePerkJson(perk);
    const filePath = path.join(baseDir, `slot${perk.slot}`, `${perk.name}.json`);
    fs.writeFileSync(filePath, JSON.stringify(perkJson, null, 2), "utf-8");
    count++;
  }

  console.log(`\n生成完成！共生成 ${count} 个插件文件`);
  console.log(`\n按槽位统计:`);
  for (let slot = 1; slot <= 4; slot++) {
    const slotPerks = perksData.filter((p) => p.slot === slot);
    console.log(`  ${slot}号槽位: ${slotPerks.length} 个`);
  }

  console.log(`\n按稀有度统计:`);
  const rarities: Rarity[] = ["普通", "稀有", "史诗", "传说"];
  for (const rarity of rarities) {
    const rarityPerks = perksData.filter((p) => p.rarity === rarity);
    console.log(`  ${rarity}: ${rarityPerks.length} 个`);
  }
}

main();
