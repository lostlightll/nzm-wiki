import type { MDXComponents } from "mdx/types";

export function useMDXComponents(components: MDXComponents): MDXComponents {
  return {
    ...components,
    wrapper: ({ children }) => (
      <div className="mx-auto max-w-3xl p-10">
        <article className="prose prose-lg prose-invert max-w-none">
          {children}
        </article>
      </div>
    ),
  };
}
