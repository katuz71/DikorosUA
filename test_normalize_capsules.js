// Тест нового regex для капсул
const testCases = [
  "Мікродозінг Brain & Sleep Їжовик гребінчастий (Hericium erinaceus) 60 капсул по 0,5 грама",
  "Мікродозінг Brain & Sleep Їжовик гребінчастий (Hericium erinaceus) 120 капсул по 0,5 грама",
  "Мікродозінг HARD Мухомор пантерний (Amanita pantherina) 60 капсул по 0,35 грама",
  "Мікродозінг ALL Inclusive Мухомор червоний + Їжовик гребінчастий + Кордицепс військовий 60 капсул по 0,5гр",
  "Мікродозінг ALL Inclusive Мухомор червоний + Їжовик гребінчастий + Кордицепс військовий 120 капсул по 0,5гр",
];

// Regex из обновленного database.ts
const weightRegex = /[-–]?\s*(\d+)\s*г+\s*р?\s*а?\s*м+/i;
const capsulesWithDoseRegex = /(\d+)\s*капсул\s+по\s+([\d,]+)\s*г(?:рам[аи]?|р)?/i;
const capsulesRegex = /(\d+)\s*капсул/i;

console.log('Testing capsules regex:\n');
testCases.forEach(name => {
  console.log(`\n📦 "${name}"`);
  
  const capsWithDose = name.match(capsulesWithDoseRegex);
  const caps = name.match(capsulesRegex);
  const weight = name.match(weightRegex);
  
  if (capsWithDose) {
    console.log(`  ✅ Капсулы с дозировкой:`);
    console.log(`     Количество: ${capsWithDose[1]} капсул`);
    console.log(`     Дозировка: по ${capsWithDose[2]}гр`);
    console.log(`     Size: "${capsWithDose[1]} капсул"`);
    console.log(`     Dose: "по ${capsWithDose[2]}гр"`);
    console.log(`     Label: "${capsWithDose[1]} капсул по ${capsWithDose[2]}гр"`);
  } else if (caps) {
    console.log(`  ⚠️ Капсулы без дозировки: ${caps[1]} капсул`);
  }
  
  if (weight) {
    console.log(`  ⚖️ Вес найден (НЕ ДОЛЖНО БЫТЬ!): "${weight[0]}"`);
  } else {
    console.log(`  ✅ Вес НЕ захвачен (правильно)`);
  }
  
  // BaseName
  let baseName = name;
  if (capsWithDose) {
    baseName = baseName.replace(capsulesWithDoseRegex, '');
  }
  baseName = baseName.replace(/по\s+[\d,]+\s*грам[аи]?/gi, '');
  baseName = baseName.replace(/\s+/g, ' ').trim();
  console.log(`  📝 BaseName: "${baseName}"`);
});

console.log('\n' + '='.repeat(80));
console.log('ОЖИДАЕМЫЙ РЕЗУЛЬТАТ:');
console.log('='.repeat(80));
console.log('1. Все товары должны иметь одинаковый BaseName (без "60/120 капсул")');
console.log('2. Size должен быть "60 капсул" или "120 капсул"');
console.log('3. Dose должен быть "по 0,5гр" или "по 0,35гр"');
console.log('4. Label должен быть "60 капсул по 0,5гр" или "120 капсул по 0,5гр"');
console.log('5. Вес "0,5 грама" НЕ должен захватываться как отдельный атрибут');
