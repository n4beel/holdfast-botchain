/**
 * Holdfast contract ABI.
 *
 * Hand-written and `as const` rather than imported from `contracts/out`. The const assertion is
 * what gives viem and wagmi their argument and return types; a generated JSON artifact loses that
 * unless it is cast, and a mistyped argument would then only surface as a revert.
 *
 * Custom errors are here on purpose: without them viem cannot decode reverts into descriptive UI
 * messages.
 */
export const holdfastAbi = [
  {
    type: "function",
    name: "open",
    stateMutability: "payable",
    inputs: [
      { name: "seller", type: "address" },
      { name: "deadline", type: "uint64" },
    ],
    outputs: [{ name: "id", type: "uint256" }],
  },
  {
    type: "function",
    name: "confirmBySeller",
    stateMutability: "nonpayable",
    inputs: [{ name: "id", type: "uint256" }],
    outputs: [],
  },
  {
    type: "function",
    name: "confirmByBuyer",
    stateMutability: "nonpayable",
    inputs: [{ name: "id", type: "uint256" }],
    outputs: [],
  },
  {
    type: "function",
    name: "release",
    stateMutability: "nonpayable",
    inputs: [{ name: "id", type: "uint256" }],
    outputs: [],
  },
  {
    type: "function",
    name: "refund",
    stateMutability: "nonpayable",
    inputs: [{ name: "id", type: "uint256" }],
    outputs: [],
  },
  {
    type: "function",
    name: "dealOf",
    stateMutability: "view",
    inputs: [{ name: "id", type: "uint256" }],
    outputs: [
      {
        name: "",
        type: "tuple",
        components: [
          { name: "buyer", type: "address" },
          { name: "seller", type: "address" },
          { name: "deadline", type: "uint64" },
          { name: "state", type: "uint8" },
          { name: "amount", type: "uint256" },
        ],
      },
    ],
  },
  {
    type: "event",
    name: "DealOpened",
    inputs: [
      { name: "id", type: "uint256", indexed: true },
      { name: "buyer", type: "address", indexed: true },
      { name: "seller", type: "address", indexed: true },
      { name: "deadline", type: "uint64", indexed: false },
      { name: "amount", type: "uint256", indexed: false },
    ],
  },
  {
    type: "event",
    name: "SellerConfirmed",
    inputs: [{ name: "id", type: "uint256", indexed: true }],
  },
  {
    type: "event",
    name: "BuyerConfirmed",
    inputs: [{ name: "id", type: "uint256", indexed: true }],
  },
  {
    type: "event",
    name: "DealReleased",
    inputs: [
      { name: "id", type: "uint256", indexed: true },
      { name: "seller", type: "address", indexed: true },
      { name: "amount", type: "uint256", indexed: false },
    ],
  },
  {
    type: "event",
    name: "DealRefunded",
    inputs: [
      { name: "id", type: "uint256", indexed: true },
      { name: "buyer", type: "address", indexed: true },
      { name: "amount", type: "uint256", indexed: false },
    ],
  },
  { type: "error", name: "ZeroValue", inputs: [] },
  { type: "error", name: "ZeroAddress", inputs: [] },
  { type: "error", name: "DeadlineInPast", inputs: [] },
  { type: "error", name: "SellerIsBuyer", inputs: [] },
  {
    type: "error",
    name: "NotFound",
    inputs: [{ name: "id", type: "uint256" }],
  },
  {
    type: "error",
    name: "NotSeller",
    inputs: [{ name: "id", type: "uint256" }],
  },
  {
    type: "error",
    name: "NotBuyer",
    inputs: [{ name: "id", type: "uint256" }],
  },
  {
    type: "error",
    name: "AlreadyConfirmedBySeller",
    inputs: [{ name: "id", type: "uint256" }],
  },
  {
    type: "error",
    name: "AlreadyConfirmedByBuyer",
    inputs: [{ name: "id", type: "uint256" }],
  },
  {
    type: "error",
    name: "NotBothConfirmed",
    inputs: [{ name: "id", type: "uint256" }],
  },
  {
    type: "error",
    name: "DeadlineNotPassed",
    inputs: [
      { name: "id", type: "uint256" },
      { name: "deadline", type: "uint64" },
    ],
  },
  {
    type: "error",
    name: "AlreadyFinalized",
    inputs: [{ name: "id", type: "uint256" }],
  },
  {
    type: "error",
    name: "TransferFailed",
    inputs: [
      { name: "id", type: "uint256" },
      { name: "to", type: "address" },
      { name: "amount", type: "uint256" },
    ],
  },
] as const;

export const contractAbi = holdfastAbi;
