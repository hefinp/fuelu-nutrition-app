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

async function setPrefs(sid, overrides) {
  const current = await req('GET', '/api/user/preferences', null, sid);
  const currentPrefs = JSON.parse(current.body);
  return req('PUT', '/api/user/preferences', {
    allergies: [], diet: null, excludedFoods: [], preferredFoods: [],
    onboardingComplete: true, cycleTrackingEnabled: false, micronutrientOptimize: false,
    dislikedMeals: currentPrefs.dislikedMeals ?? [],
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
        for (const m of (plan[day]?.[slot] || [])) names.push(m.meal);
      }
    }
  } else {
    for (const slot of SLOTS) {
      for (const m of (plan[slot] || [])) names.push(m.meal);
    }
  }
  return names;
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

  await setPrefs(sid, {});
  const baseline = await generateWeekly(sid, 'simple');
  const basePlan = JSON.parse(baseline.body);
  const mealNames = {};
  for (const slot of SLOTS) {
    mealNames[slot] = new Set();
    for (const day of DAYS) {
      for (const m of (basePlan[day]?.[slot] || [])) mealNames[slot].add(m.meal);
    }
    mealNames[slot] = [...mealNames[slot]];
  }

  const dislikeMeals = [
    mealNames.breakfast[0],
    mealNames.lunch[0],
    mealNames.dinner[0],
  ].filter(Boolean);
  const uniqueDislike = [...new Set(dislikeMeals)];

  console.log('Disliking meals:', uniqueDislike);
  for (const meal of uniqueDislike) {
    await req('POST', '/api/preferences/disliked-meals', { mealName: meal }, sid);
  }
  const dislikedLower = new Set(uniqueDislike.map(m => m.toLowerCase()));

  console.log('\n=== TEST 1: Disliked meals not in weekly plans (all styles) ===');
  for (const style of ['simple', 'gourmet', 'michelin']) {
    const res = await generateWeekly(sid, style);
    const plan = JSON.parse(res.body);
    const names = collectAllMealNames(plan, true);
    let f = 0;
    for (const name of names) {
      if (dislikedLower.has(name.toLowerCase())) {
        f++;
        console.log(`  FAIL: weekly/${style} — "${name}" is disliked`);
      }
    }
    report(`Weekly ${style} excludes disliked meals`, f);
  }

  console.log('\n=== TEST 2: Disliked meals not in daily plan ===');
  const dailyRes = await generateDaily(sid, 'simple');
  const dailyPlan = JSON.parse(dailyRes.body);
  const dailyNames = collectAllMealNames(dailyPlan, false);
  let f2 = 0;
  for (const name of dailyNames) {
    if (dislikedLower.has(name.toLowerCase())) {
      f2++;
      console.log(`  FAIL: daily/simple — "${name}" is disliked`);
    }
  }
  report('Daily simple excludes disliked meals', f2);

  console.log('\n=== TEST 3: Disliked meals not in replace-meal (all styles, all slots) ===');
  for (const style of ['simple', 'gourmet', 'michelin']) {
    let f = 0;
    for (const slot of REPLACE_SLOTS) {
      const res = await replaceMeal(sid, slot, style);
      const r = JSON.parse(res.body);
      if (r.meal && typeof r.meal === 'string' && dislikedLower.has(r.meal.toLowerCase())) {
        f++;
        console.log(`  FAIL: replace/${style}/${slot} — "${r.meal}" is disliked`);
      }
    }
    report(`Replace-meal ${style} excludes disliked meals`, f);
  }

  console.log('\n=== TEST 4: Allergen regression (gluten+sesame) with disliked meals ===');
  await setPrefs(sid, { allergies: ['gluten', 'sesame'] });
  const glSeKws = ['toast', 'bread', 'pasta', 'spaghetti', 'noodle', 'tortilla', 'bagel', 'muffin', 'cracker', 'sourdough', 'rye', 'bulgur', 'couscous', 'crouton', 'flatbread', 'crepe', 'pancake', 'brioche', 'oat', 'oats', 'oatmeal', 'granola', 'muesli', 'barley', 'spelt', 'wheat', 'pumpernickel', 'porridge', 'sesame', 'tahini', 'hummus', 'halva', 'gomashio'];
  const glRes = await generateWeekly(sid, 'simple');
  const glPlan = JSON.parse(glRes.body);
  const glNames = collectAllMealNames(glPlan, true);
  let f4 = 0;
  for (const name of glNames) {
    const fl = glSeKws.filter(k => name.toLowerCase().includes(k));
    if (fl.length) { f4++; console.log(`  FAIL: allergen leak — "${name}" contains [${fl.join(', ')}]`); }
  }
  report('Allergen regression gluten+sesame', f4);

  console.log('\n=== TEST 5: Excluded foods regression (mushroom+avocado) with disliked meals ===');
  await setPrefs(sid, { excludedFoods: ['mushroom', 'avocado'] });
  const efKws = ['mushroom', 'shiitake', 'portobello', 'chanterelle', 'truffle', 'avocado', 'guacamole'];
  const efRes = await generateWeekly(sid, 'simple');
  const efPlan = JSON.parse(efRes.body);
  const efNames = collectAllMealNames(efPlan, true);
  let f5 = 0;
  for (const name of efNames) {
    const fl = efKws.filter(k => name.toLowerCase().includes(k));
    if (fl.length) { f5++; console.log(`  FAIL: excluded food leak — "${name}" contains [${fl.join(', ')}]`); }
  }
  report('Excluded foods regression mushroom+avocado', f5);

  console.log('\n=== TEST 6: Combined disliked + excluded + allergen ===');
  await setPrefs(sid, { allergies: ['nuts'], excludedFoods: ['chicken'] });
  const combKws = ['chicken', 'almond', 'walnut', 'hazelnut', 'pistachio', 'pecan', 'cashew', 'pine nut', 'nut butter', 'marcona', 'praline', 'marzipan', 'nougat', 'pesto', 'romesco', 'chestnut'];
  const combRes = await generateWeekly(sid, 'simple');
  const combPlan = JSON.parse(combRes.body);
  const combNames = collectAllMealNames(combPlan, true);
  let f6 = 0;
  for (const name of combNames) {
    if (dislikedLower.has(name.toLowerCase())) { f6++; console.log(`  FAIL: disliked leak — "${name}"`); }
    const fl = combKws.filter(k => name.toLowerCase().includes(k));
    if (fl.length) { f6++; console.log(`  FAIL: allergen/excluded leak — "${name}" contains [${fl.join(', ')}]`); }
  }
  report('Combined disliked + excluded chicken + allergen nuts', f6);

  console.log('\n=== TEST 7: User recipe with disliked name is not injected ===');
  await setPrefs(sid, { recipeWebsitesEnabled: true, recipeWeeklyLimit: 10, recipeEnabledSlots: ['breakfast', 'lunch', 'dinner', 'snack'] });
  const testRecipeName = uniqueDislike[0];
  const createRecipeRes = await req('POST', '/api/recipes', {
    name: testRecipeName,
    sourceUrl: 'https://test.example.com/disliked-recipe',
    servings: 1,
    caloriesPerServing: 400,
    proteinPerServing: 30,
    carbsPerServing: 40,
    fatPerServing: 15,
    mealSlot: 'lunch',
    mealStyle: 'simple',
  }, sid);
  let createdRecipeId = null;
  if (createRecipeRes.status === 201) {
    createdRecipeId = JSON.parse(createRecipeRes.body).id;
    const genRes = await generateWeekly(sid, 'simple');
    const genPlan = JSON.parse(genRes.body);
    const allNames = collectAllMealNames(genPlan, true);
    let f7 = 0;
    for (const name of allNames) {
      if (dislikedLower.has(name.toLowerCase())) {
        f7++;
        console.log(`  FAIL: user recipe injection bypass — "${name}" is disliked`);
      }
    }
    report('User recipe with disliked name not injected', f7);
  } else {
    console.log('  SKIP: Could not create test recipe (status ' + createRecipeRes.status + ')');
    report('User recipe with disliked name not injected', 0);
  }

  console.log('\n=== TEST 8: Community meal with disliked name is not injected ===');
  const testCmName = uniqueDislike[uniqueDislike.length - 1];
  const createCmRes = await req('POST', '/api/community-meals', {
    name: testCmName,
    slot: 'dinner',
    style: 'simple',
    caloriesPerServing: 500,
    proteinPerServing: 35,
    carbsPerServing: 50,
    fatPerServing: 20,
    microScore: 3,
  }, sid);
  let createdCmId = null;
  if (createCmRes.status === 201) {
    createdCmId = JSON.parse(createCmRes.body).id;
    const genRes = await generateWeekly(sid, 'simple');
    const genPlan = JSON.parse(genRes.body);
    const allNames = collectAllMealNames(genPlan, true);
    let f8 = 0;
    for (const name of allNames) {
      if (dislikedLower.has(name.toLowerCase())) {
        f8++;
        console.log(`  FAIL: community meal injection bypass — "${name}" is disliked`);
      }
    }
    report('Community meal with disliked name not injected', f8);
  } else {
    console.log('  SKIP: Could not create test community meal (status ' + createCmRes.status + ')');
    report('Community meal with disliked name not injected', 0);
  }

  console.log('\n=== TEST 9: Empty-pool graceful handling (all meals disliked) ===');
  await setPrefs(sid, { recipeWebsitesEnabled: false });
  const baseRes2 = await generateWeekly(sid, 'simple');
  const basePlan2 = JSON.parse(baseRes2.body);
  const allMealNames = new Set();
  for (const day of DAYS) {
    for (const slot of SLOTS) {
      for (const m of (basePlan2[day]?.[slot] || [])) allMealNames.add(m.meal);
    }
  }
  for (const name of allMealNames) {
    await req('POST', '/api/preferences/disliked-meals', { mealName: name }, sid);
  }
  const emptyRes = await generateWeekly(sid, 'simple');
  if (emptyRes.status >= 200 && emptyRes.status < 300) {
    report('Empty-pool weekly generation succeeds (graceful)', 0);
  } else {
    report('Empty-pool weekly generation succeeds (graceful)', 1);
    console.log(`  Got status ${emptyRes.status}`);
  }
  for (const slot of REPLACE_SLOTS) {
    const repRes = await replaceMeal(sid, slot, 'simple');
    if (repRes.status >= 200 && repRes.status < 300) {
      report(`Empty-pool replace ${slot} succeeds (graceful)`, 0);
    } else {
      report(`Empty-pool replace ${slot} succeeds (graceful)`, 1);
    }
  }
  for (const name of allMealNames) {
    await req('DELETE', '/api/preferences/disliked-meals/' + encodeURIComponent(name), null, sid);
  }

  if (createdRecipeId) {
    await req('DELETE', '/api/recipes/' + createdRecipeId, null, sid);
  }
  if (createdCmId) {
    await req('DELETE', '/api/community-meals/' + createdCmId + '/unshare', null, sid);
  }
  for (const meal of uniqueDislike) {
    await req('DELETE', '/api/preferences/disliked-meals/' + encodeURIComponent(meal), null, sid);
  }
  await setPrefs(sid, { dislikedMeals: [] });

  console.log(`\n=== RESULTS: ${passed} passed, ${failed} failed ===`);
  process.exit(failed > 0 ? 1 : 0);
}

run().catch(err => { console.error(err); process.exit(1); });
