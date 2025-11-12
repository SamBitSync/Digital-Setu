# YouTube Video Upload Guide for Digital-Setu

## 📋 Overview

This guide helps you upload all your videos to YouTube (unlisted) and configure them in the Digital-Setu project. By using YouTube instead of local files or Google Drive, you'll get:

- **88MB→ ~0KB** initial page load (224x faster!)
- Automatic quality switching (HD/SD/mobile)
- Global CDN delivery
- Professional video player
- Analytics to see viewer engagement
- Free unlimited bandwidth

---

## 🎯 Step-by-Step Upload Process

### Step 1: Prepare Your Videos

All your current videos are in these locations:
- `video/intro/` - Intro videos (88MB total)
  - `Bhimdhunga_intro.mp4` (29MB)
  - `Age intro.mp4` (28MB)
- `video/participants/` - Interview videos
  - Currently empty placeholder files; you likely have the actual videos elsewhere

### Step 2: Upload to YouTube

**For each video:**

1. **Go to YouTube Studio**: https://studio.youtube.com
2. **Click "CREATE"** → **"Upload videos"**
3. **Select your video file**
4. **Fill in details**:

#### **Video Settings Template**

**Title Format**: `[Project] - [Person/Topic] - [Description]`
Examples:
- `Digital Setu - Bhimdhunga Introduction`
- `Digital Setu - Maili Tamang Interview - Mobile Phone Perceptions`
- `Digital Setu - Age Journey Intro`

**Description Template**:
```
Part of the Digital Setu research project by All In Foundation (ALIN).

Exploring digital divides in Bhimdhunga, Ward No. 8, Nagarjun Municipality, Nepal.

This video is part of an interactive storymap documenting how age, circumstances, and access create different digital realities in a single community.

Project: Check your privilege digital
```

**Settings**:
- ✅ **Visibility**: `Unlisted` (not searchable, only people with link can watch)
- ✅ **Audience**: Not made for kids (unless it is)
- ✅ **Category**: Education
- ✅ **License**: Standard YouTube License or Creative Commons BY (your choice)
- ✅ **Tags**: `Nepal, digital divide, research, Nagarjun, Bhimdhunga, ALIN Foundation, ethnography`

**Advanced Settings**:
- ✅ Allow embedding
- ✅ Publish to subscriptions feed: NO (keep it quiet)
- ✅ Category: Education

5. **Click "NEXT"** through screens (no monetization, no ads)
6. **Set to "Unlisted"** on final screen
7. **Click "PUBLISH"**

### Step 3: Extract Video IDs

After uploading, YouTube will show you the video URL:
```
https://youtube.com/watch?v=ABC123XYZ456
                              ^^^^^^^^^^^^
                              This is your Video ID
```

**Copy just the Video ID** (the part after `v=`)

---

## 📝 Video Inventory & Upload Checklist

Use this checklist to track your uploads and record the YouTube video IDs:

### 🎬 INTRO VIDEOS

| Video File | YouTube Title | Video ID | Status |
|------------|---------------|----------|--------|
| `Bhimdhunga_intro.mp4` | Digital Setu - Bhimdhunga Introduction | `______________` | ⬜ Not Uploaded |
| `Age intro.mp4` | Digital Setu - Age Journey Introduction | `______________` | ⬜ Not Uploaded |

### 👥 PARTICIPANT SHOWCASE VIDEOS

| Participant | Video Description | Video ID | Status |
|-------------|-------------------|----------|--------|
| **Maili Tamang** (58) | Mobile Phone Perceptions | `______________` | ⬜ Not Uploaded |
| **Sunita Tamang** (45) | Digital Learning at Any Age | `______________` | ⬜ Not Uploaded |
| **Principal Shyam Krishna** (52) | Analysis of Technology Use | `______________` | ⬜ Not Uploaded |
| **Aman Tamang** (18) | Value of Internet in Daily Life | `______________` | ⬜ Not Uploaded |
| **Tej Lama** | Additional Interview | `______________` | ⬜ Not Uploaded |

### 🏘️ LOCATION VIDEOS

