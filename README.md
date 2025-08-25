# BSV Hash Rate Estimator

A single-page React app that estimates and visualizes the **Bitcoin SV network hash rate** over the last 10 blocks.  
It fetches recent block header data from [WhatsOnChain](https://whatsonchain.com) and applies the standard difficulty-based hash rate formula.

---

## 🚀 Features

- Fetches latest 10 BSV block headers (plus one earlier for timing).
- Computes per-block estimated hash rate from header difficulty and block times.
- Displays:
  - Line chart of hash rate per block.
  - Average network hash rate across the last 10 blocks.
  - Table of block height, time, difficulty, Δt, and hash rate.
- Beautiful, responsive, dark-mode-first UI.
- Refresh button and graceful error handling.
- Caches last successful result in `localStorage`.

---

## 📊 How the Calculation Works

### 1. Block header fields
From each block header we use:
- `time` → the block timestamp (seconds since epoch, set by miner).
- `bits` → compact representation of the proof-of-work target.
- `difficulty` → already computed by WhatsOnChain, but can also be derived from `bits`.

### 2. Difficulty and target
The Bitcoin system defines difficulty relative to the “difficulty-1 target” (the target used in the genesis block, `0x1d00ffff`).  
For any block:

```
target = mantissa * 2^(8*(exponent-3))
difficulty = diff1_target / target
```

Where `mantissa` and `exponent` are extracted from the `bits` field.

### 3. Expected work per block
On average, a miner must perform:

```
expected_hashes = difficulty × 2^32
```

hash operations to find a valid block at the given difficulty.

### 4. Estimating actual rate
If a block at height `h` was found at time `t(h)`, and the previous block at `h-1` was at time `t(h-1)`, then:

```
Δt = t(h) - t(h-1)   // seconds
hashrate(h) = (difficulty × 2^32) / Δt
```

This gives an **estimate of the average network hash rate during that interval**, measured in hashes per second.

### 5. Averaging
To reduce noise (block arrivals are random, Poisson-distributed), the app takes the mean of the last 10 per-block estimates:

```
avg_hashrate = (Σ hashrate(h)) / 10
```

---

## ⚡ Quick Start

```bash
git clone https://github.com/sirdeggen/bsv-hash-watch.git
cd bsv-hashrate-estimator
npm install
npm run dev
```

Open [http://localhost:5173](http://localhost:5173) in your browser.

---

## 📦 Deploy

This project is ready to deploy on [Vercel](https://vercel.com), [Netlify](https://www.netlify.com/), or any static host:

```bash
npm run build
```

Outputs to `/dist`.

---

## 📝 Notes

- The estimate depends on **block timestamps**, which are miner-supplied and can be skewed by a few seconds or minutes. Over a 10-block window, such noise averages out reasonably well.
- True instantaneous hash rate is unknowable; this method is the industry-standard approximation.
- Units are auto-formatted: H/s, kH/s, MH/s, GH/s, TH/s, PH/s, EH/s.

---

## 📚 References

- [WhatsOnChain API](https://developers.whatsonchain.com/#introduction)
- Bitcoin protocol difficulty formula: [Bitcoin Wiki – Difficulty](https://en.bitcoin.it/wiki/Difficulty)
- Satoshi Nakamoto, *Bitcoin: A Peer-to-Peer Electronic Cash System*

---
