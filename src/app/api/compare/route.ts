import { streamObject } from "ai";
import { openai } from "@ai-sdk/openai";
import { NextResponse } from "next/server";
import { z } from "zod";
import { BOMComparisonSchema, BOMSchema, compareBomAnalyses } from "@/lib/procureai";

const CompareRequestSchema = z.object({
  primary: BOMSchema,
  secondary: BOMSchema,
});

const COMPARE_PROMPT = `You are an engineering procurement analyst comparing two analyzed Bills of Materials.
Return JSON with:
- deltas: array of { type: 'Added' | 'Removed' | 'Changed', item, details, costImpact }
- totalCostDelta: number
- added: number
- removed: number
- changed: number
Focus on line-item adds, removals, quantity/material/cost changes, and delta impact. Return valid JSON only.`;

export async function POST(request: Request) {
  try {
    const payload = CompareRequestSchema.parse(await request.json());

    if (!process.env.OPENAI_API_KEY || process.env.OPENAI_API_KEY === "your_key_here") {
      return NextResponse.json(compareBomAnalyses(payload.primary, payload.secondary));
    }

    const result = streamObject({
      model: openai("gpt-4o"),
      schema: BOMComparisonSchema,
      system: COMPARE_PROMPT,
      prompt: JSON.stringify(payload),
      temperature: 0.1,
    });

    const object = BOMComparisonSchema.parse(await result.object);
    return NextResponse.json(object);
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Invalid comparison payload." }, { status: 400 });
  }
}
