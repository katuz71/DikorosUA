const fs = require('fs');
const path = require('path');

// ⚙️ НАСТРОЙКИ
const OUTPUT_FILE = '__CODE_DUMP.txt';
const SEARCH_DIR = './'; // Ищем от корня (или замени на './src')
const KEYWORDS = ['Product', 'Cart', 'Variant', 'sku', 'types', 'interface']; // Что ищем в названии
const EXTENSIONS = ['.tsx', '.ts', '.js', '.jsx']; // Какие расширения берем
const IGNORE_DIRS = ['node_modules', '.git', '.next', 'dist', 'build', '.expo', 'android', 'ios'];

function collectFiles(dir, fileList = []) {
  const files = fs.readdirSync(dir);

  files.forEach(file => {
    const filePath = path.join(dir, file);
    const stat = fs.statSync(filePath);

    if (stat.isDirectory()) {
      if (!IGNORE_DIRS.includes(file)) {
        collectFiles(filePath, fileList);
      }
    } else {
      const ext = path.extname(file);
      const fileName = path.basename(file);
      
      // Логика: Подходит расширение И (содержит ключевое слово ИЛИ это index файл в важной папке)
      const isRelevant = KEYWORDS.some(k => fileName.toLowerCase().includes(k.toLowerCase()));
      
      if (EXTENSIONS.includes(ext) && isRelevant) {
        fileList.push(filePath);
      }
    }
  });

  return fileList;
}

try {
  console.log('🔍 Сканирую файлы...');
  if (fs.existsSync(OUTPUT_FILE)) fs.unlinkSync(OUTPUT_FILE);

  const files = collectFiles(SEARCH_DIR);
  let output = `=== GENERATED CONTEXT ===\n\n`;

  files.forEach(filePath => {
    const content = fs.readFileSync(filePath, 'utf8');
    output += `\n========================================\n`;
    output += `FILE: ${filePath}\n`;
    output += `========================================\n`;
    output += content;
    output += `\n\n`;
  });

  fs.writeFileSync(OUTPUT_FILE, output);
  console.log(`✅ Готово! Найдено файлов: ${files.length}.`);
  console.log(`📂 Результат сохранен в: ${OUTPUT_FILE}`);
} catch (err) {
  console.error('❌ Ошибка:', err);
}