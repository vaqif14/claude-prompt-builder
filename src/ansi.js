const enabled = Boolean(process.stdout.isTTY) && !process.env.NO_COLOR;

const codes = {
  bold: [1, 22],
  red: [31, 39],
  green: [32, 39],
  yellow: [33, 39],
  cyan: [36, 39],
  white: [37, 39],
  gray: [90, 39],
};

function paint(styles, value) {
  const text = String(value);
  if (!enabled || !styles.length) return text;
  const open = styles.map(style => `\x1b[${codes[style][0]}m`).join('');
  const close = [...styles].reverse().map(style => `\x1b[${codes[style][1]}m`).join('');
  return `${open}${text}${close}`;
}

function makeStyle(styles = []) {
  const fn = value => paint(styles, value);
  for (const name of Object.keys(codes)) {
    Object.defineProperty(fn, name, {
      enumerable: true,
      get: () => makeStyle([...styles, name]),
    });
  }
  return fn;
}

module.exports = makeStyle();
