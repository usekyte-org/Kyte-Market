# Fees

| Action | Fee | Paid by | When |
|---|---|---|---|
| Fill an offer | 3% of the premium | Seller (deducted from the premium) | When a buyer fills |
| Exercise | 0.1% of the strike | Holder | When the option is exercised |
| Cancel unfilled | Free | | Gas only |
| Expire | Free | | Gas only; anyone can call it |
| Stake, unstake, claim | Free | | Gas only |

The fee rates are written onto each position when it is created. A later governance change never affects an option
that is already open. Hard caps in the contracts: at most 10% of the premium and 1% of the strike. No other protocol
fees exist. Network gas is separate.
