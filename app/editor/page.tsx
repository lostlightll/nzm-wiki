"use client";
import React, {
  useState,
  useEffect,
  useMemo,
  useRef,
  useCallback,
} from "react";
import { getSchemaForPath, FIELD_OPTIONS } from "@/constants/schema";

// --- 新增：标签输入组件 ---
const TagInput = ({
  value = [],
  onChange,
}: {
  value: string[];
  onChange: (val: string[]) => void;
}) => {
  const [inputValue, setInputValue] = useState("");

  // 处理回车添加
  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      e.preventDefault();
      const tag = inputValue.trim();
      // 只有非空且不重复的标签才添加
      if (tag && !value.includes(tag)) {
        onChange([...value, tag]);
        setInputValue("");
      }
    } else if (e.key === "Backspace" && !inputValue && value.length > 0) {
      // (可选功能) 当输入框为空按删除键时，删除最后一个标签
      onChange(value.slice(0, -1));
    }
  };

  // 处理点击删除
  const removeTag = (tagToRemove: string) => {
    onChange(value.filter((tag) => tag !== tagToRemove));
  };

  return (
    <div className="flex flex-wrap gap-2 p-2 min-h-10.5 bg-zinc-900 border border-zinc-800 rounded-md focus-within:ring-1 focus-within:ring-blue-500 focus-within:border-blue-500 transition-all">
      {/* 渲染已有的标签 */}
      {value.map((tag) => (
        <span
          key={tag}
          className="flex items-center gap-1 bg-blue-900/40 text-blue-200 px-2 py-1 rounded text-xs border border-blue-800 animate-fadeIn"
        >
          {tag}
          <button
            onClick={() => removeTag(tag)}
            className="text-blue-400 hover:text-white transition-colors focus:outline-none ml-1"
          >
            <svg
              className="w-3 h-3"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M6 18L18 6M6 6l12 12"
              />
            </svg>
          </button>
        </span>
      ))}

      {/* 输入框 */}
      <input
        type="text"
        className="flex-1 bg-transparent min-w-30 text-sm text-zinc-200 outline-none placeholder-zinc-600"
        placeholder={
          value.length === 0 ? "Type and press Enter..." : "Add tag..."
        }
        value={inputValue}
        onChange={(e) => setInputValue(e.target.value)}
        onKeyDown={handleKeyDown}
      />
    </div>
  );
};

// --- 0. 配置：图标映射表 ---
const ELEMENT_ICON_MAP: Record<string, string> = {
  物理: "kinetic",
  火焰: "fire",
  寒冷: "cryo",
  电弧: "shock",
  腐蚀: "corossive",
};

// --- 图标组件 (SVG) ---
const Icons = {
  Folder: () => (
    <svg
      className="w-4 h-4 text-blue-400"
      fill="currentColor"
      viewBox="0 0 20 20"
    >
      <path d="M2 6a2 2 0 012-2h5l2 2h5a2 2 0 012 2v6a2 2 0 01-2 2H4a2 2 0 01-2-2V6z" />
    </svg>
  ),

  FolderOpen: () => (
    <svg
      className="w-4 h-4 text-blue-300"
      fill="currentColor"
      viewBox="0 0 20 20"
    >
      <path
        fillRule="evenodd"
        d="M2 6a2 2 0 012-2h4l2 2h4a2 2 0 012 2v1H8a3 3 0 00-3 3v1.5a1.5 1.5 0 01-3 0V6z"
        clipRule="evenodd"
      />
      <path d="M6 12a2 2 0 012-2h8a2 2 0 012 2v2a2 2 0 01-2 2H2h2a2 2 0 002-2v-2z" />
    </svg>
  ),
  File: () => (
    <svg
      className="w-4 h-4 text-zinc-500"
      fill="none"
      stroke="currentColor"
      viewBox="0 0 24 24"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 011.414.586l4.793 4.793a1 1 0 01.586 1.414V19a2 2 0 01-2 2z"
      />
    </svg>
  ),
  ChevronRight: () => (
    <svg
      className="w-3 h-3 text-zinc-500"
      fill="none"
      stroke="currentColor"
      viewBox="0 0 24 24"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M9 5l7 7-7 7"
      />
    </svg>
  ),
  ChevronDown: () => (
    <svg
      className="w-3 h-3 text-zinc-500"
      fill="none"
      stroke="currentColor"
      viewBox="0 0 24 24"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M19 9l-7 7-7-7"
      />
    </svg>
  ),
  Save: () => (
    <svg
      className="w-4 h-4"
      fill="none"
      stroke="currentColor"
      viewBox="0 0 24 24"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M8 7H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-3m-1 4l-3 3m0 0l-3-3m3 3V4"
      />
    </svg>
  ),
  Check: () => (
    <svg
      className="w-4 h-4 text-blue-500"
      fill="none"
      stroke="currentColor"
      viewBox="0 0 24 24"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M5 13l4 4L19 7"
      />
    </svg>
  ),
  // 👇 新增图标
  Plus: () => (
    <svg
      className="w-4 h-4"
      fill="none"
      stroke="currentColor"
      viewBox="0 0 24 24"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M12 4v16m8-8H4"
      />
    </svg>
  ),
  Trash: () => (
    <svg
      className="w-3.5 h-3.5"
      fill="none"
      stroke="currentColor"
      viewBox="0 0 24 24"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
      />
    </svg>
  ),
};

// --- 伤害标签下拉组件 ---
const DAMAGE_LABEL_OPTIONS = [
  { value: 0, label: "命中伤害" },
  { value: 1, label: "爆炸伤害" },
  { value: 2, label: "自定义" },
];

