# 逆战未来 维基

> [!NOTE]
> 正在施工中

技术栈: React, Next.js, TypeScript, Tailwind CSS, [MDX](https://mdxjs.com/)

## 特性 (Features)

### 搜索面板 (Search Pannel)

按 `Ctrl/Cmd + p` 或点击搜索框打开搜索面板，支持：
- 拼音搜索（全拼、首字母缩写）
- 模糊匹配
- 键盘导航（↑↓ 选择，Enter 跳转，Esc 关闭）

### 命令面板 (Command Pannel)

按 `Ctrl/Cmd + Shift + p` 打开命令面板，可快速执行：
- 打开计算器
- 跳转到 Github 文件页面 (只在 MDX 页面生效，方便快速修改)

### 计算器 (Floating Calculator)

计算器悬浮窗口，可以自由拖动，支持：
- 基础运算：`+ - * / ^ ()`
- 百分号：`25%` → `0.25`
- 中文变量：`攻击力 = 500`
- 公式变量：变量存储公式，引用时自动重新计算
- 循环引用检测

命令：
- `clear` / `cl` - 清屏（保留变量）
- `reset` - 清屏并清空变量
- `show <变量名>` - 查看公式定义
- `help` - 显示帮助
- `exit` / `quit` / `q` - 关闭

示例：
```
> 基础伤害 200
> 伤害倍率 0.8
> 最终伤害 = 基础伤害 * 伤害倍率
> 最终伤害 = 160
> 基础伤害 100
> 最终伤害 = 80    # 自动重新计算
```

## 开发 (Development)

安装依赖：

```bash
pnpm i
```

启动开发服务器：

```bash
pnpm dev
```

打开 [http://localhost:3000](http://localhost:3000) 查看网站。

打开 [http://localhost:3000/editor](http://localhost:3000/editor) 编辑 MDX 文件。

<img alt="editor-preview" src="https://github.com/user-attachments/assets/f9a7e58f-d30f-4907-8895-667c28a406fb" />

### 注意事项

添加或修改 MDX 文件后，下面命令可以手动重新生成搜索索引（`pnpm build` 时是会自动执行的）：

```bash
pnpm search-index
```

添加新图片后，需要转换为 webp 格式 (png 原图会保留，下面的命令会在 `/public/webp` 下存放所有的压缩后的 webp 格式，为了加快加载速度)：

```bash
pnpm webp
```

## MDX 可用组件 (Components)

### Frontmatter

MDX 文件支持以下 frontmatter 字段：

| 字段         | 类型                 | 默认值 | 说明                   |
| :---         | :---                 | :---   | :---                   |
| `title`      | string               | -      | 页面标题               |
| `tag`        | string               | -      | 分类标签               |
| `toc`        | boolean              | `true` | 是否显示目录           |
| `page-width` | string               | `lg`   | 页面宽度               |
| `keywords`   | string 或者 string[] | -      | 自定义额外的搜索关键词 |
| `nickname`   | string               | -      | 别名（用于搜索）       |

`page-width` 可选值：

| 值     | Tailwind class | 宽度   |
| :---   | :---           | :---   |
| `sm`   | max-w-xl       | 576px  |
| `md`   | max-w-2xl      | 672px  |
| `lg`   | max-w-3xl      | 768px  |
| `xl`   | max-w-4xl      | 896px  |
| `2xl`  | max-w-5xl      | 1024px |
| `3xl`  | max-w-6xl      | 1152px |
| `full` | max-w-7xl      | 1280px |

也支持自定义宽度值（如 `1200px`、`80rem`），移动端会自动撑满屏幕。

搜索会自动索引：`title`、`keywords`、`nickname`、`tags`、`weapon_type`、`element`、`rarity`、`tag` 等字段。

### Callout

```mdx
<Callout>默认灰色提示</Callout>
<Callout color="blue">蓝色提示</Callout>
<Callout color="green">绿色提示</Callout>
<Callout color="yellow">黄色提示</Callout>
<Callout color="red">红色提示</Callout>
<Callout color="purple">紫色提示</Callout>
```

### Highlight

```mdx
<Highlight>默认 sunny 黄色高亮</Highlight>
<Highlight color="sunny">sunny - #faeb7b</Highlight>
<Highlight color="peach">peach - #f6c9b6</Highlight>
<Highlight color="cyan">cyan - #bee2dc</Highlight>
<Highlight color="violet">violet - #b8bcfa</Highlight>
<Highlight color="magenta">magenta - #e9b5fa</Highlight>
<Highlight color="hazy">hazy - #d3d3d3</Highlight>
```

### Text Color

```mdx
<Red>Red - #cf5148</Red>
<Yellow>Yellow - #cb9434</Yellow>
<Green>Green - #50946e</Green>
<Grey>Grey - #7d7a75</Grey>
<Orange>Orange - #d27b2d</Orange>
<Brown>Brown - #9f765a</Brown>
<Blue>Blue - #387dc9</Blue>
<Purple>Purple - #9a6bb4</Purple>
<Pink>Pink - #c14c8a</Pink>
```

```mdx
<Fire>Fire - #f8c618</Fire>
<Ice>Ice - #90f5ff</Ice>
<Shock>Shock - #a09eff</Shock>
<Corrosive>Corrosive - #c3db2a</Corrosive>
<Kinetic>Kinetic - #becacc</Kinetic>
```

## 脚本 (Scripts)

解码 CG：
```bash
python3 ./scripts/convert.py "/e/games/WeGameApps/rail_apps/逆战：未来(2002130)/NZM/Content/Movies"
```

解包 Pak：
```bash
./scripts/decrypt.sh NZM/Content/AIBehavior/
```

更详细介绍请看此视频 [BV1fVfXB8EkT](https://www.bilibili.com/video/BV1fVfXB8EkT)

## 更多 (About)

更多关于逆战未来的内容，见 https://qiekn.notion.site/nzm
