# ProcureAI

ProcureAI is a single-page BOM cost intelligence web app for engineering students and small project teams. It lets users upload, enter, or paste a Bill of Materials, estimate pricing and procurement risks with AI, compare two BOM revisions, export an enhanced CSV, and generate a print-ready procurement summary.

## How to use

1. Open `index.html` in a browser.
2. Load BOM data with `CSV Upload`, `Manual Entry`, or `Paste Table`.
3. Click `Analyze BOM` to run the cost analysis.
4. Use `Load Demo BOM` to instantly populate a hydraulic actuator BOM and auto-run the analysis.
5. Export the enhanced BOM as CSV or generate the printable procurement report.

## Notes

- The app is built with HTML, CSS, and vanilla JavaScript.
- PapaParse and Chart.js are loaded from CDN.
- OpenAI API usage is configured in the `CONFIG` object at the top of the JavaScript in `index.html`.
- If no OpenAI API key is present, the app falls back to a built-in local estimator so the demo still works immediately.
