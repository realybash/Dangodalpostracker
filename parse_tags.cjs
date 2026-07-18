const fs = require('fs');
const content = fs.readFileSync('src/components/TransactionForm.tsx', 'utf8');

// Strip JSX comments
let noComments = content.replace(/\{\/\*[\s\S]*?\*\/\}/g, '');

let tags = [];
let re = /<\/?(div|form)[^>]*>/g;
let match;
while ((match = re.exec(noComments)) !== null) {
  let full = match[0];
  let tag = match[1];
  let isClose = full.startsWith('</');
  let isSelfClose = full.endsWith('/>');
  
  // calculate approximate line number
  let line = noComments.substring(0, match.index).split('\n').length;
  
  if (isSelfClose) continue;
  
  if (isClose) {
    let last = tags.pop();
    if (!last || last.tag !== tag) {
      console.log(`Mismatch! Expected </${last?.tag}> (from ${last?.line}) but got </${tag}> at line ${line}`);
      if (last) tags.push(last); // keep in stack
    }
  } else {
    tags.push({ tag, line });
  }
}

console.log('Unclosed tags remaining in stack:');
for (let t of tags) console.log(`<${t.tag}> at line ${t.line}`);
