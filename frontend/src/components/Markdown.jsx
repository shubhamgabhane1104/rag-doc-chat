import { Fragment } from 'react';

/**
 * Minimal Markdown renderer for model answers: paragraphs, headings,
 * bullet/numbered lists, tables, **bold**, *italic* and `code`.
 * Builds React elements directly (no dangerouslySetInnerHTML), so text
 * from the model can never inject HTML.
 */

function renderInline(text, keyPrefix = '') {
  const parts = [];
  const re = /(\*\*[^*]+\*\*|__[^_]+__|`[^`]+`|\*[^*\s][^*]*\*)/g;
  let last = 0;
  let m;
  let i = 0;
  while ((m = re.exec(text)) !== null) {
    if (m.index > last) parts.push(text.slice(last, m.index));
    const tok = m[0];
    const key = `${keyPrefix}-${i++}`;
    if (tok.startsWith('**') || tok.startsWith('__')) parts.push(<strong key={key}>{tok.slice(2, -2)}</strong>);
    else if (tok.startsWith('`')) parts.push(<code key={key}>{tok.slice(1, -1)}</code>);
    else parts.push(<em key={key}>{tok.slice(1, -1)}</em>);
    last = m.index + tok.length;
  }
  if (last < text.length) parts.push(text.slice(last));
  return parts;
}

const isTableRow = (l) => /^\s*\|.*\|\s*$/.test(l);
const isTableSep = (l) => /^\s*\|?\s*:?-{2,}:?\s*(\|\s*:?-{2,}:?\s*)*\|?\s*$/.test(l);
const splitRow = (l) => l.trim().replace(/^\||\|$/g, '').split('|').map((c) => c.trim());

export default function Markdown({ text = '', className = '' }) {
  const lines = String(text).replace(/\r\n/g, '\n').split('\n');
  const blocks = [];
  let i = 0;

  while (i < lines.length) {
    const line = lines[i];

    if (!line.trim()) {
      i++;
      continue;
    }

    const heading = line.match(/^(#{1,4})\s+(.*)$/);
    if (heading) {
      const Tag = `h${Math.min(heading[1].length + 2, 6)}`;
      blocks.push(<Tag key={i}>{renderInline(heading[2], `h${i}`)}</Tag>);
      i++;
      continue;
    }

    if (isTableRow(line) && i + 1 < lines.length && isTableSep(lines[i + 1])) {
      const header = splitRow(line);
      const rows = [];
      i += 2;
      while (i < lines.length && isTableRow(lines[i])) rows.push(splitRow(lines[i++]));
      blocks.push(
        <div key={`t${i}`} className="overflow-x-auto">
          <table>
            <thead>
              <tr>{header.map((c, k) => <th key={k}>{renderInline(c, `th${i}${k}`)}</th>)}</tr>
            </thead>
            <tbody>
              {rows.map((r, ri) => (
                <tr key={ri}>{r.map((c, k) => <td key={k}>{renderInline(c, `td${i}${ri}${k}`)}</td>)}</tr>
              ))}
            </tbody>
          </table>
        </div>
      );
      continue;
    }

    const listMatch = line.match(/^\s*([-*•]|\d+[.)])\s+/);
    if (listMatch) {
      const ordered = /\d/.test(listMatch[1]);
      const items = [];
      while (i < lines.length) {
        const m = lines[i].match(/^\s*([-*•]|\d+[.)])\s+(.*)$/);
        if (!m || /\d/.test(m[1]) !== ordered) break;
        items.push(m[2]);
        i++;
      }
      const List = ordered ? 'ol' : 'ul';
      blocks.push(
        <List key={`l${i}`}>
          {items.map((it, k) => <li key={k}>{renderInline(it, `li${i}${k}`)}</li>)}
        </List>
      );
      continue;
    }

    // Paragraph: gather consecutive plain lines
    const para = [];
    while (
      i < lines.length &&
      lines[i].trim() &&
      !/^(#{1,4})\s/.test(lines[i]) &&
      !/^\s*([-*•]|\d+[.)])\s+/.test(lines[i]) &&
      !(isTableRow(lines[i]) && isTableSep(lines[i + 1] || ''))
    ) {
      para.push(lines[i]);
      i++;
    }
    blocks.push(
      <p key={`p${i}`}>
        {para.map((l, k) => (
          <Fragment key={k}>
            {k > 0 && <br />}
            {renderInline(l, `p${i}${k}`)}
          </Fragment>
        ))}
      </p>
    );
  }

  return <div className={`md ${className}`}>{blocks}</div>;
}
