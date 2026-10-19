// SPDX-License-Identifier: MIT
pragma solidity 0.8.23;

import {Test} from "forge-std/Test.sol";
import {Holdfast} from "../src/Holdfast.sol";

/// @dev Helper contract that rejects all incoming ETH/BOT transfers.
contract RejectingReceiver {
  receive() external payable {
    revert("REJECTED");
  }
}

contract HoldfastTest is Test {
  Holdfast internal holdfast;

  address internal alice = address(0xA11CE); // Buyer
  address internal bob = address(0xB0B);     // Seller
  address internal charlie = address(0xC0C); // Stranger

  uint64 internal constant NOW = 1_760_000_000;
  uint64 internal constant ONE_WEEK = 7 days;
  uint256 internal constant DEAL_AMOUNT = 1 ether;

  event DealOpened(
    uint256 indexed id,
    address indexed buyer,
    address indexed seller,
    uint64 deadline,
    uint256 amount
  );
  event SellerConfirmed(uint256 indexed id);
  event BuyerConfirmed(uint256 indexed id);
  event DealReleased(uint256 indexed id, address indexed seller, uint256 amount);
  event DealRefunded(uint256 indexed id, address indexed buyer, uint256 amount);

  function setUp() public {
    holdfast = new Holdfast();
    vm.warp(NOW);
    vm.deal(alice, 100 ether);
    vm.deal(bob, 100 ether);
    vm.deal(charlie, 100 ether);
  }

  // --- 1. test_RecordsDeal ----------------------------------------------------------------------

  function test_RecordsDeal() public {
    uint64 deadline = NOW + ONE_WEEK;
    vm.prank(alice);
    uint256 id = holdfast.open{value: DEAL_AMOUNT}(bob, deadline);

    assertEq(id, 1, "id starts at 1");

    Holdfast.Deal memory deal = holdfast.dealOf(id);
    assertEq(deal.buyer, alice, "buyer");
    assertEq(deal.seller, bob, "seller");
    assertEq(deal.deadline, deadline, "deadline");
    assertEq(uint8(deal.state), uint8(Holdfast.State.Open), "state is Open");
    assertEq(deal.amount, DEAL_AMOUNT, "amount");
  }

  // --- 2. test_EmitsDealOpened ------------------------------------------------------------------

  function test_EmitsDealOpened() public {
    uint64 deadline = NOW + ONE_WEEK;
    vm.expectEmit(true, true, true, true, address(holdfast));
    emit DealOpened(1, alice, bob, deadline, DEAL_AMOUNT);

    vm.prank(alice);
    holdfast.open{value: DEAL_AMOUNT}(bob, deadline);
  }

  // --- 3. test_HappyPath ------------------------------------------------------------------------

  function test_HappyPath() public {
    uint64 deadline = NOW + ONE_WEEK;
    vm.prank(alice);
    uint256 id = holdfast.open{value: DEAL_AMOUNT}(bob, deadline);

    uint256 bobBalBefore = bob.balance;

    // Seller confirms first
    vm.expectEmit(true, false, false, false, address(holdfast));
    emit SellerConfirmed(id);
    vm.prank(bob);
    holdfast.confirmBySeller(id);
    assertEq(uint8(holdfast.dealOf(id).state), uint8(Holdfast.State.SellerConfirmed));

    // Buyer confirms second
    vm.expectEmit(true, false, false, false, address(holdfast));
    emit BuyerConfirmed(id);
    vm.prank(alice);
    holdfast.confirmByBuyer(id);
    assertEq(uint8(holdfast.dealOf(id).state), uint8(Holdfast.State.BothConfirmed));

    // Release (anyone can call)
    vm.expectEmit(true, true, false, true, address(holdfast));
    emit DealReleased(id, bob, DEAL_AMOUNT);
    holdfast.release(id);

    assertEq(uint8(holdfast.dealOf(id).state), uint8(Holdfast.State.Released));
    assertEq(bob.balance, bobBalBefore + DEAL_AMOUNT, "bob received full amount");
  }

  function test_HappyPath_BuyerConfirmsFirst() public {
    uint64 deadline = NOW + ONE_WEEK;
    vm.prank(alice);
    uint256 id = holdfast.open{value: DEAL_AMOUNT}(bob, deadline);

    uint256 bobBalBefore = bob.balance;

    // Buyer confirms first
    vm.prank(alice);
    holdfast.confirmByBuyer(id);
    assertEq(uint8(holdfast.dealOf(id).state), uint8(Holdfast.State.BuyerConfirmed));

    // Seller confirms second
    vm.prank(bob);
    holdfast.confirmBySeller(id);
    assertEq(uint8(holdfast.dealOf(id).state), uint8(Holdfast.State.BothConfirmed));

    // Release
    holdfast.release(id);
    assertEq(uint8(holdfast.dealOf(id).state), uint8(Holdfast.State.Released));
    assertEq(bob.balance, bobBalBefore + DEAL_AMOUNT);
  }

  // --- 4. test_DeadlinePath ---------------------------------------------------------------------

  function test_DeadlinePath() public {
    uint64 deadline = NOW + ONE_WEEK;
    vm.prank(alice);
    uint256 id = holdfast.open{value: DEAL_AMOUNT}(bob, deadline);

    uint256 aliceBalBefore = alice.balance;

    // Time passes past the deadline
    vm.warp(deadline + 1);

    vm.expectEmit(true, true, false, true, address(holdfast));
    emit DealRefunded(id, alice, DEAL_AMOUNT);

    holdfast.refund(id);

    assertEq(uint8(holdfast.dealOf(id).state), uint8(Holdfast.State.Refunded));
    assertEq(alice.balance, aliceBalBefore + DEAL_AMOUNT, "alice refunded in full");
  }

  // --- 5. test_PartialConfirmPlusDeadline --------------------------------------------------------

  function test_PartialConfirmPlusDeadline() public {
    uint64 deadline = NOW + ONE_WEEK;
    vm.prank(alice);
    uint256 id = holdfast.open{value: DEAL_AMOUNT}(bob, deadline);

    // Seller confirms, but buyer never confirms
    vm.prank(bob);
    holdfast.confirmBySeller(id);
    assertEq(uint8(holdfast.dealOf(id).state), uint8(Holdfast.State.SellerConfirmed));

    uint256 aliceBalBefore = alice.balance;

    // Deadline passes
    vm.warp(deadline + 1);

    // Buyer refunds
    vm.prank(alice);
    holdfast.refund(id);

    assertEq(uint8(holdfast.dealOf(id).state), uint8(Holdfast.State.Refunded));
    assertEq(alice.balance, aliceBalBefore + DEAL_AMOUNT, "alice refunded despite seller confirmation");
  }

  function test_PartialConfirmBuyerPlusDeadline() public {
    uint64 deadline = NOW + ONE_WEEK;
    vm.prank(alice);
    uint256 id = holdfast.open{value: DEAL_AMOUNT}(bob, deadline);

    // Buyer confirms, but seller never confirms
    vm.prank(alice);
    holdfast.confirmByBuyer(id);
    assertEq(uint8(holdfast.dealOf(id).state), uint8(Holdfast.State.BuyerConfirmed));

    uint256 aliceBalBefore = alice.balance;

    // Deadline passes
    vm.warp(deadline + 1);

    // Refund succeeds
    holdfast.refund(id);

    assertEq(uint8(holdfast.dealOf(id).state), uint8(Holdfast.State.Refunded));
    assertEq(alice.balance, aliceBalBefore + DEAL_AMOUNT);
  }

  // --- 6. All guard reverts (each custom error) --------------------------------------------------

  function test_Revert_ZeroValue() public {
    vm.expectRevert(Holdfast.ZeroValue.selector);
    vm.prank(alice);
    holdfast.open{value: 0}(bob, NOW + ONE_WEEK);
  }

  function test_Revert_ZeroAddress() public {
    vm.expectRevert(Holdfast.ZeroAddress.selector);
    vm.prank(alice);
    holdfast.open{value: DEAL_AMOUNT}(address(0), NOW + ONE_WEEK);
  }

  function test_Revert_SellerIsBuyer() public {
    vm.expectRevert(Holdfast.SellerIsBuyer.selector);
    vm.prank(alice);
    holdfast.open{value: DEAL_AMOUNT}(alice, NOW + ONE_WEEK);
  }

  function test_Revert_DeadlineInPast() public {
    vm.expectRevert(Holdfast.DeadlineInPast.selector);
    vm.prank(alice);
    holdfast.open{value: DEAL_AMOUNT}(bob, NOW); // <= block.timestamp reverts

    vm.expectRevert(Holdfast.DeadlineInPast.selector);
    vm.prank(alice);
    holdfast.open{value: DEAL_AMOUNT}(bob, NOW - 1);
  }

  function test_Revert_NotFound() public {
    vm.expectRevert(abi.encodeWithSelector(Holdfast.NotFound.selector, 999));
    holdfast.confirmBySeller(999);

    vm.expectRevert(abi.encodeWithSelector(Holdfast.NotFound.selector, 999));
    holdfast.confirmByBuyer(999);

    vm.expectRevert(abi.encodeWithSelector(Holdfast.NotFound.selector, 999));
    holdfast.release(999);

    vm.expectRevert(abi.encodeWithSelector(Holdfast.NotFound.selector, 999));
    holdfast.refund(999);
  }

  function test_Revert_NotSeller() public {
    vm.prank(alice);
    uint256 id = holdfast.open{value: DEAL_AMOUNT}(bob, NOW + ONE_WEEK);

    // Alice (buyer) tries to confirm as seller
    vm.expectRevert(abi.encodeWithSelector(Holdfast.NotSeller.selector, id));
    vm.prank(alice);
    holdfast.confirmBySeller(id);

    // Charlie (stranger) tries to confirm as seller
    vm.expectRevert(abi.encodeWithSelector(Holdfast.NotSeller.selector, id));
    vm.prank(charlie);
    holdfast.confirmBySeller(id);
  }

  function test_Revert_NotBuyer() public {
    vm.prank(alice);
    uint256 id = holdfast.open{value: DEAL_AMOUNT}(bob, NOW + ONE_WEEK);

    // Bob (seller) tries to confirm as buyer
    vm.expectRevert(abi.encodeWithSelector(Holdfast.NotBuyer.selector, id));
    vm.prank(bob);
    holdfast.confirmByBuyer(id);

    // Charlie (stranger) tries to confirm as buyer
    vm.expectRevert(abi.encodeWithSelector(Holdfast.NotBuyer.selector, id));
    vm.prank(charlie);
    holdfast.confirmByBuyer(id);
  }

  function test_Revert_AlreadyConfirmedBySeller() public {
    vm.prank(alice);
    uint256 id = holdfast.open{value: DEAL_AMOUNT}(bob, NOW + ONE_WEEK);

    vm.prank(bob);
    holdfast.confirmBySeller(id);

    // Confirming again while in SellerConfirmed
    vm.expectRevert(abi.encodeWithSelector(Holdfast.AlreadyConfirmedBySeller.selector, id));
    vm.prank(bob);
    holdfast.confirmBySeller(id);

    // And after buyer confirms too (BothConfirmed)
    vm.prank(alice);
    holdfast.confirmByBuyer(id);

    vm.expectRevert(abi.encodeWithSelector(Holdfast.AlreadyConfirmedBySeller.selector, id));
    vm.prank(bob);
    holdfast.confirmBySeller(id);
  }

  function test_Revert_AlreadyConfirmedByBuyer() public {
    vm.prank(alice);
    uint256 id = holdfast.open{value: DEAL_AMOUNT}(bob, NOW + ONE_WEEK);

    vm.prank(alice);
    holdfast.confirmByBuyer(id);

    // Confirming again while in BuyerConfirmed
    vm.expectRevert(abi.encodeWithSelector(Holdfast.AlreadyConfirmedByBuyer.selector, id));
    vm.prank(alice);
    holdfast.confirmByBuyer(id);

    // And after seller confirms too (BothConfirmed)
    vm.prank(bob);
    holdfast.confirmBySeller(id);

    vm.expectRevert(abi.encodeWithSelector(Holdfast.AlreadyConfirmedByBuyer.selector, id));
    vm.prank(alice);
    holdfast.confirmByBuyer(id);
  }

  function test_Revert_NotBothConfirmed() public {
    vm.prank(alice);
    uint256 id = holdfast.open{value: DEAL_AMOUNT}(bob, NOW + ONE_WEEK);

    // Releasing while Open
    vm.expectRevert(abi.encodeWithSelector(Holdfast.NotBothConfirmed.selector, id));
    holdfast.release(id);

    // Releasing while only SellerConfirmed
    vm.prank(bob);
    holdfast.confirmBySeller(id);
    vm.expectRevert(abi.encodeWithSelector(Holdfast.NotBothConfirmed.selector, id));
    holdfast.release(id);
  }

  function test_Revert_DeadlineNotPassed() public {
    uint64 deadline = NOW + ONE_WEEK;
    vm.prank(alice);
    uint256 id = holdfast.open{value: DEAL_AMOUNT}(bob, deadline);

    // Trying to refund before deadline
    vm.expectRevert(abi.encodeWithSelector(Holdfast.DeadlineNotPassed.selector, id, deadline));
    holdfast.refund(id);

    // Exactly at deadline
    vm.warp(deadline);
    vm.expectRevert(abi.encodeWithSelector(Holdfast.DeadlineNotPassed.selector, id, deadline));
    holdfast.refund(id);
  }

  function test_Revert_AlreadyFinalized() public {
    uint64 deadline = NOW + ONE_WEEK;
    vm.prank(alice);
    uint256 id = holdfast.open{value: DEAL_AMOUNT}(bob, deadline);

    // Case 1: BothConfirmed -> cannot refund
    vm.prank(bob);
    holdfast.confirmBySeller(id);
    vm.prank(alice);
    holdfast.confirmByBuyer(id);

    vm.warp(deadline + 1);
    vm.expectRevert(abi.encodeWithSelector(Holdfast.AlreadyFinalized.selector, id));
    holdfast.refund(id);

    // Case 2: Released -> cannot confirm, release or refund
    holdfast.release(id);

    vm.expectRevert(abi.encodeWithSelector(Holdfast.AlreadyFinalized.selector, id));
    vm.prank(bob);
    holdfast.confirmBySeller(id);

    vm.expectRevert(abi.encodeWithSelector(Holdfast.AlreadyFinalized.selector, id));
    vm.prank(alice);
    holdfast.confirmByBuyer(id);

    vm.expectRevert(abi.encodeWithSelector(Holdfast.AlreadyFinalized.selector, id));
    holdfast.release(id);

    vm.expectRevert(abi.encodeWithSelector(Holdfast.AlreadyFinalized.selector, id));
    holdfast.refund(id);

    // Case 3: Refunded deal
    uint64 deadline2 = uint64(block.timestamp + ONE_WEEK);
    vm.prank(alice);
    uint256 id2 = holdfast.open{value: DEAL_AMOUNT}(bob, deadline2);
    vm.warp(deadline2 + 1);
    holdfast.refund(id2);

    vm.expectRevert(abi.encodeWithSelector(Holdfast.AlreadyFinalized.selector, id2));
    vm.prank(bob);
    holdfast.confirmBySeller(id2);

    vm.expectRevert(abi.encodeWithSelector(Holdfast.AlreadyFinalized.selector, id2));
    vm.prank(alice);
    holdfast.confirmByBuyer(id2);

    vm.expectRevert(abi.encodeWithSelector(Holdfast.AlreadyFinalized.selector, id2));
    holdfast.release(id2);

    vm.expectRevert(abi.encodeWithSelector(Holdfast.AlreadyFinalized.selector, id2));
    holdfast.refund(id2);
  }

  function test_Revert_TransferFailed_Release() public {
    RejectingReceiver rejector = new RejectingReceiver();
    uint64 deadline = NOW + ONE_WEEK;

    vm.prank(alice);
    uint256 id = holdfast.open{value: DEAL_AMOUNT}(address(rejector), deadline);

    vm.prank(address(rejector));
    holdfast.confirmBySeller(id);
    vm.prank(alice);
    holdfast.confirmByBuyer(id);

    vm.expectRevert(
      abi.encodeWithSelector(Holdfast.TransferFailed.selector, id, address(rejector), DEAL_AMOUNT)
    );
    holdfast.release(id);
  }

  function test_Revert_TransferFailed_Refund() public {
    RejectingReceiver rejector = new RejectingReceiver();
    uint64 deadline = NOW + ONE_WEEK;
    vm.deal(address(rejector), 10 ether);

    vm.prank(address(rejector));
    uint256 id = holdfast.open{value: DEAL_AMOUNT}(bob, deadline);

    vm.warp(deadline + 1);

    vm.expectRevert(
      abi.encodeWithSelector(Holdfast.TransferFailed.selector, id, address(rejector), DEAL_AMOUNT)
    );
    holdfast.refund(id);
  }

  // --- 7. test_IllegalTransitions ---------------------------------------------------------------

  function test_IllegalTransitions() public {
    uint64 deadline = NOW + ONE_WEEK;
    vm.prank(alice);
    uint256 id = holdfast.open{value: DEAL_AMOUNT}(bob, deadline);

    // 1. Refund before deadline reverts
    vm.expectRevert(abi.encodeWithSelector(Holdfast.DeadlineNotPassed.selector, id, deadline));
    holdfast.refund(id);

    // 2. Release without both confirmed reverts (when Open)
    vm.expectRevert(abi.encodeWithSelector(Holdfast.NotBothConfirmed.selector, id));
    holdfast.release(id);

    // 3. Release when only BuyerConfirmed reverts
    vm.prank(alice);
    holdfast.confirmByBuyer(id);
    vm.expectRevert(abi.encodeWithSelector(Holdfast.NotBothConfirmed.selector, id));
    holdfast.release(id);
  }

  // --- 8. test_GasCeiling -----------------------------------------------------------------------

  function test_GasCeiling() public {
    vm.deal(alice, 10 ether);
    // Steady state: counter already initialized (>0) and contract address already warm
    vm.prank(alice);
    holdfast.open{value: DEAL_AMOUNT}(bob, NOW + ONE_WEEK);

    vm.prank(alice);
    uint256 beforeGas = gasleft();
    holdfast.open{value: DEAL_AMOUNT}(bob, NOW + ONE_WEEK);
    uint256 used = beforeGas - gasleft();

    emit log_named_uint("open() gas", used);
    assertLt(used, 110_000, "open() gas ceiling exceeded");
  }

  // --- 9. testFuzz_ReleaseMatchesOpened ----------------------------------------------------------

  function testFuzz_ReleaseMatchesOpened(uint128 amount) public {
    vm.assume(amount > 0);
    vm.deal(alice, uint256(amount));

    uint64 deadline = NOW + ONE_WEEK;
    vm.prank(alice);
    uint256 id = holdfast.open{value: amount}(bob, deadline);

    uint256 bobBalBefore = bob.balance;

    vm.prank(bob);
    holdfast.confirmBySeller(id);
    vm.prank(alice);
    holdfast.confirmByBuyer(id);

    holdfast.release(id);

    assertEq(bob.balance - bobBalBefore, uint256(amount), "released to seller == opened amount");
  }

  // --- 10. testFuzz_RefundMatchesOpened ---------------------------------------------------------

  function testFuzz_RefundMatchesOpened(uint128 amount) public {
    vm.assume(amount > 0);
    vm.deal(alice, uint256(amount));

    uint64 deadline = NOW + ONE_WEEK;
    vm.prank(alice);
    uint256 id = holdfast.open{value: amount}(bob, deadline);

    uint256 aliceBalBefore = alice.balance;

    vm.warp(deadline + 1);
    holdfast.refund(id);

    assertEq(alice.balance - aliceBalBefore, uint256(amount), "refunded to buyer == opened amount");
  }
}
