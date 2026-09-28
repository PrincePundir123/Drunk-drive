# Study results

This folder is empty until you run the study. Put each participant's exported file here (`secondlook-study-P01.json`, …) and run:

```bash
npm run analyze
```

That writes `summary.md` (false-alarm rate, detection rates, threshold sweep, best signals) and `chart.svg` here.

## Running the study with 8–10 people

**No alcohol, ever.** The study uses safe, legal stand-ins for impairment, and they are labelled as stand-ins everywhere.

1. Host the app (GitHub Pages or `npm start`) and open **`study.html`**. It isn't linked from the main app.
2. Give each person a code: P01, P02, … No names are ever recorded.
3. Use the **same device** for a person's whole session, and mouse vs. touch the way they normally would.
4. The participant confirms they're sober and understands only timing is recorded. Then:
   - **Baseline:** reaction, steady hand, typing, and two short free-typed texts.
   - **Three rounds in random order:** a sober retest (this gives the false-alarm rate), non-dominant hand, and a dual task (counting backwards from 300 in 7s, out loud).
   - **Optional:** a *tired / late night* round with a tiredness rating. They can add it later by loading their file on the start screen.
5. At the end they tap **Download my file**. Copy it into this folder.
6. Run `npm run analyze`, then copy the key numbers into the **Evidence** sections of `README.md` and `DEVPOST.md`.

About 12 minutes per person. Leave a minute's break between rounds.

## Testing the pipeline without people

`npm run analyze -- --synthetic` writes **fake** participants to `results/synthetic/` (which git ignores). Every output is watermarked *"SYNTHETIC – not real results"*. It only checks that the scripts work. **Never cite it as evidence.**

## What a result file contains

For each round: signal values (milliseconds, rates), their z-scores against that person's baseline, and the 0–100 scores for the quick check and message. It has no text, no names and no timestamps beyond the session time.