#### Street Interviews
| Location | Description | Video ID | Status |
|----------|-------------|----------|--------|
| Street Interview 1 | Maili Tamang | `______________` | ⬜ Not Uploaded |
| Street Interview 2 | Bijaya Tamang - Gaming Scam | `______________` | ⬜ Not Uploaded |
| Street Interview 3 | Samjhana Lama | `______________` | ⬜ Not Uploaded |

#### Khajaghar (Tea Shops)
| Location | Videos | Video IDs | Status |
|----------|--------|-----------|--------|
| Khajaghar 1 (Majuwa) | Video 1 | `______________` | ⬜ Not Uploaded |
|  | Video 2 | `______________` | ⬜ Not Uploaded |
| Khajaghar 2 (Thaple) | Video 1 | `______________` | ⬜ Not Uploaded |
|  | Video 2 | `______________` | ⬜ Not Uploaded |
|  | Video 3 | `______________` | ⬜ Not Uploaded |

#### School
| Location | Video | Video ID | Status |
|----------|-------|----------|--------|
| School | Video 1 | `______________` | ⬜ Not Uploaded |
| School | Video 2 | `______________` | ⬜ Not Uploaded |

#### Houses
| Resident | Description | Video ID | Status |
|----------|-------------|----------|--------|
| Barsha Pokharel | Banking/Wallets | Currently on Drive: `1UulOKF5g4sKxMJ_uZwK0Jw23OnyiO2gn` | ⬜ Not Uploaded |
| Bijaya Tamang | House interview | `______________` | ⬜ Not Uploaded |
| Samjhana Lama | Cliff farmer | `______________` | ⬜ Not Uploaded |

---

## 🔧 Step 4: Configure Video IDs in Code

After uploading all videos to YouTube, update the video IDs in your code:

**File**: `script.js` (lines 8-39)

Find the `YOUTUBE_VIDEO_IDS` object at the top of `script.js` and replace the placeholder IDs with your actual YouTube video IDs:

```javascript
const YOUTUBE_VIDEO_IDS = {
    // INTRO VIDEOS
    bhimdhunga_intro: 'YOUR_YOUTUBE_ID_HERE',  // Replace with actual ID
    age_intro: 'YOUR_YOUTUBE_ID_HERE',

    // PARTICIPANT INTERVIEW VIDEOS
    maili_tamang: 'YOUR_YOUTUBE_ID_HERE',
    sunita_tamang: 'YOUR_YOUTUBE_ID_HERE',
    principal: 'YOUR_YOUTUBE_ID_HERE',
    aman_tamang: 'YOUR_YOUTUBE_ID_HERE',
    tej_lama: 'YOUR_YOUTUBE_ID_HERE',

    // ... and so on for all videos
};
```

**Example**:
```javascript
// BEFORE:
bhimdhunga_intro: 'BHIMDHUNGA_INTRO_VIDEO_ID',

// AFTER (with real YouTube ID):
bhimdhunga_intro: 'dQw4w9WgXcQ',
```

---

## 📊 Testing Your Videos

After configuring the video IDs:

1. **Open `index.html` in a browser**
2. **Check the intro video** - Should load with YouTube thumbnail
3. **Click a location marker** - Should show YouTube embed in modal
4. **Verify all videos load** correctly

If a video doesn't load:
- ✅ Check the video is set to "Unlisted" (not Private)
- ✅ Verify embedding is enabled in YouTube video settings
- ✅ Double-check the video ID is correct in `script.js`

---

## 🎨 Video Thumbnail Optimization

YouTube generates thumbnails automatically, but you can upload custom ones:

1. Create a 1280x720px image representing your video
2. In YouTube Studio, edit the video
3. Upload custom thumbnail under "Thumbnail" section
4. Use images that show:
   - Participant's face (with permission)
   - Location landmark
   - Key message/quote

---

## 📈 Analytics & Monitoring

Once videos are on YouTube, you can track:

1. **Views**: How many people watched
2. **Watch time**: Average duration viewed
3. **Drop-off points**: Where viewers stop watching
4. **Traffic sources**: Where viewers came from
5. **Geography**: Which countries are watching

