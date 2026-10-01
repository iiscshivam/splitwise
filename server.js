const express = require('express');
const cors = require('cors');
const path = require('path');
const { calculateNetBalances, simplifyDebts, roundToCents } = require('./lib/simplifier');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// In-memory data store with initial seed
let users = [
  { id: '1', name: 'Alice' },
  { id: '2', name: 'Bob' },
  { id: '3', name: 'Charlie' },
  { id: '4', name: 'Diana' }
];

let expenses = [
  {
    id: 'e1',
    description: 'Dinner at Italian Bistro',
    category: 'Food',
    amount: 120.00,
    paidById: '1',
    splits: [
      { userId: '1', amount: 30.00 },
      { userId: '2', amount: 30.00 },
      { userId: '3', amount: 30.00 },
      { userId: '4', amount: 30.00 }
    ],
    date: new Date().toISOString()
  },
  {
    id: 'e2',
    description: 'Groceries & Snacks',
    category: 'Groceries',
    amount: 60.00,
    paidById: '2',
    splits: [
      { userId: '1', amount: 20.00 },
      { userId: '2', amount: 20.00 },
      { userId: '3', amount: 20.00 }
    ],
    date: new Date().toISOString()
  }
];

let settlements = [];

// ==================== API Endpoints ====================

// Health Check
app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    uptime: process.uptime(),
    timestamp: new Date().toISOString(),
    version: '1.0.0'
  });
});

// Users
app.get('/api/users', (req, res) => {
  res.json(users);
});

app.post('/api/users', (req, res) => {
  const { name } = req.body;
  if (!name || typeof name !== 'string' || !name.trim()) {
    return res.status(400).json({ error: 'Valid user name is required' });
  }

  const trimmedName = name.trim();
  const exists = users.some(u => u.name.toLowerCase() === trimmedName.toLowerCase());
  if (exists) {
    return res.status(409).json({ error: `User with name "${trimmedName}" already exists` });
  }

  const newUser = { id: Date.now().toString(), name: trimmedName };
  users.push(newUser);
  res.status(201).json(newUser);
});

app.delete('/api/users/:id', (req, res) => {
  const userId = req.params.id;
  const userIndex = users.findIndex(u => u.id === userId);
  if (userIndex === -1) {
    return res.status(404).json({ error: 'User not found' });
  }

  // Remove user and clean up their splits from expenses
  users.splice(userIndex, 1);
  expenses = expenses.filter(e => e.paidById !== userId);
  expenses.forEach(e => {
    e.splits = e.splits.filter(s => s.userId !== userId);
  });
  settlements = settlements.filter(s => s.payerId !== userId && s.recipientId !== userId);

  res.json({ message: 'User and associated records removed successfully' });
});

// Expenses
app.get('/api/expenses', (req, res) => {
  res.json(expenses);
});

app.post('/api/expenses', (req, res) => {
  const { description, amount, paidById, splits, category } = req.body;

  if (!description || typeof description !== 'string' || !description.trim()) {
    return res.status(400).json({ error: 'Description is required' });
  }

  const parsedAmount = parseFloat(amount);
  if (isNaN(parsedAmount) || parsedAmount <= 0) {
    return res.status(400).json({ error: 'Amount must be a positive number' });
  }

  if (!paidById || !users.some(u => u.id === String(paidById))) {
    return res.status(400).json({ error: 'Invalid or non-existent payer ID' });
  }

  if (!Array.isArray(splits) || splits.length === 0) {
    return res.status(400).json({ error: 'Splits array must contain at least one participant' });
  }

  // Validate split members and sum
  let splitTotal = 0;
  for (const s of splits) {
    if (!s || !s.userId || isNaN(parseFloat(s.amount)) || parseFloat(s.amount) <= 0) {
      return res.status(400).json({ error: 'Each split must have a valid userId and positive amount' });
    }
    splitTotal += parseFloat(s.amount);
  }

  // Validate that split total matches total amount within 0.05 margin for rounding
  if (Math.abs(splitTotal - parsedAmount) > 0.05) {
    return res.status(400).json({
      error: `Sum of splits ($${splitTotal.toFixed(2)}) does not match expense amount ($${parsedAmount.toFixed(2)})`
    });
  }

  const newExpense = {
    id: 'e_' + Date.now(),
    description: description.trim(),
    category: category || 'General',
    amount: roundToCents(parsedAmount),
    paidById: String(paidById),
    splits: splits.map(s => ({ userId: String(s.userId), amount: roundToCents(parseFloat(s.amount)) })),
    date: new Date().toISOString()
  };

  expenses.push(newExpense);
  res.status(201).json(newExpense);
});

