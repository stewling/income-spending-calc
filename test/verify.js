'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const http = require('node:http');
const os = require('node:os');
const path = require('node:path');
const { createBudgetServer } = require('../server');
const { getCurrentMonth, shiftMonth } = require('../seed-data');

function httpGetWithHost(port, reqPath, hostHeader) {
  return new Promise((resolve, reject) => {
    const req = http.request(
      {
        hostname: '127.0.0.1',
        port,
        path: reqPath,
        method: 'GET',
        headers: { Host: hostHeader }
      },
      (res) => {
        const chunks = [];
        res.on('data', (c) => chunks.push(c));
        res.on('end', () => {
          resolve({
            status: res.statusCode,
            body: JSON.parse(Buffer.concat(chunks).toString('utf8'))
          });
        });
      }
    );
    req.on('error', reject);
    req.end();
  });
}

async function runTests() {
  const tempDataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'hb-verify-'));
  console.log(`Using temporary data dir: ${tempDataDir}`);

  let instance = createBudgetServer({ port: 0, dataDir: tempDataDir });
  await new Promise((resolve) => instance.server.listen(0, '127.0.0.1', resolve));
  let port = instance.server.address().port;
  let baseUrl = `http://127.0.0.1:${port}`;

  try {
    // 1. Static files served with 200
    for (const asset of ['/', '/index.html', '/styles.css', '/app.js', '/manifest.json', '/sw.js', '/icon.svg']) {
      const res = await fetch(`${baseUrl}${asset}`);
      assert.equal(res.status, 200, `Expected 200 for ${asset}`);
    }
    console.log('PASS: Static assets and PWA files served with HTTP 200');

    // 2. SQLite + JSON files created automatically
    assert.ok(fs.existsSync(path.join(tempDataDir, 'household-budget.sqlite')), 'SQLite DB should exist');
    assert.ok(fs.existsSync(path.join(tempDataDir, 'household-budget.json')), 'JSON backup should exist');
    console.log('PASS: Local SQLite database and JSON backup created');

    // 3. GET /api/state returns seeded data across past, current, and future months
    const stateRes = await fetch(`${baseUrl}/api/state`);
    assert.equal(stateRes.status, 200);
    const stateJson = await stateRes.json();
    assert.equal(stateJson.revision, 1);
    assert.ok(Array.isArray(stateJson.state.entries) && stateJson.state.entries.length > 10);
    assert.ok(Array.isArray(stateJson.state.savingsAccounts) && stateJson.state.savingsAccounts.length >= 4);
    assert.ok(Array.isArray(stateJson.state.savingsTransactions) && stateJson.state.savingsTransactions.length >= 6);
    assert.ok(stateJson.network && typeof stateJson.network.port === 'number');

    const nowMonth = getCurrentMonth();
    const pastMonth = shiftMonth(nowMonth, -1);
    const futureMonth = shiftMonth(nowMonth, 2);

    const hasPastOneOff = stateJson.state.entries.some((e) => e.frequency === 'one-off' && e.month < nowMonth);
    const hasFutureOneOff = stateJson.state.entries.some((e) => e.frequency === 'one-off' && e.month > nowMonth);
    const hasWeeklyDd = stateJson.state.entries.some((e) => e.frequency === 'weekly' && e.kind === 'outgoing');
    const hasMonthlyDd = stateJson.state.entries.some((e) => e.frequency === 'monthly' && e.kind === 'outgoing');
    assert.ok(hasPastOneOff && hasFutureOneOff && hasWeeklyDd && hasMonthlyDd, 'Seed data must cover past/future one-offs, weekly DD, and monthly DD');
    console.log('PASS: Initial seeded state includes past, current, and future entries + DDs + savings');

    // 4. PUT /api/state persists custom income, one-off, weekly DD, monthly DD, and savings deposit/withdrawal
    const modifiedState = structuredClone(stateJson.state);
    modifiedState.entries.push(
      {
        id: 'test_inc_1',
        kind: 'income',
        title: 'Test Side Gig',
        category: 'Freelance',
        frequency: 'one-off',
        amount: 250,
        month: nowMonth,
        date: `${nowMonth}-18`,
        essential: false,
        notes: 'Test income'
      },
      {
        id: 'test_out_weekly',
        kind: 'outgoing',
        title: 'Test Weekly Box',
        category: 'Groceries',
        frequency: 'weekly',
        amount: 35,
        dayOfWeek: 4,
        startMonth: pastMonth,
        endMonth: null,
        essential: true,
        notes: 'Every Thursday'
      },
      {
        id: 'test_out_future',
        kind: 'outgoing',
        title: 'Future Annual Flight',
        category: 'Leisure & Travel',
        frequency: 'one-off',
        amount: 600,
        month: futureMonth,
        date: `${futureMonth}-11`,
        essential: false,
        notes: 'Searchable future payment'
      }
    );
    modifiedState.savingsTransactions.push(
      {
        id: 'test_stx_dep',
        accountId: modifiedState.savingsAccounts[0].id,
        type: 'deposit',
        amount: 425,
        date: `${nowMonth}-18`,
        month: nowMonth,
        category: 'Monthly Allocation',
        note: 'Test savings deposit'
      },
      {
        id: 'test_stx_with',
        accountId: modifiedState.savingsAccounts[0].id,
        type: 'withdrawal',
        amount: 75,
        date: `${nowMonth}-18`,
        month: nowMonth,
        category: 'Withdrawal',
        note: 'Test savings withdrawal'
      }
    );

    const putRes = await fetch(`${baseUrl}/api/state`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ state: modifiedState, clientId: 'test_runner' })
    });
    assert.equal(putRes.status, 200);
    const putJson = await putRes.json();
    assert.equal(putJson.ok, true);
    assert.equal(putJson.revision, 2);
    console.log('PASS: PUT /api/state saved updates and incremented revision to 2');

    // 5. Verify persistence across server restart
    await new Promise((resolve) => instance.server.close(resolve));
    instance = createBudgetServer({ port: 0, dataDir: tempDataDir });
    await new Promise((resolve) => instance.server.listen(0, '127.0.0.1', resolve));
    port = instance.server.address().port;
    baseUrl = `http://127.0.0.1:${port}`;

    const reloadedRes = await fetch(`${baseUrl}/api/state`);
    const reloadedJson = await reloadedRes.json();
    assert.equal(reloadedJson.revision, 2);
    assert.ok(reloadedJson.state.entries.some((e) => e.id === 'test_inc_1'));
    assert.ok(reloadedJson.state.entries.some((e) => e.id === 'test_out_weekly'));
    assert.ok(reloadedJson.state.entries.some((e) => e.id === 'test_out_future'));
    assert.ok(reloadedJson.state.savingsTransactions.some((t) => t.id === 'test_stx_dep'));
    assert.ok(reloadedJson.state.savingsTransactions.some((t) => t.id === 'test_stx_with'));

    const backupFile = JSON.parse(fs.readFileSync(path.join(tempDataDir, 'household-budget.json'), 'utf8'));
    assert.ok(backupFile.entries.some((e) => e.id === 'test_out_future'));
    console.log('PASS: Data persisted cleanly across server restart in both SQLite and JSON backup');

    // 6. Export endpoint
    const expRes = await fetch(`${baseUrl}/api/export`);
    assert.equal(expRes.status, 200);
    const expText = await expRes.text();
    const expObj = JSON.parse(expText);
    assert.ok(expObj.entries.some((e) => e.id === 'test_inc_1'));
    console.log('PASS: GET /api/export returns full valid JSON backup');

    // 7. Reset endpoint (empty + sample)
    const resetEmptyRes = await fetch(`${baseUrl}/api/reset`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ mode: 'empty' })
    });
    const resetEmptyJson = await resetEmptyRes.json();
    assert.equal(resetEmptyJson.state.entries.length, 0);
    assert.equal(resetEmptyJson.state.savingsAccounts.length, 0);

    const resetSampleRes = await fetch(`${baseUrl}/api/reset`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ mode: 'sample', anchorMonth: nowMonth })
    });
    const resetSampleJson = await resetSampleRes.json();
    assert.ok(resetSampleJson.state.entries.length > 10);
    console.log('PASS: POST /api/reset works for both empty and sample modes');

    // 8. Docker configuration files & remote port 5025 + DATA_DIR verification
    const rootDir = path.resolve(__dirname, '..');
    const dockerfileText = fs.readFileSync(path.join(rootDir, 'Dockerfile'), 'utf8');
    const composeText = fs.readFileSync(path.join(rootDir, 'docker-compose.yml'), 'utf8');
    const dockerignoreText = fs.readFileSync(path.join(rootDir, '.dockerignore'), 'utf8');

    assert.ok(dockerfileText.includes('PORT=5025') && dockerfileText.includes('EXPOSE 5025'), 'Dockerfile must expose port 5025');
    assert.ok(dockerfileText.includes('DATA_DIR=/app/data') && dockerfileText.includes('VOLUME ["/app/data"]'), 'Dockerfile must persist /app/data');
    assert.ok(composeText.includes('5025:5025') && composeText.includes('./data:/app/data'), 'docker-compose.yml must map 5025:5025 and ./data:/app/data');
    assert.ok(dockerignoreText.includes('data/*.sqlite'), '.dockerignore must exclude local sqlite files');
    console.log('PASS: Dockerfile, docker-compose.yml, and .dockerignore configured for port 5025 & persistent /app/data');

    const tempDataDir5025 = fs.mkdtempSync(path.join(os.tmpdir(), 'hb-verify-5025-'));
    const prevDataDirEnv = process.env.DATA_DIR;
    process.env.DATA_DIR = tempDataDir5025;
    let instance5025;
    try {
      instance5025 = createBudgetServer({ port: 5025 });
      await new Promise((resolve) => instance5025.server.listen(5025, '0.0.0.0', resolve));

      const health5025 = await httpGetWithHost(5025, '/api/health', 'myserver.local:5025');
      assert.equal(health5025.status, 200);
      assert.equal(health5025.body.status, 'ok');
      assert.equal(health5025.body.network.port, 5025);
      assert.ok(
        health5025.body.network.lanUrls.some((item) => item.url === 'http://myserver.local:5025' && item.interface === 'remote-host'),
        'Remote Host header URL on port 5025 should be included in network.lanUrls'
      );

      const net5025 = await httpGetWithHost(5025, '/api/network-info', '192.168.1.50:5025');
      assert.equal(net5025.status, 200);
      assert.equal(net5025.body.port, 5025);
      assert.ok(
        net5025.body.lanUrls.some((item) => item.url === 'http://192.168.1.50:5025'),
        'Remote IP Host header URL on port 5025 should be included in network.lanUrls'
      );
      assert.ok(fs.existsSync(path.join(tempDataDir5025, 'household-budget.sqlite')), 'DATA_DIR env var should control SQLite directory');
      console.log('PASS: Server binds cleanly on port 5025, honors DATA_DIR, and reports remote Host URLs');
    } finally {
      if (prevDataDirEnv === undefined) delete process.env.DATA_DIR;
      else process.env.DATA_DIR = prevDataDirEnv;
      if (instance5025) await instance5025.shutdown();
      fs.rmSync(tempDataDir5025, { recursive: true, force: true });
    }

    console.log('\nALL BACKEND & PERSISTENCE CHECKS PASSED.');
  } finally {
    await instance.shutdown();
    fs.rmSync(tempDataDir, { recursive: true, force: true });
  }
}

runTests().catch((err) => {
  console.error('Verification failed:', err);
  process.exit(1);
});
