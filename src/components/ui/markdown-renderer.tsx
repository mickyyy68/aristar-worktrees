import { memo, useState } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { oneDark } from 'react-syntax-highlighter/dist/esm/styles/prism';
import { Check, Copy } from 'lucide-react';
import { cn } from '@/lib/utils';

interface MarkdownRendererProps {
  content: string;
  className?: string;
}

function CopyButton({ code }: { code: string }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    await navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <button
      onClick={handleCopy}
      className="absolute right-2 top-2 rounded-md bg-muted/80 p-1.5 text-muted-foreground opacity-0 transition-opacity hover:bg-muted hover:text-foreground group-hover:opacity-100"
      title={copied ? 'Copied!' : 'Copy code'}
    >
      {copied ? (
        <Check className="h-4 w-4 text-green-500" />
      ) : (
        <Copy className="h-4 w-4" />
      )}
    </button>
  );
}

export const MarkdownRenderer = memo(function MarkdownRenderer({
  content,
  className,
}: MarkdownRendererProps) {
  return (
    <div className={cn('prose prose-sm dark:prose-invert max-w-none', className)}>
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          code({ className, children, ...props }) {
            const match = /language-(\w+)/.exec(className || '');
            const isInline = !match;
            const codeString = String(children).replace(/\n$/, '');

            if (isInline) {
              return (
                <code
                  className="rounded bg-muted px-1.5 py-0.5 font-mono text-sm"
                  {...props}
                >
                  {children}
                </code>
              );
            }

            return (
              <div className="group relative my-4">
                <CopyButton code={codeString} />
                <SyntaxHighlighter
                  style={oneDark}
                  language={match[1]}
                  PreTag="div"
                  customStyle={{
                    margin: 0,
                    borderRadius: '0.5rem',
                    fontSize: '0.875rem',
                  }}
                >
                  {codeString}
                </SyntaxHighlighter>
              </div>
            );
          },
          pre({ children }) {
            // Let the code component handle the rendering
            return <>{children}</>;
          },
          p({ children }) {
            return <p className="mb-3 leading-relaxed">{children}</p>;
          },
          ul({ children }) {
            return <ul className="mb-3 list-disc pl-6">{children}</ul>;
          },
          ol({ children }) {
            return <ol className="mb-3 list-decimal pl-6">{children}</ol>;
          },
          li({ children }) {
            return <li className="mb-1">{children}</li>;
          },
          a({ href, children }) {
            return (
              <a
                href={href}
                target="_blank"
                rel="noopener noreferrer"
                className="text-primary underline underline-offset-2 hover:text-primary/80"
              >
                {children}
              </a>
            );
          },
          h1({ children }) {
            return <h1 className="mb-4 mt-6 text-2xl font-bold">{children}</h1>;
          },
          h2({ children }) {
            return <h2 className="mb-3 mt-5 text-xl font-semibold">{children}</h2>;
          },
          h3({ children }) {
            return <h3 className="mb-2 mt-4 text-lg font-semibold">{children}</h3>;
          },
          h4({ children }) {
            return <h4 className="mb-2 mt-3 text-base font-semibold">{children}</h4>;
          },
          blockquote({ children }) {
            return (
              <blockquote className="my-3 border-l-4 border-muted-foreground/30 pl-4 italic text-muted-foreground">
                {children}
              </blockquote>
            );
          },
          table({ children }) {
            return (
              <div className="my-4 overflow-x-auto">
                <table className="w-full border-collapse border border-border">
                  {children}
                </table>
              </div>
            );
          },
          th({ children }) {
            return (
              <th className="border border-border bg-muted px-3 py-2 text-left font-semibold">
                {children}
              </th>
            );
          },
          td({ children }) {
            return (
              <td className="border border-border px-3 py-2">{children}</td>
            );
          },
          hr() {
            return <hr className="my-6 border-border" />;
          },
        }}
      >
        {content}
      </ReactMarkdown>
    </div>
  );
});
