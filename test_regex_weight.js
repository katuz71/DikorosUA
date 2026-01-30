// Тест regex для веса
const testCases = [
  "Шляпки мухомору червоного (Amanita muscaria) сушені,  1 сорт - 50 грам",
  "Шляпки мухомору червоного (Amanita muscaria) сушені,  порошок 1 сорт - 50 грам",
  "Шляпки мухомору червоного (Amanita muscaria) сушені,  1 сорт - 100 грам",
  "Шляпки мухомору червоного (Amanita muscaria) сушені,  1 сорт - 200 грам",
  "Їжовик гребінчастий (Герицій їжаковий) сушений - 50 гграм",
  "Чага (Inonotus obliquus) сушена - 50 грам",
];

const weightRegex = /[-–]?\s*(\d+)\s*г+\s*р?\s*а?\s*м+/i;

console.log('Testing weight regex:\n');
testCases.forEach(name => {
  const match = name.match(weightRegex);
  if (match) {
    console.log(`✅ MATCH: "${name}"`);
    console.log(`   Full match: "${match[0]}"`);
    console.log(`   Weight num: "${match[1]}"`);
    console.log(`   Unit: "${match[2]}"`);
  } else {
    console.log(`❌ NO MATCH: "${name}"`);
  }
  console.log('');
});
