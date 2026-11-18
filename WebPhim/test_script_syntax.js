const fs = require('fs');
const path = require('path');
const vm = require('vm');

const viewsDir = path.join(__dirname, 'views');
const files = fs.readdirSync(viewsDir).filter(f => f.endsWith('.ejs'));

let errorCount = 0;

files.forEach(file => {
  const content = fs.readFileSync(path.join(viewsDir, file), 'utf8');
  const scriptRegex = /<script\b[^>]*>([\s\S]*?)<\/script>/gi;
  let match;
  let scriptIndex = 0;
  while ((match = scriptRegex.exec(content)) !== null) {
    scriptIndex++;
    let jsCode = match[1];
    // Replace EJS tags with valid JS placeholders
    jsCode = jsCode.replace(/<%-[\s\S]*?%>/g, '""');
    jsCode = jsCode.replace(/<%=[\s\S]*?%>/g, '""');
    jsCode = jsCode.replace(/<%[\s\S]*?%>/g, '');
    
    try {
      new vm.Script(jsCode);
      console.log(`✅ ${file} (script #${scriptIndex}) parsed successfully.`);
    } catch (err) {
      console.error(`❌ ${file} (script #${scriptIndex}) SYNTAX ERROR:`, err.message);
      errorCount++;
    }
  }
});

if (errorCount === 0) {
  console.log('\n🎉 ALL CLIENT-SIDE SCRIPTS ARE 100% SYNTACTICALLY VALID!');
} else {
  console.error(`\n💥 FOUND ${errorCount} SCRIPT SYNTAX ERRORS!`);
  process.exit(1);
}
