import { z } from "zod";

export const UNIT_OPTIONS = ["each", "ft", "m", "kg", "lb", "in", "L", "set"] as const;
export const MATERIAL_OPTIONS = [
  "Steel",
  "Aluminum",
  "Plastic",
  "Electronic",
  "Fastener",
  "Hydraulic",
  "Electrical",
  "Other",
] as const;

export const BomInputItemSchema = z.object({
  partNumber: z.string().optional().default(""),
  description: z.string(),
  quantity: z.number(),
  unit: z.string(),
  material: z.string(),
  notes: z.string().optional().default(""),
});

export const BOMSchema = z.object({
  items: z.array(
    z.object({
      partNumber: z.string().optional(),
      description: z.string(),
      quantity: z.number(),
      unit: z.string(),
      material: z.string(),
      estimatedUnitCost: z.number(),
      estimatedTotalCost: z.number(),
      costConfidence: z.enum(["High", "Medium", "Low"]),
      commonSuppliers: z.array(z.string()),
      leadTimeEstimate: z.string(),
      notes: z.string().optional(),
    }),
  ),
  totalEstimatedCost: z.number(),
  costBreakdownByCategory: z.array(
    z.object({
      category: z.string(),
      totalCost: z.number(),
      percentage: z.number(),
    }),
  ),
  topCostDrivers: z.array(
    z.object({
      partDescription: z.string(),
      cost: z.number(),
      savingsTip: z.string(),
    }),
  ),
  procurementRisks: z.array(z.string()),
  alternativeSuggestions: z.array(
    z.object({
      originalItem: z.string(),
      alternativeItem: z.string(),
      estimatedSavings: z.number(),
      tradeoff: z.string(),
    }),
  ),
  totalPotentialSavings: z.number(),
});

export const BOMComparisonSchema = z.object({
  deltas: z.array(
    z.object({
      type: z.enum(["Added", "Removed", "Changed"]),
      item: z.string(),
      details: z.string(),
      costImpact: z.number(),
    }),
  ),
  totalCostDelta: z.number(),
  added: z.number(),
  removed: z.number(),
  changed: z.number(),
});

export type BomInputItem = z.infer<typeof BomInputItemSchema>;
export type BomAnalysis = z.infer<typeof BOMSchema>;
export type BomComparison = z.infer<typeof BOMComparisonSchema>;

export const FIELD_LABELS: Record<keyof BomInputItem, string> = {
  partNumber: "Part Number",
  description: "Description",
  quantity: "Quantity",
  unit: "Unit",
  material: "Material",
  notes: "Notes",
};

export const DEMO_BOM: BomInputItem[] = [
  {
    partNumber: "HC-2.0-STR",
    description: "Hydraulic cylinder, 2 in bore x 8 in stroke",
    quantity: 1,
    unit: "each",
    material: "Hydraulic",
    notes: "Main actuation assembly",
  },
  {
    partNumber: "SV-24V-3W",
    description: "24V DC 3-way solenoid valve",
    quantity: 1,
    unit: "each",
    material: "Hydraulic",
    notes: "Directional flow control",
  },
  {
    partNumber: "PS-1600",
    description: "Pressure sensor, 0-1600 psi",
    quantity: 1,
    unit: "each",
    material: "Electronic",
    notes: "Feedback sensor to PLC",
  },
  {
    partNumber: "AL-6061-PLT",
    description: "6061 aluminum mounting plate 12 x 8 x 0.5 in",
    quantity: 1,
    unit: "each",
    material: "Aluminum",
    notes: "Machined manifold mount",
  },
  {
    partNumber: "PLC-IO-8",
    description: "Compact PLC control module, 8 I/O",
    quantity: 1,
    unit: "each",
    material: "Electrical",
    notes: "Core controller",
  },
  {
    partNumber: "FS-M6-SS",
    description: "M6 stainless socket head fastener kit",
    quantity: 16,
    unit: "each",
    material: "Fastener",
    notes: "Mounting hardware",
  },
  {
    partNumber: "TUBE-PU-6",
    description: "Polyurethane hydraulic tubing, 6 mm",
    quantity: 4,
    unit: "m",
    material: "Plastic",
    notes: "Fluid routing lines",
  },
  {
    partNumber: "FIT-ELB-6",
    description: "Push-to-connect elbow fitting, 6 mm",
    quantity: 6,
    unit: "each",
    material: "Hydraulic",
    notes: "Tubing interface fittings",
  },
];

