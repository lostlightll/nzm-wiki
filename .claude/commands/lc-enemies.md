用户会提供一个或多个塔防敌人名称: $ARGUMENTS

## 流程

对于每个敌人名称，执行以下步骤：

### 1. 查找敌人数据

在 `refs/Exports/NZM/Content/DataTables/MonsterUniqueIDTable.json` 中搜索 `"Name": "<敌人名称>"`，获取该敌人的完整数据。

如果找不到，告知用户并跳过。

### 2. 确定敌人类型

根据 MonsterType 和现有 MDX 的对应关系判断 type：
- MonsterType 3 = normal
- MonsterType 4 = normal
- MonsterType 5 = elite
- MonsterType 7 = boss

如果遇到未知 MonsterType，询问用户。

### 3. 复制图标

从 MonsterIcon.AssetPathName 中提取图标路径：
- `/Game/...` 对应 `refs/Exports/NZM/...`
- 只取 `.` 之前的部分作为路径，加上 `.png` 后缀

将图标复制到 `public/icons/enemies/td/<type>/<Name>.png`，其中 `<type>` 是 normal/elite/boss。

### 4. 创建 MDX 文件

在 `data/s0/enemies/td/<Name>.mdx` 创建文件，frontmatter 格式如下：

```yaml
---
title: <Name>
nickname: ''
type: <normal|elite|boss>
attack: <SpellPower, 如果是 100.0 就填 100>
hp: <MaxHealth, 如果是 1.0 这种明显不是实际血量的值就填 '?'>
hitback_hp: <HitBackThreshold>
hardstraight_hp: <HardStraightThreshold>
weight: <NPCBodyWeight>
speed: 5
description: <NarrativeContent, 去掉 <br> 标签，转换为纯文本>
---
```

注意事项：
- hp 如果是 1.0 这种明显不是实际数值的，填 `'?'`
- description 中的 `<br>` 和 `<br><br>` 替换为空格或适当的文本连接
- attack 如果是 0.0 或不合理的值，填 `''`
- 如果 description 很长，使用 YAML 的 `>-` 多行语法

### 5. 完成后

列出所有创建的文件和复制的图标，让用户确认。
