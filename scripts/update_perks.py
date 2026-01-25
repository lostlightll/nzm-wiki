#!/usr/bin/env python3
"""
根据 perks.json 中的数据更新 slot-1, slot-2, slot-3, slot-4 目录中的 perk JSON 文件
将结构改为: id, name, slot, rarity, description, icon, weapon_type
"""

import json
import re
from pathlib import Path
from collections import OrderedDict

BASE_DIR = Path(__file__).parent.parent / 'data' / 's0' / 'perks'
PERKS_JSON_PATH = BASE_DIR / 'perks.json'


def normalize_name(name):
    """移除零宽空格和其他不可见字符"""
    # 移除零宽空格 \u200b, \u200c, \u200d, \ufeff 等
    return re.sub(r'[\u200b\u200c\u200d\ufeff\u00a0]', '', name).strip()


def main():
    # 读取主 perks.json
    with open(PERKS_JSON_PATH, 'r', encoding='utf-8') as f:
        perks_data = json.load(f)

    # 按标准化名称创建映射以便快速查找
    perks_by_name = {}
    for perk in perks_data:
        normalized = normalize_name(perk['name'])
        perks_by_name[normalized] = perk

    slots = ['slot-1', 'slot-2', 'slot-3', 'slot-4']
    updated_count = 0
    not_found_count = 0
    not_found_names = []

    for slot_dir in slots:
        slot_path = BASE_DIR / slot_dir
        slot_number = int(slot_dir.split('-')[1])

        if not slot_path.exists():
            print(f"目录 {slot_dir} 不存在，跳过...")
            continue

        json_files = list(slot_path.glob('*.json'))

        for file_path in json_files:
            with open(file_path, 'r', encoding='utf-8') as f:
                current_data = json.load(f)

            perk_name = current_data.get('name', '')
            normalized_perk_name = normalize_name(perk_name)

            # 在 perks.json 中查找匹配的 perk（使用标准化名称）
            source_perk = perks_by_name.get(normalized_perk_name)

            if not source_perk:
                print(f"警告: Perk \"{perk_name}\" 在 perks.json 中未找到")
                not_found_count += 1
                not_found_names.append(perk_name)

                # 未找到时使用默认值
                new_data = OrderedDict([
                    ('id', ''),
                    ('name', normalized_perk_name),  # 使用清理后的名称
                    ('slot', slot_number),
                    ('rarity', 3),
                    ('description', ''),
                    ('icon', ''),
                    ('weapon_type', [])
                ])
            else:
                # 按指定字段顺序创建新结构
                new_data = OrderedDict([
                    ('id', source_perk['id']),
                    ('name', normalize_name(source_perk['name'])),  # 清理名称中的不可见字符
                    ('slot', slot_number),
                    ('rarity', 3),
                    ('description', source_perk['description']),
                    ('icon', source_perk['icon']),
                    ('weapon_type', source_perk['weapon_type'])
                ])

            with open(file_path, 'w', encoding='utf-8') as f:
                json.dump(new_data, f, ensure_ascii=False, indent=2)
                f.write('\n')

            updated_count += 1
            print(f"已更新: {slot_dir}/{file_path.name}")

    print(f"\n完成！共更新 {updated_count} 个文件。")
    if not_found_count > 0:
        print(f"警告: {not_found_count} 个 perk 在 perks.json 中未找到:")
        for name in not_found_names:
            print(f"  - {name}")


if __name__ == '__main__':
    main()
