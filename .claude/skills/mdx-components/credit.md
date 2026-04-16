# Credit

致谢来源卡片，通常放在页面末尾。

## 属性

| 属性 | 类型 | 默认值 | 说明 |
|---|---|---|---|
| `platform` | string | `"link"` | 平台 |
| `author` | string | - | 作者名 |
| `url` | string | - | 链接地址 |
| `title` | string | - | 标题（显示在作者名旁） |

platform 可选：`bilibili`, `youtube`, `twitter`, `github`, `douyin`, `tieba`, `link`

## 示例

```mdx
<Credit platform="bilibili" author="逆战未来" url="https://www.bilibili.com/video/BV1x4QgBKEoR" title="BV1x4QgBKEoR" />
<Credit platform="douyin" author="逆战未来" url="https://v.douyin.com/mv1-Ieg5xjQ/" title="mv1-Ieg5xjQ" />
<Credit author="某作者" url="https://example.com" title="参考文章" />
```
