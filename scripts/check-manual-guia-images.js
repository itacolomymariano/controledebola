const fs = require('fs');
const path = require('path');

const mdxDir = path.resolve(__dirname, '../../controledebolasite/src/content/guia');
const pubDir = path.resolve(__dirname, '../../controledebolasite/public/guia');

const pub = new Set(fs.readdirSync(pubDir));
const missing = [];
const refs = new Set();

for (const f of fs.readdirSync(mdxDir).filter((x) => x.endsWith('.mdx'))) {
  const t = fs.readFileSync(path.join(mdxDir, f), 'utf8');
  for (const m of t.matchAll(/\/guia\/([^)\s"']+\.(?:jpeg|jpg|png))/gi)) {
    refs.add(m[1]);
    if (!pub.has(m[1])) missing.push({ file: f, img: m[1] });
  }
}

const orphan = [...pub].filter((x) => !refs.has(x)).sort();

console.log(JSON.stringify({ refCount: refs.size, missing, orphanCount: orphan.length, orphan }, null, 2));
