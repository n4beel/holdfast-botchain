// SPDX-License-Identifier: MIT
pragma solidity 0.8.23;

/// @title Holdfast
/// @notice Two-party escrow for BOT Chain that releases funds when both sides confirm.
///
/// @dev What this contract deliberately CANNOT do:
/// - No owner / admin: nobody controls this contract after deployment. There are no roles,
///   no backdoors, and no special privileges.
/// - No arbitration: disputes are not adjudicated by a third party. Either both parties confirm,
///   or the deadline expires.
/// - No partial release: the full deposit is either released to the seller or refunded to the buyer.
/// - No deadline extension: the deadline set at creation is immutable.
/// - No pause / upgrade: the bytecode is immutable and permanent on BOT Chain.
///
/// Key insight & deadlock prevention:
/// Two parties who must both act creates the risk of stranded funds if one party disappears or refuses
/// to cooperate. The deadline is the mandatory solution: once the deadline passes, any deal that has
/// not been confirmed by both parties can be refunded back to the buyer, regardless of whether the
/// seller has confirmed or disappeared.
///
/// Reentrancy protection:
/// State transitions and effects strictly precede external calls (effects before interactions).
contract Holdfast {
  /// @notice State of an escrow deal.
  enum State {
    Open,
    SellerConfirmed,
    BuyerConfirmed,
    BothConfirmed,
    Released,
    Refunded
  }

  /// @notice Escrow deal record.
  /// @param buyer The address that deposited the funds.
  /// @param seller The recipient address designated by the buyer.
  /// @param deadline Unix timestamp (seconds) after which buyer can claim a refund if not both confirmed.
  /// @param state Current lifecycle state.
  /// @param amount Escrowed native BOT in wei.
  /// @dev Slot 0 packs buyer (20B).
  /// Slot 1 packs seller (20B) + deadline (8B) + state (1B) = 29 bytes.
  /// Slot 2 stores amount (32B).
  struct Deal {
    address buyer;
    address seller;
    uint64 deadline;
    State state;
    uint256 amount;
  }

  /// @dev Monotonically increasing deal counter. First deal has ID 1.
  uint256 private _nextId;

  /// @dev Private storage mapping with explicit getter dealOf(id).
  mapping(uint256 id => Deal) private _deals;

  /// @notice Emitted when a new escrow deal is funded and opened.
  event DealOpened(
    uint256 indexed id,
    address indexed buyer,
    address indexed seller,
    uint64 deadline,
    uint256 amount
  );

  /// @notice Emitted when the seller confirms the deal.
  event SellerConfirmed(uint256 indexed id);

  /// @notice Emitted when the buyer confirms the deal.
  event BuyerConfirmed(uint256 indexed id);

  /// @notice Emitted when funds are released to the seller.
  event DealReleased(uint256 indexed id, address indexed seller, uint256 amount);

  /// @notice Emitted when funds are refunded to the buyer after the deadline.
  event DealRefunded(uint256 indexed id, address indexed buyer, uint256 amount);

  error ZeroValue();
  error ZeroAddress();
  error DeadlineInPast();
  error SellerIsBuyer();
  error NotFound(uint256 id);
  error NotSeller(uint256 id);
  error NotBuyer(uint256 id);
  error AlreadyConfirmedBySeller(uint256 id);
  error AlreadyConfirmedByBuyer(uint256 id);
  error NotBothConfirmed(uint256 id);
  error DeadlineNotPassed(uint256 id, uint64 deadline);
  error AlreadyFinalized(uint256 id);
  error TransferFailed(uint256 id, address to, uint256 amount);

  /// @notice Open a new escrow deal by depositing BOT.
  /// @param seller Designated seller who receives funds upon two-sided confirmation.
  /// @param deadline Unix timestamp (seconds) until which both parties have time to confirm.
  /// @return id Sequential identifier for the created deal.
  function open(address seller, uint64 deadline) external payable returns (uint256 id) {
    if (msg.value == 0) revert ZeroValue();
    if (seller == address(0)) revert ZeroAddress();
    if (seller == msg.sender) revert SellerIsBuyer();
    if (deadline <= block.timestamp) revert DeadlineInPast();

    id = ++_nextId;
    _deals[id] = Deal({
      buyer: msg.sender,
      seller: seller,
      deadline: deadline,
      state: State.Open,
      amount: msg.value
    });

    emit DealOpened(id, msg.sender, seller, deadline, msg.value);
  }

  /// @notice Confirm the deal as the seller.
  /// @param id Deal identifier.
  function confirmBySeller(uint256 id) external {
    Deal storage deal = _deals[id];
    if (deal.buyer == address(0)) revert NotFound(id);
    if (msg.sender != deal.seller) revert NotSeller(id);

    if (deal.state == State.Released || deal.state == State.Refunded) {
      revert AlreadyFinalized(id);
    }
    if (deal.state == State.SellerConfirmed || deal.state == State.BothConfirmed) {
      revert AlreadyConfirmedBySeller(id);
    }

    if (deal.state == State.Open) {
      deal.state = State.SellerConfirmed;
    } else if (deal.state == State.BuyerConfirmed) {
      deal.state = State.BothConfirmed;
    }

    emit SellerConfirmed(id);
  }

  /// @notice Confirm the deal as the buyer.
  /// @param id Deal identifier.
  function confirmByBuyer(uint256 id) external {
    Deal storage deal = _deals[id];
    if (deal.buyer == address(0)) revert NotFound(id);
    if (msg.sender != deal.buyer) revert NotBuyer(id);

    if (deal.state == State.Released || deal.state == State.Refunded) {
      revert AlreadyFinalized(id);
    }
    if (deal.state == State.BuyerConfirmed || deal.state == State.BothConfirmed) {
      revert AlreadyConfirmedByBuyer(id);
    }

    if (deal.state == State.Open) {
      deal.state = State.BuyerConfirmed;
    } else if (deal.state == State.SellerConfirmed) {
      deal.state = State.BothConfirmed;
    }

    emit BuyerConfirmed(id);
  }

  /// @notice Release escrowed funds to the seller once both parties have confirmed.
  /// @param id Deal identifier.
  function release(uint256 id) external {
    Deal storage deal = _deals[id];
    if (deal.buyer == address(0)) revert NotFound(id);

    if (deal.state == State.Released || deal.state == State.Refunded) {
      revert AlreadyFinalized(id);
    }
    if (deal.state != State.BothConfirmed) {
      revert NotBothConfirmed(id);
    }

    deal.state = State.Released;
    uint256 amount = deal.amount;
    address seller = deal.seller;

    emit DealReleased(id, seller, amount);

    (bool ok, ) = seller.call{value: amount}("");
    if (!ok) revert TransferFailed(id, seller, amount);
  }

  /// @notice Refund escrowed funds to the buyer if deadline has passed without both confirming.
  /// @param id Deal identifier.
  function refund(uint256 id) external {
    Deal storage deal = _deals[id];
    if (deal.buyer == address(0)) revert NotFound(id);

    if (
      deal.state == State.Released ||
      deal.state == State.Refunded ||
      deal.state == State.BothConfirmed
    ) {
      revert AlreadyFinalized(id);
    }

    if (block.timestamp <= deal.deadline) {
      revert DeadlineNotPassed(id, deal.deadline);
    }

    deal.state = State.Refunded;
    uint256 amount = deal.amount;
    address buyer = deal.buyer;

    emit DealRefunded(id, buyer, amount);

    (bool ok, ) = buyer.call{value: amount}("");
    if (!ok) revert TransferFailed(id, buyer, amount);
  }

  /// @notice Get details of an escrow deal.
  /// @param id Deal identifier.
  /// @return Deal struct containing buyer, seller, deadline, state, and amount.
  function dealOf(uint256 id) external view returns (Deal memory) {
    return _deals[id];
  }
}
