# Splitwise Clone (Expense & Debt Simplifier)

A Node.js application featuring a debt simplification engine powered by a Min-Cash-Flow algorithm.

## Features
- **Expense tracking**: Record group expenses and splits across users.
- **Settlement tracking**: Record payments between group members.
- **Debt Simplification (`lib/simplifier.js`)**: Calculates net balances and computes the minimum number of transactions needed to settle all debts within the group.

## Project Structure
- `lib/simplifier.js`: Core debt minimization algorithm (`calculateNetBalances`, `simplifyDebts`).
- `package.json`: Project metadata and dependencies (`express`, `cors`).

## Quick Start
```bash
npm install
npm start
```
