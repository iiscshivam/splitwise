const { test, describe } = require('node:test');
const assert = require('node:assert/strict');
const { calculateNetBalances, simplifyDebts, roundToCents } = require('../lib/simplifier');

describe('Debt Simplifier Unit Tests', () => {

  test('roundToCents accurately rounds floating point numbers', () => {
    assert.strictEqual(roundToCents(10.005), 10.01);
    assert.strictEqual(roundToCents(33.3333), 33.33);
    assert.strictEqual(roundToCents(0.1 + 0.2), 0.3);
    assert.strictEqual(roundToCents(0), 0);
  });

  test('calculateNetBalances with empty or invalid inputs returns empty object', () => {
    assert.deepStrictEqual(calculateNetBalances([], [], []), {});
    assert.deepStrictEqual(calculateNetBalances(null, null, null), {});
    assert.deepStrictEqual(calculateNetBalances(undefined, undefined, undefined), {});
  });

  test('calculateNetBalances preserves all users with 0 initial balance', () => {
    const users = [{ id: '1', name: 'Alice' }, { id: '2', name: 'Bob' }];
    const balances = calculateNetBalances(users, [], []);
    assert.deepStrictEqual(balances, { '1': 0, '2': 0 });
  });

  test('calculateNetBalances correctly computes simple 2-person split', () => {
    const users = [{ id: '1', name: 'Alice' }, { id: '2', name: 'Bob' }];
    const expenses = [
      {
        paidById: '1',
        amount: 50,
        splits: [
          { userId: '1', amount: 25 },
          { userId: '2', amount: 25 }
        ]
      }
    ];
    const balances = calculateNetBalances(users, expenses, []);
    assert.strictEqual(balances['1'], 25);  // Alice gets back $25
    assert.strictEqual(balances['2'], -25); // Bob owes $25
  });

  test('calculateNetBalances handles settlements properly', () => {
    const users = [{ id: '1', name: 'Alice' }, { id: '2', name: 'Bob' }];
    const expenses = [
      {
        paidById: '1',
        amount: 50,
        splits: [
          { userId: '1', amount: 25 },
          { userId: '2', amount: 25 }
        ]
      }
    ];
    const settlements = [
      { payerId: '2', recipientId: '1', amount: 25 }
    ];
    const balances = calculateNetBalances(users, expenses, settlements);
    assert.strictEqual(balances['1'], 0);
    assert.strictEqual(balances['2'], 0);
  });

  test('simplifyDebts returns empty list when all balances are 0', () => {
    const users = [{ id: '1', name: 'Alice' }, { id: '2', name: 'Bob' }];
    const balances = { '1': 0, '2': 0 };
    const debts = simplifyDebts(balances, users);
    assert.deepStrictEqual(debts, []);
  });

  test('simplifyDebts simplifies 3-way circular debts into 0 transactions', () => {
    // A paid $30 for B, B paid $30 for C, C paid $30 for A
    const users = [
      { id: '1', name: 'Alice' },
      { id: '2', name: 'Bob' },
      { id: '3', name: 'Charlie' }
    ];
    const expenses = [
      { paidById: '1', amount: 30, splits: [{ userId: '2', amount: 30 }] },
      { paidById: '2', amount: 30, splits: [{ userId: '3', amount: 30 }] },
      { paidById: '3', amount: 30, splits: [{ userId: '1', amount: 30 }] }
    ];
    const balances = calculateNetBalances(users, expenses, []);
    assert.strictEqual(balances['1'], 0);
    assert.strictEqual(balances['2'], 0);
    assert.strictEqual(balances['3'], 0);

    const simplified = simplifyDebts(balances, users);
    assert.deepStrictEqual(simplified, []);
  });

  test('simplifyDebts correctly minimizes transactions for complex 5-person group', () => {
    const users = [
      { id: '1', name: 'Alice' },
      { id: '2', name: 'Bob' },
      { id: '3', name: 'Charlie' },
      { id: '4', name: 'Diana' },
      { id: '5', name: 'Evan' }
    ];

    // Net balances:
    // Alice: +100
    // Bob: +50
    // Charlie: -40
    // Diana: -60
    // Evan: -50
    // Total sum = 100 + 50 - 40 - 60 - 50 = 0
    const balances = {
      '1': 100,
      '2': 50,
      '3': -40,
      '4': -60,
      '5': -50
    };

    const transactions = simplifyDebts(balances, users);
    
    // Number of transactions should be <= 4 (N - 1)
    assert.ok(transactions.length <= 4);

    // Verify all transactions settle the exact amounts
    const simulatedBalances = { '1': 0, '2': 0, '3': 0, '4': 0, '5': 0 };
    transactions.forEach(t => {
      simulatedBalances[t.fromId] -= t.amount;
      simulatedBalances[t.toId] += t.amount;
    });

    Object.keys(balances).forEach(id => {
      assert.strictEqual(roundToCents(simulatedBalances[id]), balances[id]);
    });
  });

  test('calculateNetBalances preserves zero-sum invariant on uneven fractional splits', () => {
    const users = [
      { id: '1', name: 'Alice' },
      { id: '2', name: 'Bob' },
      { id: '3', name: 'Charlie' }
    ];
    // $100 split 3 ways: 33.33, 33.33, 33.34
    const expenses = [
      {
        paidById: '1',
        amount: 100,
        splits: [
          { userId: '1', amount: 33.34 },
          { userId: '2', amount: 33.33 },
          { userId: '3', amount: 33.33 }
        ]
      }
    ];

    const balances = calculateNetBalances(users, expenses, []);
    assert.strictEqual(balances['1'], 66.66);
    assert.strictEqual(balances['2'], -33.33);
    assert.strictEqual(balances['3'], -33.33);

    const sum = Object.values(balances).reduce((acc, v) => acc + v, 0);
    assert.strictEqual(roundToCents(sum), 0);
  });

});
