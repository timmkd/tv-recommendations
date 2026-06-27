# Prediction Review Report

**Generated:** 2026-02-02T11:30:35.242Z
**Trigger:** Happy Valley prediction miss (predicted 4.5★, actual 2★)

---

## Executive Summary

Happy Valley was predicted at 4.5★ for "together" viewing but received 2★ and was dropped after one episode.

**What went wrong:**
1. Confused "acclaimed British crime drama" with "engaging mystery"
2. Over-indexed on high IMDB/RT scores and acting acclaim
3. Missed the "dark character study" vs "whodunit mystery" distinction
4. Didn't flag the bleak, trauma-focused content as a dealbreaker
5. Tommy Lee Royce (central antagonist) is deliberately repulsive - character investment failure

**Key lesson:** "Prestige crime drama" ≠ "Mystery you'll enjoy." Need to distinguish between:
- **Engaging mysteries:** Sherlock, Slow Horses, Only Murders - intrigue and momentum
- **Dark character studies:** Happy Valley, Mindhunter - watching suffering unfold

---

## Happy Valley Entry Updated

```
Title: Happy Valley
Rating: 2★ (was predicted 4.5★)
Status: Dropped
Watch Preference: Together
Review Note: "Dropped after 1 episode. Too dark and bleak..."
```

---

## Risk Patterns Implemented

These patterns will now be checked for all predictions:

| Pattern | Description | Adjustment |
|---------|-------------|------------|
| dark-character-study | Dark character study without mystery intrigue | -1.0★ |
| bleak-british-crime | British crime that may prioritize darkness over entertainment | -0.5★ |
| prestige-trap | High critics but lower audience (pretention risk) | -0.3★ |
| watch-the-crime-unfold | You see the crime happen (no whodunit) | -0.5★ |
| repulsive-central-character | Deliberately unlikeable characters | -0.5★ |
| trauma-focused | Focused on trauma without hope/redemption | -0.5★ |
| together-but-dark | Predicted together but too dark for Helen | -0.5★ |

---

## Flagged Shows (15 total)

These shows were predicted 4★+ but trigger risk patterns similar to Happy Valley:

### 🔴 Critical (adjustment -1.0★ or more)

| Show | Current | Suggested | Risks | Notes |
|------|---------|-----------|-------|-------|
| Ozark | 4.5★ | 3★ | dark-character-study, watch-the-crime-unfold | Known dark character study - verify it has mystery intrigue, not just bleakness |
| Breaking Bad | 4.5★ | 3★ | dark-character-study, watch-the-crime-unfold | Known dark character study - verify it has mystery intrigue, not just bleakness |
| Your Friends & Neighbors | 4★ | 3★ | watch-the-crime-unfold, repulsive-central-character | You see the crime/villain from the start - not a whodunit mystery |
| True Detective | 4.5★ | 3.5★ | dark-character-study | Known dark character study - verify it has mystery intrigue, not just bleakness |
| Happy Valley | 4.5★ | 3.5★ | dark-character-study | Known dark character study - verify it has mystery intrigue, not just bleakness |
| Mare of Easttown | 4.5★ | 3.5★ | dark-character-study | Known dark character study - verify it has mystery intrigue, not just bleakness |

### 🟡 Warning (adjustment -0.5★ to -1.0★)

| Show | Current | Suggested | Risks | Notes |
|------|---------|-----------|-------|-------|
| Succession | 4.5★ | 4★ | repulsive-central-character | Features deliberately unlikeable characters - character investment may fail |

### 🟢 Minor (adjustment less than -0.5★)

| Show | Current | Suggested | Risks |
|------|---------|-----------|-------|
| Watchmen | 4★ | 3.5★ | prestige-trap |
| Rosehaven | 4★ | 3.5★ | prestige-trap |
| Bad Sisters | 4★ | 3.5★ | prestige-trap |
| Pluribus | 4.5★ | 4★ | prestige-trap |
| Task | 4.5★ | 4★ | prestige-trap |
| The Chair Company | 4★ | 3.5★ | prestige-trap |
| Black Doves | 4★ | 3.5★ | prestige-trap |
| Station Eleven | 4★ | 3.5★ | prestige-trap |

---

## Detailed Analysis of Critical Shows

### Ozark

**Current prediction:** 4.5★ (solo)
**Suggested:** 3★
**IMDB:** N/A
**RT Critics/Audience:** 82% / 86%
**Genres:** Crime, Drama

**Triggered risks:**
- **dark-character-study** (-1★): Known dark character study - verify it has mystery intrigue, not just bleakness
- **watch-the-crime-unfold** (-0.5★): You see the crime/villain from the start - not a whodunit mystery

### Breaking Bad

**Current prediction:** 4.5★ (solo)
**Suggested:** 3★
**IMDB:** N/A
**RT Critics/Audience:** 96% / 97%
**Genres:** Drama, Crime

**Triggered risks:**
- **dark-character-study** (-1★): Known dark character study - verify it has mystery intrigue, not just bleakness
- **watch-the-crime-unfold** (-0.5★): You see the crime/villain from the start - not a whodunit mystery

### Your Friends & Neighbors

**Current prediction:** 4★ (together)
**Suggested:** 3★
**IMDB:** N/A
**RT Critics/Audience:** N/A% / N/A%
**Genres:** Drama

**Triggered risks:**
- **watch-the-crime-unfold** (-0.5★): You see the crime/villain from the start - not a whodunit mystery
- **repulsive-central-character** (-0.5★): Features deliberately unlikeable characters - character investment may fail

### True Detective

**Current prediction:** 4.5★ (solo)
**Suggested:** 3.5★
**IMDB:** N/A
**RT Critics/Audience:** 79% / 59%
**Genres:** Drama, Mystery

**Triggered risks:**
- **dark-character-study** (-1★): Known dark character study - verify it has mystery intrigue, not just bleakness

### Happy Valley

**Current prediction:** 4.5★ (together)
**Suggested:** 3.5★
**IMDB:** N/A
**RT Critics/Audience:** 98% / 94%
**Genres:** Crime, Drama, Mystery

**Triggered risks:**
- **dark-character-study** (-1★): Known dark character study - verify it has mystery intrigue, not just bleakness

### Mare of Easttown

**Current prediction:** 4.5★ (together)
**Suggested:** 3.5★
**IMDB:** N/A
**RT Critics/Audience:** 95% / 94%
**Genres:** Drama, Mystery, Crime

**Triggered risks:**
- **dark-character-study** (-1★): Known dark character study - verify it has mystery intrigue, not just bleakness

---

## Recommendations

1. **Immediate action:** Review the 6 critical shows before recommending them
2. **Update taste profile:** Add explicit pattern for "dark character study vs engaging mystery"
3. **Together filter:** Add stronger checks for Helen-unfriendly content
4. **British crime distinction:** Not all British crime is Sherlock - some is bleak suffering

---

## Next Steps

1. Review this report in the morning
2. Decide which predictions to adjust in the database
3. Update CLAUDE.md taste profile with Happy Valley learnings
4. Consider re-running predictions for all flagged shows

