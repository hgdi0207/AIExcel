'use client';

import type { ReactNode } from 'react';

type ReportPreviewProps = {
  contentMd: string;
};

type Block =
  | { type: 'heading'; level: 1 | 2 | 3; text: string }
  | { type: 'paragraph'; text: string }
  | { type: 'list'; ordered: boolean; items: string[] }
  | { type: 'code'; text: string }
  | { type: 'rule' };

export function ReportPreview({ contentMd }: ReportPreviewProps) {
  const blocks = parseMarkdownBlocks(contentMd);

  return (
    <div style={{ display: 'grid', gap: 16 }}>
      {blocks.map((block, index) => renderBlock(block, index))}
    </div>
  );
}

function renderBlock(block: Block, index: number) {
  if (block.type === 'heading') {
    const Tag = block.level === 1 ? 'h2' : block.level === 2 ? 'h3' : 'h4';
    return (
      <div key={index}>
        <Tag style={{ margin: '0 0 8px', fontSize: block.level === 1 ? 22 : block.level === 2 ? 18 : 15 }}>
          {renderInlineText(block.text)}
        </Tag>
      </div>
    );
  }

  if (block.type === 'paragraph') {
    return (
      <p key={index} style={{ margin: 0, lineHeight: 1.75 }}>
        {renderInlineText(block.text)}
      </p>
    );
  }

  if (block.type === 'list') {
    const Tag = block.ordered ? 'ol' : 'ul';
    return (
      <Tag key={index} style={{ margin: '0 0 0 20px', paddingLeft: 12, lineHeight: 1.7 }}>
        {block.items.map((item, itemIndex) => (
          <li key={`${index}-${itemIndex}`} style={{ marginBottom: 4 }}>
            {renderInlineText(item)}
          </li>
        ))}
      </Tag>
    );
  }

  if (block.type === 'code') {
    return (
      <pre
        key={index}
        style={{
          margin: 0,
          padding: 14,
          borderRadius: 16,
          background: 'rgba(31, 45, 64, 0.06)',
          overflow: 'auto',
          whiteSpace: 'pre-wrap',
        }}
      >
        {block.text}
      </pre>
    );
  }

  return <hr key={index} style={{ border: 0, borderTop: '1px solid rgba(31, 45, 64, 0.1)', width: '100%' }} />;
}

function parseMarkdownBlocks(input: string): Block[] {
  const lines = input.replace(/\r\n/g, '\n').split('\n');
  const blocks: Block[] = [];
  let index = 0;

  while (index < lines.length) {
    const line = lines[index]?.trimEnd() ?? '';

    if (!line.trim()) {
      index += 1;
      continue;
    }

    if (line.startsWith('```')) {
      const codeLines: string[] = [];
      index += 1;
      while (index < lines.length && !lines[index]!.startsWith('```')) {
        codeLines.push(lines[index] ?? '');
        index += 1;
      }
      if (index < lines.length) {
        index += 1;
      }
      blocks.push({ type: 'code', text: codeLines.join('\n') });
      continue;
    }

    if (/^#{1,3}\s+/.test(line)) {
      const level = Math.min((line.match(/^#+/)?.[0].length ?? 1) as 1 | 2 | 3, 3) as 1 | 2 | 3;
      blocks.push({ type: 'heading', level, text: line.replace(/^#{1,3}\s+/, '').trim() });
      index += 1;
      continue;
    }

    if (/^(-|\*|\d+\.)\s+/.test(line)) {
      const ordered = /^\d+\./.test(line);
      const items: string[] = [];
      while (index < lines.length && /^(-|\*|\d+\.)\s+/.test((lines[index] ?? '').trim())) {
        items.push((lines[index] ?? '').trim().replace(/^(-|\*|\d+\.)\s+/, ''));
        index += 1;
      }
      blocks.push({ type: 'list', ordered, items });
      continue;
    }

    if (/^---+$/.test(line.trim())) {
      blocks.push({ type: 'rule' });
      index += 1;
      continue;
    }

    const paragraphLines = [line.trim()];
    index += 1;
    while (index < lines.length) {
      const next = (lines[index] ?? '').trim();
      if (!next || /^#{1,3}\s+/.test(next) || /^(-|\*|\d+\.)\s+/.test(next) || /^```/.test(next) || /^---+$/.test(next)) {
        break;
      }
      paragraphLines.push(next);
      index += 1;
    }
    blocks.push({ type: 'paragraph', text: paragraphLines.join(' ') });
  }

  return blocks;
}

function renderInlineText(value: string): ReactNode {
  const nodes: ReactNode[] = [];
  const tokens = value.split(/(\*\*[^*]+\*\*|`[^`]+`)/g).filter(Boolean);

  tokens.forEach((token, index) => {
    if (token.startsWith('**') && token.endsWith('**')) {
      nodes.push(
        <strong key={`${index}-${token}`}>{token.slice(2, -2)}</strong>,
      );
      return;
    }

    if (token.startsWith('`') && token.endsWith('`')) {
      nodes.push(
        <code
          key={`${index}-${token}`}
          style={{ padding: '0 4px', borderRadius: 6, background: 'rgba(31, 45, 64, 0.08)' }}
        >
          {token.slice(1, -1)}
        </code>,
      );
      return;
    }

    nodes.push(<span key={`${index}-${token}`}>{token}</span>);
  });

  return nodes;
}
