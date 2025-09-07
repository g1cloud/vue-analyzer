const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, '../dist/index.js');
const shebang = '#!/usr/bin/env node';

fs.readFile(filePath, 'utf8', (err, data) => {
  if (err) {
    console.error(err);
    process.exit(1);
  }

  if (!data.startsWith(shebang)) {
    const newData = shebang + '\n' + data;
    fs.writeFile(filePath, newData, 'utf8', (err) => {
      if (err) {
        console.error(err);
        process.exit(1);
      }
      console.log('Shebang added to', filePath);
    });
  }
});