const DamageLabelSelect = ({
  value,
  onChange,
}: {
  value: number;
  onChange: (val: number) => void;
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const current = DAMAGE_LABEL_OPTIONS.find((o) => o.value === value);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        containerRef.current &&
        !containerRef.current.contains(event.target as Node)
      ) {
        setIsOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  return (
    <div className="relative w-full" ref={containerRef}>
      <div
        className="w-full h-10 bg-zinc-900 border border-zinc-800 rounded-md px-3 flex items-center justify-between cursor-pointer hover:border-zinc-700 transition-colors"
        onClick={() => setIsOpen(!isOpen)}
      >
        <span className="text-sm text-zinc-200 truncate">
          {current ? `${current.label} (${current.value})` : "选择伤害标签..."}
        </span>
        <div
          className={`text-zinc-500 transition-transform duration-200 ${isOpen ? "rotate-180" : ""}`}
        >
          <Icons.ChevronDown />
        </div>
      </div>
      {isOpen && (
        <div className="absolute z-50 w-full mt-1 bg-zinc-800 border border-zinc-700 rounded-md shadow-xl custom-scrollbar">
          {DAMAGE_LABEL_OPTIONS.map((opt) => (
            <div
              key={opt.value}
              className={`flex items-center px-3 py-2 cursor-pointer text-sm transition-colors ${
                value === opt.value
                  ? "bg-blue-600/20 text-blue-400"
                  : "text-zinc-300 hover:bg-zinc-700"
              }`}
              onClick={() => {
                onChange(opt.value);
                setIsOpen(false);
              }}
            >
              <span className="flex-1 truncate">{opt.label}</span>
              <span className="text-xs text-zinc-500 ml-2">{opt.value}</span>
              {value === opt.value && <Icons.Check />}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

// --- 额外模式编辑器组件 ---
type ExtraModeEntry = {
  name: string;
  fire_interval?: number;
  label?: string;
  damage?: {
    base: number;
    impulse: number;
    toughness: number;
    flesh: number;
    hurtable: number;
  };
  element?: string;
  element_add_rate?: number;
  weakness_multiplier?: number;
  enable_critical?: boolean;
  enable_weakness?: boolean;
  toughness_type?: string;
  ignore_shield?: boolean;
  element_debuff_type_id?: number;
};

const ExtraModesEditor = ({
  value = [],
  onChange,
}: {
  value: ExtraModeEntry[];
  onChange: (val: ExtraModeEntry[]) => void;
}) => {
  const modes = Array.isArray(value) ? value : [];

  const addMode = () => {
    onChange([
      ...modes,
      {
        name: "",
        damage: { base: 0, impulse: 0, toughness: 0, flesh: 0, hurtable: 0 },
      },
    ]);
  };

  const removeMode = (idx: number) => {
    onChange(modes.filter((_, i) => i !== idx));
  };

  const updateMode = (idx: number, field: string, fieldValue: unknown) => {
    const updated = modes.map((m, i) =>
      i === idx ? { ...m, [field]: fieldValue } : m,
    );
    onChange(updated);
  };

  const updateDamage = (
    idx: number,
    subField: string,
    fieldValue: number,
  ) => {
    const updated = modes.map((m, i) => {
      if (i !== idx) return m;
      return {
        ...m,
        damage: { ...(m.damage || { base: 0, impulse: 0, toughness: 0, flesh: 0, hurtable: 0 }), [subField]: fieldValue },
      };
    });
    onChange(updated);
  };

  const inputClass =
    "w-full h-9 bg-zinc-900 border border-zinc-800 rounded px-2.5 text-sm text-zinc-200 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none transition-all placeholder-zinc-600";
  const damageLabelClass = "text-[9px] text-zinc-500 uppercase block mb-1 font-bold pl-1";

  return (
    <div className="space-y-3">
      {modes.map((mode, idx) => (
        <div
          key={idx}
          className="bg-zinc-900/30 border border-zinc-800/50 rounded-lg p-3 relative"
        >
          <button
            className="absolute top-2 right-2 text-zinc-500 hover:text-red-500 transition-colors p-1"
            onClick={() => removeMode(idx)}
            title="删除模式"
          >
            <Icons.Trash />
          </button>
          <div className="grid grid-cols-2 gap-2.5">
            <div>
              <span className={damageLabelClass}>模式名</span>
              <input
                type="text"
                className={inputClass}
                value={mode.name || ""}
                onChange={(e) => updateMode(idx, "name", e.target.value)}
                placeholder="e.g. 浮游模式"
              />
            </div>
            <div>
              <span className={damageLabelClass}>射速 (可选)</span>
              <input
                type="number"
                className={inputClass}
                value={mode.fire_interval ?? ""}
                onChange={(e) =>
                  updateMode(
                    idx,
                    "fire_interval",
                    e.target.value ? parseFloat(e.target.value) : undefined,
                  )
                }
                placeholder="继承主模式"
              />
            </div>
            <div>
              <span className={damageLabelClass}>伤害标签 (可选)</span>
              <input
                type="text"
                className={inputClass}
                value={mode.label || ""}
                onChange={(e) =>
                  updateMode(idx, "label", e.target.value || undefined)
                }
                placeholder="e.g. 爆炸伤害"
              />
            </div>
            <div>
              <span className={damageLabelClass}>元素</span>
              <select
                className={inputClass}
                value={mode.element || ""}
                onChange={(e) =>
                  updateMode(idx, "element", e.target.value || undefined)
                }
              >
                <option value="">(继承主武器)</option>
                {(FIELD_OPTIONS["element"] || []).map((opt) => (
                  <option key={opt} value={opt}>{opt}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Damage sub-object */}
          <div className="mt-3 pt-3 border-t border-zinc-800/50">
            <span className="text-[9px] text-zinc-500 uppercase block mb-2 font-bold pl-1">
              伤害
            </span>
            <div className="grid grid-cols-3 gap-2">
              {(["base", "impulse", "toughness", "flesh", "hurtable"] as const).map(
                (key) => (
                  <div key={key}>
                    <span className={damageLabelClass}>{key}</span>
                    <input
                      type="number"
                      className={inputClass}
                      value={mode.damage?.[key] ?? ""}
                      onChange={(e) =>
                        updateDamage(
                          idx,
                          key,
                          e.target.value ? parseFloat(e.target.value) : 0,
                        )
                      }
                    />
                  </div>
                ),
              )}
            </div>
          </div>

          {/* Property fields */}
          <div className="mt-3 pt-3 border-t border-zinc-800/50">
            <div className="grid grid-cols-3 gap-2.5">
              <div>
                <span className={damageLabelClass}>元素异常概率</span>
                <input
                  type="number"
                  className={inputClass}
                  value={mode.element_add_rate ?? ""}
                  onChange={(e) =>
                    updateMode(
                      idx,
                      "element_add_rate",
                      e.target.value ? parseFloat(e.target.value) : undefined,
                    )
                  }
                />
              </div>
              <div>
                <span className={damageLabelClass}>弱点倍率</span>
                <input
                  type="number"
                  className={inputClass}
                  value={mode.weakness_multiplier ?? ""}
                  onChange={(e) =>
                    updateMode(
                      idx,
                      "weakness_multiplier",
                      e.target.value ? parseFloat(e.target.value) : undefined,
                    )
                  }
                />
              </div>
              <div>
                <span className={damageLabelClass}>破韧类型</span>
                <select
                  className={inputClass}
                  value={mode.toughness_type || ""}
                  onChange={(e) =>
                    updateMode(idx, "toughness_type", e.target.value || undefined)
                  }
                >
                  <option value="">(继承)</option>
                  {(FIELD_OPTIONS["toughness_type"] || []).map((opt) => (
                    <option key={opt} value={opt}>{opt}</option>
                  ))}
                </select>
              </div>
            </div>
            <div className="flex items-center gap-4 mt-3 flex-wrap">
              <label className="flex items-center gap-1.5 text-xs text-zinc-400 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={mode.enable_critical ?? false}
                  onChange={(e) =>
                    updateMode(idx, "enable_critical", e.target.checked)
                  }
                  className="rounded-sm bg-zinc-800 border-zinc-700 checked:bg-blue-500"
                />
                可暴击
              </label>
              <label className="flex items-center gap-1.5 text-xs text-zinc-400 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={mode.enable_weakness ?? false}
                  onChange={(e) =>
                    updateMode(idx, "enable_weakness", e.target.checked)
                  }
                  className="rounded-sm bg-zinc-800 border-zinc-700 checked:bg-blue-500"
                />
                弱点伤害
              </label>
              <label className="flex items-center gap-1.5 text-xs text-zinc-400 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={mode.ignore_shield ?? false}
                  onChange={(e) =>
                    updateMode(idx, "ignore_shield", e.target.checked)
                  }
                  className="rounded-sm bg-zinc-800 border-zinc-700 checked:bg-blue-500"
                />
                无视护盾
              </label>
            </div>
            {/* Hidden storage field: element_debuff_type_id */}
            <div className="mt-2 pt-2 border-t border-zinc-800/30">
              <details className="group">
                <summary className="text-[10px] text-zinc-600 hover:text-zinc-400 cursor-pointer select-none">
                  高级 (存储但不显示)
                </summary>
                <div className="mt-2 grid grid-cols-2 gap-2">
                  <div>
                    <span className={damageLabelClass}>Element Debuff Type ID</span>
                    <input
                      type="number"
                      className={inputClass}
                      value={mode.element_debuff_type_id ?? ""}
                      onChange={(e) =>
                        updateMode(
                          idx,
                          "element_debuff_type_id",
                          e.target.value ? parseInt(e.target.value) : undefined,
                        )
                      }
                    />
                  </div>
                </div>
              </details>
            </div>
          </div>
        </div>
      ))}
      <button
        onClick={addMode}
        className="w-full py-2 border border-dashed border-zinc-700 rounded-lg text-xs text-zinc-500 hover:text-zinc-300 hover:border-zinc-600 transition-colors flex items-center justify-center gap-1.5"
      >
        <Icons.Plus />
        添加额外模式
      </button>
    </div>
  );
};

// --- 多模式数据编辑器组件 ---

type DamageModeEntry = {
  mode: number;
  name: string;
  fire_interval?: number;
  label?: string;
  pellets?: number;
  damage?: {
    base: number;
    impulse: number;
    toughness: number;
    flesh: number;
    hurtable: number;
  };
  element?: string;
  element_add_rate?: number;
  weakness_multiplier?: number;
  enable_critical?: boolean;
  enable_weakness?: boolean;
  toughness_type?: string;
  ignore_shield?: boolean;
  element_debuff_type_id?: number;
};

const DamageModesEditor = ({
  value = [],
  onChange,
}: {
  value: DamageModeEntry[];
  onChange: (val: DamageModeEntry[]) => void;
}) => {
  const modes = Array.isArray(value) ? value : [];

  const addMode = () => {
    onChange([
      ...modes,
      {
        mode: 1,
        name: "",
        damage: { base: 0, impulse: 0, toughness: 0, flesh: 0, hurtable: 0 },
      },
    ]);
  };

  const removeMode = (idx: number) => {
    onChange(modes.filter((_, i) => i !== idx));
  };

  const updateMode = (idx: number, field: string, fieldValue: unknown) => {
    const updated = modes.map((m, i) =>
      i === idx ? { ...m, [field]: fieldValue } : m,
    );
    onChange(updated);
  };

  const updateDamage = (
    idx: number,
    subField: string,
    fieldValue: number,
  ) => {
    const updated = modes.map((m, i) => {
      if (i !== idx) return m;
      return {
        ...m,
        damage: { ...(m.damage || { base: 0, impulse: 0, toughness: 0, flesh: 0, hurtable: 0 }), [subField]: fieldValue },
      };
    });
    onChange(updated);
  };

  const inputClass =
    "w-full h-9 bg-zinc-900 border border-zinc-800 rounded px-2.5 text-sm text-zinc-200 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none transition-all placeholder-zinc-600";
  const damageLabelClass = "text-[9px] text-zinc-500 uppercase block mb-1 font-bold pl-1";

  return (
    <div className="space-y-3">
      {modes.map((mode, idx) => (
        <div
          key={idx}
          className="bg-zinc-900/30 border border-zinc-800/50 rounded-lg p-3 relative"
        >
          <button
            className="absolute top-2 right-2 text-zinc-500 hover:text-red-500 transition-colors p-1"
            onClick={() => removeMode(idx)}
            title="删除模式"
          >
            <Icons.Trash />
          </button>
          <div className="grid grid-cols-2 gap-2.5">
            <div>
              <span className={damageLabelClass}>Mode 索引 (对应 PrototypeConfig)</span>
              <input
                type="number"
                className={inputClass}
                value={mode.mode ?? ""}
                onChange={(e) =>
                  updateMode(idx, "mode", e.target.value ? parseInt(e.target.value) : 0)
                }
              />
            </div>
            <div>
              <span className={damageLabelClass}>模式名</span>
              <input
                type="text"
                className={inputClass}
                value={mode.name || ""}
                onChange={(e) => updateMode(idx, "name", e.target.value)}
                placeholder="e.g. 爆发模式"
              />
            </div>
            <div>
              <span className={damageLabelClass}>射速 (可选)</span>
              <input
                type="number"
                className={inputClass}
                value={mode.fire_interval ?? ""}
                onChange={(e) =>
                  updateMode(
                    idx,
                    "fire_interval",
                    e.target.value ? parseFloat(e.target.value) : undefined,
                  )
                }
                placeholder="继承主模式"
              />
            </div>
            <div>
              <span className={damageLabelClass}>弹丸数 (可选)</span>
              <input
                type="number"
                className={inputClass}
                value={mode.pellets ?? ""}
                onChange={(e) =>
                  updateMode(
                    idx,
                    "pellets",
                    e.target.value ? parseInt(e.target.value) : undefined,
                  )
                }
                placeholder="继承主模式"
              />
            </div>
            <div>
              <span className={damageLabelClass}>伤害标签 (可选)</span>
              <input
                type="text"
                className={inputClass}
                value={mode.label || ""}
                onChange={(e) =>
                  updateMode(idx, "label", e.target.value || undefined)
                }
                placeholder="e.g. 爆炸伤害"
              />
            </div>
            <div>
              <span className={damageLabelClass}>元素</span>
              <select
                className={inputClass}
                value={mode.element || ""}
                onChange={(e) =>
                  updateMode(idx, "element", e.target.value || undefined)
                }
              >
                <option value="">(继承主武器)</option>
                {(FIELD_OPTIONS["element"] || []).map((opt) => (
                  <option key={opt} value={opt}>{opt}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Damage sub-object */}
          <div className="mt-3 pt-3 border-t border-zinc-800/50">
            <span className="text-[9px] text-zinc-500 uppercase block mb-2 font-bold pl-1">
              伤害
            </span>
            <div className="grid grid-cols-3 gap-2">
              {(["base", "impulse", "toughness", "flesh", "hurtable"] as const).map(
                (key) => (
                  <div key={key}>
                    <span className={damageLabelClass}>{key}</span>
                    <input
                      type="number"
                      className={inputClass}
                      value={mode.damage?.[key] ?? ""}
                      onChange={(e) =>
                        updateDamage(
                          idx,
                          key,
                          e.target.value ? parseFloat(e.target.value) : 0,
                        )
                      }
                    />
                  </div>
                ),
              )}
            </div>
          </div>

          {/* Property fields */}
          <div className="mt-3 pt-3 border-t border-zinc-800/50">
            <div className="grid grid-cols-3 gap-2.5">
              <div>
                <span className={damageLabelClass}>元素异常概率</span>
                <input
                  type="number"
                  className={inputClass}
                  value={mode.element_add_rate ?? ""}
                  onChange={(e) =>
                    updateMode(
                      idx,
                      "element_add_rate",
                      e.target.value ? parseFloat(e.target.value) : undefined,
                    )
                  }
                />
              </div>
              <div>
                <span className={damageLabelClass}>弱点倍率</span>
                <input
                  type="number"
                  className={inputClass}
                  value={mode.weakness_multiplier ?? ""}
                  onChange={(e) =>
                    updateMode(
                      idx,
                      "weakness_multiplier",
                      e.target.value ? parseFloat(e.target.value) : undefined,
                    )
                  }
                />
              </div>
              <div>
                <span className={damageLabelClass}>破韧类型</span>
                <select
                  className={inputClass}
                  value={mode.toughness_type || ""}
                  onChange={(e) =>
                    updateMode(idx, "toughness_type", e.target.value || undefined)
                  }
                >
                  <option value="">(继承)</option>
                  {(FIELD_OPTIONS["toughness_type"] || []).map((opt) => (
                    <option key={opt} value={opt}>{opt}</option>
                  ))}
                </select>
              </div>
            </div>
            <div className="flex items-center gap-4 mt-3 flex-wrap">
              <label className="flex items-center gap-1.5 text-xs text-zinc-400 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={mode.enable_critical ?? false}
                  onChange={(e) =>
                    updateMode(idx, "enable_critical", e.target.checked)
                  }
                  className="rounded-sm bg-zinc-800 border-zinc-700 checked:bg-blue-500"
                />
                可暴击
              </label>
              <label className="flex items-center gap-1.5 text-xs text-zinc-400 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={mode.enable_weakness ?? false}
                  onChange={(e) =>
                    updateMode(idx, "enable_weakness", e.target.checked)
                  }
                  className="rounded-sm bg-zinc-800 border-zinc-700 checked:bg-blue-500"
                />
                弱点伤害
              </label>
              <label className="flex items-center gap-1.5 text-xs text-zinc-400 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={mode.ignore_shield ?? false}
                  onChange={(e) =>
                    updateMode(idx, "ignore_shield", e.target.checked)
                  }
                  className="rounded-sm bg-zinc-800 border-zinc-700 checked:bg-blue-500"
                />
                无视护盾
              </label>
            </div>
            <div className="mt-2 pt-2 border-t border-zinc-800/30">
              <details className="group">
                <summary className="text-[10px] text-zinc-600 hover:text-zinc-400 cursor-pointer select-none">
                  高级 (存储但不显示)
                </summary>
                <div className="mt-2 grid grid-cols-2 gap-2">
                  <div>
                    <span className={damageLabelClass}>Element Debuff Type ID</span>
                    <input
                      type="number"
                      className={inputClass}
                      value={mode.element_debuff_type_id ?? ""}
                      onChange={(e) =>
                        updateMode(
                          idx,
                          "element_debuff_type_id",
                          e.target.value ? parseInt(e.target.value) : undefined,
                        )
                      }
                    />
                  </div>
                </div>
              </details>
            </div>
          </div>
        </div>
      ))}
      <button
        onClick={addMode}
        className="w-full py-2 border border-dashed border-zinc-700 rounded-lg text-xs text-zinc-500 hover:text-zinc-300 hover:border-zinc-600 transition-colors flex items-center justify-center gap-1.5"
      >
        <Icons.Plus />
        添加多模式
      </button>
    </div>
  );
};

// --- 模式名编辑器组件 ---
const ModeNamesEditor = ({
  value,
  onChange,
}: {
  value: Record<string, string>;
  onChange: (val: Record<string, string>) => void;
}) => {
  const entries = value && typeof value === "object" ? value : {};
  const list = Object.entries(entries);

  const updateEntry = (oldKey: string, newKey: string, name: string) => {
    const next: Record<string, string> = {};
    for (const [k, v] of Object.entries(entries)) {
      if (k === oldKey) {
        if (newKey) next[newKey] = name;
      } else {
        next[k] = v;
      }
    }
    onChange(next);
  };

  const addEntry = () => {
    const nextKey = String(list.length);
    onChange({ ...entries, [nextKey]: "" });
  };

  const removeEntry = (key: string) => {
    const next: Record<string, string> = {};
    for (const [k, v] of Object.entries(entries)) {
      if (k !== key) next[k] = v;
    }
    onChange(next);
  };

  const inputClass =
    "w-full h-8 bg-zinc-900 border border-zinc-800 rounded px-2 text-sm text-zinc-200 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none transition-all placeholder-zinc-600";

  return (
    <div className="space-y-2">
      {list.map(([k, v]) => (
        <div key={k} className="flex items-center gap-2">
          <span className="text-[10px] text-zinc-500 w-12 text-right shrink-0">
            Mode {k}
          </span>
          <input
            type="text"
            className={inputClass}
            value={v || ""}
            onChange={(e) => updateEntry(k, k, e.target.value)}
            placeholder="模式显示名"
          />
          <button
            className="text-zinc-500 hover:text-red-500 transition-colors shrink-0 p-1"
            onClick={() => removeEntry(k)}
            title="删除"
          >
            <Icons.Trash />
          </button>
        </div>
      ))}
      <button
        onClick={addEntry}
        className="w-full py-1.5 border border-dashed border-zinc-700 rounded-lg text-xs text-zinc-500 hover:text-zinc-300 hover:border-zinc-600 transition-colors flex items-center justify-center gap-1"
      >
        <Icons.Plus />
        添加模式名
      </button>
    </div>
  );
};

// --- 自定义下拉组件 ---
const CustomSelect = ({
  value,
  onChange,
  options,
  hasIcons = false,
}: {
  value: string;
  onChange: (val: string) => void;
  options: string[];
  hasIcons?: boolean;
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        containerRef.current &&
        !containerRef.current.contains(event.target as Node)
      ) {
        setIsOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const renderIcon = (optionLabel: string) => {
    const iconName = ELEMENT_ICON_MAP[optionLabel];
    if (!iconName) return null;
    return (
      <img
        src={`/icons/elements/${iconName}.png`}
        alt={optionLabel}
        className="w-5 h-5 object-contain mr-2"
        onError={(e) => {
          (e.target as HTMLImageElement).style.display = "none";
        }}
      />
    );
  };

  return (
    <div className="relative w-full" ref={containerRef}>
      <div
        className="w-full h-10 bg-zinc-900 border border-zinc-800 rounded-md px-3 flex items-center justify-between cursor-pointer hover:border-zinc-700 transition-colors"
        onClick={() => setIsOpen(!isOpen)}
      >
        <div className="flex items-center text-sm text-zinc-200 overflow-hidden">
          {value ? (
            <>
              {hasIcons && renderIcon(value)}
              <span className="truncate">{value}</span>
            </>
          ) : (
            <span className="text-zinc-500">Select option...</span>
          )}
        </div>
        <div
          className={`text-zinc-500 transition-transform duration-200 ${isOpen ? "rotate-180" : ""}`}
        >
          <Icons.ChevronDown />
        </div>
      </div>

      {isOpen && (
        <div className="absolute z-50 w-full mt-1 bg-zinc-800 border border-zinc-700 rounded-md shadow-xl max-h-60 overflow-y-auto custom-scrollbar">
          {options.map((opt) => (
            <div
              key={opt}
              className={`flex items-center px-3 py-2 cursor-pointer text-sm transition-colors ${
                value === opt
                  ? "bg-blue-600/20 text-blue-400"
                  : "text-zinc-300 hover:bg-zinc-700"
              }`}
              onClick={() => {
                onChange(opt);
                setIsOpen(false);
              }}
            >
              {hasIcons && renderIcon(opt)}
              <span className="flex-1 truncate">{opt}</span>
              {value === opt && <Icons.Check />}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

// --- 类型定义 ---
type TreeNode = {
  name: string;
  path: string;
  type: "folder" | "file";
  children?: TreeNode[];
};

// --- 子组件：递归文件树 (已添加 React.memo 优化性能) ---
const FileTreeItem = React.memo(
  ({
    item,
    onSelect,
    onDelete, // 👈 新增：删除回调
    activePath,
    defaultOpen = false,
  }: {
    item: TreeNode;
    onSelect: (path: string) => void;
    onDelete: (path: string) => void;
    activePath: string | null;
    defaultOpen?: boolean;
  }) => {
    const [isOpen, setIsOpen] = useState(defaultOpen);

    useEffect(() => {
      setIsOpen(defaultOpen);
    }, [defaultOpen]);

    if (item.type === "folder") {
      return (
        <div className="select-none">
          <div
            className="group flex items-center gap-2 px-3 py-1.5 cursor-pointer text-sm text-zinc-400 hover:text-zinc-100 transition-colors"
            onClick={() => setIsOpen(!isOpen)}
          >
            <span className="opacity-70 group-hover:opacity-100 transition-opacity">
              {isOpen ? <Icons.ChevronDown /> : <Icons.ChevronRight />}
            </span>
            {isOpen ? <Icons.FolderOpen /> : <Icons.Folder />}
            <span className="font-medium truncate">{item.name}</span>
          </div>
          {isOpen && item.children && (
            <div className="pl-4 border-l border-zinc-800 ml-4">
              {item.children.map((child) => (
                <FileTreeItem
                  key={child.path}
                  item={child}
                  onSelect={onSelect}
                  onDelete={onDelete} // 👈 递归传递
                  activePath={activePath}
                  defaultOpen={defaultOpen}
                />
              ))}
            </div>
          )}
        </div>
      );
    }

    if (item.name.endsWith(".mdx")) {
      const isActive = activePath === item.path;
      return (
        <div
          className={`group flex items-center justify-between px-3 py-1.5 ml-3 cursor-pointer text-sm rounded-md transition-all ${
            isActive
              ? "bg-blue-600/10 text-blue-400 font-medium"
              : "text-zinc-500 hover:text-zinc-200 hover:bg-zinc-800/50"
          }`}
          onClick={() => onSelect(item.path)}
        >
          <div className="flex items-center gap-2 overflow-hidden">
            <Icons.File />
            <span className="truncate">{item.name.replace(".mdx", "")}</span>
          </div>

          {/* 👇 删除按钮 (Hover 时显示) */}
          <button
            className="opacity-0 group-hover:opacity-100 text-zinc-500 hover:text-red-500 hover:bg-zinc-900/50 p-1 rounded transition-all"
            onClick={(e) => {
              e.stopPropagation(); // 防止触发 onSelect
              onDelete(item.path);
            }}
            title="Delete File"
          >
            <Icons.Trash />
          </button>
        </div>
      );
    }

    return null;
  },
);
FileTreeItem.displayName = "FileTreeItem";

// --- 主页面组件 ---
export default function EditorPage() {
  const [tree, setTree] = useState<TreeNode[]>([]);
  const [treeLoading, setTreeLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedPath, setSelectedPath] = useState<string | null>(null);
  const [editorLoading, setEditorLoading] = useState(false);
  const [formData, setFormData] = useState<any>({});
  const [content, setContent] = useState("");

  // Toast 状态
  const [toast, setToast] = useState<{
    show: boolean;
    msg: string;
    type: "success" | "error";
  }>({
    show: false,
    msg: "",
    type: "success",
  });

  // 显示 Toast 的辅助函数
  const showToast = (msg: string, type: "success" | "error" = "success") => {
    setToast({ show: true, msg, type });
    setTimeout(() => {
      setToast((prev) => ({ ...prev, show: false }));
    }, 3000);
  };

  // --- 核心逻辑 ---

  // 1. 获取文件树 (抽取以便复用)
  const fetchTree = useCallback(async () => {
    try {
      const res = await fetch("/api/cms");
      const data = await res.json();
      setTree(data.tree || []);
    } catch (err) {
      console.error(err);
    } finally {
      setTreeLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchTree();
  }, [fetchTree]);

  // 2. 加载文件
  const loadFile = useCallback(async (path: string) => {
    setEditorLoading(true);
    setSelectedPath(path);
    try {
      const res = await fetch("/api/cms", {
        method: "POST",
        body: JSON.stringify({ action: "read", filePath: path }),
      });
      const json = await res.json();

      const schema = getSchemaForPath(path);
      const initData: any = {};
      schema.fieldOrder.forEach((key) => {
        initData[key] = json.frontmatter[key] ?? "";
      });
      setFormData({ ...initData, ...json.frontmatter });
      setContent(json.content);
    } catch (err) {
      showToast("读取文件失败", "error");
    } finally {
      setEditorLoading(false);
    }
  }, []);

  // URL ?file= 参数自动打开文件
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const file = params.get("file");
    if (file) {
      loadFile(file);
    }
  }, [loadFile]);

  // 3. 保存文件
  const handleSave = async () => {
    if (!selectedPath) return;
    try {
      const res = await fetch("/api/cms", {
        method: "POST",
        body: JSON.stringify({
          action: "save",
          filePath: selectedPath,
          data: formData,
          content,
        }),
      });
      if (res.ok) showToast("保存成功！", "success");
      else showToast("保存失败", "error");
    } catch (err) {
      showToast("网络错误", "error");
    }
  };

  // 4. 新建文件 (New Handle)
  const handleCreate = async () => {
    // 简单的 prompt 获取路径
    const input = window.prompt(
      "请输入相对路径 (例如: weapons/new_gun.mdx)\n提示: 如果不写后缀，默认补充 .mdx",
    );
    if (!input) return;

    let filePath = input.trim();
    if (!filePath.endsWith(".mdx")) filePath += ".mdx";

    try {
      const res = await fetch("/api/cms", {
        method: "POST",
        body: JSON.stringify({ action: "create", filePath }),
      });
      const data = await res.json();

      if (res.ok) {
        showToast("✨ 文件创建成功！");
        await fetchTree(); // 刷新树
        loadFile(filePath); // 自动选中新文件
      } else {
        showToast(data.error || "创建失败", "error");
      }
    } catch (err) {
      showToast("网络错误", "error");
    }
  };

  // 5. 删除文件 (New Handle)
  const handleDelete = useCallback(
    async (path: string) => {
      if (!window.confirm(`确定要永久删除这个文件吗？\n${path}`)) return;

      try {
        const res = await fetch("/api/cms", {
          method: "POST",
          body: JSON.stringify({ action: "delete", filePath: path }),
        });

        if (res.ok) {
          showToast("🗑️ 文件已删除");

          // 如果删除的是当前正在编辑的文件，清空编辑区
          if (selectedPath === path) {
            setSelectedPath(null);
            setFormData({});
            setContent("");
          }
          await fetchTree(); // 刷新树
        } else {
          showToast("删除失败", "error");
        }
      } catch (err) {
        showToast("网络错误", "error");
      }
    },
    [selectedPath, fetchTree],
  );

  const handleChange = (key: string, val: any) => {
    setFormData((prev: any) => ({ ...prev, [key]: val }));
  };

  const filterTree = (nodes: TreeNode[], term: string): TreeNode[] => {
    return nodes
      .map((node) => {
        if (node.type === "folder" && node.children) {
          const children = filterTree(node.children, term);
          if (
            node.name.toLowerCase().includes(term.toLowerCase()) ||
            children.length > 0
          ) {
            return { ...node, children };
          }
        } else if (node.name.toLowerCase().includes(term.toLowerCase())) {
          return node;
        }
        return null;
      })
      .filter(Boolean) as TreeNode[];
  };

  const filteredTree = useMemo(
    () => (searchTerm ? filterTree(tree, searchTerm) : tree),
    [tree, searchTerm],
  );

  // 根据当前选中的文件路径获取 schema
  const currentSchema = useMemo(
    () => getSchemaForPath(selectedPath || ""),
    [selectedPath],
  );

  const formatLabel = (key: string) => key.replace(/_/g, " ");

  // --- 渲染字段 ---
  const renderField = (key: string) => {
    const value = formData[key];
    const type = currentSchema.fieldTypes[key] || "text";
    const options = currentSchema.fieldOptions[key];

    const labelClass =
      "block text-[10px] font-bold text-zinc-500 uppercase tracking-wider mb-1.5 ml-1";
    const inputBaseClass =
      "w-full h-10 bg-zinc-900 border border-zinc-800 rounded-md px-3 text-sm text-zinc-200 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none transition-all placeholder-zinc-600";

    if (type === "damage_label") {
      return (
        <div key={key}>
          <label className={labelClass}>{formatLabel(key)}</label>
          <DamageLabelSelect
            value={typeof value === "number" ? value : 0}
            onChange={(val) => handleChange(key, val)}
          />
        </div>
      );
    }

    if (type === "extra_modes") {
      return (
        <div key={key} className="col-span-1 md:col-span-2">
          <label className={labelClass}>{formatLabel(key)}</label>
          <ExtraModesEditor
            value={Array.isArray(value) ? value : []}
            onChange={(val) => handleChange(key, val)}
          />
        </div>
      );
    }

    if (type === "damage_modes") {
      return (
        <div key={key} className="col-span-1 md:col-span-2">
          <label className={labelClass}>{formatLabel(key)}</label>
          <DamageModesEditor
            value={Array.isArray(value) ? value : []}
            onChange={(val) => handleChange(key, val)}
          />
        </div>
      );
    }

    if (type === "mode_names") {
      return (
        <div key={key} className="col-span-1 md:col-span-2">
          <label className={labelClass}>{formatLabel(key)}</label>
          <ModeNamesEditor
            value={value && typeof value === "object" ? value : {}}
            onChange={(val) => handleChange(key, val)}
          />
        </div>
      );
    }

    if (type === "select" && options) {
      const hasIcons = key === "element";
      return (
        <div key={key}>
          <label className={labelClass}>{formatLabel(key)}</label>
          <CustomSelect
            value={value || ""}
            options={options}
            onChange={(val) => handleChange(key, val)}
            hasIcons={hasIcons}
          />
        </div>
      );
    }

    if (type === "damage_object") {
      const damageData = value || {
        base: 0,
        impulse: 0,
        toughness: 0,
        flesh: 0,
        hurtable: 0,
      };
      return (
        <div
          key={key}
          className="col-span-1 md:col-span-2 bg-zinc-900/30 p-4 border border-zinc-800/50 rounded-lg mt-2"
        >
          <label className="flex items-center gap-2 text-blue-400 font-bold mb-3 uppercase text-xs tracking-wider">
            Damage Configuration
          </label>
          <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
            {["base", "impulse", "toughness", "flesh", "hurtable"].map(
              (subKey) => (
                <div key={subKey}>
                  <span className="text-[9px] text-zinc-500 uppercase block mb-1 font-bold pl-1">
                    {subKey}
                  </span>
                  <input
                    type="number"
                    className={`${inputBaseClass} text-center font-mono`}
                    value={damageData[subKey] ?? 0}
                    onChange={(e) =>
                      handleChange(key, {
                        ...damageData,
                        [subKey]: parseFloat(e.target.value),
                      })
                    }
                  />
                </div>
              ),
            )}
          </div>
        </div>
      );
    }

    // Boolean 开关：修复卡顿 (加快动画) 和 样式
    if (type === "boolean") {
      return (
        <div key={key}>
          <label className={labelClass}>{formatLabel(key)}</label>
          <div
            className={`h-10 flex items-center justify-between px-3 bg-zinc-900 border border-zinc-800 rounded-md group hover:border-zinc-700 transition-colors cursor-pointer`}
            onClick={() => handleChange(key, !value)}
          >
            <span
              className={`text-sm font-medium ${value ? "text-blue-400" : "text-zinc-500"}`}
            >
              {value ? "Enabled" : "Disabled"}
            </span>

            <div className="relative inline-block w-9 h-5 align-middle select-none">
              <div
                className={`
                absolute block w-5 h-5 rounded-full bg-white border-4 border-zinc-900 
                transition-all duration-200 ease-out z-10 
                ${value ? "right-0" : "right-4"} 
                ${value ? "border-zinc-900" : "border-zinc-900"}
              `}
              ></div>
              <div
                className={`block overflow-hidden h-5 rounded-full transition-colors duration-200 ${
                  value ? "bg-blue-600" : "bg-zinc-700"
                }`}
              ></div>
            </div>
          </div>
        </div>
      );
    }

    if (type === "array") {
      // 确保传递给组件的是一个数组，防止数据为空时报错
      const tagsArray = Array.isArray(value) ? value : [];

      return (
        <div key={key} className="col-span-1 md:col-span-2">
          <label className={labelClass}>{formatLabel(key)}</label>
          <TagInput
            value={tagsArray}
            onChange={(newTags) => handleChange(key, newTags)}
          />
        </div>
      );
    }

    return (
      <div key={key}>
        <label className={labelClass}>{formatLabel(key)}</label>
        <input
          type={type === "number" ? "number" : "text"}
          className={inputBaseClass}
          value={value ?? ""}
          onChange={(e) => {
            const v = e.target.value;
            handleChange(
              key,
              type === "number" && v !== "" ? parseFloat(v) : v,
            );
          }}
        />
      </div>
    );
  };

  return (
    <>
      <style jsx global>{`
        /* 1. 隐藏数字输入框的箭头 (Spinner) */
        input[type="number"]::-webkit-inner-spin-button,
        input[type="number"]::-webkit-outer-spin-button {
          -webkit-appearance: none;
          margin: 0;
        }
        input[type="number"] {
          -moz-appearance: textfield; /* Firefox */
        }

        /* 2. 滚动条样式 */
        ::-webkit-scrollbar {
          width: 8px;
          height: 8px;
        }
        ::-webkit-scrollbar-track {
          background: #18181b;
        }
        ::-webkit-scrollbar-thumb {
          background: #3f3f46;
          border-radius: 4px;
        }
        ::-webkit-scrollbar-thumb:hover {
          background: #52525b;
        }
      `}</style>

      <div className="flex h-screen bg-black text-zinc-100 font-sans overflow-hidden">
        {/* 左侧边栏 */}
        <div className="w-72 shrink-0 border-r border-zinc-800 flex flex-col bg-zinc-950">
          <div className="p-4 border-b border-zinc-800">
            {/* Header: Title + Create Button */}
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2 text-zinc-100 font-bold tracking-tight">
                <div className="w-2 h-2 rounded-full bg-blue-500"></div>
                NZM Wiki CMS
              </div>
              {/* 👇 新建按钮 */}
              <button
                onClick={handleCreate}
                className="p-1.5 text-zinc-400 hover:text-white hover:bg-zinc-800 rounded transition-colors"
                title="Create New File"
              >
                <Icons.Plus />
              </button>
            </div>

            <div className="relative">
              <input
                type="text"
                placeholder="Find file..."
                className="w-full bg-zinc-900 border border-zinc-700 rounded-md pl-8 pr-3 py-1.5 text-xs text-white focus:border-blue-500 outline-none"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
              <span className="absolute left-2.5 top-2 text-zinc-500">
                <svg
                  className="w-3 h-3"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
                  />
                </svg>
              </span>
            </div>
          </div>

          <div className="flex-1 overflow-y-auto p-2">
            {treeLoading ? (
              <div className="p-4 text-xs text-zinc-500 flex items-center gap-2">
                <div className="w-3 h-3 border-2 border-zinc-600 border-t-transparent rounded-full animate-spin"></div>
                Loading...
              </div>
            ) : filteredTree.length === 0 ? (
              <div className="p-4 text-xs text-zinc-500 text-center">
                No files found.
              </div>
            ) : (
              filteredTree.map((node) => (
                <FileTreeItem
                  key={node.path}
                  item={node}
                  onSelect={loadFile}
                  onDelete={handleDelete} // 👈 传递 delete handle
                  activePath={selectedPath}
                  defaultOpen={searchTerm.trim() !== ""}
                />
              ))
            )}
          </div>
        </div>

        {/* 右侧编辑区 */}
        <div className="flex-1 flex flex-col h-full bg-[#09090b]">
          {!selectedPath ? (
            <div className="flex flex-col items-center justify-center h-full text-zinc-600 space-y-4">
              <div className="w-16 h-16 bg-zinc-900 rounded-full flex items-center justify-center">
                <Icons.File />
              </div>
              <p className="text-sm">Select a document to start editing</p>
            </div>
          ) : editorLoading ? (
            <div className="flex items-center justify-center h-full text-zinc-500 text-sm gap-2">
              <div className="w-4 h-4 border-2 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
              Loading data...
            </div>
          ) : (
            <div className="flex flex-col h-full">
              {/* Header */}
              <div className="px-8 py-4 border-b border-zinc-800 bg-zinc-950 flex justify-between items-center sticky top-0 z-20 shadow-sm">
                <div className="flex items-center gap-3">
                  <span className="p-1.5 bg-zinc-900 rounded border border-zinc-800 text-zinc-400">
                    <Icons.File />
                  </span>
                  <div>
                    <h2 className="text-sm font-bold text-zinc-200">
                      {selectedPath.split("/").pop()}
                    </h2>
                    <p className="text-xs text-zinc-500 font-mono mt-0.5">
                      {selectedPath}
                    </p>
                  </div>
                </div>
                <button
                  onClick={handleSave}
                  className="bg-blue-600 hover:bg-blue-500 text-white text-xs px-4 py-2 rounded-md font-medium transition-colors flex items-center gap-2"
                >
                  <Icons.Save />
                  Save Changes
                </button>
              </div>

              {/* Scrollable Content */}
              <div className="flex-1 overflow-y-auto p-8">
                <div className="max-w-5xl mx-auto grid grid-cols-1 xl:grid-cols-2 gap-10 pb-20">
                  {/* Left Column: Metadata */}
                  <div className="space-y-6">
                    <div className="flex items-center gap-2 pb-2 border-b border-zinc-800 mb-6">
                      <span className="text-zinc-500 font-mono text-xs">
                        01
                      </span>
                      <h3 className="text-sm font-bold text-zinc-100 uppercase tracking-wider">
                        Properties
                      </h3>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                      {currentSchema.fieldOrder.map((key) => {
                        if (key === "pellets" && formData.weapon_type !== "霰弹枪") {
                          return null;
                        }
                        if (key === "explosion_range" &&
                            !["单发榴弹", "连发榴弹", "火箭发射器"].includes(formData.weapon_type)) {
                          return null;
                        }
                        if (key === "damage_label_text" && formData.damage_label !== 2) {
                          return null;
                        }
                        return renderField(key);
                      })}
                    </div>
                  </div>

                  {/* Right Column: Content */}
                  <div className="flex flex-col h-full">
                    <div className="flex items-center gap-2 pb-2 border-b border-zinc-800 mb-6">
                      <span className="text-zinc-500 font-mono text-xs">
                        02
                      </span>
                      <h3 className="text-sm font-bold text-zinc-100 uppercase tracking-wider">
                        Markdown Body
                      </h3>
                    </div>
                    <div className="flex-1 min-h-125 bg-zinc-900/30 border border-zinc-800 rounded-lg p-1 relative group">
                      <textarea
                        className="w-full h-full bg-transparent border-none p-4 font-mono text-sm leading-relaxed text-zinc-300 focus:ring-0 outline-none resize-none"
                        value={content}
                        onChange={(e) => setContent(e.target.value)}
                        spellCheck={false}
                        placeholder="Write your markdown content here..."
                      />
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* 新增：Toast 通知组件 (放在最外层) */}
        <div
          className={`fixed bottom-6 right-6 z-50 px-4 py-3 rounded-lg shadow-lg flex items-center gap-3 transition-all duration-300 transform ${
            toast.show
              ? "opacity-100 translate-y-0"
              : "opacity-0 translate-y-4 pointer-events-none"
          } ${toast.type === "success" ? "bg-green-600 text-white" : "bg-red-600 text-white"}`}
        >
          {/* 图标 */}
          {toast.type === "success" ? (
            <svg
              className="w-5 h-5"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M5 13l4 4L19 7"
              />
            </svg>
          ) : (
            <svg
              className="w-5 h-5"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M6 18L18 6M6 6l12 12"
              />
            </svg>
          )}
          <span className="font-medium text-sm">{toast.msg}</span>
        </div>
      </div>
    </>
  );
}