app.delete('/api/expenses/:id', (req, res) => {
  const expenseId = req.params.id;
  const initialLength = expenses.length;
  expenses = expenses.filter(e => e.id !== expenseId);

  if (expenses.length === initialLength) {
    return res.status(404).json({ error: 'Expense not found' });
  }

  res.json({ message: 'Expense deleted successfully' });
});

// Settlements
app.get('/api/settlements', (req, res) => {
  res.json(settlements);
});

app.post('/api/settlements', (req, res) => {
  const { payerId, recipientId, amount } = req.body;

  if (!payerId || !recipientId) {
    return res.status(400).json({ error: 'Both payerId and recipientId are required' });
  }

  if (String(payerId) === String(recipientId)) {
    return res.status(400).json({ error: 'Payer and recipient cannot be the same user' });
  }

  const parsedAmount = parseFloat(amount);
  if (isNaN(parsedAmount) || parsedAmount <= 0) {
    return res.status(400).json({ error: 'Settlement amount must be a positive number' });
  }

  const newSettlement = {
    id: 's_' + Date.now(),
    payerId: String(payerId),
    recipientId: String(recipientId),
    amount: roundToCents(parsedAmount),
    date: new Date().toISOString()
  };

  settlements.push(newSettlement);
  res.status(201).json(newSettlement);
});

// Summary & Debt Simplification
app.get('/api/summary', (req, res) => {
  const netBalances = calculateNetBalances(users, expenses, settlements);
  const simplifiedDebts = simplifyDebts(netBalances, users);
  const totalAmount = roundToCents(expenses.reduce((sum, e) => sum + e.amount, 0));

  res.json({
    users,
    netBalances,
    simplifiedDebts,
    totalExpensesCount: expenses.length,
    totalExpensesAmount: totalAmount,
    settlementsCount: settlements.length
  });
});

// Reset
app.post('/api/reset', (req, res) => {
  expenses = [];
  settlements = [];
  res.json({ message: 'All expenses and settlements reset successfully' });
});

// Export & Import Data
app.get('/api/export', (req, res) => {
  res.json({ users, expenses, settlements, exportDate: new Date().toISOString() });
});

app.post('/api/import', (req, res) => {
  const { users: impUsers, expenses: impExpenses, settlements: impSettlements } = req.body;
  if (!Array.isArray(impUsers) || !Array.isArray(impExpenses)) {
    return res.status(400).json({ error: 'Invalid import format' });
  }
  users = impUsers;
  expenses = impExpenses;
  settlements = Array.isArray(impSettlements) ? impSettlements : [];
  res.json({ message: 'Data imported successfully' });
});

// Start Server if executed directly
let serverInstance = null;
if (require.main === module) {
  serverInstance = app.listen(PORT, () => {
    console.log(`Splitwise production server listening on port ${PORT}`);
  });

  const gracefulShutdown = () => {
    console.log('Shutting down server gracefully...');
    if (serverInstance) {
      serverInstance.close(() => {
        console.log('HTTP server closed.');
        process.exit(0);
      });
    }
  };

  process.on('SIGTERM', gracefulShutdown);
  process.on('SIGINT', gracefulShutdown);
}

module.exports = { app, calculateNetBalances, simplifyDebts };
