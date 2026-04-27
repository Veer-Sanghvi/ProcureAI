# ProcureAI

ProcureAI is a Next.js 14 App Router application for AI-powered Bill of Materials cost intelligence. It is designed for engineering students and small project teams who need quick BOM pricing estimates, supplier hints, cost breakdowns, procurement risks, and revision-to-revision comparison.

## Stack

- Next.js 14 App Router
- Vercel AI SDK with `streamObject`
- OpenAI `gpt-4o`
- TypeScript
- Tailwind CSS
- Framer Motion
- Recharts
- shadcn/ui + selected 21st.dev components

## Local setup

1. Install dependencies with `npm install`
2. Add `.env.local` in the project root:

```env
OPENAI_API_KEY=your_key_here
```

3. Run the dev server:

```bash
npm run dev
```

4. Open `http://localhost:3000`

## Features

- CSV upload with BOM column mapping
- Manual BOM entry with dynamic rows
- Paste-from-spreadsheet parsing
- Streaming AI BOM analysis
- Cost breakdown charting and cost-driver insights
- AI alternatives and procurement risk surfacing
- Side-by-side BOM comparison mode
- CSV export and printable procurement summary
- Hydraulic actuator demo BOM with one-click analysis
