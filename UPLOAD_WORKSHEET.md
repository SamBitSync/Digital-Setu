# 🎬 Digital Setu — Video Upload Worksheet

**Goal this morning:** Get your videos onto your "Digital Setu" YouTube channel and record the IDs here.
**Time-saver:** You realistically only NEED the 2 intro videos. The 11 interviews already work on Google Drive.

---

## ⚡ Before You Start (one-time, 2 min)

1. Create/sign into your **Digital Setu** YouTube channel.
2. YouTube Studio → **Settings → Upload defaults → Visibility → Unlisted**.
   *(Now every upload is Unlisted automatically — you won't click it 13 times.)*
3. Same screen → set default Category: **Education**, Allow embedding: **Yes**.

**How to copy a video ID:** after upload, the link looks like
`https://youtube.com/watch?v=` **`aB3xK9zQ1pY`** → the bold part is the ID.

---

## 🔴 PRIORITY 1 — Do These Now (the 2 that matter)

These are your local 88MB files. Uploading them is the whole point.

| # | Video | Source file on disk | YouTube title to use | ➡️ Paste new ID |
|---|-------|---------------------|----------------------|------------------|
| 1 | **Main intro** | `video/intro/Bhimdhunga_intro.mp4` | `Digital Setu — Bhimdhunga Introduction` | `________________` |
| 2 | **Age-journey intro** | `video/intro/Age intro.mp4` | `Digital Setu — Age Journey` | `________________` |

> When you have these 2 IDs, that's enough to finish the migration. Bring them back and I'll wire the code in one clean pass.

---

## 🟡 PRIORITY 2 — Optional (already work on Google Drive)

These 11 stream fine from Drive today. Only upload them if you want everything on YouTube
(better player + analytics). The source files are in your **Google Drive** — download, then upload.

### Maili Tamang (58) — street interview
| Topic | Drive ID (source) | ➡️ New YouTube ID |
|-------|-------------------|-------------------|
| Perception of Mobile Phones | `1TtkMt7IbRgbdaof_zOenLbqyy5MuRDcg` | `________________` |

### Sunita Tamang (45) — tea shop owner
| Topic | Drive ID (source) | ➡️ New YouTube ID |
|-------|-------------------|-------------------|
| Digital Learning at Any Age | `1Gb3JR_vFlNlu2d8mmnU9gd9kr89JoK8C` | `________________` |

### Aman Tamang (18) — digital native
| Topic | Drive ID (source) | ➡️ New YouTube ID |
|-------|-------------------|-------------------|
| Value of Internet in Daily Life | `1hLANscn_QwqB7kikdPvgiBnBowQRBiYf` | `________________` |
| Use of Internet in Learning | `1AtMPVtt5veyhsd_PKRIl9ruxG7pzGo7n` | `________________` |

### Bijay Tamang (17) — gaming
| Topic | Drive ID (source) | ➡️ New YouTube ID |
|-------|-------------------|-------------------|
| Mobile Gaming Scam Story | `1m1Q8CPlbzHUyv51OKcLx2JLEASR1u1hQ` | `________________` |

### Barsha Pokharel (33) — grocery shop owner
| Topic | Drive ID (source) | ➡️ New YouTube ID |
|-------|-------------------|-------------------|
| On Not Using Online Banking & Wallets | `1UulOKF5g4sKxMJ_uZwK0Jw23OnyiO2gn` | `________________` |
| Concerns on Mobile Use by Children | `1G-L2Tvvz0UHGadU9MQisKoBd9kAJNpgH` | `________________` |

### Shyam Krishna Bhattarai (52) — school principal
| Topic | Drive ID (source) | ➡️ New YouTube ID |
|-------|-------------------|-------------------|
| Analysis of Technology Use in Majuwa | `1zT7sWLhgh04hFKervNl-XXM05D327a62` | `________________` |
| Government's Role in Digital Literacy | `1SdOqhntIZ9mNKYQdcfT3A7TbUyR-UOeE` | `________________` |

### Suraj Kumar Pokharel — ward chairperson
| Topic | Drive ID (source) | ➡️ New YouTube ID |
|-------|-------------------|-------------------|
| Introduction of Ward | `1W7D1_DSX2qeqQhcivB9I0jnAbOaIsMxt` | `________________` |
| Q&A with Ward Chairperson | `1Xaoxp4RjZSGPrWdDEGH2kR3u2YQEW5C6` | `________________` |

---

## ✅ When You're Done

Bring back this filled-in sheet (even just Priority 1). I'll:
1. Drop the IDs into the `YOUTUBE_VIDEO_IDS` config in `script.js`
2. Wire every video reference cleanly (no leftover Drive iframes)
3. Run a smoke test so videos load before you push

**You upload + paste IDs here. I do the code. That's the whole deal.**
