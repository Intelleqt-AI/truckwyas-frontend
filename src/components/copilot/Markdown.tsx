import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

// Chat-bubble markdown renderer: tight margins, mono code, bordered GFM tables.
// Typography matches the copilot bubble (13px, var(--text-primary)); wide tables
// scroll horizontally inside their own wrapper instead of stretching the bubble.

const cellStyle: React.CSSProperties = {
  border: '1px solid var(--border-subtle)',
  padding: '6px 10px',
  fontSize: 12.5,
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
  ul: ({ children }: any) => <ul style={{ margin: '0 0 8px', paddingLeft: 18 }}>{children}</ul>,
  ol: ({ children }: any) => <ol style={{ margin: '0 0 8px', paddingLeft: 18 }}>{children}</ol>,
  li: ({ children }: any) => <li style={{ margin: '2px 0', whiteSpace: 'pre-wrap' }}>{children}</li>,
  h1: ({ children }: any) => <div style={{ fontSize: 15, fontWeight: 600, margin: '10px 0 6px', color: 'var(--text-primary)' }}>{children}</div>,
  h2: ({ children }: any) => <div style={{ fontSize: 14, fontWeight: 600, margin: '10px 0 6px', color: 'var(--text-primary)' }}>{children}</div>,
  h3: ({ children }: any) => <div style={{ fontSize: 13, fontWeight: 600, margin: '8px 0 5px', color: 'var(--text-primary)' }}>{children}</div>,
  code: ({ children, ...props }: any) => {
    // Block code is rendered inside our <pre> override; only style inline code here.
    const isBlock = typeof props.className === 'string' && props.className.includes('language-');
    if (isBlock) return <code style={{ fontFamily: 'var(--font-mono)', fontSize: 12 }}>{children}</code>;
    return (
      <code style={{ fontFamily: 'var(--font-mono)', fontSize: 12, background: 'var(--bg-base)', padding: '1px 5px', borderRadius: 4 }}>
        {children}
      </code>
    );
  },
  pre: ({ children }: any) => (
    <pre style={{ margin: '0 0 8px', padding: '8px 10px', background: 'var(--bg-base)', border: '1px solid var(--border-subtle)', borderRadius: 4, overflowX: 'auto', fontFamily: 'var(--font-mono)', fontSize: 12, lineHeight: 1.55 }}>
      {children}
    </pre>
  ),
  blockquote: ({ children }: any) => (
    <blockquote style={{ margin: '0 0 8px', padding: '2px 0 2px 10px', borderLeft: '2px solid var(--border-subtle)', color: 'var(--text-secondary)' }}>
      {children}
    </blockquote>
  ),
  hr: () => <hr style={{ border: 'none', borderTop: '1px solid var(--border-subtle)', margin: '10px 0' }} />,
  table: ({ children }: any) => (
    <div style={{ overflowX: 'auto', margin: '0 0 8px' }}>
      <table style={{ borderCollapse: 'collapse', border: '1px solid var(--border-subtle)', fontSize: 12.5 }}>{children}</table>
    </div>
  ),
  th: ({ children }: any) => (
    <th style={{ ...cellStyle, fontFamily: 'var(--font-mono)', fontSize: 10.5, textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--text-tertiary)', background: 'var(--bg-base)', fontWeight: 600 }}>
      {children}
    </th>
  ),
  td: ({ children }: any) => <td style={cellStyle}>{children}</td>,
};

export default function Markdown({ children }: { children: string }) {
  return (
    // whiteSpace 'normal' overrides the chat bubble's pre-wrap, which would
    // otherwise render the parser's inter-block newlines as blank lines.
    <div className="cp-md" style={{ fontSize: 13, lineHeight: 1.6, color: 'var(--text-primary)', whiteSpace: 'normal' }}>
      <ReactMarkdown remarkPlugins={[remarkGfm]} components={components}>{children}</ReactMarkdown>
    </div>
  );
}
