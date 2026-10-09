/** Parse a bounded CSV/TSV preview, preserving quoted and multiline fields. */
export function parseDelimitedRows(text: string, delimiter = ",", limit = 100): string[][] {
  if (limit <= 0) return [];
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let quoted = false;
  let hasData = false;
  const input = text.replace(/^\uFEFF/, "");

  for (let i = 0; i < input.length; i++) {
    const char = input[i];
    if (quoted) {
      if (char === '"') {
        if (input[i + 1] === '"') {
          field += '"';
          i++;
        } else {
          quoted = false;
        }
      } else {
        field += char;
      }
    } else if (char === '"' && field.length === 0) {
      quoted = true;
      hasData = true;
    } else if (char === delimiter) {
      row.push(field);
      field = "";
      hasData = true;
    } else if (char === "\r" || char === "\n") {
      if (hasData) rows.push([...row, field]);
      if (rows.length >= limit) return rows;
      row = [];
      field = "";
      hasData = false;
      if (char === "\r" && input[i + 1] === "\n") i++;
    } else {
      field += char;
      hasData = true;
    }
  }
  if (hasData && rows.length < limit) rows.push([...row, field]);
  return rows;
}