export function createEmptyRows(count = 3): BomInputItem[] {
  return Array.from({ length: count }, () => ({
    partNumber: "",
    description: "",
    quantity: 1,
    unit: "each",
    material: "Steel",
    notes: "",
  }));
}

export function sanitizeBomItem(
  item: Partial<BomInputItem> & {
    partNumber?: unknown;
    description?: unknown;
    quantity?: unknown;
    unit?: unknown;
    material?: unknown;
    notes?: unknown;
  },
): BomInputItem {
  return {
    partNumber: String(item.partNumber ?? "").trim(),
    description: String(item.description ?? "").trim(),
    quantity: Math.max(0, toNumber(item.quantity, 1)),
    unit: String(item.unit ?? "each").trim() || "each",
    material: String(item.material ?? "Other").trim() || "Other",
    notes: String(item.notes ?? "").trim(),
  };
}

export function rowHasMeaningfulData(row: Partial<BomInputItem>) {
  const description = String(row.description ?? "").trim();
  const partNumber = String(row.partNumber ?? "").trim();
  const notes = String(row.notes ?? "").trim();
  return Boolean(description || partNumber || notes || toNumber(row.quantity, 0) > 0);
}

export function toNumber(value: unknown, fallback = 0) {
  const cleaned = String(value ?? "").replace(/[^0-9.\-]/g, "");
  const parsed = Number(cleaned);
  return Number.isFinite(parsed) ? parsed : fallback;
}

export function roundMoney(value: number) {
  return Math.round(value * 100) / 100;
}

export function estimateBaseCost(item: BomInputItem) {
  const base = {
    Steel: 18,
    Aluminum: 42,
    Plastic: 6,
    Electronic: 55,
    Fastener: 1.2,
    Hydraulic: 78,
    Electrical: 48,
    Other: 22,
  }[item.material] ?? 22;

  const text = `${item.partNumber} ${item.description} ${item.notes}`.toLowerCase();
  let multiplier = 1;
  if (text.includes("plc")) multiplier = 8.2;
  else if (text.includes("sensor")) multiplier = 3.1;
  else if (text.includes("valve")) multiplier = 4.4;
  else if (text.includes("cylinder")) multiplier = 6.7;
  else if (text.includes("plate")) multiplier = 2.4;
  else if (text.includes("tubing")) multiplier = 1.35;
  else if (text.includes("fitting")) multiplier = 1.1;
  else if (text.includes("fastener")) multiplier = 0.75;

  const unitFactor = {
    each: 1,
    ft: 0.9,
    m: 1.1,
    kg: 1.4,
    lb: 1.05,
    in: 0.2,
    L: 1.3,
    set: 2.2,
  }[item.unit] ?? 1;

  return base * multiplier * unitFactor;
}

export function confidenceFromMaterial(material: string) {
  if (["Fastener", "Steel", "Plastic"].includes(material)) return "High" as const;
  if (["Aluminum", "Electrical"].includes(material)) return "Medium" as const;
  return "Low" as const;
}

export function leadTimeFromMaterial(material: string) {
  return {
    Hydraulic: "2-4 weeks",
    Electronic: "1-3 weeks",
    Electrical: "1-2 weeks",
    Aluminum: "5-10 days",
    Steel: "3-7 days",
    Fastener: "2-5 days",
    Plastic: "3-6 days",
    Other: "1-2 weeks",
  }[material] ?? "1-2 weeks";
}

export function suggestSuppliers(material: string) {
  return (
    {
      Hydraulic: ["Grainger", "Motion", "McMaster-Carr"],
      Electronic: ["DigiKey", "Mouser", "Amazon"],
      Electrical: ["AutomationDirect", "DigiKey", "Grainger"],
      Aluminum: ["OnlineMetals", "McMaster-Carr", "Grainger"],
      Steel: ["McMaster-Carr", "Grainger", "Fastenal"],
      Fastener: ["Fastenal", "McMaster-Carr", "Grainger"],
      Plastic: ["McMaster-Carr", "Amazon", "Uline"],
      Other: ["McMaster-Carr", "Grainger", "Amazon"],
    }[material] ?? ["McMaster-Carr", "Grainger", "Amazon"]
  ).slice(0, 3);
}

