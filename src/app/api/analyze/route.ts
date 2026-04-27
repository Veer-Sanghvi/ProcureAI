import { streamObject } from "ai";
import { openai } from "@ai-sdk/openai";
import { NextResponse } from "next/server";
import { z } from "zod";
import {
  BOMSchema,
  BomInputItemSchema,
  fallbackAnalyze,
  sanitizeBomItem,
} from "@/lib/procureai";

const AnalyzeRequestSchema = z.object({
  items: z.array(BomInputItemSchema).min(1),
});

const SYSTEM_PROMPT = `You are an engineering procurement specialist. Analyze this Bill of Materials and return a JSON object with:
- items: array matching the input, each with added fields: { estimatedUnitCost, estimatedTotalCost, costConfidence which is 'High', 'Medium', or 'Low', commonSuppliers as an array of up to 3 supplier names such as McMaster-Carr, Grainger, Amazon, Digikey, etc., leadTimeEstimate, notes }
- totalEstimatedCost: number
- costBreakdownByCategory: array of { category, totalCost, percentage }
- topCostDrivers: array of 3 { partDescription, cost, savingsTip }
- procurementRisks: array of 2-3 risks covering supply chain, lead time, or cost volatility
- alternativeSuggestions: array of 2-3 { originalItem, alternativeItem, estimatedSavings, tradeoff }
- totalPotentialSavings: number if alternatives are adopted
Return valid JSON only.`;

export async function POST(request: Request) {
  try {
    const payload = AnalyzeRequestSchema.parse(await request.json());
    const items = payload.items.map(sanitizeBomItem);

    if (!process.env.OPENAI_API_KEY || process.env.OPENAI_API_KEY === "your_key_here") {
      return createLocalStreamResponse(fallbackAnalyze(items));
    }

    const result = streamObject({
      model: openai("gpt-4o"),
      schema: BOMSchema,
      system: SYSTEM_PROMPT,
      prompt: JSON.stringify({ items }),
      temperature: 0.2,
      onError: ({ error }) => {
        console.error("streamObject error", error);
      },
    });

    const encoder = new TextEncoder();
    const stream = new ReadableStream({
      async start(controller) {
        try {
          for await (const partial of result.partialObjectStream) {
            controller.enqueue(
              encoder.encode(`${JSON.stringify({ type: "partial", data: partial })}\n`),
            );
          }

          const finalObject = BOMSchema.parse(await result.object);
          controller.enqueue(
            encoder.encode(`${JSON.stringify({ type: "done", data: finalObject })}\n`),
          );
        } catch (error) {
          console.error(error);
          controller.enqueue(
            encoder.encode(
              `${JSON.stringify({
                type: "error",
                error: "AI analysis failed. Falling back to a local estimator is recommended.",
              })}\n`,
            ),
          );
        } finally {
          controller.close();
        }
      },
    });

    return new Response(stream, {
      headers: {
        "Content-Type": "application/x-ndjson; charset=utf-8",
        "Cache-Control": "no-cache, no-transform",
      },
    });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Invalid BOM payload." }, { status: 400 });
  }
}

function createLocalStreamResponse(analysis: z.infer<typeof BOMSchema>) {
  const encoder = new TextEncoder();
  const items = analysis.items;
  const stream = new ReadableStream({
    async start(controller) {
      for (let index = 0; index < items.length; index += 1) {
        const partialItems = items.slice(0, index + 1);
        const partialAnalysis = {
          ...analysis,
          items: partialItems,
          totalEstimatedCost: partialItems.reduce(
            (sum, item) => sum + item.estimatedTotalCost,
            0,
          ),
        };
        controller.enqueue(
          encoder.encode(`${JSON.stringify({ type: "partial", data: partialAnalysis })}\n`),
        );
        await wait(120);
      }
      controller.enqueue(encoder.encode(`${JSON.stringify({ type: "done", data: analysis })}\n`));
      controller.close();
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "application/x-ndjson; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
    },
  });
}

function wait(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
