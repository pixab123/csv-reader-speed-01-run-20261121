export function run(input) {
  const s = input.text;
  const header = input.header;
  const n = s.length;
  const errors = [];
  const rows = [];
  let columns = null;
  let i = 0;
  if (n > 0 && s.charCodeAt(0) === 0xfeff) i = 1;
  let line = 1;
  let first = true;
  let firstWidth = 0;

  while (i < n) {
    // Skip stray CRs and empty lines at record start; they form no record.
    let skippedStray = false;
    for (;;) {
      if (i >= n) break;
      const c = s.charCodeAt(i);
      if (c === 10) { i++; line++; continue; }
      if (c === 13) {
        if (i + 1 < n && s.charCodeAt(i + 1) === 10) { i += 2; line++; continue; }
        // stray CR before any record content
        const prow = first && header ? null : rows.length;
        errors.push({ code: "stray_cr", line: line, row: prow });
        i++;
        skippedStray = true;
        continue;
      }
      break;
    }
    if (i >= n) break;

    const recLine = line;
    const recRow = first && header ? null : rows.length;
    const fields = [];
    let term = 0; // 1 comma, 2 eol, 3 eof

    // Parse fields of one record.
    for (;;) {
      let field = "";
      term = 3;
      if (i < n && s.charCodeAt(i) === 34) {
        // Quoted attempt: locate a closing quote that is not doubled.
        let j = i + 1;
        let closing = -1;
        for (;;) {
          const q = s.indexOf('"', j);
          if (q === -1) break;
          if (q + 1 < n && s.charCodeAt(q + 1) === 34) { j = q + 2; continue; }
          closing = q;
          break;
        }
        if (closing === -1) {
          errors.push({ code: "unterminated_quote", line: recLine, row: recRow });
          // Fall through to unquoted parsing starting at i (quote literal).
        } else {
          // Build quoted content from (i+1 .. closing-1).
          const a = i + 1;
          const b = closing;
          let content;
          if (b === a) {
            content = "";
          } else {
            // Fast scan for escape pairs or CR inside the segment.
            let hasSpecial = false;
            // A doubled quote inside means a '"' appears before b as part of a pair;
            // detect by checking whether the closing scan passed any pair.
            // Simpler: search for '"' and '\r' in segment.
            const qIn = s.indexOf('"', a);
            const rIn = s.indexOf("\r", a);
            if ((qIn === -1 || qIn >= b) && (rIn === -1 || rIn >= b)) {
              content = s.slice(a, b);
              // Count LF for line tracking.
              let p = s.indexOf("\n", a);
              while (p !== -1 && p < b) { line++; p = s.indexOf("\n", p + 1); }
            } else {
              hasSpecial = true;
              const parts = [];
              let chunk = a;
              let k = a;
              while (k < b) {
                const ch = s.charCodeAt(k);
                if (ch === 34) {
                  // doubled quote -> one quote
                  if (chunk < k) parts.push(s.slice(chunk, k));
                  parts.push('"');
                  k += 2;
                  chunk = k;
                } else if (ch === 13) {
                  if (chunk < k) parts.push(s.slice(chunk, k));
                  parts.push("\n");
                  line++;
                  if (k + 1 < b && s.charCodeAt(k + 1) === 10) k += 2; else k += 1;
                  chunk = k;
                } else if (ch === 10) {
                  line++;
                  k++;
                } else {
                  k++;
                }
              }
              if (chunk < b) parts.push(s.slice(chunk, b));
              content = parts.length === 1 ? parts[0] : parts.join("");
            }
          }
          i = closing + 1;
          // Junk after closing quote, up to comma or line break.
          let junk = "";
          let hasJunk = false;
          for (;;) {
            if (i >= n) { term = 3; break; }
            // Find next delimiter among , \n \r
            let dComma = s.indexOf(",", i);
            let dNl = s.indexOf("\n", i);
            let dCr = s.indexOf("\r", i);
            let d = -1; let kind = 0;
            if (dComma !== -1) { d = dComma; kind = 1; }
            if (dNl !== -1 && (d === -1 || dNl < d)) { d = dNl; kind = 2; }
            if (dCr !== -1 && (d === -1 || dCr < d)) { d = dCr; kind = 3; }
            if (d === -1) {
              if (i < n) { junk += s.slice(i); hasJunk = true; }
              i = n; term = 3; break;
            }
            if (kind === 1) {
              if (d > i) { junk += s.slice(i, d); hasJunk = true; }
              i = d + 1; term = 1; break;
            }
            if (kind === 2) {
              if (d > i) { junk += s.slice(i, d); hasJunk = true; }
              i = d + 1; line++; term = 2; break;
            }
            // CR
            if (d + 1 < n && s.charCodeAt(d + 1) === 10) {
              if (d > i) { junk += s.slice(i, d); hasJunk = true; }
              i = d + 2; line++; term = 2; break;
            }
            // lone CR inside junk: dropped as stray, junk continues
            if (d > i) { junk += s.slice(i, d); hasJunk = true; }
            errors.push({ code: "stray_cr", line: recLine, row: recRow });
            i = d + 1;
          }
          field = hasJunk ? content + junk : content;
          if (hasJunk) errors.push({ code: "quote_junk", line: recLine, row: recRow });
          fields.push(field);
          if (term === 1) continue;
          break;
        }
      }
      // Unquoted field parsing (also the unterminated fallback).
      {
        let parts = null;
        let chunk = i;
        for (;;) {
          if (i >= n) { term = 3; break; }
          let dComma = s.indexOf(",", i);
          let dNl = s.indexOf("\n", i);
          let dCr = s.indexOf("\r", i);
          let d = -1; let kind = 0;
          if (dComma !== -1) { d = dComma; kind = 1; }
          if (dNl !== -1 && (d === -1 || dNl < d)) { d = dNl; kind = 2; }
          if (dCr !== -1 && (d === -1 || dCr < d)) { d = dCr; kind = 3; }
          if (d === -1) {
            if (parts) parts.push(s.slice(chunk, n)); else field = s.slice(chunk, n);
            i = n; term = 3; break;
          }
          if (kind === 1) {
            if (parts) parts.push(s.slice(chunk, d)); else field = s.slice(chunk, d);
            i = d + 1; term = 1; break;
          }
          if (kind === 2) {
            if (parts) parts.push(s.slice(chunk, d)); else field = s.slice(chunk, d);
            i = d + 1; line++; term = 2; break;
          }
          // CR
          if (d + 1 < n && s.charCodeAt(d + 1) === 10) {
            if (parts) parts.push(s.slice(chunk, d)); else field = s.slice(chunk, d);
            i = d + 2; line++; term = 2; break;
          }
          // stray CR: drop it, keep scanning the same field
          if (!parts) parts = [];
          parts.push(s.slice(chunk, d));
          errors.push({ code: "stray_cr", line: recLine, row: recRow });
          i = d + 1;
          chunk = i;
        }
        if (parts) field = parts.join("");
        fields.push(field);
        if (term === 1) continue;
        break;
      }
    }

    // Finish record.
    if (first) {
      firstWidth = fields.length;
      first = false;
      if (header) columns = fields;
      else rows.push(fields);
    } else {
      const rowIdx = rows.length;
      if (fields.length < firstWidth) {
        errors.push({ code: "short_row", line: recLine, row: rowIdx, fields: fields.length });
        while (fields.length < firstWidth) fields.push("");
      } else if (fields.length > firstWidth) {
        const extra = fields.slice(firstWidth);
        errors.push({ code: "long_row", line: recLine, row: rowIdx, extra: extra });
        fields.length = firstWidth;
      }
      rows.push(fields);
    }
    if (term === 3) break;
  }

  return { columns: columns, rows: rows, errors: errors };
}