export function buildAnalysisNote(item: BomInputItem) {
  return (
    {
      Hydraulic: "Pressure rating, seal compatibility, and port geometry should be quote-checked.",
      Electronic: "Electronic pricing may shift quickly with distributor stock levels.",
      Electrical: "Verify voltage, IO count, and enclosure requirements before purchase.",
      Aluminum: "Machining setup and stock thickness can materially change final quote value.",
      Fastener: "Finish, grade, and minimum order pack size should be confirmed with suppliers.",
    }[item.material] ??
    "Confirm dimensions, tolerances, and stocked equivalents before release."
  );
}

export function deriveBreakdown(items: BomAnalysis["items"]) {
  const totals = items.reduce<Record<string, number>>((acc, item) => {
    acc[item.material] = (acc[item.material] ?? 0) + item.estimatedTotalCost;
    return acc;
  }, {});
  const grandTotal = items.reduce((sum, item) => sum + item.estimatedTotalCost, 0) || 1;
  return Object.entries(totals)
    .map(([category, totalCost]) => ({
      category,
      totalCost: roundMoney(totalCost),
      percentage: roundMoney((totalCost / grandTotal) * 100),
    }))
    .sort((a, b) => b.totalCost - a.totalCost);
}

export function deriveTopCostDrivers(items: BomAnalysis["items"]) {
  return [...items]
    .sort((a, b) => b.estimatedTotalCost - a.estimatedTotalCost)
    .slice(0, 3)
    .map((item) => ({
      partDescription: item.description,
      cost: roundMoney(item.estimatedTotalCost),
      savingsTip: savingsTipForItem(item),
    }));
}

export function deriveRisks(items: BomAnalysis["items"]) {
  const risks: string[] = [];
  if (items.some((item) => item.material === "Hydraulic")) {
    risks.push(
      "Hydraulic valves, cylinders, and fittings can introduce long-lead exposure when exact pressure ratings are not held in stock.",
    );
  }
  if (items.some((item) => item.material === "Electronic" || item.material === "Electrical")) {
    risks.push(
      "Control and sensing hardware is prone to distributor inventory swings, calibration delays, and pricing volatility.",
    );
  }
  if (items.some((item) => item.costConfidence === "Low")) {
    risks.push(
      "Low-confidence cost lines should be verified with supplier quotes before procurement signoff to avoid budget drift.",
    );
  }
  return risks.slice(0, 3);
}

export function deriveAlternatives(items: BomAnalysis["items"]) {
  return [...items]
    .filter((item) => item.estimatedTotalCost > 20)
    .sort((a, b) => b.estimatedTotalCost - a.estimatedTotalCost)
    .slice(0, 3)
    .map((item) => ({
      originalItem: item.description,
      alternativeItem: alternativeForItem(item),
      estimatedSavings: roundMoney(item.estimatedTotalCost * (item.material === "Hydraulic" ? 0.12 : 0.08)),
      tradeoff: tradeoffForItem(item),
    }));
}

export function fallbackAnalyze(items: BomInputItem[]): BomAnalysis {
  const normalizedItems = items.map((item) => sanitizeBomItem(item)).filter(rowHasMeaningfulData);
  const analyzedItems: BomAnalysis["items"] = normalizedItems.map((item) => {
    const estimatedUnitCost = roundMoney(estimateBaseCost(item));
    return {
      ...item,
      estimatedUnitCost,
      estimatedTotalCost: roundMoney(estimatedUnitCost * item.quantity),
      costConfidence: confidenceFromMaterial(item.material),
      commonSuppliers: suggestSuppliers(item.material),
      leadTimeEstimate: leadTimeFromMaterial(item.material),
      notes: buildAnalysisNote(item),
    };
  });

  const costBreakdownByCategory = deriveBreakdown(analyzedItems);
  const alternativeSuggestions = deriveAlternatives(analyzedItems);

  return {
    items: analyzedItems,
    totalEstimatedCost: roundMoney(analyzedItems.reduce((sum, item) => sum + item.estimatedTotalCost, 0)),
    costBreakdownByCategory,
    topCostDrivers: deriveTopCostDrivers(analyzedItems),
    procurementRisks: deriveRisks(analyzedItems),
    alternativeSuggestions,
    totalPotentialSavings: roundMoney(
      alternativeSuggestions.reduce((sum, item) => sum + item.estimatedSavings, 0),
    ),
  };
}

