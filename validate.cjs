const fs = require('fs');
const content = fs.readFileSync('src/components/TransactionForm.tsx', 'utf8');

let tags = [];
let lines = content.split('\n');
for (let i = 0; i < lines.length; i++) {
  let line = lines[i];
  // Simple regex to match opening <tag ...>, self-closing <tag .../>, and closing </tag>
  let matches = [...line.matchAll(/<\/?([a-zA-Z0-9]+)[^>]*>/g)];
  for (let m of matches) {
    let full = m[0];
    let tag = m[1];
    
    // ignore custom components and self-closing tags
    if (tag[0] === tag[0].toUpperCase()) continue;
    if (full.endsWith('/>')) continue;
    
    if (full.startsWith('</')) {
      let last = tags.pop();
      if (last && last.tag !== tag) {
        console.log(`Mismatch at line ${i+1}: expected </${last.tag}> (opened at ${last.line}) but got </${tag}>`);
      }
    } else {
      tags.push({ tag, line: i+1 });
    }
  }
}
console.log('Unclosed tags at EOF:', tags.map(t => `${t.tag} at ${t.line}`));
