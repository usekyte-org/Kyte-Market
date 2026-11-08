# Glossary

| Term | Meaning |
|---|---|
| Covered call | A call option backed by the actual tokens, locked in the contract |
| Cash-secured put | A put option backed by the strike amount in ETH, locked in the contract |
| Strike | The price, in ETH per token, at which the option can be exercised |
| Premium | What the buyer pays the seller for the option, in ETH |
| Expiry | The timestamp after which the option can no longer be exercised |
| Fill deadline | How long an unfilled offer stays open for buyers |
| Option NFT | The ERC-721 that represents a filled position. The holder has the exercise right |
| Epoch | The 24-hour window after which the FeeVault splits collected fees |
| Keeper | The bot that expires positions, triggers the epoch split and runs the buyback |
| Guardian | A Safe that can pause the protocol or disable a token instantly. Re-enabling needs the timelock |
