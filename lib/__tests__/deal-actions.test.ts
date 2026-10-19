import { describe, expect, it } from "vitest";
import type { Address } from "viem";
import { availableActions, DealState, dealStatusLabel, type HoldfastDeal } from "../holdfast";

/**
 * The deal page shipped with a four-name state table against a six-state contract. Every case
 * below is one that table got wrong, or that it made unreachable.
 */

const BUYER = "0xe6bD2d5d55b24De1AC90718a2D518Db64d0cB5C6" as Address;
const SELLER = "0x5B2C065d73448483Eb99bb547F7BFbF680aEb148" as Address;
const STRANGER = "0x1111111111111111111111111111111111111111" as Address;

const DEADLINE = 2_000_000_000;
const BEFORE = DEADLINE - 1000;
const AFTER = DEADLINE + 1000;

const deal = (state: number): HoldfastDeal => ({
  buyer: BUYER,
  seller: SELLER,
  deadline: DEADLINE,
  state,
  amount: 100_000_000_000_000_000n,
});

describe("who can do what, by state", () => {
  it("Open: either side may confirm, nobody may release", () => {
    const b = availableActions(deal(DealState.Open), BUYER, BEFORE);
    const s = availableActions(deal(DealState.Open), SELLER, BEFORE);
    expect(b.confirmAsBuyer).toBe(true);
    expect(b.confirmAsSeller).toBe(false);
    expect(s.confirmAsSeller).toBe(true);
    expect(b.release).toBe(false);
    expect(s.release).toBe(false);
  });

  it("SellerConfirmed: the buyer can still confirm — the old page offered Release here", () => {
    const b = availableActions(deal(DealState.SellerConfirmed), BUYER, BEFORE);
    expect(b.confirmAsBuyer).toBe(true);
    expect(b.release).toBe(false);
  });

  it("BuyerConfirmed: the seller can still confirm — the old page showed no button at all", () => {
    const s = availableActions(deal(DealState.BuyerConfirmed), SELLER, BEFORE);
    expect(s.confirmAsSeller).toBe(true);
    expect(s.release).toBe(false);
  });

  it("neither side may confirm twice", () => {
    expect(availableActions(deal(DealState.SellerConfirmed), SELLER, BEFORE).confirmAsSeller).toBe(false);
    expect(availableActions(deal(DealState.BuyerConfirmed), BUYER, BEFORE).confirmAsBuyer).toBe(false);
  });

  it("BothConfirmed: release is open to anyone, including a passer-by", () => {
    for (const who of [BUYER, SELLER, STRANGER, undefined]) {
      expect(availableActions(deal(DealState.BothConfirmed), who, BEFORE).release).toBe(true);
    }
  });

  it("Released and Refunded offer nothing to anyone", () => {
    for (const state of [DealState.Released, DealState.Refunded]) {
      for (const who of [BUYER, SELLER, STRANGER]) {
        expect(availableActions(deal(state), who, AFTER)).toEqual({
          confirmAsSeller: false,
          confirmAsBuyer: false,
          release: false,
          refund: false,
        });
      }
    }
  });
});

describe("the deadline", () => {
  it("lets the buyer reclaim from any state before BothConfirmed", () => {
    for (const state of [DealState.Open, DealState.SellerConfirmed, DealState.BuyerConfirmed]) {
      expect(availableActions(deal(state), BUYER, AFTER).refund).toBe(true);
    }
  });

  it("does not let the buyer reclaim once both have confirmed", () => {
    expect(availableActions(deal(DealState.BothConfirmed), BUYER, AFTER).refund).toBe(false);
  });

  it("gives the seller no reclaim, ever", () => {
    expect(availableActions(deal(DealState.Open), SELLER, AFTER).refund).toBe(false);
  });

  it("does not offer a reclaim before the deadline", () => {
    expect(availableActions(deal(DealState.Open), BUYER, BEFORE).refund).toBe(false);
  });
});

describe("state names", () => {
  it("never calls a confirmation a release", () => {
    expect(dealStatusLabel(DealState.BuyerConfirmed)).toBe("Buyer Confirmed");
    expect(dealStatusLabel(DealState.SellerConfirmed)).toBe("Seller Confirmed");
    expect(dealStatusLabel(DealState.BothConfirmed)).toBe("Both Confirmed");
    expect(dealStatusLabel(DealState.Released)).toBe("Released");
  });

  it("names all six, so a new state cannot silently read as another", () => {
    const names = [0, 1, 2, 3, 4, 5].map(dealStatusLabel);
    expect(new Set(names).size).toBe(6);
    expect(names).not.toContain("Unknown");
  });
});
