const DELIM = /[,\n\r]/g;

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
  const hasCR = s.indexOf("\r") !== -1;

  while (i < n) {
    // Skip empty lines and stray CRs at record start; they form no record.
    for (;;) {
      if (i >= n) break;
      const c = s.charCodeAt(i);
      if (c === 10) { i++; line++; continue; }
      if (c === 13) {
        if (i + 1 < n && s.charCodeAt(i + 1) === 10) { i += 2; line++; continue; }
        const prow = first && header ? null : rows.length;
        errors.push({ code: "stray_cr", line: line, row: prow });
        i++;
        continue;
      }
      break;
    }
    if (i >= n) break;

    const recLine = line;
    const recRow = first && header ? null : rows.length;
    const fields = [];
    let term = 3; // 1 comma, 2 eol, 3 eof

    for (;;) {
      let field = "";
      term = 3;
      let quotedDone = false;
      if (s.charCodeAt(i) === 34) {
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
        } else {
          const a = i + 1;
          const b = closing;
          let content = "";
          if (b > a) {
            const seg = s.slice(a, b);
            const qIn = seg.indexOf('"');
            const rIn = seg.indexOf("\r");
            if (qIn === -1 && rIn === -1) {
              content = seg;
              let p = seg.indexOf("\n");
              while (p !== -1) { line++; p = seg.indexOf("\n", p + 1); }
            } else {
              const parts = [];
              let chunk = 0;
              let k = 0;
              const m = seg.length;
              while (k < m) {
                const ch = seg.charCodeAt(k);
                if (ch === 34) {
                  if (chunk < k) parts.push(seg.slice(chunk, k));
                  parts.push('"');
                  k += 2;
                  chunk = k;
                } else if (ch === 13) {
                  if (chunk < k) parts.push(seg.slice(chunk, k));
                  parts.push("\n");
                  line++;
                  if (k + 1 < m && seg.charCodeAt(k + 1) === 10) k += 2; else k += 1;
                  chunk = k;
                } else if (ch === 10) {
                  line++;
                  k++;
                } else {
                  k++;
                }
              }
              if (chunk < m) parts.push(seg.slice(chunk, m));
              content = parts.length === 1 ? parts[0] : parts.join("");
            }
          }
          i = closing + 1;
          // Junk after the closing quote, up to a comma or a line break.
          let junk = "";
          let hasJunk = false;
          for (;;) {
            if (i >= n) { term = 3; break; }
            let d;
            if (!hasCR) {
              const dc = s.indexOf(",", i);
              const dn = s.indexOf("\n", i);
              d = dc === -1 ? dn : dn === -1 ? dc : dc < dn ? dc : dn;
              if (d === -1) {
                junk += s.slice(i);
                hasJunk = true;
                i = n; term = 3; break;
              }
            } else {
              DELIM.lastIndex = i;
              const mm = DELIM.exec(s);
              if (!mm) {
                junk += s.slice(i);
                hasJunk = true;
                i = n; term = 3; break;
              }
              d = mm.index;
            }
            const code = s.charCodeAt(d);
            if (code === 44) {
              if (d > i) { junk += s.slice(i, d); hasJunk = true; }
              i = d + 1; term = 1; break;
            }
            if (code === 10) {
              if (d > i) { junk += s.slice(i, d); hasJunk = true; }
              i = d + 1; line++; term = 2; break;
            }
            if (d + 1 < n && s.charCodeAt(d + 1) === 10) {
              if (d > i) { junk += s.slice(i, d); hasJunk = true; }
              i = d + 2; line++; term = 2; break;
            }
            // Lone CR inside junk: dropped as stray, junk continues.
            if (d > i) { junk += s.slice(i, d); hasJunk = true; }
            errors.push({ code: "stray_cr", line: recLine, row: recRow });
            i = d + 1;
          }
          field = hasJunk ? content + junk : content;
          if (hasJunk) errors.push({ code: "quote_junk", line: recLine, row: recRow });
          quotedDone = true;
        }
      }
      if (!quotedDone) {
        // Unquoted field (also the unterminated-quote fallback).
        let parts = null;
        let chunk = i;
        for (;;) {
          if (i >= n) {
            if (parts) parts.push(s.slice(chunk, n)); else field = s.slice(chunk, n);
            term = 3; break;
          }
          let d;
          if (!hasCR) {
            const dc = s.indexOf(",", i);
            const dn = s.indexOf("\n", i);
            d = dc === -1 ? dn : dn === -1 ? dc : dc < dn ? dc : dn;
            if (d === -1) {
              if (parts) parts.push(s.slice(chunk, n)); else field = s.slice(chunk, n);
              i = n; term = 3; break;
            }
          } else {
            DELIM.lastIndex = i;
            const mm = DELIM.exec(s);
            if (!mm) {
              if (parts) parts.push(s.slice(chunk, n)); else field = s.slice(chunk, n);
              i = n; term = 3; break;
            }
            d = mm.index;
          }
          const code = s.charCodeAt(d);
          if (code === 44) {
            if (parts) parts.push(s.slice(chunk, d)); else field = s.slice(chunk, d);
            i = d + 1; term = 1; break;
          }
          if (code === 10) {
            if (parts) parts.push(s.slice(chunk, d)); else field = s.slice(chunk, d);
            i = d + 1; line++; term = 2; break;
          }
          if (d + 1 < n && s.charCodeAt(d + 1) === 10) {
            if (parts) parts.push(s.slice(chunk, d)); else field = s.slice(chunk, d);
            i = d + 2; line++; term = 2; break;
          }
          // Stray CR: drop it, keep scanning the same field.
          if (!parts) parts = [];
          parts.push(s.slice(chunk, d));
          errors.push({ code: "stray_cr", line: recLine, row: recRow });
          i = d + 1;
          chunk = i;
        }
        if (parts) field = parts.join("");
      }
      fields.push(field);
      if (term === 1) continue;
      break;
    }

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
