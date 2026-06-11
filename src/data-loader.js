const fs = require('fs');
const path = require('path');
const { neutralizeUserText, sanitizeCsvValue } = require('./sanitize');

class DataValidationError extends Error {
  constructor(file, row, message) {
    super(`${file}${row ? `:${row}` : ''}: ${message}`);
    this.name = 'DataValidationError';
    this.file = file;
    this.row = row || null;
  }
}

function parseCsv(text, source = '<csv>') {
  const rows = [];
  let row = [];
  let field = '';
  let quoted = false;
  let line = 1;
  let rowLine = 1;

  const pushRow = () => {
    row.push(field);
    if (row.some(value => value.length > 0)) rows.push({ values: row, line: rowLine });
    row = [];
    field = '';
    rowLine = line;
  };

  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (quoted) {
      if (ch === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i++;
        } else {
          quoted = false;
        }
      } else {
        if (ch === '\n') line++;
        field += ch;
      }
      continue;
    }

    if (ch === '"' && field.length === 0) {
      quoted = true;
    } else if (ch === ',') {
      row.push(field);
      field = '';
    } else if (ch === '\n') {
      pushRow();
      line++;
      rowLine = line;
    } else if (ch === '\r') {
      if (text[i + 1] !== '\n') pushRow();
    } else {
      field += ch;
    }
  }

  if (quoted) throw new DataValidationError(source, rowLine, 'unterminated quoted CSV field');
  if (field.length || row.length) pushRow();
  return rows;
}

function readText(file) {
  return fs.readFileSync(file, 'utf8').replace(/^\uFEFF/, '');
}

function loadCsv(file, options = {}) {
  const records = parseCsv(readText(file), file);
  if (!records.length) return [];

  const first = records[0].values.map(value => value.trim());
  const hasHeader = options.header === true ||
    (options.header !== false && options.requiredColumns &&
      options.requiredColumns.every(column => first.includes(column)));
  if (!hasHeader) {
    if (options.header === true) throw new DataValidationError(file, records[0].line, 'missing CSV header');
    return records.map(record => ({ values: record.values, __line: record.line }));
  }

  const headers = first;
  const duplicate = headers.find((header, index) => headers.indexOf(header) !== index);
  if (duplicate) throw new DataValidationError(file, records[0].line, `duplicate column "${duplicate}"`);
  for (const required of options.requiredColumns || []) {
    if (!headers.includes(required)) {
      throw new DataValidationError(file, records[0].line, `missing required column "${required}"`);
    }
  }

  return records.slice(1).map(record => {
    if (record.values.length > headers.length) {
      throw new DataValidationError(file, record.line, `expected ${headers.length} fields, got ${record.values.length}`);
    }
    const out = { __line: record.line };
    headers.forEach((header, index) => {
      const raw = record.values[index] == null ? '' : record.values[index];
      if (options.trusted === false) {
        out[header] = neutralizeUserText(raw, options.maxLength || 500);
      } else if (options.allowTemplates) {
        const value = raw.trim();
        const placeholders = value.match(/\{\{[^}]+\}\}/g) || [];
        for (const placeholder of placeholders) {
          if (!/^\{\{[A-Z0-9_]+\}\}$/.test(placeholder)) {
            throw new DataValidationError(file, record.line, `invalid template placeholder "${placeholder}"`);
          }
        }
        sanitizeCsvValue(value.replace(/\{\{[A-Z0-9_]+\}\}/g, ''), file);
        out[header] = value;
      } else if (options.allowSecurityPatterns) {
        out[header] = raw.trim();
      } else {
        out[header] = sanitizeCsvValue(raw.trim(), file);
      }
    });
    return out;
  });
}

function loadJson(file) {
  try {
    return JSON.parse(readText(file));
  } catch (error) {
    throw new DataValidationError(file, null, `invalid JSON: ${error.message}`);
  }
}

function loadMarkdown(file, options = {}) {
  const text = readText(file);
  return options.trusted === false ? neutralizeUserText(text, options.maxLength || 20_000) : text;
}

function renderTemplate(text, values = {}) {
  return String(text).replace(/\{\{([A-Z0-9_]+)\}\}/g, (match, key) => {
    if (!Object.prototype.hasOwnProperty.call(values, key)) {
      throw new Error(`Missing template value: ${key}`);
    }
    return String(values[key]);
  });
}

function validateRows(rows, schema, file) {
  const seen = new Set();
  for (const row of rows) {
    for (const field of schema.required || []) {
      if (!String(row[field] || '').trim()) {
        throw new DataValidationError(file, row.__line, `required field "${field}" is empty`);
      }
    }
    if (schema.unique) {
      const value = row[schema.unique];
      if (seen.has(value)) throw new DataValidationError(file, row.__line, `duplicate ${schema.unique} "${value}"`);
      seen.add(value);
    }
    for (const [field, allowed] of Object.entries(schema.enums || {})) {
      if (row[field] && !allowed.includes(row[field])) {
        throw new DataValidationError(file, row.__line, `invalid ${field} "${row[field]}"`);
      }
    }
  }
  return rows;
}

function listFiles(dir, extensions = null, out = []) {
  if (!fs.existsSync(dir)) return out;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) listFiles(full, extensions, out);
    else if (!extensions || extensions.includes(path.extname(entry.name))) out.push(full);
  }
  return out;
}

module.exports = {
  DataValidationError,
  parseCsv,
  readText,
  loadCsv,
  loadJson,
  loadMarkdown,
  renderTemplate,
  validateRows,
  listFiles,
};
