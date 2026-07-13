import {
  TEXT_COLORS,
  HIGHLIGHT_COLORS,
  type HighlightColor,
} from "@/constants/colors";

interface TextStyleProps {
  children: React.ReactNode;
}

// 文字颜色组件
export function Red({ children }: TextStyleProps) {
  return <span style={{ color: TEXT_COLORS.red }}>{children}</span>;
}

export function Yellow({ children }: TextStyleProps) {
  return <span style={{ color: TEXT_COLORS.yellow }}>{children}</span>;
}

export function Green({ children }: TextStyleProps) {
  return <span style={{ color: TEXT_COLORS.green }}>{children}</span>;
}

export function Grey({ children }: TextStyleProps) {
  return <span style={{ color: TEXT_COLORS.grey }}>{children}</span>;
}

export function Orange({ children }: TextStyleProps) {
  return <span style={{ color: TEXT_COLORS.orange }}>{children}</span>;
}

export function Brown({ children }: TextStyleProps) {
  return <span style={{ color: TEXT_COLORS.brown }}>{children}</span>;
}

export function Blue({ children }: TextStyleProps) {
  return <span style={{ color: TEXT_COLORS.blue }}>{children}</span>;
}

export function Purple({ children }: TextStyleProps) {
  return <span style={{ color: TEXT_COLORS.purple }}>{children}</span>;
}

export function Pink({ children }: TextStyleProps) {
  return <span style={{ color: TEXT_COLORS.pink }}>{children}</span>;
}

// 元素属性颜色
export function Fire({ children }: TextStyleProps) {
  return <span style={{ color: TEXT_COLORS.fire }}>{children}</span>;
}

export function Ice({ children }: TextStyleProps) {
  return <span style={{ color: TEXT_COLORS.ice }}>{children}</span>;
}

export function Shock({ children }: TextStyleProps) {
  return <span style={{ color: TEXT_COLORS.shock }}>{children}</span>;
}

export function Corrosive({ children }: TextStyleProps) {
  return <span style={{ color: TEXT_COLORS.corrosive }}>{children}</span>;
}

export function Kinetic({ children }: TextStyleProps) {
  return <span style={{ color: TEXT_COLORS.kinetic }}>{children}</span>;
}

// 荧光笔高亮
interface HighlightProps {
  children: React.ReactNode;
  color?: HighlightColor;
}

export function Highlight({ children, color = "sunny" }: HighlightProps) {
  return (
    <span
      style={{
        backgroundColor: HIGHLIGHT_COLORS[color],
        color: "#1a1a1a",
        padding: "0.1em 0.3em",
        borderRadius: "0.2em",
      }}
    >
      {children}
    </span>
  );
}
