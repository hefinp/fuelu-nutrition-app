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

function replaceMeal(sid, slot, style, targetDate) {
  const body = {
    slot, mealStyle: style,
    dailyCalories: 2000, proteinGoal: 150, carbsGoal: 250, fatGoal: 65,
    currentMealName: 'NONEXISTENT_MEAL_FOR_TEST',
  };
  if (targetDate) body.targetDate = targetDate;
  return req('POST', '/api/meal-plans/replace-meal', body, sid);
}

let passed = 0, failed = 0;
function report(label, failures) {
  if (failures === 0) { passed++; console.log(`  PASS: ${label}`); }
  else { failed++; console.log(`  FAIL: ${label}`); }
}

async function run() {
  const loginRes = await req('POST', '/api/auth/login', { email: TEST_EMAIL, password: TEST_PASS });
  if (loginRes.status !== 200) { console.error('Login failed:', loginRes.body); process.exit(1); }
  const sid = loginRes.setCookie.find(c => c.startsWith('connect.sid'))?.split(';')[0];
  if (!sid) { console.error('No session cookie'); process.exit(1); }

  const today = new Date();
  const lastPeriodDate = new Date(today);
  lastPeriodDate.setDate(today.getDate() - 12);
  const lpStr = lastPeriodDate.toISOString().split('T')[0];

  console.log('\n=== TEST 1: replace-meal accepts targetDate without error ===');
  await setPrefs(sid, { cycleTrackingEnabled: true, lastPeriodDate: lpStr, cycleLength: 28 });
  const futureDate = new Date(today);
  futureDate.setDate(today.getDate() + 5);
  const futureDateStr = futureDate.toISOString().split('T')[0];
  const res1 = await replaceMeal(sid, 'lunch', 'simple', futureDateStr);
  report('replace-meal with targetDate returns 200', res1.status !== 200 ? 1 : 0);
  const body1 = JSON.parse(res1.body);
  report('replace-meal with targetDate returns a meal', (!body1.meal && !body1.calories) ? 1 : 0);

  console.log('\n=== TEST 2: replace-meal without targetDate still works ===');
  const res2 = await replaceMeal(sid, 'dinner', 'simple');
  report('replace-meal without targetDate returns 200', res2.status !== 200 ? 1 : 0);
  const body2 = JSON.parse(res2.body);
  report('replace-meal without targetDate returns a meal', (!body2.meal && !body2.calories) ? 1 : 0);

  console.log('\n=== TEST 3: targetDate changes phase for mid-week boundary ===');
  const daysSinceStart = 12;
  const todayPhaseDay = daysSinceStart + 1;
  const todayPhase = todayPhaseDay <= 5 ? 'menstrual' : todayPhaseDay <= 13 ? 'follicular' : todayPhaseDay <= 16 ? 'ovulatory' : 'luteal';
  const offsetForDifferentPhase = todayPhase === 'follicular' ? 3 : todayPhase === 'ovulatory' ? 5 : todayPhase === 'luteal' ? 20 : 10;
  const diffDate = new Date(today);
  diffDate.setDate(today.getDate() + offsetForDifferentPhase);
  const diffDateStr = diffDate.toISOString().split('T')[0];
  const res3 = await replaceMeal(sid, 'breakfast', 'simple', diffDateStr);
  report('replace-meal with different-phase targetDate returns 200', res3.status !== 200 ? 1 : 0);

  console.log('\n=== TEST 4: replace-meal with targetDate works for all slots ===');
  let f4 = 0;
  for (const slot of ['breakfast', 'lunch', 'dinner', 'snack']) {
    const res = await replaceMeal(sid, slot, 'simple', futureDateStr);
    if (res.status !== 200) {
      f4++;
      console.log(`  FAIL: slot ${slot} returned ${res.status}`);
    }
  }
  report('All slots accept targetDate', f4);

  console.log('\n=== TEST 5: replace-meal with targetDate works for all styles ===');
  let f5 = 0;
  for (const style of ['simple', 'fancy', 'gourmet']) {
    const res = await replaceMeal(sid, 'lunch', style, futureDateStr);
    if (res.status !== 200) {
      f5++;
      console.log(`  FAIL: style ${style} returned ${res.status}`);
    }
  }
  report('All styles accept targetDate', f5);

  console.log('\n=== TEST 6: replace-meal without cycle tracking ignores targetDate gracefully ===');
  await setPrefs(sid, { cycleTrackingEnabled: false, lastPeriodDate: null });
  const res6 = await replaceMeal(sid, 'lunch', 'simple', futureDateStr);
  report('Non-cycle user with targetDate returns 200', res6.status !== 200 ? 1 : 0);

  console.log('\n=== TEST 7: Generate weekly plan then replace a later-week day meal with correct targetDate ===');
  const weekMonday = new Date(today);
  weekMonday.setDate(today.getDate() - ((today.getDay() + 6) % 7));
  const weekStartStr = weekMonday.toISOString().split('T')[0];
  const lpForWeek = new Date(weekMonday);
  lpForWeek.setDate(weekMonday.getDate() - 10);
  const lpForWeekStr = lpForWeek.toISOString().split('T')[0];
  await setPrefs(sid, { cycleTrackingEnabled: true, lastPeriodDate: lpForWeekStr, cycleLength: 28 });
  const genRes = await req('POST', '/api/meal-plans', {
    dailyCalories: 2000, weeklyCalories: 14000,
    proteinGoal: 150, carbsGoal: 250, fatGoal: 65,
    planType: 'weekly', mealStyle: 'simple',
    weekStartDate: weekStartStr,
  }, sid);
  let f7 = 0;
  if (genRes.status !== 201) {
    f7++;
    console.log(`  FAIL: Weekly generation returned ${genRes.status}`);
  } else {
    const plan = JSON.parse(genRes.body);
    const thursdayMeal = plan.thursday?.lunch?.[0]?.meal || plan.thursday?.dinner?.[0]?.meal;
    if (!thursdayMeal) {
      console.log('  SKIP: No Thursday meal found in plan (empty slots)');
    }
    const thursdayDateStr = (() => {
      const d = new Date(weekMonday);
      d.setDate(d.getDate() + 3);
      return d.toISOString().split('T')[0];
    })();
    const replRes = await replaceMeal(sid, 'lunch', 'simple', thursdayDateStr);
    if (replRes.status !== 200) {
      f7++;
      console.log(`  FAIL: Thursday replace-meal returned ${replRes.status}`);
    }
    const replBody = JSON.parse(replRes.body);
    if (!replBody.meal && !replBody.calories) {
      f7++;
      console.log('  FAIL: Thursday replace-meal returned no meal');
    }
  }
  report('Weekly plan + Thursday replace with targetDate', f7);

  await setPrefs(sid, { cycleTrackingEnabled: false, lastPeriodDate: null });

  console.log(`\n=== RESULTS: ${passed} passed, ${failed} failed ===`);
  process.exit(failed > 0 ? 1 : 0);
}

run().catch(err => { console.error(err); process.exit(1); });
