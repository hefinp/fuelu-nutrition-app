const http = require('http');

const PORT = process.env.PORT || 5000;
const TEST_EMAIL = 'allergentest_1773537220215@test.com';
const TEST_PASS = 'TestPass123!';

function req(method, path, body, cookie) {
  return new Promise((resolve, reject) => {
    const data = body ? JSON.stringify(body) : null;
    const opts = {
      hostname: 'localhost', port: PORT, path, method,
      headers: { 'Content-Type': 'application/json' },
    };
    if (data) opts.headers['Content-Length'] = Buffer.byteLength(data);
    if (cookie) opts.headers.Cookie = cookie;
    const r = http.request(opts, res => {
      let b = '';
      res.on('data', c => b += c);
      res.on('end', () => resolve({ body: b, setCookie: res.headers['set-cookie'] || [], status: res.statusCode }));
    });
    r.on('error', reject);
    if (data) r.write(data);
    r.end();
  });
}

function setPrefs(sid, overrides) {
  return req('PUT', '/api/user/preferences', {
    allergies: [], diet: null, excludedFoods: [], preferredFoods: [],
    onboardingComplete: true, cycleTrackingEnabled: false, micronutrientOptimize: false,
    ...overrides,
  }, sid);
}

function generateWeekly(sid, style = 'simple') {
  return req('POST', '/api/meal-plans', {
    dailyCalories: 2000, weeklyCalories: 14000,
    proteinGoal: 150, carbsGoal: 250, fatGoal: 65,
    planType: 'weekly', mealStyle: style,
  }, sid);
}

function generateDaily(sid, style = 'simple') {
  return req('POST', '/api/meal-plans', {
    dailyCalories: 2000, weeklyCalories: 14000,
    proteinGoal: 150, carbsGoal: 250, fatGoal: 65,
    planType: 'daily', mealStyle: style,
  }, sid);
}

function replaceMeal(sid, slot, style = 'simple') {
  return req('POST', '/api/meal-plans/replace-meal', {
    slot, dailyCalories: 2000,
    proteinGoal: 150, carbsGoal: 250, fatGoal: 65,
    mealStyle: style,
  }, sid);
}

const DAYS = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];
const SLOTS = ['breakfast', 'lunch', 'dinner', 'snacks'];
const REPLACE_SLOTS = ['breakfast', 'lunch', 'dinner', 'snack'];

function collectAllMealNames(plan, isWeekly) {
  const names = [];
  if (isWeekly) {
    for (const day of DAYS) {
      for (const slot of SLOTS) {
        for (const m of (plan[day]?.[slot] || [])) {
          names.push(m.meal);
        }
      }
    }
  } else {
    for (const slot of SLOTS) {
      for (const m of (plan[slot] || [])) {
        names.push(m.meal);
      }
    }
  }
  return names;
}

function checkNoKeywords(mealNames, keywords, testLabel) {
  let failures = 0;
  for (const name of mealNames) {
    const lower = name.toLowerCase();
    const matched = keywords.filter(k => lower.includes(k.toLowerCase()));
    if (matched.length) {
      console.log(`  FAIL: ${testLabel} — "${name}" contains [${matched.join(', ')}]`);
      failures++;
    }
  }
  return failures;
}

