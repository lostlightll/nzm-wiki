# 乘区案例双向索引设计

## 当前状态

乘区页面的数据保存在 `data/guides/multiplier.json`。

每条典型案例目前直接保存站内 `href`，例如：

```json
{
  "id": "pure-white-active-skill",
  "label": "纯白主动技能",
  "href": "/weapons/纯白至上"
}
```

这能满足乘区页面跳转到武器、插件或天赋页面的单向导航，但路径字符串本身不适合作为长期的数据身份。

## 目标

以后支持以下两个方向的关联：

1. 乘区案例跳转到对应武器、插件或赛季天赋节点。
2. 武器、插件或赛季天赋页面反向展示其所属乘区、增伤对象和案例名称。

双向关系只维护一份。反向索引必须从乘区数据自动派生，不在各个 MDX 文件中重复填写乘区关系。

## 数据结构

将案例中的 `href` 替换为结构化的 `source` 实体引用。

### 武器或武器局部效果

```json
{
  "id": "pure-white-active-skill",
  "label": "纯白主动技能",
  "source": {
    "type": "weapon",
    "slug": "纯白至上",
    "anchor": "active-skill"
  }
}
```

武器词条同样引用武器页面，通过 `anchor` 定位到具体词条：

```json
{
  "id": "icepoint-twin-peaks-close-range",
  "label": "冰点双峰近距词条",
  "source": {
    "type": "weapon",
    "slug": "冰点双峰",
    "anchor": "close-range-affix"
  }
}
```

### 插件

```json
{
  "id": "guan-shan-kui-gu",
  "label": "观山窥骨",
  "source": {
    "type": "perk",
    "slot": 3,
    "slug": "观山窥骨"
  }
}
```

### 赛季天赋节点

```json
{
  "id": "example-talent-node",
  "label": "示例天赋节点",
  "source": {
    "type": "season-talent",
    "season": "s3",
    "tree": "zero",
    "nodeId": "example-node"
  }
}
```

对应的 TypeScript 联合类型可定义为：

```ts
type MultiplierSource =
  | {
      type: "weapon";
      slug: string;
      anchor?: string;
    }
  | {
      type: "perk";
      slot: 1 | 2 | 3 | 4;
      slug: string;
      anchor?: string;
    }
  | {
      type: "season-talent";
      season: string;
      tree: string;
      nodeId: string;
    };
```

## 路由解析

所有跳转地址由统一函数生成，不在 JSON 中重复保存路径：

```ts
resolveMultiplierSourceHref(source)
```

预期映射：

| 来源 | 生成路径 |
| :--- | :--- |
| 武器 | `/weapons/{slug}#{anchor}` |
| 插件 | `/perks/slot-{slot}/{slug}#{anchor}` |
| 赛季天赋 | `/guides/season-talents/{season}/{tree}#{nodeId}` |

没有 `anchor` 时不添加 URL fragment。

## 反向索引

为每种来源生成稳定索引键：

```text
weapon:纯白至上
perk:slot-3:观山窥骨
season-talent:s3:zero:example-node
```

索引值记录案例所在的乘区和分类：

```ts
type MultiplierRelation = {
  factorId: string;
  categoryId: string;
  categoryLabel: string;
  exampleId: string;
  exampleLabel: string;
};
```

读取接口：

```ts
getMultiplierRelationsForSource(source)
```

武器、插件或天赋详情页只需要传入自身实体引用，即可渲染类似内容：

```text
大稀释乘区
└─ 全伤害
   └─ 纯白主动技能
```

## 数据所有权

- `data/guides/multiplier.json` 是乘区关系的唯一来源。
- 武器和插件 MDX 继续作为各自实体内容的唯一来源。
- MDX 中不重复保存所属乘区，避免双向手工维护产生漂移。
- 案例的 `label` 可以描述实体的局部效果，不要求与目标页面标题相同。
- `source` 负责标识目标实体，`anchor` 负责标识页面内的具体位置。

## 构建校验

迁移时增加以下检查：

1. 案例 ID、分类 ID 不重复。
2. `source.type` 属于允许的实体类型。
3. 插件 `slot` 只能为 1 至 4。
4. 引用的武器、插件或天赋实体真实存在。
5. 使用 `anchor` 时，对应页面存在稳定锚点。
6. 同一案例不能重复关联到同一分类。
7. 路由只能由解析器生成，JSON 中不再接受 `href`。

## 迁移步骤

1. 为武器技能、武器词条和天赋节点确定稳定锚点规则。
2. 将现有案例的 `href` 逐条迁移为 `source`。
3. 实现 `resolveMultiplierSourceHref()`。
4. 实现来源索引键和 `getMultiplierRelationsForSource()`。
5. 在乘区页面改用路由解析器生成链接。
6. 在武器、插件和天赋详情页增加“所属乘区”反向展示。
7. 把实体存在性与锚点检查加入构建或独立校验脚本。

## 暂缓事项

- 当前继续使用 `href`，不立即迁移现有页面。
- 暂不把反向索引写入搜索索引。
- 暂不为乘区关系单独新增公开 API。
- 暂不在各个 MDX 文件中添加乘区字段。
