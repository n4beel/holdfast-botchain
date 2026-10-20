# Holdfast

Escrow that releases when both sides confirm.

### BOT Chain mainnet (677) — live

| | |
|---|---|
| Contract | [`0x2f1b8b468a3e57d61C564D5099ED8223f0de91Cb`](https://scan.botchain.ai/address/0x2f1b8b468a3e57d61C564D5099ED8223f0de91Cb) · source verified |
| Deploy block | 27329436 |

### Bohr testnet (968) — live

| | |
|---|---|
| Contract | [`0x38083268c3b2D7eBd93E272B88E6085F60a44f2d`](https://scan.bohr.life/address/0x38083268c3b2D7eBd93E272B88E6085F60a44f2d) · source verified |
| Deploy block | 27397150 |

The two addresses differ because the deployer's nonce diverged between the chains;
each is this contract on its own network. The site targets mainnet.

---

## What it does
Holdfast holds BOT in escrow until both buyer and seller confirm delivery. Either party can confirm in any order. Once both have confirmed, anyone can trigger `release()`, which forwards the funds to the seller.

## Deadlock prevention
If two parties must both act, funds can easily be stranded if one party vanishes. Holdfast solves this with a mandatory deadline set at deal opening: after the deadline passes without mutual confirmation, the buyer can unilaterally claim a refund.

## What it deliberately cannot do
- **No arbitration**: no third-party judge or dispute council
- **No partial release**: deals release in full or refund in full
- **No deadline extension**: the timeout is fixed at creation
- **No owner**: no fee rake, no pause, no admin

## Gas
- `open()`: ~88k gas (target: ~90k)
- `confirmBySeller()` / `confirmByBuyer()`: ~32k gas
- `release()` / `refund()`: ~35k gas

## Honest limits
- Before the deadline passes, funds are strictly locked in escrow unless both parties confirm
- The buyer must monitor the deadline to initiate a refund if the seller defaults
