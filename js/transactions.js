export async function claimReward(runTransaction, userRef, rewardRef, receiptRef, timestamp = Date.now) {
  try { return await runTransaction(async tx => {
    const [user, reward, receipt] = await Promise.all([tx.get(userRef), tx.get(rewardRef), tx.get(receiptRef)]);
    if (!user.exists() || !reward.exists()) throw new Error('Conta ou recompensa não encontrada.');
    if (receipt.exists() || reward.data().completed) return { repeated: true, spent: user.data().xpGasto || 0 };
    const cost = reward.data().custoXp || 0, spent = user.data().xpGasto || 0, xp = user.data().xp || 0;
    if (!Number.isInteger(cost) || cost < 0 || cost > xp - spent) throw new Error('XP insuficiente para esta recompensa.');
    const redeemedAt = timestamp();
    tx.update(rewardRef, { completed: true, redeemedAt });
    tx.set(userRef, { xpGasto: spent + cost, lastRedemptionId: rewardRef.id }, { merge: true });
    tx.set(receiptRef, { cost, redeemedAt });
    return { repeated: false, spent: spent + cost };
  }); } catch (error) {
    if (!['permission-denied', 'firestore/permission-denied', 'aborted', 'failed-precondition'].includes(error.code)) throw error;
    // Uma disputa pelo recibo pode ser negada pelas regras antes de o SDK
    // repetir a transação. Confirma o resultado remoto sem tentar outro débito.
    const settled = await runTransaction(async tx => {
      const [user, reward, receipt] = await Promise.all([tx.get(userRef), tx.get(rewardRef), tx.get(receiptRef)]);
      return user.exists() && reward.exists() && receipt.exists() && reward.data().completed
        ? { repeated: true, spent: user.data().xpGasto || 0 } : null;
    });
    if (!settled) throw error;
    return settled;
  }
}
