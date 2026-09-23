import '@/pages/table-heading-roles.css';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

// Chat-bubble markdown renderer: tight margins, mono code, bordered GFM tables.
// Desktop roles inherit the scoped Copilot variables; other consumers keep their
// fallbacks. Wide tables scroll horizontally inside their own wrapper instead of
// stretching the bubble.

const cellStyle: React.CSSProperties = {
  border: '1px solid var(--border-subtle)',
  padding: "var(--cp-md-cell-inset, 6px 10px)",
  fontSize: "var(--cp-body-size, 12.5px)",
  textAlign: 'left',
  verticalAlign: 'top',
};

const components = {
  // pre-wrap on paragraphs/list items keeps soft line breaks ("\n" inside a
  // paragraph) visible — chat replies rely on them — while the wrapper's
  // whiteSpace:normal still swallows the parser's between-block newlines.
  p: ({ children }: any) => <p style={{ margin: '0 0 8px', whiteSpace: 'pre-wrap' }}>{children}</p>,
  a: ({ href, children }: any) => (
    <a href={href} target="_blank" rel="noreferrer" style={{ color: 'var(--accent-primary)' }}>{children}</a>
  ),
  ul: ({ children }: any) => <ul style={{ margin: '0 0 8px', paddingLeft: "var(--cp-md-list-inset, 18px)" }}>{children}</ul>,
  ol: ({ children }: any) => <ol style={{ margin: '0 0 8px', paddingLeft: "var(--cp-md-list-inset, 18px)" }}>{children}</ol>,
  li: ({ children }: any) => <li style={{ margin: "var(--cp-md-list-margin, 2px 0)", whiteSpace: 'pre-wrap' }}>{children}</li>,
  h1: ({ children }: any) => <div style={{ fontSize: "var(--cp-section-size, 15px)", fontWeight: 600, lineHeight: "var(--cp-section-line, inherit)", margin: "var(--cp-md-heading-margin, 10px 0 6px)", color: 'var(--text-primary)' }}>{children}</div>,
  h2: ({ children }: any) => <div style={{ fontSize: "var(--cp-section-size, 14px)", fontWeight: 600, lineHeight: "var(--cp-section-line, inherit)", margin: "var(--cp-md-heading-margin, 10px 0 6px)", color: 'var(--text-primary)' }}>{children}</div>,
  h3: ({ children }: any) => <div style={{ fontSize: "var(--cp-section-size, 13px)", fontWeight: 600, lineHeight: "var(--cp-section-line, inherit)", margin: "var(--cp-md-heading-margin, 8px 0 5px)", color: 'var(--text-primary)' }}>{children}</div>,
  code: ({ children, ...props }: any) => {
    // Block code is rendered inside our <pre> override; only style inline code here.
    const isBlock = typeof props.className === 'string' && props.className.includes('language-');
    if (isBlock) return <code style={{ fontFamily: 'var(--font-mono)', fontSize: "var(--cp-support-size, 12px)", fontWeight: "var(--cp-code-weight, inherit)" as React.CSSProperties['fontWeight'], lineHeight: "var(--cp-support-line, inherit)" }}>{children}</code>;
    return (
      <code style={{ fontFamily: 'var(--font-mono)', fontSize: "var(--cp-support-size, 12px)", fontWeight: "var(--cp-code-weight, inherit)" as React.CSSProperties['fontWeight'], lineHeight: "var(--cp-support-line, inherit)", background: 'var(--bg-base)', padding: "var(--cp-md-code-inset, 1px 5px)", borderRadius: 4 }}>
        {children}
      </code>
    );
  },
  pre: ({ children }: any) => (
    <pre style={{ margin: '0 0 8px', padding: "var(--cp-md-pre-inset, 8px 10px)", background: 'var(--bg-base)', border: '1px solid var(--border-subtle)', borderRadius: 4, overflowX: 'auto', fontFamily: 'var(--font-mono)', fontSize: "var(--cp-support-size, 12px)", fontWeight: "var(--cp-code-weight, inherit)" as React.CSSProperties['fontWeight'], lineHeight: "var(--cp-support-line, 1.55)" }}>
      {children}
    </pre>
  ),
  blockquote: ({ children }: any) => (
    <blockquote style={{ margin: '0 0 8px', padding: "var(--cp-md-quote-inset, 2px 0 2px 10px)", borderLeft: '2px solid var(--border-subtle)', color: 'var(--text-secondary)' }}>
      {children}
    </blockquote>
  ),
  hr: () => <hr style={{ border: 'none', borderTop: '1px solid var(--border-subtle)', margin: "var(--cp-md-rule-margin, 10px 0)" }} />,
  table: ({ children }: any) => (
    <div style={{ overflowX: 'auto', margin: '0 0 8px' }}>
      <table className="table-heading-roles" style={{ borderCollapse: 'collapse', border: '1px solid var(--border-subtle)', fontSize: "var(--cp-body-size, 12.5px)" }}>{children}</table>
    </div>
  ),
  th: ({ children }: any) => (
    <th style={{ ...cellStyle, fontSize: undefined, background: 'var(--bg-base)' }}>
      {children}
    </th>
  ),
  td: ({ children }: any) => <td style={cellStyle}>{children}</td>,
};

export default function Markdown({ children }: { children: string }) {
  return (
    // whiteSpace 'normal' overrides the chat bubble's pre-wrap, which would
    // otherwise render the parser's inter-block newlines as blank lines.
    <div className="cp-md" style={{ fontSize: "var(--cp-body-size, 13px)", lineHeight: "var(--cp-body-line, 1.6)", color: 'var(--text-primary)', whiteSpace: 'normal' }}>
      <ReactMarkdown remarkPlugins={[remarkGfm]} components={components}>{children}</ReactMarkdown>
    </div>
  );
}
