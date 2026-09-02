import assert from "node:assert/strict";
import test from "node:test";

const metrics = ({ target, contributions, purchases = 0, transfersIn = 0, transfersOut = 0, withdrawals = 0, status = "ACTIVE" }) => ({
  achievement: target > 0 ? contributions / target * 100 : 0,
  completion: status === "COMPLETED" ? 100 : 0,
  balance: contributions - purchases - transfersOut + transfersIn - withdrawals,
  status,
});

test("calculates exactly 100% achievement", () => {
  assert.deepEqual(metrics({ target: 15000, contributions: 15000 }), { achievement: 100, completion: 0, balance: 15000, status: "ACTIVE" });
});

test("allows achievement above 100%", () => {
  assert.equal(metrics({ target: 15000, contributions: 18000 }).achievement, 120);
  assert.equal(metrics({ target: 15000, contributions: 20000 }).achievement, 133.33333333333331);
});

test("purchase completes an overfunded goal without reducing achievement", () => {
  assert.deepEqual(metrics({ target: 15000, contributions: 18000, purchases: 12000, status: "COMPLETED" }), { achievement: 120, completion: 100, balance: 6000, status: "COMPLETED" });
});

test("transferring all remaining balance preserves achievement and completion", () => {
  assert.deepEqual(metrics({ target: 15000, contributions: 18000, purchases: 12000, transfersOut: 6000, status: "COMPLETED" }), { achievement: 120, completion: 100, balance: 0, status: "COMPLETED" });
});

test("transferring part of remaining balance preserves achievement", () => {
  assert.deepEqual(metrics({ target: 15000, contributions: 18000, purchases: 12000, transfersOut: 2000, status: "COMPLETED" }), { achievement: 120, completion: 100, balance: 4000, status: "COMPLETED" });
});

test("transfer-in and permitted withdrawals only affect current balance", () => {
  const result = metrics({ target: 15000, contributions: 15000, transfersIn: 3000, withdrawals: 1000, status: "ACTIVE" });
  assert.equal(result.achievement, 100);
  assert.equal(result.balance, 17000);
});