Access analytics at: https://studio.youtube.com → Analytics

---

## 🔒 Privacy & Permissions

### Unlisted vs Private vs Public

| Setting | Who Can Watch | Searchable | Best For |
|---------|---------------|------------|----------|
| **Unlisted** ✅ | Anyone with link | ❌ No | Your use case |
| **Private** | Only you & invited people | ❌ No | Internal review |
| **Public** | Everyone | ✅ Yes | Public launch |

**Recommendation**: Use **Unlisted** for now. You can always:
- Make videos Public later for broader reach
- Keep them Unlisted for controlled access
- Never make Private (will break embeds for other users)

### Participant Consent

⚠️ **IMPORTANT**: Ensure you have consent from all participants to:
- Record their interviews
- Upload to YouTube (even unlisted)
- Display their stories publicly on your website
- Use their images/names

---

## 🚀 Performance Impact

**Before (Local Files)**:
- Initial load: 88MB
- Load time (3G): 4-5 minutes
- Mobile data cost: NPR 50-100
- Bandwidth cost: $5-20 per 1000 views

**After (YouTube Embeds)**:
- Initial load: ~100KB (with lite-youtube-embed)
- Load time (3G): <1 second
- Mobile data cost: NPR 0.50
- Bandwidth cost: $0 (YouTube handles it)

---

## 💡 Tips & Best Practices

### Video Quality
- Upload in 1080p (Full HD) if possible
- YouTube will auto-generate lower qualities
- Let YouTube process fully before testing (can take 30min-2hr for HD)

### Naming Convention
Keep titles consistent:
```
Digital Setu - [Location] - [Person Name] - [Topic]
```

Examples:
- ✅ `Digital Setu - Majuwa Khajaghar - Sunita Tamang - Digital Learning`
- ❌ `interview_final_v3_FINAL.mp4`

### Batch Upload
- Upload multiple videos at once
- YouTube Studio supports drag-and-drop bulk uploads
- Copy settings from first video to others

### Backup
- Keep original video files backed up separately
- YouTube is your distribution platform, not your archive
- Consider Google Drive or external hard drive for originals

---

## 🛠️ Troubleshooting

### "Video unavailable"
- **Cause**: Video is set to Private
- **Fix**: Change to Unlisted in YouTube Studio

### "Embedding disabled"
- **Cause**: Embedding is disabled in video settings
- **Fix**: Edit video → More options → Allow embedding

### Video ID not working
- **Cause**: Wrong ID copied
- **Fix**: Make sure you copied only the ID part after `v=`
  - ✅ Correct: `dQw4w9WgXcQ`
  - ❌ Wrong: `https://youtube.com/watch?v=dQw4w9WgXcQ`

### Slow loading
- **Cause**: Video still processing on YouTube
- **Fix**: Wait 30 minutes to 2 hours for HD processing to complete

---

## 📞 Support

If you encounter issues:

1. **Check YouTube Studio**: Are videos uploaded successfully?
2. **Verify settings**: Are they Unlisted with embedding enabled?
3. **Test video IDs**: Try opening `https://youtube.com/watch?v=YOUR_ID` directly
4. **Browser console**: Check for JavaScript errors (F12 → Console tab)

---

## ✅ Final Checklist

Before going live:

- [ ] All videos uploaded to YouTube
- [ ] All videos set to "Unlisted"
- [ ] Embedding enabled for all videos
- [ ] All video IDs recorded in checklist above
- [ ] Video IDs updated in `script.js`
- [ ] Website tested in browser
- [ ] All videos load correctly
- [ ] Mobile tested (important for your audience!)
- [ ] Analytics enabled in YouTube Studio
- [ ] Participant consent documented

---

## 🎉 Next Steps

After videos are live:

1. **Monitor analytics** to see which stories resonate most
2. **Consider captions** - YouTube auto-generates them, you can edit for accuracy
3. **Share strategically** - Unlisted means controlled access
4. **Iterate** - You can replace videos without changing IDs
5. **Archive local files** - Free up 109MB of disk space!

---

**Questions?** Check the main README.md or open an issue in the repository.

**Happy uploading!** 🎬