export function compareBomAnalyses(primary: BomAnalysis, secondary: BomAnalysis): BomComparison {
  const keyOf = (item: BomAnalysis["items"][number]) =>
    item.partNumber?.trim() || item.description.trim().toLowerCase();

  const primaryMap = new Map(primary.items.map((item) => [keyOf(item), item]));
  const secondaryMap = new Map(secondary.items.map((item) => [keyOf(item), item]));
  const allKeys = new Set([...primaryMap.keys(), ...secondaryMap.keys()]);

  const deltas: BomComparison["deltas"] = [];
  allKeys.forEach((key) => {
    const a = primaryMap.get(key);
    const b = secondaryMap.get(key);
    if (a && !b) {
      deltas.push({
        type: "Removed",
        item: a.description,
        details: "Present in BOM A only",
        costImpact: roundMoney(-a.estimatedTotalCost),
      });
      return;
    }
    if (!a && b) {
      deltas.push({
        type: "Added",
        item: b.description,
        details: "Present in BOM B only",
        costImpact: roundMoney(b.estimatedTotalCost),
      });
      return;
    }
    if (!a || !b) return;

    const changes: string[] = [];
    if (a.quantity !== b.quantity) changes.push(`Qty ${a.quantity} -> ${b.quantity}`);
    if (a.material !== b.material) changes.push(`Material ${a.material} -> ${b.material}`);
    if (Math.abs(a.estimatedTotalCost - b.estimatedTotalCost) > 0.009) {
      changes.push(`Cost ${a.estimatedTotalCost.toFixed(2)} -> ${b.estimatedTotalCost.toFixed(2)}`);
    }
    if (changes.length) {
      deltas.push({
        type: "Changed",
        item: b.description,
        details: changes.join(" | "),
        costImpact: roundMoney(b.estimatedTotalCost - a.estimatedTotalCost),
      });
    }
  });

  return {
    deltas,
    totalCostDelta: roundMoney(secondary.totalEstimatedCost - primary.totalEstimatedCost),
    added: deltas.filter((item) => item.type === "Added").length,
    removed: deltas.filter((item) => item.type === "Removed").length,
    changed: deltas.filter((item) => item.type === "Changed").length,
  };
}

export function overallConfidence(items: BomAnalysis["items"]) {
  const scoreMap = { High: 3, Medium: 2, Low: 1 } as const;
  if (!items.length) return "N/A";
  const average =
    items.reduce((sum, item) => sum + scoreMap[item.costConfidence], 0) / items.length;
  if (average >= 2.6) return "High";
  if (average >= 1.8) return "Medium";
  return "Low";
}

function savingsTipForItem(item: BomAnalysis["items"][number]) {
  const text = `${item.description} ${item.notes}`.toLowerCase();
  if (text.includes("plc")) return "Check whether a lower-I/O PLC or relay controller can cover the prototype phase.";
  if (text.includes("cylinder")) return "Ask suppliers for stocked bore and stroke variants before custom-ordering.";
  if (text.includes("valve")) return "Compare bundled manifold-mounted packages against inline valve sourcing.";
  if (text.includes("sensor")) return "Review whether a narrower sensing range can still cover the control envelope.";
  if (text.includes("plate")) return "Use standard stock thickness and reduce secondary machining where possible.";
  return "Consolidate sourcing and compare stocked equivalents to lower total acquisition cost.";
}

function alternativeForItem(item: BomAnalysis["items"][number]) {
  const text = item.description.toLowerCase();
  if (text.includes("plc")) return "Lower-I/O PLC or relay controller";
  if (text.includes("sensor")) return "Standard analog industrial transducer";
  if (text.includes("valve")) return "Stocked solenoid valve with standard coil";
  if (text.includes("cylinder")) return "Standard catalog hydraulic cylinder";
  if (text.includes("plate")) return "Pre-cut tooling plate with fewer machining operations";
  return `Stocked equivalent ${item.material.toLowerCase()} component`;
}

function tradeoffForItem(item: BomAnalysis["items"][number]) {
  const text = item.description.toLowerCase();
  if (text.includes("plc")) return "May reduce future expansion headroom for the controls stack.";
  if (text.includes("sensor")) return "Could lower precision or connector convenience.";
  if (text.includes("valve")) return "May require minor fitting or mounting adjustments.";
  if (text.includes("cylinder")) return "Mounting geometry may need small bracket changes.";
  return "Compatibility, ratings, and packaging must be validated before substitution.";
}
