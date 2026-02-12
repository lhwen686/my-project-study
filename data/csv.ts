export type CsvCardRow = {
  deck: string;
  front: string;
  back: string;
  tags: string;
};

function parseCsvLine(line: string) {
  const values: string[] = [];
  let cur = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i += 1) {
    const ch = line[i];
    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') {
        cur += '"';
        i += 1;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (ch === ',' && !inQuotes) {
      values.push(cur.trim());
      cur = '';
    } else {
      cur += ch;
    }
  }

  values.push(cur.trim());
  return values;
}

export function parseCardsCsv(csv: string): CsvCardRow[] {
  const lines = csv
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);

  if (lines.length === 0) return [];

  const header = parseCsvLine(lines[0]).map((s) => s.toLowerCase());
  const expected = ['deck', 'front', 'back', 'tags'];
  if (header.join(',') !== expected.join(',')) {
    throw new Error('CSV header must be: deck,front,back,tags');
  }

  return lines.slice(1).map((line) => {
    const [deck, front, back, tags = ''] = parseCsvLine(line);
    if (!deck || !front || !back) {
      throw new Error(`Invalid CSV row: ${line}`);
    }
    return { deck, front, back, tags };
  });
}
