import type {
  BlockContext,
  BlockParser,
  Element,
  Line,
  MarkdownConfig,
} from "@lezer/markdown";

function backtickFenceEnd(line: Line): number {
  if (line.next !== 96) return -1;
  let position = line.pos + 1;
  while (position < line.text.length && line.text.charCodeAt(position) === 96) position += 1;
  if (position < line.pos + 3) return -1;
  for (let index = position; index < line.text.length; index += 1) {
    if (line.text.charCodeAt(index) === 96) return -1;
  }
  return position;
}

function skipSpaceBack(text: string, position: number, to: number): number {
  while (position > to && /\s/.test(text.charAt(position - 1))) position -= 1;
  return position;
}

const backtickFencedCodeParser: BlockParser = {
  name: "BacktickFencedCode",
  before: "Blockquote",
  parse(context: BlockContext, line: Line) {
    const fenceEnd = backtickFenceEnd(line);
    if (fenceEnd < 0) return false;

    const from = context.lineStart + line.pos;
    const fenceLength = fenceEnd - line.pos;
    const infoFrom = line.skipSpace(fenceEnd);
    const infoTo = skipSpaceBack(line.text, line.text.length, infoFrom);
    const children: Element[] = [context.elt("CodeMark", from, from + fenceLength)];
    if (infoFrom < infoTo) {
      children.push(
        context.elt("CodeInfo", context.lineStart + infoFrom, context.lineStart + infoTo),
      );
    }

    let first = true;
    let empty = true;
    let hasLine = false;
    while (
      context.nextLine() &&
      (line as Line & { depth: number }).depth >= context.depth
    ) {
      let position = line.pos;
      if (line.indent - line.baseIndent < 4) {
        while (position < line.text.length && line.text.charCodeAt(position) === 96) {
          position += 1;
        }
      }

      if (
        position - line.pos >= fenceLength &&
        line.skipSpace(position) === line.text.length
      ) {
        children.push(...line.markers);
        if (empty && hasLine) {
          children.push(context.elt("CodeText", context.lineStart - 1, context.lineStart));
        }
        children.push(
          context.elt(
            "CodeMark",
            context.lineStart + line.pos,
            context.lineStart + position,
          ),
        );
        context.nextLine();
        break;
      }

      hasLine = true;
      if (!first) {
        children.push(context.elt("CodeText", context.lineStart - 1, context.lineStart));
        empty = false;
      }
      children.push(...line.markers);
      const textStart = context.lineStart + line.basePos;
      const textEnd = context.lineStart + line.text.length;
      if (textStart < textEnd) {
        children.push(context.elt("CodeText", textStart, textEnd));
        empty = false;
      }
      first = false;
    }

    context.addElement(
      context.elt("FencedCode", from, context.prevLineEnd(), children),
    );
    return true;
  },
  endLeaf(_context, line) {
    return backtickFenceEnd(line) >= 0;
  },
};

export const backtickFencedCode: MarkdownConfig = {
  remove: ["FencedCode"],
  parseBlock: [backtickFencedCodeParser],
};
