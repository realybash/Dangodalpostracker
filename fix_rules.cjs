const fs = require('fs');
let rules = fs.readFileSync('firestore.rules', 'utf8');
rules = rules.replace(/allow create: .*/g, 'allow create: if request.auth != null && (request.auth.uid == userId || isManager());');
rules = rules.replace(/allow update: if request\.auth != null && \([\s\S]*?isManager\(\)\s*\);/g, 'allow update: if request.auth != null && (request.auth.uid == userId || isManager());');
fs.writeFileSync('firestore.rules', rules);
console.log('Rules updated locally');
