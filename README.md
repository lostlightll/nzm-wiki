# 逆战未来 维基

> [!NOTE]
> 正在施工中

TechStack: React, Next.js, TypeScript, Tailwindcss, [MDX](https://mdxjs.com/)

## Development

First, run `pnpm i` to install the dependencies.

Then, run `pnpm dev` to start the development server.

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

Open [http://localhost:3000/editor](http://localhost:3000/editor) to edit wiki mdx files.

<img alt="editor-preview" src="https://github.com/user-attachments/assets/f9a7e58f-d30f-4907-8895-667c28a406fb" />

## MDX Components

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

### Text Colors

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

### Element Colors

```mdx
<Fire>Fire - #f8c618</Fire>
<Ice>Ice - #90f5ff</Ice>
<Shock>Shock - #a09eff</Shock>
<Corrosive>Corrosive - #c3db2a</Corrosive>
<Kinetic>Kinetic - #becacc</Kinetic>
```

## Scripts

Decode CG: `python3 ./scripts/convert.py "/e/games/WeGameApps/rail_apps/逆战：未来(2002130)/NZM/Content/Movies"`
Decrypt: for example`./scripts/decrypt.sh NZM/Content/AIBehavior/`

## Extra

For more about Nizhan: Future, See my notes at https://qiekn.notion.site/nzm
