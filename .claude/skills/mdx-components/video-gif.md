# VideoGif

以 GIF 方式展示 mp4 视频（自动播放、循环、静音、无控制栏）。视频文件放在 `public/videos/` 目录下。

## 属性

| 属性 | 类型 | 必填 | 说明 |
|---|---|---|---|
| `src` | string | 是 | 视频路径，如 `"/videos/xxx.mp4"` |
| `alt` | string | 否 | 无障碍描述 |
| `width` | number | 否 | 视频宽度（px） |

## 示例

```mdx
<VideoGif src="/videos/snake-god-slash.mp4" />
<VideoGif src="/videos/demo.mp4" alt="技能演示" width={400} />
```
