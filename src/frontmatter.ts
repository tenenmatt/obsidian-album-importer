// Hand-rolled, line-oriented frontmatter merge. We deliberately avoid a
// parse-to-object-and-redump round trip so that everything we do NOT manage —
// other keys, comments, blank lines, key order — and the entire note body
// survive byte-for-byte. Assumes LF line endings (Obsidian's default).

export class FrontmatterParseError extends Error {
  constructor(message = "Could not parse existing frontmatter.") {
    super(message);
    this.name = "FrontmatterParseError";
  }
}

export type FrontmatterValue = string | number | string[];
export type ManagedFields = Record<string, FrontmatterValue>;

// Captures the inner YAML (group 1, undefined for an empty block) and the full
// delimited block incl. its trailing newline (match[0]); the remainder of the
// string is the body.
const FRONTMATTER_RE = /^---\n(?:([\s\S]*?)\n)?---[ \t]*\n?/;
const OPENS_FRONTMATTER_RE = /^---\n/;

interface SplitNote {
  lines: string[]; // inner frontmatter lines ([] when there is no block)
  body: string;
}

function splitNote(content: string): SplitNote {
  const match = content.match(FRONTMATTER_RE);
  if (match) {
    const inner = match[1];
    return {
      lines: inner === undefined ? [] : inner.split("\n"),
      body: content.slice(match[0].length),
    };
  }
  // Looks like it opens a block but never closes it → unparseable.
  if (OPENS_FRONTMATTER_RE.test(content)) {
    throw new FrontmatterParseError();
  }
  return { lines: [], body: content };
}

/**
 * Merge plugin-managed fields into a note's frontmatter, overwriting those
 * keys and leaving everything else untouched. Creates a frontmatter block if
 * the note has none. Throws FrontmatterParseError on an unterminated block.
 */
export function mergeFrontmatter(content: string, fields: ManagedFields): string {
  const { lines, body } = splitNote(content);

  for (const [key, value] of Object.entries(fields)) {
    const serialized = serializeField(key, value);
    const range = findKeyRange(lines, key);
    if (range) {
      lines.splice(range.start, range.count, ...serialized);
    } else {
      lines.push(...serialized);
    }
  }

  return `---\n${lines.join("\n")}\n---\n${body}`;
}

/**
 * Locate a top-level key and the span of lines it owns (its own line plus any
 * indented continuation lines, e.g. block-list items). Returns null if absent.
 */
function findKeyRange(
  lines: string[],
  key: string,
): { start: number; count: number } | null {
  for (let i = 0; i < lines.length; i++) {
    if (topLevelKeyOf(lines[i]) !== key) continue;

    let count = 1;
    // Continuation lines are indented; blank/comment/next-key lines end the span.
    while (i + count < lines.length && /^[ \t]/.test(lines[i + count])) {
      count++;
    }
    return { start: i, count };
  }
  return null;
}

/** The key name of a top-level `key:` line (no leading space), else null. */
function topLevelKeyOf(line: string): string | null {
  const match = line.match(/^([^\s#][^:]*):(?:\s.*|)$/);
  return match ? match[1] : null;
}

function serializeField(key: string, value: FrontmatterValue): string[] {
  if (Array.isArray(value)) {
    return [`${key}:`, ...value.map((item) => `  - ${plainOrQuoted(item)}`)];
  }
  if (typeof value === "number") {
    return [`${key}: ${value}`];
  }
  return [`${key}: ${quote(value)}`];
}

function quote(value: string): string {
  return `"${value.replace(/\\/g, "\\\\").replace(/"/g, '\\"')}"`;
}

/** Bare scalar when safe in a block context, otherwise double-quoted. */
function plainOrQuoted(value: string): string {
  const unsafe =
    value === "" ||
    value !== value.trim() ||
    /[:#]/.test(value) ||
    /^[-?,[\]{}&*!|>'"%@`]/.test(value);
  return unsafe ? quote(value) : value;
}

/**
 * Place a cover-art embed at the top of the note body. If the body already
 * begins (first non-empty line) with a wikilink embed, replace it; otherwise
 * prepend `![[path]]` followed by a blank line.
 */
export function setCoverEmbed(content: string, coverPath: string): string {
  const match = content.match(FRONTMATTER_RE);
  const prefix = match ? match[0] : "";
  const body = match ? content.slice(match[0].length) : content;
  const embed = `![[${coverPath}]]`;

  const bodyLines = body.split("\n");
  const firstNonEmpty = bodyLines.findIndex((line) => line.trim() !== "");

  if (firstNonEmpty !== -1 && /^!\[\[.*\]\]\s*$/.test(bodyLines[firstNonEmpty])) {
    bodyLines[firstNonEmpty] = embed;
    return prefix + bodyLines.join("\n");
  }

  return `${prefix}${embed}\n\n${body}`;
}
