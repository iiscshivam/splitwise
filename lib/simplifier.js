/**
 * Debt Simplification Module using Min-Cash-Flow Algorithm
 * Minimizes total number of transactions required to settle all debts in a group.
 */

/**
 * Rounds a number safely to 2 decimal places avoiding floating-point precision traps.
 * @param {number} num
 * @returns {number}
 */
function roundToCents(num) {
  return Math.round((num + Number.EPSILON) * 100) / 100;
}

/**
 * Calculates net balance for each user based on expenses and settlements.
 * Net Balance = (Total Paid by User) - (Total User Owed) + (Settlements Received) - (Settlements Paid)
 * @param {Array} users - List of user objects { id, name }
 * @param {Array} expenses - List of expense objects { paidById, amount, splits: [{ userId, amount }] }
 * @param {Array} settlements - List of settlement objects { payerId, recipientId, amount }
 * @returns {Object} Map of userId -> net balance
 */
function calculateNetBalances(users = [], expenses = [], settlements = []) {
  const balances = {};
  
  // Initialize each existing user with 0 balance
  if (Array.isArray(users)) {
    users.forEach(u => {
      if (u && u.id !== undefined) {
        balances[String(u.id)] = 0;
      }
    });
  }

  // Process Expenses
  if (Array.isArray(expenses)) {
    expenses.forEach(expense => {
      if (!expense) return;
      const paidBy = String(expense.paidById);
      const totalAmount = parseFloat(expense.amount);

      if (isNaN(totalAmount) || totalAmount <= 0) return;

      // Payer gets credit for total amount paid
      if (balances[paidBy] === undefined) {
        balances[paidBy] = 0;
      }
      balances[paidBy] += totalAmount;

      // Debtors get debited for their respective shares
      if (Array.isArray(expense.splits)) {
        expense.splits.forEach(split => {
          if (!split) return;
          const splitUserId = String(split.userId);
          const splitAmount = parseFloat(split.amount);

          if (!isNaN(splitAmount) && splitAmount > 0) {
            if (balances[splitUserId] === undefined) {
              balances[splitUserId] = 0;
            }
            balances[splitUserId] -= splitAmount;
          }
        });
      }
    });
  }

  // Process Settlements (Payer pays Recipient)
  if (Array.isArray(settlements)) {
    settlements.forEach(settlement => {
      if (!settlement) return;
      const payerId = String(settlement.payerId);
      const recipientId = String(settlement.recipientId);
      const amount = parseFloat(settlement.amount);

      if (isNaN(amount) || amount <= 0 || payerId === recipientId) return;

      if (balances[payerId] === undefined) balances[payerId] = 0;
      if (balances[recipientId] === undefined) balances[recipientId] = 0;

      balances[payerId] += amount;       // Payer paid their debt (balance increases toward 0)
      balances[recipientId] -= amount;   // Recipient received their money (balance decreases toward 0)
    });
  }

  // Round all balances to 2 decimal places
  Object.keys(balances).forEach(id => {
    balances[id] = roundToCents(balances[id]);
    // Eliminate -0
    if (Object.is(balances[id], -0) || Math.abs(balances[id]) < 0.001) {
      balances[id] = 0;
    }
  });

  return balances;
}

/**
 * Greedily resolves debts to minimize number of transactions (Min-Cash-Flow)
 * @param {Object} balances - Map of userId -> net balance
 * @param {Array} users - List of user objects to map IDs to names
 * @returns {Array} List of simplified transactions { fromId, fromName, toId, toName, amount }
 */
function simplifyDebts(balances = {}, users = []) {
  const userMap = {};
  if (Array.isArray(users)) {
    users.forEach(u => {
      if (u && u.id !== undefined) {
        userMap[String(u.id)] = u.name || String(u.id);
      }
    });
  }

  const debtors = [];  // { id, amount (positive number) }
  const creditors = []; // { id, amount (positive number) }

  Object.entries(balances).forEach(([userId, netAmount]) => {
    const rounded = roundToCents(netAmount);
    if (rounded < -0.005) {
      debtors.push({ id: userId, amount: Math.abs(rounded) });
    } else if (rounded > 0.005) {
      creditors.push({ id: userId, amount: rounded });
    }
  });

  // Sort debtors & creditors descending by amount to settle largest debts first
  debtors.sort((a, b) => b.amount - a.amount);
  creditors.sort((a, b) => b.amount - a.amount);

  const simplifiedTransactions = [];
  let i = 0, j = 0;

  while (i < debtors.length && j < creditors.length) {
    const debtor = debtors[i];
    const creditor = creditors[j];

    const settleAmount = roundToCents(Math.min(debtor.amount, creditor.amount));

    if (settleAmount > 0) {
      simplifiedTransactions.push({
        fromId: debtor.id,
        fromName: userMap[debtor.id] || debtor.id,
        toId: creditor.id,
        toName: userMap[creditor.id] || creditor.id,
        amount: settleAmount
      });
    }

    debtor.amount = roundToCents(debtor.amount - settleAmount);
    creditor.amount = roundToCents(creditor.amount - settleAmount);

    if (debtor.amount <= 0.005) i++;
    if (creditor.amount <= 0.005) j++;
  }

  return simplifiedTransactions;
}

module.exports = {
  roundToCents,
  calculateNetBalances,
  simplifyDebts
};
