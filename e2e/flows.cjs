// Saved browser tests for every role, in English and Telugu. Exits 1 if anything fails.
const pw = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const BROWSER = process.env.E2E_BROWSER || 'chromium';   // chromium | firefox | webkit
const B = process.env.E2E_BASE, PW = process.env.E2E_PASSWORD;
const fails = []; let passed = 0;
const check = (name, ok, extra = '') => { if (ok) { passed++; console.log('  ok  ', name); } else { fails.push(name); console.log('  FAIL', name, extra); } };

(async () => {
  const b = BROWSER === 'firefox' ? await pw.firefox.launch() : BROWSER === 'webkit' ? await pw.webkit.launch() : await pw.chromium.launch({ executablePath: process.env.CHROME_BIN });
  console.log('Browser:', BROWSER);
  const pageErrors = [], cspViolations = [];
  const open = async (u, w = 1280, h = 900, pw = PW) => {
    const p = await b.newPage({ viewport: { width: w, height: h } });
    p.on('pageerror', (e) => pageErrors.push(u + ': ' + e.message));
    p.on('console', (m) => { if (/Content Security Policy|Refused to/i.test(m.text())) cspViolations.push(u + ': ' + m.text().slice(0, 160)); });
    await p.goto(B); await p.waitForTimeout(500);
    await p.locator('input[type=text], input:not([type])').first().fill(u);
    await p.locator('input[type=password]').first().fill(pw);
    await p.keyboard.press('Enter'); await p.waitForTimeout(2200);
    return p;
  };
  const h1 = async (p) => (await p.locator('h1').first().innerText().catch(() => ''));

  console.log('Sign-in screen');
  {
    const ctx = await b.newContext({ viewport: { width: 1280, height: 800 } });
    const lp = await ctx.newPage(); lp.on('pageerror', (e) => pageErrors.push('login: ' + e.message));
    await lp.goto(B); await lp.waitForTimeout(700);
    check('brand panel is shown on a wide screen', await lp.getByRole('heading', { name: 'Governance news for Telangana' }).isVisible());
    check('the username box has focus on arrival', (await lp.evaluate(() => document.activeElement && document.activeElement.id)) === 'login-username');
    await lp.click('#btn-login'); await lp.waitForTimeout(300);
    check('empty form: asks for both', (await lp.locator('#login-error-msg').innerText()).includes('Enter both'));
    await lp.fill('#login-username', 'nobody'); await lp.fill('#login-password', 'wrong-pass-1'); await lp.click('#btn-login'); await lp.waitForTimeout(900);
    check('wrong password: a clear, friendly message', (await lp.locator('#login-error-msg').innerText()).includes('not right'));
    check('password is hidden by default', (await lp.locator('#login-password').getAttribute('type')) === 'password');
    await lp.getByRole('button', { name: 'Show password' }).click();
    check('show password reveals it', (await lp.locator('#login-password').getAttribute('type')) === 'text');
    await lp.getByRole('button', { name: 'Hide password' }).click();
    check('hide password hides it again', (await lp.locator('#login-password').getAttribute('type')) === 'password');
    await lp.locator('#btn-lang-login').click(); await lp.waitForTimeout(300);
    check('language switch works on the sign-in screen (Telugu)', (await lp.locator('h2').first().innerText()).includes('సైన్ ఇన్'));
    await lp.locator('#btn-lang-login').click(); await lp.waitForTimeout(200);
    for (let i = 0; i < 6; i++) { await lp.fill('#login-username', 'lockme'); await lp.fill('#login-password', 'bad-pass-' + i); await lp.click('#btn-login'); await lp.waitForTimeout(350); }
    check('too many wrong attempts: tells the person to wait', (await lp.locator('#login-error-msg').innerText()).includes('Too many wrong attempts'), await lp.locator('#login-error-msg').innerText());
    await lp.close();
    const pctx = await b.newContext({ viewport: { width: 375, height: 700 } });
    const pp = await pctx.newPage(); await pp.goto(B); await pp.waitForTimeout(700);
    check('phone: no sideways scroll, brand panel hidden, form usable', (await pp.evaluate(() => document.documentElement.scrollWidth - innerWidth)) <= 0 && !(await pp.getByRole('heading', { name: 'Governance news for Telangana' }).isVisible()) && await pp.locator('#login-username').isVisible());
    await pp.close(); await pctx.close(); await ctx.close();
  }

  console.log('Each login opens its own home');
  for (const [u, expect] of [['admin', 'Control Room'], ['mla_test', 'My Constituency'], ['min_test', 'State Overview'], ['staff_test', 'Work Queue']]) {
    const p = await open(u); check(`${u} home is "${expect}"`, (await h1(p)).includes(expect), await h1(p)); await p.close();
  }

  console.log('Staff sends up to the MLA');
  let p = await open('staff_test');
  await p.getByRole('button', { name: /Send to MLA/ }).first().click(); await p.waitForTimeout(700);
  let dlg = p.getByRole('dialog');
  check('share dialog opens with the leader preselected', await dlg.getByRole('checkbox').first().isChecked());
  await dlg.locator('textarea').fill('Please look at this today'); await dlg.getByText('Mark urgent').click();
  await dlg.getByRole('button', { name: 'Send', exact: true }).click(); await p.waitForTimeout(1300);
  check('dialog closed after sending', (await p.getByRole('dialog').count()) === 0);
  await p.close();

  console.log('MLA receives, acts, replies, manages team');
  p = await open('mla_test');
  check('Shared button shows unread 1', (await p.locator('#btn-inbox').innerText()).includes('1'));
  const pick = p.locator('li', { hasText: 'Please look at this today' }).first();
  check('leader home: "Picked for you" shows the staff pick with its note', (await p.getByText('Picked for you').count()) > 0 && (await pick.count()) > 0);
  check('leader home: three one-tap answers are offered', (await pick.locator('[data-pick-answer]').count()) === 3);
  await pick.locator('[data-pick-answer=seen]').click(); await p.waitForTimeout(1200);
  const after = p.locator('li', { hasText: 'Please look at this today' }).first();
  check('one tap on "Seen" moves it on (Seen button gone, "I\'ll act" and "Done" remain)',
        (await after.locator('[data-pick-answer=seen]').count()) === 0 && (await after.locator('[data-pick-answer=acting]').count()) === 1 && (await after.locator('[data-pick-answer=done]').count()) === 1);
  check('leader home has only 3 big numbers, no team list', (await p.getByText('In progress').count()) === 0);
  await p.getByRole('button', { name: 'See everything' }).click(); await p.waitForTimeout(800);
  await p.locator('[data-slot=sheet-content] button[aria-expanded]').first().click(); await p.waitForTimeout(800);
  check('the staff note is shown', (await p.locator('[data-slot=sheet-content]').innerText()).includes('Please look at this today'));
  await p.getByRole('button', { name: /Mark acting/i }).click(); await p.waitForTimeout(800);
  await p.getByPlaceholder('Write a reply').fill('Noted'); await p.getByRole('button', { name: 'Reply' }).click(); await p.waitForTimeout(800);
  check('reply posted', (await p.locator('[data-slot=sheet-content]').innerText()).includes('Noted'));
  await p.keyboard.press('Escape'); await p.waitForTimeout(300);
  check('Esc closes the drawer', (await p.locator('[data-slot=sheet-content]').count()) === 0);
  await p.getByRole('button', { name: 'Manage' }).click(); await p.waitForTimeout(600);
  dlg = p.getByRole('dialog');
  await dlg.getByLabel('Username').fill('e2e_helper'); await dlg.getByLabel(/Password \(8/).fill('helper-pass-123');
  await dlg.getByRole('button', { name: 'Add', exact: true }).click(); await p.waitForTimeout(1000);
  check('new staff listed', (await dlg.innerText()).includes('e2e_helper'));
  await dlg.getByRole('button', { name: 'Disable' }).first().click(); await p.waitForTimeout(800);
  check('staff can be disabled', (await dlg.innerText()).includes('Disabled'));
  await p.close();

  console.log('Team board: tasks, notes, edited briefing, logo');
  p = await open('staff_test');
  check('logo is one real image file and it loads in the header', await p.evaluate(() => { const i = document.querySelector('.brand-container img'); return !!i && i.getAttribute('src') === '/logo.svg' && i.naturalWidth > 0; }));
  check('browser tab has an icon', (await p.locator('link[rel=icon]').count()) === 1);
  check('staff home has a Team tasks section', (await p.locator('#btn-open-board').count()) === 1);
  await p.getByRole('button', { name: 'Make a task' }).first().click(); await p.waitForTimeout(800);
  dlg = p.getByRole('dialog');
  check('"Make a task" opens the board with the story title filled in', (await dlg.locator('#task-title').inputValue()).includes('[E2E]'));
  await dlg.locator('#task-who').selectOption('staff_test'); await dlg.locator('#task-due').fill('2000-01-01');
  await dlg.getByRole('button', { name: 'Add task' }).click(); await p.waitForTimeout(1100);
  check('the task appears under To do and is marked overdue', (await dlg.locator('section[aria-label="To do"]').innerText()).includes('[E2E]') && (await dlg.locator('section[aria-label="To do"]').innerText()).includes('Overdue'));
  await dlg.getByRole('button', { name: 'Start' }).click(); await p.waitForTimeout(900);
  check('Start moves it to Doing', (await dlg.locator('section[aria-label="Doing"]').innerText()).includes('[E2E]'));
  await dlg.getByRole('button', { name: /^Notes \(0\)/ }).click(); await p.waitForTimeout(500);
  await dlg.getByPlaceholder('Write a note').fill('Called the ward officer'); await dlg.getByRole('button', { name: 'Send', exact: true }).click(); await p.waitForTimeout(800);
  check('a team note is saved and shown', (await dlg.innerText()).includes('Called the ward officer'));
  await p.keyboard.press('Escape'); await p.waitForTimeout(300);
  await p.getByRole('button', { name: /Briefing/ }).click(); await p.waitForTimeout(1200);
  dlg = p.getByRole('dialog');
  check('staff see an editable box with the leader\'s briefing', (await dlg.locator('#briefing-text').inputValue()).includes('[E2E] MLA'));
  await dlg.locator('#briefing-text').fill('Good morning sir. E2E edited briefing: only the road story today.');
  await dlg.getByRole('button', { name: 'Save for leader' }).click(); await p.waitForTimeout(1000);
  check('saving the edited briefing is confirmed', (await dlg.innerText()).includes('Saved. The leader gets your version today.'));
  await p.keyboard.press('Escape'); await p.waitForTimeout(200);
  await p.locator('#btn-lang').click(); await p.waitForTimeout(400);
  await p.locator('#btn-board').click(); await p.waitForTimeout(800);
  check('Telugu: the board is translated', (await p.getByRole('dialog').innerText()).includes('బృందం పనులు'));
  await p.close();

  p = await open('mla_test');
  check('leader home shows the team task line', (await p.locator('#btn-open-board').count()) === 1 && (await p.getByText(/1 doing/).count()) > 0);
  await p.locator('#btn-board').click(); await p.waitForTimeout(900);
  dlg = p.getByRole('dialog');
  check('leader sees the task but cannot add or move tasks', (await dlg.innerText()).includes('[E2E]') && (await dlg.getByRole('button', { name: 'Add task' }).count()) === 0 && (await dlg.getByRole('button', { name: 'Start' }).count()) === 0);
  await dlg.getByRole('button', { name: /^Notes \(1\)/ }).click(); await p.waitForTimeout(600);
  check('leader reads the staff note', (await dlg.innerText()).includes('Called the ward officer'));
  await dlg.getByPlaceholder('Write a note').fill('Good. Update me tonight.'); await dlg.getByRole('button', { name: 'Send', exact: true }).click(); await p.waitForTimeout(800);
  check('leader can write a note', (await dlg.innerText()).includes('Update me tonight.'));
  await p.keyboard.press('Escape'); await p.waitForTimeout(300);
  await p.getByRole('button', { name: /Briefing/ }).click(); await p.waitForTimeout(1200);
  dlg = p.getByRole('dialog');
  check('leader gets the staff-edited briefing, with who edited it', (await dlg.locator('pre').innerText()).includes('E2E edited briefing') && (await dlg.locator('#briefing-edited-note').innerText()).includes('staff_test'));
  await p.close();

  p = await open('staff_test');
  await p.getByRole('button', { name: /Briefing/ }).click(); await p.waitForTimeout(1200);
  dlg = p.getByRole('dialog');
  check('staff see "Edited by" on their own edit', (await dlg.locator('#briefing-edited-note').innerText()).includes('staff_test'));
  await dlg.getByRole('button', { name: 'Back to automatic' }).click(); await p.waitForTimeout(1100);
  check('"Back to automatic" restores the generated text', (await dlg.locator('#briefing-text').inputValue()).includes('Top stories') && !(await dlg.locator('#briefing-text').inputValue()).includes('E2E edited briefing') && (await dlg.locator('#briefing-edited-note').count()) === 0);
  await p.close();

  p = await open('mla2');
  await p.getByRole('button', { name: /Briefing/ }).click(); await p.waitForTimeout(1200);
  check('another leader is not affected by the edit (no staff-edited text)', !(await p.getByRole('dialog').innerText()).includes('E2E edited briefing') && (await p.locator('#briefing-edited-note').count()) === 0);
  await p.keyboard.press('Escape'); await p.waitForTimeout(300);
  await p.locator('#btn-board').click(); await p.waitForTimeout(800);
  check('another team\'s board is empty', !(await p.getByRole('dialog').innerText()).includes('[E2E] '));
  await p.close();

  console.log('Anyone can change their own password; other sessions end');
  const other = await open('mla2');                                   // an older session of the same person
  p = await open('mla2');
  await p.locator('#btn-password').click(); await p.waitForTimeout(500);
  dlg = p.getByRole('dialog');
  await dlg.getByRole('tab', { name: 'Password' }).click(); await p.waitForTimeout(300);
  await dlg.getByLabel('Current password').fill('wrong-wrong'); await dlg.getByLabel('New password (8+ characters)').fill('fresh-pass-77'); await dlg.getByLabel('Repeat new password').fill('fresh-pass-77');
  await dlg.getByRole('button', { name: 'Change password' }).click(); await p.waitForTimeout(800);
  check('wrong current password is refused', (await dlg.innerText()).includes('Current password is wrong'));
  await dlg.getByLabel('Current password').fill(PW); await dlg.getByLabel('Repeat new password').fill('different-77');
  await dlg.getByRole('button', { name: 'Change password' }).click(); await p.waitForTimeout(500);
  check('two different new passwords are refused', (await dlg.innerText()).includes('not the same'));
  await dlg.getByLabel('Repeat new password').fill('fresh-pass-77');
  await dlg.getByRole('button', { name: 'Change password' }).click(); await p.waitForTimeout(1000);
  check('password changed', (await dlg.innerText()).includes('Password changed'));
  await p.keyboard.press('Escape'); await p.waitForTimeout(300);
  check('this session keeps working', (await h1(p)).length > 0 && (await p.locator('#btn-logout').count()) === 1);
  await other.reload(); await other.waitForTimeout(2200);
  check('the older session was logged out', (await other.locator('#btn-logout').count()) === 0 && (await other.locator('input[type=password]').count()) === 1);
  const oldLogin = await (await fetch(B + '/api/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ username: 'mla2', password: PW }) })).json();
  const newLogin = await (await fetch(B + '/api/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ username: 'mla2', password: 'fresh-pass-77' }) })).json();
  check('old password no longer works, new one does', oldLogin.status !== 'success' && newLogin.status === 'success');
  await p.close(); await other.close();

  console.log('Master admin: control room, users, read-only shares, audit log, Telugu');
  p = await open('admin');
  check('control room shows system health', (await p.locator('body').innerText()).includes('Database'));
  check('admin has no Share buttons on Home', (await p.getByRole('button', { name: /^Send to/ }).count()) === 0);
  const body = await p.locator('body').innerText();
  check('audit card lists real activity', body.includes('Recent activity') && /Changed own password|Shared a story|Account created/.test(body));
  await p.getByRole('button', { name: 'View all' }).click(); await p.waitForTimeout(800);
  dlg = p.getByRole('dialog');
  check('audit log dialog has entries', (await dlg.locator('li').count()) > 0);
  await dlg.getByPlaceholder(/Search by person/).fill('mla2'); await p.waitForTimeout(900);
  check('audit search filters', (await dlg.locator('li').count()) > 0 && !(await dlg.innerText()).includes('staff_test'));
  await p.keyboard.press('Escape'); await p.waitForTimeout(300);
  await p.getByRole('button', { name: /Users/ }).click(); await p.waitForTimeout(800);
  check('users dialog lists accounts', (await p.getByRole('dialog').locator('.rounded-lg.border.p-3').count()) >= 5);
  await p.keyboard.press('Escape'); await p.waitForTimeout(300);
  await p.getByRole('button', { name: /All shares/ }).first().click(); await p.waitForTimeout(800);
  check('admin sees all shares but cannot reply', (await p.locator('[data-slot=sheet-content] button[aria-expanded]').count()) > 0 && (await p.getByPlaceholder('Write a reply').count()) === 0);
  await p.keyboard.press('Escape'); await p.waitForTimeout(300);
  await p.locator('#btn-lang').click(); await p.waitForTimeout(500);
  check('Telugu: control room title', (await h1(p)).includes('కంట్రోల్ రూమ్'), await h1(p));
  await p.reload(); await p.waitForTimeout(2000);
  check('Telugu is remembered after reload', (await h1(p)).includes('కంట్రోల్ రూమ్'));
  await p.close();

  console.log('Account, briefing, feedback, reports, contact import');
  p = await open('mla_test');
  await p.locator('#btn-password').click(); await p.waitForTimeout(700);
  dlg = p.getByRole('dialog');
  check('account dialog warns that email is not set up on the server', (await dlg.innerText()).includes('Email is not set up on the server'));
  await dlg.getByLabel('Email', { exact: true }).fill('mla@example.org'); await dlg.getByLabel('Phone', { exact: true }).fill('+91 98765 43210');
  await dlg.getByRole('button', { name: 'Save', exact: true }).click(); await p.waitForTimeout(900);
  check('contact details saved', (await dlg.innerText()).includes('Saved.'));
  await dlg.getByLabel('Email', { exact: true }).fill('not-an-email'); await dlg.getByRole('button', { name: 'Save', exact: true }).click(); await p.waitForTimeout(700);
  check('a bad email is refused', (await dlg.innerText()).includes('does not look right'));
  await p.keyboard.press('Escape'); await p.waitForTimeout(300);
  await p.getByRole('button', { name: /Briefing/ }).click(); await p.waitForTimeout(1200);
  dlg = p.getByRole('dialog');
  const brief = await dlg.locator('pre').innerText();
  check('briefing has the leader name, scope and top stories', brief.includes('[E2E] MLA') && brief.includes('Sircilla') && brief.includes('Top stories'), brief.slice(0, 80));
  check('briefing offers Send via WhatsApp with the text ready', (await dlg.locator('a[href^="https://wa.me/?text="]').count()) === 1);
  await p.keyboard.press('Escape'); await p.waitForTimeout(300);
  await p.close();

  p = await open('staff_test');
  await p.getByRole('button', { name: 'Report' }).first().click(); await p.waitForTimeout(400);
  await p.getByRole('menuitem', { name: 'Wrong priority' }).click(); await p.waitForTimeout(900);
  check('reporting a story says thanks', (await p.locator('[role=status]').first().innerText().catch(() => '')).includes('Thanks'));
  await p.locator('#btn-feedback').click(); await p.waitForTimeout(500);
  dlg = p.getByRole('dialog');
  await dlg.locator('textarea').fill('The send button was hard to find at first');
  await dlg.getByRole('button', { name: 'Send', exact: true }).click(); await p.waitForTimeout(900);
  check('app feedback sent', (await dlg.innerText()).includes('Thank you'));
  await p.close();

  p = await open('admin');
  const ab = await p.locator('body').innerText();
  check('admin sees the quality report', ab.includes('News quality') && ab.includes('Wrong priority 1'));
  check('admin sees the user feedback', ab.includes('hard to find at first'));
  await p.getByRole('button', { name: /Users/ }).click(); await p.waitForTimeout(700);
  await p.getByRole('tab', { name: 'Import contacts' }).click(); await p.waitForTimeout(300);
  await p.locator('input[type=file]').setInputFiles({ name: 'contacts.csv', mimeType: 'text/csv',
    buffer: Buffer.from('constituency,name,phone,email,party,role_type,district\nSircilla,,+91 98765 43210,sircilla@example.org,,,\nNowhere,,98765 43210,,,,\n\nSiddipet,,,,,,') });
  check('import tab offers a template download', (await p.getByRole('button', { name: 'Download template' }).count()) === 1);
  await p.getByRole('button', { name: 'Preview' }).click(); await p.waitForTimeout(900);
  dlg = p.getByRole('dialog');
  check('import preview: 1 update, 1 problem, unfilled row skipped quietly', /1 to update, 0 to add, 1 problems, 1 rows skipped/.test(await dlg.innerText()), (await dlg.innerText()).slice(0, 200));
  await dlg.getByRole('button', { name: 'Apply' }).click(); await p.waitForTimeout(900);
  check('import applied', (await dlg.innerText()).includes('Done: 1 updated'));
  await p.keyboard.press('Escape'); await p.waitForTimeout(300);
  await p.locator('#btn-lang').click(); await p.waitForTimeout(400);
  const te = await p.locator('body').innerText();
  check('Telugu: quality + feedback cards translated', te.includes('వార్తల నాణ్యత') && te.includes('వినియోగదారుల అభిప్రాయాలు'));
  await p.close();
  const reps = await (await fetch(B + '/api/representatives', { headers: { Authorization: 'Bearer ' + (await (await fetch(B + '/api/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ username: 'admin', password: PW }) })).json()).token } })).json();
  check('the MLA contact now shows real data', reps.representatives.some((r) => r.email === 'sircilla@example.org' && r.contact_phone === '+91 98765 43210'));

  console.log('Phone width and News feed');
  p = await open('mla_test', 375, 812);
  check('no sideways scroll on a phone', (await p.evaluate(() => document.documentElement.scrollWidth - innerWidth)) <= 0);
  await p.locator('nav button').nth(1).click(); await p.waitForTimeout(1200);
  check('News feed tab shows stories', (await p.locator('[id^=article-card-]').count()) > 0);
  check('Refresh news button is on the news page', (await p.locator('#btn-refresh-news').count()) === 1);
  await p.locator('#btn-refresh-news').click();
  await p.waitForFunction(() => { const n = document.getElementById('refresh-note'); return n && /Found|No new stories|Could not check|Refresh again/.test(n.textContent); }, null, { timeout: 40000 }).catch(() => {});
  const refreshNote = await p.locator('#refresh-note').innerText().catch(() => '');
  check('Refresh news answers in plain words (found / nothing new / could not check)', /Found|No new stories|Could not check/.test(refreshNote), refreshNote);
  check('Refresh news waits before it can be pressed again', await p.locator('#btn-refresh-news').isDisabled());
  await p.close();

  if (process.env.AXE_PATH || process.env.E2E_SHOTS) {             // optional: accessibility scan + screenshots of the team screens
    console.log('Accessibility scan / screenshots (AXE_PATH, E2E_SHOTS)');
    const fs = require('fs');
    const axeSrc = process.env.AXE_PATH ? fs.readFileSync(process.env.AXE_PATH, 'utf8') : null;
    const scan = async (pg, name) => {
      if (process.env.E2E_SHOTS) await pg.screenshot({ path: `${process.env.E2E_SHOTS}/${name}.png` });
      if (axeSrc) {
        await pg.evaluate(axeSrc);
        const v = await pg.evaluate(async () => (await axe.run(document, { runOnly: ['wcag2a', 'wcag2aa'], preload: false })).violations.map((x) => `${x.id} x${x.nodes.length}: ${x.nodes[0].target.join(' ')}`));
        check(`accessibility clean: ${name}`, v.length === 0, v.join(' | '));
      }
    };
    p = await open('mla_test'); await scan(p, 'leader-home');
    await p.locator('#btn-board').click(); await p.waitForTimeout(900); await scan(p, 'leader-board'); await p.keyboard.press('Escape'); await p.waitForTimeout(300);
    await p.getByRole('button', { name: /Briefing/ }).click(); await p.waitForTimeout(1000); await scan(p, 'leader-briefing'); await p.close();
    p = await open('staff_test'); await scan(p, 'staff-home');
    await p.locator('#btn-board').click(); await p.waitForTimeout(900); await scan(p, 'staff-board'); await p.keyboard.press('Escape'); await p.waitForTimeout(300);
    await p.getByRole('button', { name: /Briefing/ }).click(); await p.waitForTimeout(1000); await scan(p, 'staff-briefing-editor'); await p.close();
    p = await open('mla_test', 375, 800); await scan(p, 'leader-home-phone'); await p.close();
  }

  check('no page errors in any flow', pageErrors.length === 0, JSON.stringify(pageErrors.slice(0, 3)));
  check('no Content-Security-Policy violations on any screen', cspViolations.length === 0, JSON.stringify(cspViolations.slice(0, 3)));
  const head = await fetch(B + '/api/health');
  check('security headers are sent', !!head.headers.get('content-security-policy') && head.headers.get('x-frame-options') === 'DENY');
  await b.close();
  console.log(`\n${passed} passed, ${fails.length} failed`);
  process.exit(fails.length ? 1 : 0);
})().catch((e) => { console.error('crashed:', e.message); process.exit(1); });
