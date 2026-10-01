const { test, describe, before, after } = require('node:test');
const assert = require('node:assert/strict');
const http = require('http');
const { app } = require('../server');

describe('Splitwise API Integration Tests', () => {
  let server;
  let baseUrl;

  before((done) => {
    // Start temporary test server on ephemeral port
    server = http.createServer(app);
    server.listen(0, () => {
      const port = server.address().port;
      baseUrl = `http://localhost:${port}`;
      done();
    });
  });

  after((done) => {
    server.close(done);
  });

  async function request(path, options = {}) {
    const res = await fetch(`${baseUrl}${path}`, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        ...(options.headers || {})
      }
    });
    const data = await res.json().catch(() => null);
    return { status: res.status, data };
  }

  test('GET /api/health returns ok status and uptime', async () => {
    const res = await request('/api/health');
    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.data.status, 'ok');
    assert.ok(typeof res.data.uptime === 'number');
  });

  test('GET /api/users returns list of users', async () => {
    const res = await request('/api/users');
    assert.strictEqual(res.status, 200);
    assert.ok(Array.isArray(res.data));
    assert.ok(res.data.length >= 2);
  });

  test('POST /api/users adds a new user with validation', async () => {
    // Valid user
    const res = await request('/api/users', {
      method: 'POST',
      body: JSON.stringify({ name: 'Zack' })
    });
    assert.strictEqual(res.status, 201);
    assert.strictEqual(res.data.name, 'Zack');
    assert.ok(res.data.id);

    // Empty name should fail (400)
    const errRes = await request('/api/users', {
      method: 'POST',
      body: JSON.stringify({ name: ' ' })
    });
    assert.strictEqual(errRes.status, 400);

    // Duplicate name should fail (409)
    const dupRes = await request('/api/users', {
      method: 'POST',
      body: JSON.stringify({ name: 'Zack' })
    });
    assert.strictEqual(dupRes.status, 409);
  });

  test('POST /api/expenses adds an expense and validates input', async () => {
    const validExpense = {
      description: 'Test Lunch',
      category: 'Food',
      amount: 40,
      paidById: '1',
      splits: [
        { userId: '1', amount: 20 },
        { userId: '2', amount: 20 }
      ]
    };

    const res = await request('/api/expenses', {
      method: 'POST',
      body: JSON.stringify(validExpense)
    });
    assert.strictEqual(res.status, 201);
    assert.strictEqual(res.data.description, 'Test Lunch');
    assert.strictEqual(res.data.amount, 40);

    // Invalid split sum should fail (400)
    const invalidSplitRes = await request('/api/expenses', {
      method: 'POST',
      body: JSON.stringify({
        description: 'Bad splits',
        amount: 50,
        paidById: '1',
        splits: [{ userId: '1', amount: 20 }]
      })
    });
    assert.strictEqual(invalidSplitRes.status, 400);

    // Missing description should fail (400)
    const noDescRes = await request('/api/expenses', {
      method: 'POST',
      body: JSON.stringify({
        description: '',
        amount: 50,
        paidById: '1',
        splits: [{ userId: '1', amount: 50 }]
      })
    });
    assert.strictEqual(noDescRes.status, 400);
  });

  test('POST /api/settlements records settlement correctly and forbids self-payment', async () => {
    // Valid settlement
    const res = await request('/api/settlements', {
      method: 'POST',
      body: JSON.stringify({
        payerId: '2',
        recipientId: '1',
        amount: 20
      })
    });
    assert.strictEqual(res.status, 201);
    assert.strictEqual(res.data.amount, 20);

    // Self settlement should fail
    const selfRes = await request('/api/settlements', {
      method: 'POST',
      body: JSON.stringify({
        payerId: '1',
        recipientId: '1',
        amount: 10
      })
    });
    assert.strictEqual(selfRes.status, 400);
  });

  test('GET /api/summary returns complete netBalances and simplifiedDebts', async () => {
    const res = await request('/api/summary');
    assert.strictEqual(res.status, 200);
    assert.ok(res.data.netBalances);
    assert.ok(Array.isArray(res.data.simplifiedDebts));
    assert.ok(typeof res.data.totalExpensesAmount === 'number');
  });

  test('DELETE /api/expenses/:id deletes expense', async () => {
    // Add temporary expense to delete
    const addRes = await request('/api/expenses', {
      method: 'POST',
      body: JSON.stringify({
        description: 'To Delete',
        amount: 10,
        paidById: '1',
        splits: [{ userId: '1', amount: 10 }]
      })
    });
    const expId = addRes.data.id;

    const delRes = await request(`/api/expenses/${expId}`, { method: 'DELETE' });
    assert.strictEqual(delRes.status, 200);

    // Deleting again should 404
    const notFoundRes = await request(`/api/expenses/${expId}`, { method: 'DELETE' });
    assert.strictEqual(notFoundRes.status, 404);
  });

});
