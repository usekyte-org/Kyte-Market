# Rules and limits

| Rule | Value |
|---|---|
| Expiry window | 1 hour to 90 days from listing |
| Fill deadline | Per offer; never later than expiry. After it passes, the seller can reclaim collateral |
| Minimum premium | 0.0005 ETH |
| Minimum strike | Per token, set in the AssetRegistry |
| Exposure cap | Per token and per market; new offers beyond the cap are rejected |
| Open offers per seller | 200 |
| Eligible tokens | Listed tokens only. Fee-on-transfer and rebasing tokens are rejected |
| Pause | Blocks new offers and fills only. Cancel, exercise, expire, unstake and claim always work |
| Settlement asset | WETH. Unwrap to ETH from the Positions page |

## Governance

Settings change only through a TimelockController with a 10 minute minimum delay, within ceilings hard-coded in the
contracts. A guardian can pause new offers and buys or disable a token; it cannot unpause, enable or move funds.
Collateral in escrow can only ever go to its seller or to the option holder.
