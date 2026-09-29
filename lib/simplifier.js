/**
 * Debt Simplification Module using Min-Cash-Flow Algorithm
 * Minimizes total number of transactions required to settle all debts in a group or system.
 */

/**
 * Calculates net balance for each user based on expenses and settlements.
 * @param {Array} users - List of user objects { id, name }
 * @param {Array} expenses - List of expense objects
 * @param {Array} settlements - List of settlement objects
 * @returns {Object} Map of userId -> net balance
 */
function calculateNetBalances(users, expenses, settlements) {
  const balances = {};
  users.forEach(u => { balances[u.id] = 0; });

  // Process Expenses
  expenses.forEach(expense => {
    const paidBy = expense.paidById;
    const totalAmount = parseFloat(expense.amount);
    
    // Payer gets credit for total amount
    if (balances[paidBy] !== undefined) {
      balances[paidBy] += totalAmount;
    }

    // Debtors get debited for their share
    if (Array.isArray(expense.splits)) {
      expense.splits.forEach(split => {
        if (balances[split.userId] !== undefined) {
          balances[split.userId] -= parseFloat(split.amount);
        }
      });
    }
  });

  // Process Settlements (Payer pays Recipient)
  settlements.forEach(settlement => {
    const payerId = settlement.payerId;
    const recipientId = settlement.recipientId;
    const amount = parseFloat(settlement.amount);

    if (balances[payerId] !== undefined) {
      balances[payerId] += amount; // Payer balance increases (debt reduced)
    }
    if (balances[recipientId] !== undefined) {
      balances[recipientId] -= amount; // Recipient balance decreases (credit fulfilled)
    }
  });

  // Round balances to 2 decimal places to avoid floating-point issues
  Object.keys(balances).forEach(id => {
    balances[id] = Math.round(balances[id] * 100) / 100;
  });

  return balances;
}

/**
 * Greedily resolves debts to minimize number of transactions (Min-Cash-Flow)
 * @param {Object} balances - Map of userId -> net balance
 * @param {Array} users - List of user objects to map IDs to names
 * @returns {Array} List of simplified transactions { fromId, fromName, toId, toName, amount }
 */
function simplifyDebts(balances, users) {
  const userMap = {};
  users.forEach(u => { userMap[u.id] = u.name; });

  const debtors = [];  // { id, amount (positive number) }
  const creditors = []; // { id, amount (positive number) }

  Object.entries(balances).forEach(([userId, netAmount]) => {
    if (netAmount < -0.01) {
      debtors.push({ id: userId, amount: Math.abs(netAmount) });
    } else if (netAmount > 0.01) {
      creditors.push({ id: userId, amount: netAmount });
    }
  });

  // Sort debtors & creditors descending by amount
  debtors.sort((a, b) => b.amount - a.amount);
  creditors.sort((a, b) => b.amount - a.amount);

  const simplifiedTransactions = [];
  let i = 0, j = 0;

  while (i < debtors.length && j < creditors.length) {
    const debtor = debtors[i];
    const creditor = creditors[j];

    const settleAmount = Math.min(debtor.amount, creditor.amount);
    const roundedAmount = Math.round(settleAmount * 100) / 100;

    if (roundedAmount > 0) {
      simplifiedTransactions.push({
        fromId: debtor.id,
        fromName: userMap[debtor.id] || debtor.id,
        toId: creditor.id,
        toName: userMap[creditor.id] || creditor.id,
        amount: roundedAmount
      });
    }

    debtor.amount -= settleAmount;
    creditor.amount -= settleAmount;

    if (debtor.amount < 0.01) i++;
    if (creditor.amount < 0.01) j++;
  }

  return simplifiedTransactions;
}

module.exports = {
  calculateNetBalances,
  simplifyDebts
};
