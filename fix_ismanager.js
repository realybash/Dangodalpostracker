const fs = require('fs');
let rules = fs.readFileSync('firestore.rules', 'utf8');
rules = rules.replace(
  /function isManager\(\) {\s*return request.auth != null && get\([^)]+\)\.data\.role == 'Manager';\s*}/g,
  `function isManager() {
      return request.auth != null && 
             exists(/databases/$(database)/documents/users/$(request.auth.uid)) && 
             get(/databases/$(database)/documents/users/$(request.auth.uid)).data.role == 'Manager';
    }`
);
fs.writeFileSync('firestore.rules', rules);
console.log('Rules updated locally');
