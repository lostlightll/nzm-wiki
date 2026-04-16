# WeaponSkill / ActiveSkill / PassiveSkill

武器技能展示组件。`WeaponSkill` 是外层容器，内部放 `ActiveSkill` 和 `PassiveSkill`。

## ActiveSkill 属性

| 属性 | 类型 | 说明 |
|---|---|---|
| `name` | string | 技能名称 |
| `icon` | string | 图标路径 |
| `duration` | number | 持续时间（秒），-1 表示无限 |
| `cooldown` | number | 冷却时间（秒） |
| `count` | number | 可累积次数 |
| `children` | ReactNode | 技能描述 |

## PassiveSkill 属性

同 ActiveSkill，额外支持 `tag`（自定义标签文字，如"快速连发"）。

## 示例

```mdx
<WeaponSkill>
  <ActiveSkill
    name="飓龙连击"
    icon="/icons/weapons/skills/T_Weapon_Skill_20003000011_2.png"
    duration={-1}
    cooldown={25}
    count={1}
  >
    技能描述文字
  </ActiveSkill>
  <PassiveSkill
    name="炙热龙炎"
    tag="快速连发"
    icon="/icons/weapons/skills/T_Weapon_Skill_20003000011_1.png"
  >
    被动技能描述
  </PassiveSkill>
</WeaponSkill>
```
