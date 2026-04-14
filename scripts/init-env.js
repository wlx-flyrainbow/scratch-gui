/* eslint-disable no-console */
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const dest = path.join(root, '.env');
const src = path.join(root, '.env.example');
if (fs.existsSync(dest)) {
    console.log('.env already exists; leaving unchanged.');
    process.exit(0);
}
fs.copyFileSync(src, dest);
console.log('Created .env from .env.example. Edit if needed.');
