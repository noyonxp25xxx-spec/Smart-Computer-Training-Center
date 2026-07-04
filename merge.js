const fs = require('fs');
const oldFile = fs.readFileSync('old.ejs', 'utf-8');
const currentFile = fs.readFileSync('views/admin/results.ejs', 'utf-8');

const oldFormPart = oldFile.substring(oldFile.indexOf('<!-- Main Result Entry Form -->'), oldFile.indexOf('<!-- Existing Results List -->'));
const oldTablePart = oldFile.substring(oldFile.indexOf('<!-- Existing Results List -->'), oldFile.indexOf('<script>'));
const oldScript = oldFile.substring(oldFile.indexOf('<script>') + 8, oldFile.indexOf('</script>'));

let merged = currentFile.replace('<div class="row g-4">', '<div class="row g-4">\n' + oldFormPart + '\n' + oldTablePart);
merged = merged.replace('<script>', '<script>\n' + oldScript + '\n');

// Fix published certificates loop vs individual results loop
merged = merged.replace('<% if(results && results.length > 0) { %>\r\n            <% results.forEach(r => { %>', '<% if(publishedCertificates && publishedCertificates.length > 0) { %>\r\n            <% publishedCertificates.forEach(r => { %>');
// Fix the other `results.forEach` which might be present in the newly merged part
// Actually let's just make the changes using replace

fs.writeFileSync('views/admin/results.ejs', merged);
console.log('Merged successfully!');
