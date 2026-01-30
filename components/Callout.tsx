/**
 * 自动在中文和数字/英文/百分号之间添加空格
 * 如果已有空格则不重复添加
 */
function autoSpace(text: string): string {
  // 中文后接数字/英文/百分号，且中间没有空格
  let result = text.replace(
    /([\u4e00-\u9fff])([A-Za-z0-9%])/g,
    "$1 $2"
  );
  // 数字/英文/百分号后接中文，且中间没有空格
  result = result.replace(
    /([A-Za-z0-9%])([\u4e00-\u9fff])/g,
    "$1 $2"
  );
  return result;
}

interface CalloutProps {
  children: React.ReactNode;
}

export function Callout({ children }: CalloutProps) {
  // 递归处理子元素中的文本节点
  const processChildren = (node: React.ReactNode): React.ReactNode => {
    if (typeof node === "string") {
      return autoSpace(node);
    }
    return node;
  };

  return (
    <div className="not-prose my-4 rounded-xl border border-zinc-700 bg-zinc-800/30 px-4 py-3">
      <div className="flex items-start gap-3">
        <div className="h-full w-1 flex-shrink-0 rounded-full bg-zinc-500 self-stretch" />
        <div className="text-sm text-zinc-300 leading-relaxed">
          {Array.isArray(children)
            ? children.map((child, i) => (
                <span key={i}>{processChildren(child)}</span>
              ))
            : processChildren(children)}
        </div>
      </div>
    </div>
  );
}
