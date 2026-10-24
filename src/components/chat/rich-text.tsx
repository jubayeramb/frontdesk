import { Fragment, type ReactNode } from "react";

// The small markdown subset the agent writes: paragraphs, "-" and "1." lists,
// **bold** and links. Built as React nodes, so model text is never HTML.
export function RichText({ text }: { text: string }) {
  return (
    <div className="space-y-2">
      {text
        .trim()
        .split(/\n{2,}/)
        .map((block, i) => (
          <Block key={i} block={block} />
        ))}
    </div>
  );
}

function Block({ block }: { block: string }) {
  const lines = block.split("\n");
  const bullet = /^\s*[-*]\s+/;
  const numbered = /^\s*\d+[.)]\s+/;
  if (lines.every((line) => bullet.test(line))) {
    return (
      <ul className="list-disc space-y-1 pl-5">
        {lines.map((line, i) => (
          <li key={i}>{inline(line.replace(bullet, ""))}</li>
        ))}
      </ul>
    );
  }
  if (lines.every((line) => numbered.test(line))) {
    return (
      <ol className="list-decimal space-y-1 pl-5">
        {lines.map((line, i) => (
          <li key={i}>{inline(line.replace(numbered, ""))}</li>
        ))}
      </ol>
    );
  }
  return (
    <p>
      {lines.map((line, i) => (
        <Fragment key={i}>
          {i > 0 && <br />}
          {inline(line)}
        </Fragment>
      ))}
    </p>
  );
}

// Bold, a markdown link, a bare URL, or a booking reference (kept on one line).
const TOKEN = /\*\*(.+?)\*\*|\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)|(https?:\/\/[^\s)]+)|\b(TR-\d+)\b/g;

function inline(text: string): ReactNode[] {
  const out: ReactNode[] = [];
  let at = 0;
  for (const match of text.matchAll(TOKEN)) {
    if (match.index > at) out.push(text.slice(at, match.index));
    const [, bold, label, url, bare, reference] = match;
    if (bold !== undefined) out.push(<strong key={match.index}>{bold}</strong>);
    else if (reference !== undefined) out.push(<span key={match.index} className="whitespace-nowrap">{reference}</span>);
    else out.push(<ExternalLink key={match.index} href={(url ?? bare)!} label={label ?? bare!} />);
    at = match.index + match[0].length;
  }
  if (at < text.length) out.push(text.slice(at));
  return out;
}

function ExternalLink({ href, label }: { href: string; label: string }) {
  return (
    <a href={href} target="_blank" rel="noopener noreferrer" className="font-medium underline underline-offset-2">
      {label}
    </a>
  );
}
