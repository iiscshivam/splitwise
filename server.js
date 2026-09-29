const express = require('express');
const cors = require('cors');
const path = require('path');
const { calculateNetBalances, simplifyDebts } = require('./lib/simplifier');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// In-memory data store
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
    amount: 120,
    paidById: '1', // Alice paid $120
    splits: [
      { userId: '1', amount: 30 },
      { userId: '2', amount: 30 },
      { userId: '3', amount: 30 },
      { userId: '4', amount: 30 }
    ],
    date: new Date().toISOString()
  },
  {
    id: 'e2',
    description: 'Groceries',
    amount: 60,
    paidById: '2', // Bob paid $60
    splits: [
      { userId: '1', amount: 20 },
      { userId: '2', amount: 20 },
      { userId: '3', amount: 20 }
    ],
    date: new Date().toISOString()
  }
];

let settlements = [];

// API Endpoints

// Get all users
app.get('/api/users', (req, res) => {
  res.json(users);
});

// Add user
app.post('/api/users', (req, res) => {
  const { name } = req.body;
  if (!name) return res.status(400).json({ error: 'Name is required' });
  const newUser = { id: Date.now().toString(), name: name.trim() };
  users.push(newUser);
  res.status(201).json(newUser);
});

// Get all expenses
app.get('/api/expenses', (req, res) => {
  res.json(expenses);
});

// Add expense
app.post('/api/expenses', (req, res) => {
  const { description, amount, paidById, splits } = req.body;
  if (!description || !amount || !paidById || !splits) {
    return res.status(400).json({ error: 'Missing required expense fields' });
  }

  const newExpense = {
    id: 'e_' + Date.now(),
    description,
    amount: parseFloat(amount),
    paidById,
    splits,
    date: new Date().toISOString()
  };

  expenses.push(newExpense);
  res.status(201).json(newExpense);
});

// Get settlements
app.get('/api/settlements', (req, res) => {
  res.json(settlements);
});

// Record settlement
app.post('/api/settlements', (req, res) => {
  const { payerId, recipientId, amount } = req.body;
  if (!payerId || !recipientId || !amount) {
    return res.status(400).json({ error: 'Missing settlement fields' });
  }

  const newSettlement = {
    id: 's_' + Date.now(),
    payerId,
    recipientId,
    amount: parseFloat(amount),
    date: new Date().toISOString()
  };

  settlements.push(newSettlement);
  res.status(201).json(newSettlement);
});

// Reset demo data
app.post('/api/reset', (req, res) => {
  expenses = [];
  settlements = [];
  res.json({ message: 'Expenses and settlements reset successfully' });
});

// Get summary & simplified debts
app.get('/api/summary', (req, res) => {
  const netBalances = calculateNetBalances(users, expenses, settlements);
  const simplified = simplifyDebts(netBalances, users);

  res.json({
    users,
    netBalances,
    simplifiedDebts: simplified,
    totalExpensesCount: expenses.length,
    totalExpensesAmount: expenses.reduce((sum, e) => sum + e.amount, 0)
  });
});

app.listen(PORT, () => {
  console.log(`Splitwise App server running at http://localhost:${PORT}`);
});