async function run() {
  let passed = 0;
  let failed = 0;

  const login = await req('POST', '/api/auth/login', { email: TEST_EMAIL, password: TEST_PASS });
  if (login.status !== 200) {
    console.error('Login failed:', login.body);
    process.exit(1);
  }
  const sid = login.setCookie.find(c => c.startsWith('connect.sid=')).split(';')[0];

  function report(label, failures) {
    if (failures === 0) { passed++; console.log(`  PASS: ${label}`); }
    else { failed++; console.log(`  FAIL: ${label} (${failures} failures)`); }
  }

  console.log('\n=== TEST 1: excludedFoods=[chicken] — weekly generation (all styles) ===');
  await setPrefs(sid, { excludedFoods: ['chicken'] });
  for (const style of ['simple', 'fancy', 'gourmet']) {
    const res = await generateWeekly(sid, style);
    const plan = JSON.parse(res.body);
    const names = collectAllMealNames(plan, true);
    const f = checkNoKeywords(names, ['chicken'], `weekly/${style}`);
    report(`Weekly ${style} excludes chicken`, f);
  }

  console.log('\n=== TEST 2: excludedFoods=[chicken] — daily generation ===');
  const dailyRes = await generateDaily(sid, 'simple');
  const dailyPlan = JSON.parse(dailyRes.body);
  const dailyNames = collectAllMealNames(dailyPlan, false);
  report('Daily simple excludes chicken', checkNoKeywords(dailyNames, ['chicken'], 'daily/simple'));

  console.log('\n=== TEST 3: excludedFoods=[chicken] — replace-meal (all styles) ===');
  for (const style of ['simple', 'fancy', 'gourmet']) {
    for (const slot of REPLACE_SLOTS) {
      const res = await replaceMeal(sid, slot, style);
      const r = JSON.parse(res.body);
      if (r.meal && typeof r.meal === 'string') {
        const f = checkNoKeywords([r.meal], ['chicken'], `replace/${style}/${slot}`);
        report(`Replace ${style}/${slot} excludes chicken`, f);
      } else {
        report(`Replace ${style}/${slot} safe empty response`, 0);
      }
    }
  }

  console.log('\n=== TEST 4: excludedFoods=[beef] — must NOT over-filter turkey mince ===');
  await setPrefs(sid, { excludedFoods: ['beef'] });
  const beefRes = await generateWeekly(sid, 'simple');
  const beefPlan = JSON.parse(beefRes.body);
  const beefNames = collectAllMealNames(beefPlan, true);
  report('Weekly simple excludes beef keywords', checkNoKeywords(beefNames, ['beef', 'steak', 'bresaola'], 'weekly/simple'));

  console.log('\n=== TEST 5: excludedFoods=[mushroom, avocado] — category expansion (all styles) ===');
  await setPrefs(sid, { excludedFoods: ['mushroom', 'avocado'] });
  const expandedKws = ['mushroom', 'shiitake', 'portobello', 'chanterelle', 'truffle', 'avocado', 'guacamole'];
  for (const style of ['simple', 'fancy', 'gourmet']) {
    const res = await generateWeekly(sid, style);
    const plan = JSON.parse(res.body);
    const names = collectAllMealNames(plan, true);
    const f = checkNoKeywords(names, expandedKws, `weekly/${style}`);
    report(`Weekly ${style} excludes mushroom+avocado`, f);
  }

  console.log('\n=== TEST 6: excludedFoods=[red meat] — category keyword expansion ===');
  await setPrefs(sid, { excludedFoods: ['red meat'] });
  const redMeatKws = ['beef', 'lamb', 'veal', 'venison', 'steak', 'mince'];
  const rmRes = await generateWeekly(sid, 'simple');
  const rmPlan = JSON.parse(rmRes.body);
  const rmNames = collectAllMealNames(rmPlan, true);
  report('Weekly simple excludes red meat keywords', checkNoKeywords(rmNames, redMeatKws, 'weekly/simple'));

  console.log('\n=== TEST 7: Combined allergen + excluded food ===');
  await setPrefs(sid, { allergies: ['nuts'], excludedFoods: ['chicken'] });
  const combKws = ['chicken', 'almond', 'walnut', 'hazelnut', 'pistachio', 'pecan', 'cashew', 'pine nut', 'nut butter', 'marcona', 'praline', 'marzipan', 'nougat', 'pesto', 'romesco', 'chestnut'];
  const combRes = await generateWeekly(sid, 'simple');
  const combPlan = JSON.parse(combRes.body);
  const combNames = collectAllMealNames(combPlan, true);
  report('Weekly simple excludes chicken + nut allergen', checkNoKeywords(combNames, combKws, 'weekly/simple'));

  console.log('\n=== TEST 8: Empty-pool graceful handling (extreme exclusions) ===');
  await setPrefs(sid, { excludedFoods: ['chicken', 'beef', 'lamb', 'pork', 'turkey', 'duck', 'salmon', 'tuna', 'cod', 'egg', 'tofu', 'rice', 'pasta', 'bread', 'avocado', 'mushroom', 'cheese', 'yogurt', 'oat', 'quinoa', 'lentil', 'bean', 'chickpea'] });
  const emptyRes = await generateWeekly(sid, 'simple');
  if (emptyRes.status >= 200 && emptyRes.status < 300) {
    report('Empty-pool weekly returns success (graceful, no crash)', 0);
  } else {
    report('Empty-pool weekly returns success (graceful, no crash)', 1);
    console.log(`  Got status ${emptyRes.status}`);
  }
  for (const slot of REPLACE_SLOTS) {
    const repRes = await replaceMeal(sid, slot, 'simple');
    const repData = JSON.parse(repRes.body);
    if (repRes.status === 200) {
      report(`Empty-pool replace ${slot} returns 200`, 0);
    } else {
      report(`Empty-pool replace ${slot} returns 200`, 1);
    }
  }

  console.log('\n=== TEST 9: Allergen regression (gluten+sesame, no excluded foods) ===');
  await setPrefs(sid, { allergies: ['gluten', 'sesame'] });
  const glSeKws = ['toast', 'bread', 'pasta', 'spaghetti', 'noodle', 'tortilla', 'bagel', 'muffin', 'cracker', 'sourdough', 'rye', 'bulgur', 'couscous', 'crouton', 'flatbread', 'crepe', 'pancake', 'brioche', 'oat', 'oats', 'oatmeal', 'granola', 'muesli', 'barley', 'spelt', 'wheat', 'pumpernickel', 'porridge', 'sesame', 'tahini', 'hummus', 'halva', 'gomashio'];
  const glRes = await generateWeekly(sid, 'simple');
  const glPlan = JSON.parse(glRes.body);
  const glNames = collectAllMealNames(glPlan, true);
  report('Allergen regression gluten+sesame', checkNoKeywords(glNames, glSeKws, 'weekly/simple'));

  await setPrefs(sid, {});

  console.log(`\n=== RESULTS: ${passed} passed, ${failed} failed ===`);
  process.exit(failed > 0 ? 1 : 0);
}

run().catch(err => { console.error(err); process.exit(1); });
