import fs from 'fs';
import path from 'path';

const hasLocale = /locale\$\.subscribe/;
const onPush = /ChangeDetectionStrategy\.OnPush/;
const already = /hostDirectives:\s*\[LocaleRefreshDirective\]/;

function walk(dir, out = []) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) walk(p, out);
    else if (e.name.endsWith('.ts') && !e.name.endsWith('.spec.ts')) out.push(p);
  }
  return out;
}

let patched = 0;
for (const file of walk('src/app')) {
  let t = fs.readFileSync(file, 'utf8');
  if (!onPush.test(t) || hasLocale.test(t) || already.test(t) || !/@Component/.test(t)) {
    continue;
  }
  const rel = path
    .relative(path.dirname(file), 'src/app/shared/directives/locale-refresh.directive')
    .replace(/\\/g, '/')
    .replace(/\.ts$/, '');
  const imp = rel.startsWith('.') ? rel : `./${rel}`;
  if (!t.includes('LocaleRefreshDirective')) {
    const anchor = t.match(/import.*ChangeDetectionStrategy[^\n]+\n/);
    const importLine = `import { LocaleRefreshDirective } from '${imp}';\n`;
    if (anchor) {
      t = t.replace(anchor[0], anchor[0] + importLine);
    } else {
      t = importLine + t;
    }
  }
  t = t.replace(
    /(\s*changeDetection:\s*ChangeDetectionStrategy\.OnPush,\s*\n)/,
    '$1  hostDirectives: [LocaleRefreshDirective],\n'
  );
  fs.writeFileSync(file, t);
  patched++;
}
console.log('patched', patched);