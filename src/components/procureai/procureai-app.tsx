"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Papa from "papaparse";
import { AnimatePresence, motion } from "framer-motion";
import {
  AlertTriangle,
  ArrowRightLeft,
  ClipboardPaste,
  Download,
  LoaderCircle,
  Plus,
  Printer,
  ShieldAlert,
  Trash2,
  UploadCloud,
} from "lucide-react";
import {
  Cell,
  Legend,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
} from "recharts";
import { Badge } from "@/components/ui/badge";
import { AnimatedGradientText } from "@/components/ui/animated-gradient-text";
import { BackgroundBeams } from "@/components/ui/background-beams";
import { BlurFade } from "@/components/ui/blur-fade";
import { BorderBeam } from "@/components/ui/border-beam";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { FloatingNav } from "@/components/ui/floating-navbar";
import { FeaturedWithImageOnRight } from "@/components/ui/featured-with-image-on-right";
import { Input } from "@/components/ui/input";
import { NumberTicker } from "@/components/ui/number-ticker";
import { Progress } from "@/components/ui/progress";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { ShimmerButton } from "@/components/ui/shimmer-button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { TiltedCard } from "@/components/ui/tilted-card";
import {
  BomAnalysis,
  BomComparison,
  BomInputItem,
  DEMO_BOM,
  FIELD_LABELS,
  MATERIAL_OPTIONS,
  UNIT_OPTIONS,
  compareBomAnalyses,
  createEmptyRows,
  overallConfidence,
  rowHasMeaningfulData,
  sanitizeBomItem,
} from "@/lib/procureai";

type PanelId = "A" | "B";
type InputTab = "csv" | "manual" | "paste";

type CsvState = {
  headers: string[];
  rawRows: Record<string, string>[];
  mapping: Record<string, string>;
};

type PanelState = {
  activeTab: InputTab;
  manualRows: BomInputItem[];
  parsedRows: BomInputItem[];
  pasteValue: string;
  csv: CsvState;
};

type StreamEvent<T> =
  | { type: "partial"; data: Partial<T> }
  | { type: "done"; data: T }
  | { type: "error"; error: string };

const LOADING_MESSAGES = [
  "Querying supplier databases...",
  "Estimating lead times...",
  "Calculating cost drivers...",
  "Flagging risks...",
];

const CHART_COLORS = ["#0066ff", "#20c997", "#f7b500", "#ff5c7a", "#7c83ff", "#56c8ff", "#9ae66e"];

const DEFAULT_MAPPING: Record<string, string[]> = {
  partNumber: ["part number", "part #", "sku", "part", "pn"],
  description: ["description", "component", "item description", "name"],
  quantity: ["quantity", "qty", "count"],
  unit: ["unit", "uom", "unit of measure"],
  material: ["material", "category", "commodity", "type"],
  notes: ["notes", "remarks", "comments", "spec"],
};

export function ProcureAIApp() {
  const [compareMode, setCompareMode] = useState(false);
  const [panels, setPanels] = useState<Record<PanelId, PanelState>>({
    A: createPanelState(),
    B: createPanelState(),
  });
  const [analysisA, setAnalysisA] = useState<Partial<BomAnalysis> | null>(null);
  const [analysisB, setAnalysisB] = useState<Partial<BomAnalysis> | null>(null);
  const [finalAnalysisA, setFinalAnalysisA] = useState<BomAnalysis | null>(null);
  const [finalAnalysisB, setFinalAnalysisB] = useState<BomAnalysis | null>(null);
  const [comparison, setComparison] = useState<BomComparison | null>(null);
  const [reportOpen, setReportOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [progress, setProgress] = useState(8);
  const [progressIndex, setProgressIndex] = useState(0);
  const progressTimer = useRef<number | null>(null);

  useEffect(() => {
    return () => {
      if (progressTimer.current) window.clearInterval(progressTimer.current);
    };
  }, []);

  const summary = finalAnalysisA ?? (analysisA as BomAnalysis | null);

  async function runAnalysis() {
    const bomA = getPanelRows("A");
    const bomB = compareMode ? getPanelRows("B") : [];

    if (!bomA.length) {
      alert("Add or load a BOM into BOM A before analysis.");
      return;
    }

    if (compareMode && !bomB.length) {
      alert("Comparison mode is enabled. Add or load a BOM into BOM B before analysis.");
      return;
    }

    setLoading(true);
    setProgress(8);
    setProgressIndex(0);
    setAnalysisA(null);
    setAnalysisB(null);
    setFinalAnalysisA(null);
    setFinalAnalysisB(null);
    setComparison(null);
    startProgressLoop();

    try {
      const [primary, secondary] = await Promise.all([
        streamBomAnalysis(bomA, setAnalysisA),
        compareMode ? streamBomAnalysis(bomB, setAnalysisB) : Promise.resolve(null),
      ]);

      setFinalAnalysisA(primary);
      if (secondary) {
        setFinalAnalysisB(secondary);
        setComparison(compareBomAnalyses(primary, secondary));
      }
      setProgress(100);
    } finally {
      stopProgressLoop();
      window.setTimeout(() => setLoading(false), 250);
    }
  }

  async function streamBomAnalysis(
    items: BomInputItem[],
    setPartial: (value: Partial<BomAnalysis>) => void,
  ) {
    const response = await fetch("/api/analyze", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ items }),
    });

    if (!response.ok || !response.body) {
      throw new Error("Analysis request failed.");
    }

    let finalObject: BomAnalysis | null = null;
    await readNdjson<StreamEvent<BomAnalysis>>(response, (event) => {
      if (event.type === "partial") {
        setPartial(event.data);
        setProgress((current) => Math.min(92, current + 4));
      } else if (event.type === "done") {
        finalObject = event.data;
        setPartial(event.data);
      } else {
        throw new Error(event.error);
      }
    });

    if (!finalObject) throw new Error("No analysis returned.");
    return finalObject;
  }

  function startProgressLoop() {
    stopProgressLoop();
    progressTimer.current = window.setInterval(() => {
      setProgress((current) => Math.min(current + Math.random() * 8, 92));
      setProgressIndex((current) => (current + 1) % LOADING_MESSAGES.length);
    }, 900);
  }

  function stopProgressLoop() {
    if (progressTimer.current) {
      window.clearInterval(progressTimer.current);
      progressTimer.current = null;
    }
  }

  function getPanelRows(panel: PanelId) {
    const source = panels[panel];
    const rows =
      source.activeTab === "manual"
        ? source.manualRows
        : source.parsedRows.length
          ? source.parsedRows
          : source.manualRows;
    return rows.map(sanitizeBomItem).filter(rowHasMeaningfulData);
  }

  function updateTab(panel: PanelId, tab: InputTab) {
    setPanels((current) => ({ ...current, [panel]: { ...current[panel], activeTab: tab } }));
  }

  function updateManualRow(panel: PanelId, index: number, field: keyof BomInputItem, value: string) {
    setPanels((current) => {
      const rows = [...current[panel].manualRows];
      rows[index] = sanitizeBomItem({ ...rows[index], [field]: value });
      return { ...current, [panel]: { ...current[panel], manualRows: rows, activeTab: "manual" } };
    });
  }

  function addManualRow(panel: PanelId) {
    setPanels((current) => ({
      ...current,
      [panel]: {
        ...current[panel],
        activeTab: "manual",
        manualRows: [...current[panel].manualRows, createEmptyRows(1)[0]],
      },
    }));
  }

  function deleteManualRow(panel: PanelId, index: number) {
    setPanels((current) => {
      const rows = current[panel].manualRows.filter((_, rowIndex) => rowIndex !== index);
      return {
        ...current,
        [panel]: { ...current[panel], activeTab: "manual", manualRows: rows.length ? rows : createEmptyRows(1) },
      };
    });
  }

  function handleCsvFile(panel: PanelId, file: File) {
    Papa.parse<Record<string, string>>(file, {
      header: true,
      skipEmptyLines: true,
      complete: ({ data, meta }) => {
        const headers = meta.fields ?? Object.keys(data[0] ?? {});
        const mapping = Object.fromEntries(
          Object.entries(DEFAULT_MAPPING).map(([field, aliases]) => [
            field,
            headers.find((header) =>
              aliases.some((alias) => header.toLowerCase().includes(alias)),
            ) ?? "",
          ]),
        );

        setPanels((current) => ({
          ...current,
          [panel]: {
            ...current[panel],
            activeTab: "csv",
            csv: { headers, rawRows: data, mapping },
          },
        }));
      },
    });
  }

  function updateCsvMapping(panel: PanelId, field: string, value: string) {
    setPanels((current) => ({
      ...current,
      [panel]: {
        ...current[panel],
        csv: { ...current[panel].csv, mapping: { ...current[panel].csv.mapping, [field]: value } },
      },
    }));
  }

  function confirmCsvMapping(panel: PanelId) {
    setPanels((current) => {
      const csv = current[panel].csv;
        const parsedRows = csv.rawRows
          .map((row) =>
            sanitizeBomItem({
              partNumber: row[csv.mapping.partNumber],
              description: row[csv.mapping.description],
              quantity: Number(row[csv.mapping.quantity] ?? 1),
              unit: row[csv.mapping.unit],
              material: row[csv.mapping.material],
              notes: row[csv.mapping.notes],
            }),
          )
        .filter(rowHasMeaningfulData);

      return { ...current, [panel]: { ...current[panel], activeTab: "csv", parsedRows } };
    });
  }

  function updatePasteValue(panel: PanelId, value: string) {
    setPanels((current) => ({ ...current, [panel]: { ...current[panel], pasteValue: value, activeTab: "paste" } }));
  }

  function parsePastedTable(panel: PanelId) {
    const raw = panels[panel].pasteValue.trim();
    if (!raw) return;
    const lines = raw.split(/\r?\n/).filter(Boolean);
    const delimiter = lines.some((line) => line.includes("\t")) ? "\t" : ",";
    const rows = lines.map((line) => splitDelimited(line, delimiter));
    const headerLike = rows[0]?.some((cell) =>
      ["part", "description", "qty", "quantity", "unit", "material", "notes"].some((token) =>
        cell.toLowerCase().includes(token),
      ),
    );
    const body = headerLike ? rows.slice(1) : rows;
    const parsedRows = body
      .map((cells) =>
        sanitizeBomItem({
          partNumber: cells[0] ?? "",
          description: cells[1] ?? "",
          quantity: Number(cells[2] ?? 1),
          unit: cells[3] ?? "each",
          material: cells[4] ?? "Other",
          notes: cells[5] ?? "",
        }),
      )
      .filter(rowHasMeaningfulData);

    setPanels((current) => ({ ...current, [panel]: { ...current[panel], activeTab: "paste", parsedRows } }));
  }

  function clearAll() {
    setPanels({ A: createPanelState(), B: createPanelState() });
    setAnalysisA(null);
    setAnalysisB(null);
    setFinalAnalysisA(null);
    setFinalAnalysisB(null);
    setComparison(null);
    setLoading(false);
    setProgress(8);
  }

  function loadDemoBom() {
    setCompareMode(false);
    setPanels({
      A: { ...createPanelState(), activeTab: "manual", manualRows: DEMO_BOM, parsedRows: DEMO_BOM },
      B: createPanelState(),
    });
    window.setTimeout(() => void runAnalysis(), 0);
  }

  function exportEnhancedCsv() {
    if (!finalAnalysisA) return;
    const csv = Papa.unparse(
      finalAnalysisA.items.map((item) => ({
        "Part Number": item.partNumber ?? "",
        Description: item.description,
        Quantity: item.quantity,
        Unit: item.unit,
        Material: item.material,
        Notes: item.notes ?? "",
        EstimatedUnitCost: item.estimatedUnitCost,
        EstimatedTotalCost: item.estimatedTotalCost,
        CostConfidence: item.costConfidence,
        CommonSuppliers: item.commonSuppliers.join(" | "),
        LeadTimeEstimate: item.leadTimeEstimate,
        AINotes: item.notes ?? "",
      })),
    );

    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const href = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = href;
    anchor.download = "procureai-enhanced-bom.csv";
    anchor.click();
    URL.revokeObjectURL(href);
  }

  const riskCards = summary?.procurementRisks ?? [];
  const costDrivers = summary?.topCostDrivers ?? [];
  const alternatives = summary?.alternativeSuggestions ?? [];
  const breakdown = summary?.costBreakdownByCategory ?? [];

  return (
    <main className="relative flex-1 overflow-x-hidden">
      <div className="pointer-events-none absolute inset-0 dot-grid-bg opacity-35" />
      <BackgroundBeams className="opacity-45" />

      <FloatingNav
        navItems={[
          { name: "Input", link: "#bom-input" },
          { name: "Results", link: "#results" },
          { name: "Export", link: "#export" },
        ]}
        className="border-white/10 bg-[#101426]/80 text-white backdrop-blur-xl"
      />

      <section className="mx-auto flex w-full max-w-[1480px] flex-col gap-8 px-4 pb-16 pt-8 md:px-6 lg:px-8">
        <div className="panel-glass relative overflow-hidden rounded-[32px] border-white/10 p-6 md:p-8">
          <BorderBeam size={320} duration={18} colorFrom="#0066ff" colorTo="#20c997" />
          <div className="grid gap-8 lg:grid-cols-[1.08fr_0.92fr]">
            <div className="relative z-10 space-y-6">
              <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }}>
                <AnimatedGradientText className="mx-0 rounded-full bg-[#0b1020]/70 px-5 py-2 text-[#dce9ff]">
                  BOM cost intelligence for engineering teams
                </AnimatedGradientText>
              </motion.div>
              <div className="space-y-4">
                <motion.h1
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.6, delay: 0.1 }}
                  className="font-mono text-5xl font-semibold tracking-[-0.08em] text-white sm:text-6xl lg:text-7xl"
                >
                  ProcureAI
                </motion.h1>
                <motion.p
                  initial={{ opacity: 0, y: 16 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.6, delay: 0.2 }}
                  className="max-w-2xl text-base leading-7 text-slate-300 md:text-lg"
                >
                  Engineering teams spend weeks chasing supplier quotes before they know if a design
                  is even affordable. ProcureAI streams live cost intelligence across any Bill of
                  Materials with line-item pricing, lead times, and savings opportunities the moment
                  you paste your parts list. Stop guessing. Start building.
                </motion.p>
              </div>

              <motion.div
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5, delay: 0.3 }}
                className="flex flex-wrap gap-3"
              >
                {["CSV / Manual / Paste", "OpenAI gpt-4o", "Cost, Risk, Savings"].map((label) => (
                  <Badge
                    key={label}
                    className="rounded-full border border-white/12 bg-white/6 px-3 py-1.5 font-mono text-xs tracking-[0.18em] text-slate-200"
                  >
                    {label}
                  </Badge>
                ))}
              </motion.div>

              <motion.div
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5, delay: 0.4 }}
                className="flex flex-wrap gap-3"
              >
                <ShimmerButton
                  className="bg-[#0066ff] px-6 py-3 text-sm font-semibold text-white"
                  onClick={loadDemoBom}
                >
                  Load Demo BOM
                </ShimmerButton>
                <Button variant="secondary" className="bg-white/7 text-white" onClick={() => void runAnalysis()}>
                  Analyze BOM
                </Button>
                <Button variant="outline" className="border-white/12 bg-transparent text-white" onClick={clearAll}>
                  Clear Data
                </Button>
              </motion.div>

              <div className="grid gap-4 md:grid-cols-3">
                <TiltedCard>
                  <Card className="border-white/10 bg-white/5">
                    <CardContent className="p-4">
                      <div className="text-xs uppercase tracking-[0.26em] text-slate-400">Mode</div>
                      <div className="mt-2 font-mono text-xl text-white">AI stream</div>
                    </CardContent>
                  </Card>
                </TiltedCard>
                <TiltedCard>
                  <Card className="border-white/10 bg-white/5">
                    <CardContent className="p-4">
                      <div className="text-xs uppercase tracking-[0.26em] text-slate-400">Rows</div>
                      <div className="mt-2 font-mono text-xl text-white">Progressive</div>
                    </CardContent>
                  </Card>
                </TiltedCard>
                <TiltedCard>
                  <Card className="border-white/10 bg-white/5">
                    <CardContent className="p-4">
                      <div className="text-xs uppercase tracking-[0.26em] text-slate-400">Compare</div>
                      <div className="mt-2 font-mono text-xl text-white">Side-by-side</div>
                    </CardContent>
                  </Card>
                </TiltedCard>
              </div>
            </div>

            <div className="relative z-10">
              <FeaturedWithImageOnRight />
            </div>
          </div>
        </div>

        <section id="bom-input" className="space-y-6">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <h2 className="text-2xl font-semibold text-white">BOM Input Workspace</h2>
              <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-400">
                Import, type, or paste a BOM. Comparison mode unlocks a second parallel
                input board for revision-to-revision delta analysis.
              </p>
            </div>
            <Button
              variant={compareMode ? "default" : "secondary"}
              className={compareMode ? "bg-[#0066ff] text-white" : "bg-white/6 text-white"}
              onClick={() => setCompareMode((value) => !value)}
            >
              <ArrowRightLeft className="mr-2 h-4 w-4" />
              Compare Two BOMs
            </Button>
          </div>

          <div className={`grid gap-6 ${compareMode ? "xl:grid-cols-2" : "grid-cols-1"}`}>
            <InputPanel
              panel="A"
              title="Primary BOM"
              state={panels.A}
              onTabChange={updateTab}
              onManualChange={updateManualRow}
              onAddRow={addManualRow}
              onDeleteRow={deleteManualRow}
              onCsvFile={handleCsvFile}
              onConfirmCsvMapping={confirmCsvMapping}
              onCsvMappingChange={updateCsvMapping}
              onPasteValue={updatePasteValue}
              onParsePaste={parsePastedTable}
            />

            {compareMode ? (
              <InputPanel
                panel="B"
                title="Comparison BOM"
                state={panels.B}
                onTabChange={updateTab}
                onManualChange={updateManualRow}
                onAddRow={addManualRow}
                onDeleteRow={deleteManualRow}
                onCsvFile={handleCsvFile}
                onConfirmCsvMapping={confirmCsvMapping}
                onCsvMappingChange={updateCsvMapping}
                onPasteValue={updatePasteValue}
                onParsePaste={parsePastedTable}
              />
            ) : null}
          </div>
        </section>

        <AnimatePresence>
          {loading ? (
            <motion.div
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -12 }}
              className="panel-glass rounded-[28px] border-white/10 p-6"
            >
              <div className="flex items-start justify-between gap-4">
                <div>
                  <div className="flex items-center gap-3 text-white">
                    <LoaderCircle className="h-5 w-5 animate-spin text-[#8ebeff]" />
                    <h3 className="text-xl font-semibold">Streaming analysis in progress</h3>
                  </div>
                  <p className="mt-2 text-sm text-slate-400">{LOADING_MESSAGES[progressIndex]}</p>
                </div>
                <div className="rounded-full border border-white/10 bg-white/5 px-4 py-2 font-mono text-sm text-slate-100">
                  {Math.round(progress)}%
                </div>
              </div>
              <Progress value={progress} className="mt-5 h-3 bg-white/7" />
            </motion.div>
          ) : null}
        </AnimatePresence>

        {summary ? (
          <section id="results" className="space-y-6">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div>
                <h2 className="text-2xl font-semibold text-white">Streaming Analysis Results</h2>
                <p className="mt-2 text-sm text-slate-400">
                  Estimates are AI-generated approximations and should be verified
                  against live supplier quotes before purchasing.
                </p>
              </div>
              <div id="export" className="flex flex-wrap gap-3">
                <Button
                  variant="secondary"
                  className="bg-white/7 text-white"
                  onClick={exportEnhancedCsv}
                  disabled={!finalAnalysisA}
                >
                  <Download className="mr-2 h-4 w-4" />
                  Export Enhanced BOM as CSV
                </Button>
                <Button
                  className="bg-[#0066ff] text-white"
                  onClick={() => setReportOpen(true)}
                  disabled={!finalAnalysisA}
                >
                  <Printer className="mr-2 h-4 w-4" />
                  Generate Procurement Summary
                </Button>
              </div>
            </div>

            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
              <MetricCard label="Total Items" value={summary.items?.length ?? 0} />
              <MetricCard label="Estimated Cost" value={summary.totalEstimatedCost ?? 0} prefix="$" decimals={2} />
              <MetricCard label="Potential Savings" value={summary.totalPotentialSavings ?? 0} prefix="$" decimals={2} />
              <Card className="border-white/10 bg-white/5">
                <CardContent className="space-y-3 p-5">
                  <div className="text-xs uppercase tracking-[0.22em] text-slate-400">Confidence</div>
                  <div className="font-mono text-3xl font-semibold text-white">
                    {overallConfidence(summary.items ?? [])}
                  </div>
                </CardContent>
              </Card>
            </div>

            <div className="grid gap-6 xl:grid-cols-[1.35fr_0.65fr]">
              <Card className="overflow-hidden border-white/10 bg-white/4">
                <CardHeader className="space-y-2 pb-4">
                  <CardTitle className="text-white">Enhanced BOM Table</CardTitle>
                  <p className="text-sm leading-6 text-slate-400">
                    Dense streaming result board with sticky headers, confidence chips, and supplier badges.
                  </p>
                </CardHeader>
                <CardContent className="pt-0">
                  <ResultTable items={summary.items ?? []} />
                </CardContent>
              </Card>

              <Card className="border-white/10 bg-white/4">
                <CardHeader className="space-y-2">
                  <CardTitle className="text-white">Cost Breakdown by Category</CardTitle>
                  <p className="text-sm leading-6 text-slate-400">
                    Animated category split using Recharts for fast spend concentration review.
                  </p>
                </CardHeader>
                <CardContent className="space-y-6">
                  <div className="h-[300px]">
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie
                          data={breakdown}
                          dataKey="totalCost"
                          nameKey="category"
                          innerRadius={72}
                          outerRadius={108}
                          paddingAngle={3}
                          isAnimationActive
                        >
                          {breakdown.map((entry, index) => (
                            <Cell key={entry.category} fill={CHART_COLORS[index % CHART_COLORS.length]} />
                          ))}
                        </Pie>
                        <Tooltip formatter={(value) => formatCurrency(Number(value ?? 0))} />
                        <Legend />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                  <div className="space-y-3">
                    {breakdown.map((entry, index) => (
                      <div
                        key={entry.category}
                        className="flex items-center justify-between rounded-2xl border border-white/10 bg-white/5 px-4 py-3"
                      >
                        <div>
                          <div className="text-sm text-white">{entry.category}</div>
                          <div className="text-xs uppercase tracking-[0.2em] text-slate-500">
                            {entry.percentage.toFixed(1)}% of estimated spend
                          </div>
                        </div>
                        <div
                          className="mono-numeric text-sm font-semibold"
                          style={{ color: CHART_COLORS[index % CHART_COLORS.length] }}
                        >
                          {formatCurrency(entry.totalCost)}
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </div>

            <div className="grid gap-6 xl:grid-cols-[0.95fr_1.05fr]">
              <section className="space-y-4">
                <div>
                  <h3 className="text-xl font-semibold text-white">Top Cost Drivers</h3>
                  <p className="mt-2 text-sm text-slate-400">
                    Three highest-cost line items with pragmatic procurement savings tips.
                  </p>
                </div>
                <div className="grid gap-4">
                  {costDrivers.map((driver, index) => (
                    <BlurFade key={`${driver.partDescription}-${index}`} delay={index * 0.08}>
                      <Card className="border-white/10 bg-white/5">
                        <CardContent className="grid gap-4 p-5 md:grid-cols-[0.32fr_1fr]">
                          <div className="mono-numeric text-3xl font-semibold text-white">
                            {formatCurrency(driver.cost)}
                          </div>
                          <div className="space-y-2">
                            <div className="text-lg font-semibold text-white">{driver.partDescription}</div>
                            <p className="text-sm leading-6 text-slate-400">{driver.savingsTip}</p>
                          </div>
                        </CardContent>
                      </Card>
                    </BlurFade>
                  ))}
                </div>
              </section>

              <section className="space-y-4">
                <div>
                  <h3 className="text-xl font-semibold text-white">Smart Alternatives</h3>
                  <p className="mt-2 text-sm text-slate-400">
                    Suggested substitutions with estimated savings and primary tradeoffs.
                  </p>
                </div>
                <AlternativesTable items={alternatives} />
              </section>
            </div>

            <section className="space-y-4">
              <div>
                <h3 className="text-xl font-semibold text-white">Procurement Risks</h3>
                <p className="mt-2 text-sm text-slate-400">
                  Risk banners covering supply chain, lead time, and cost volatility concerns.
                </p>
              </div>
              <div className="grid gap-4 lg:grid-cols-3">
                {riskCards.map((risk) => (
                  <Card key={risk} className="border-white/10 bg-white/5">
                    <CardContent className="space-y-3 p-5">
                      <div className="flex items-center gap-2">
                        <ShieldAlert className={`h-4 w-4 ${riskSeverityColor(risk)}`} />
                        <span className={`text-xs uppercase tracking-[0.22em] ${riskSeverityColor(risk)}`}>
                          {riskSeverityLabel(risk)}
                        </span>
                      </div>
                      <p className="text-sm leading-6 text-slate-300">{risk}</p>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </section>

            {compareMode && finalAnalysisB && comparison ? (
              <section className="space-y-4">
                <div className="flex flex-wrap items-center justify-between gap-4">
                  <div>
                    <h3 className="text-xl font-semibold text-white">BOM Comparison Mode</h3>
                    <p className="mt-2 text-sm text-slate-400">
                      Side-by-side delta view with cost impact classification.
                    </p>
                  </div>
                  <Badge className="border-white/10 bg-white/6 px-3 py-1 text-slate-200">
                    Total delta {formatCurrency(comparison.totalCostDelta)}
                  </Badge>
                </div>
                <div className="grid gap-4 md:grid-cols-4">
                  <SummaryBlock label="Added" value={comparison.added} tone="text-rose-300" />
                  <SummaryBlock label="Removed" value={comparison.removed} tone="text-emerald-300" />
                  <SummaryBlock label="Changed" value={comparison.changed} tone="text-amber-300" />
                  <SummaryBlock label="Cost Delta" valueLabel={formatCurrency(comparison.totalCostDelta)} tone="text-[#8ebeff]" />
                </div>
                <ComparisonTable comparison={comparison} />
              </section>
            ) : null}

            <div className="rounded-2xl border border-amber-400/20 bg-amber-500/8 px-4 py-3 text-sm text-amber-100">
              Cost estimates are AI-generated approximations. Verify with actual supplier quotes before purchasing.
            </div>
          </section>
        ) : null}
      </section>

      <Dialog open={reportOpen} onOpenChange={setReportOpen}>
        <DialogContent className="max-h-[90vh] max-w-5xl overflow-hidden border-white/12 bg-[#101426] text-white">
          <DialogHeader>
            <DialogTitle>Procurement Summary</DialogTitle>
          </DialogHeader>
          <div>
            {finalAnalysisA ? (
              <ScrollArea className="h-[72vh] pr-4">
                <div className="space-y-6 p-1">
                  <div className="flex flex-wrap items-start justify-between gap-4 rounded-[24px] border border-white/10 bg-white/5 p-6">
                    <div>
                      <div className="text-xs uppercase tracking-[0.28em] text-slate-400">ProcureAI Report</div>
                      <h3 className="mt-3 font-mono text-3xl font-semibold">Engineering Procurement Summary</h3>
                      <p className="mt-3 text-sm text-slate-400">Generated {new Date().toLocaleString()}</p>
                    </div>
                    <Button className="bg-[#0066ff] text-white" onClick={() => window.print()}>
                      <Printer className="mr-2 h-4 w-4" />
                      Print
                    </Button>
                  </div>

                  <div className="grid gap-4 md:grid-cols-2">
                    <Card className="border-white/10 bg-white/5">
                      <CardContent className="space-y-3 p-5 text-sm text-slate-300">
                        <div>Total Items: {finalAnalysisA.items.length}</div>
                        <div>Estimated Cost: {formatCurrency(finalAnalysisA.totalEstimatedCost)}</div>
                        <div>Potential Savings: {formatCurrency(finalAnalysisA.totalPotentialSavings)}</div>
                        <div>Overall Confidence: {overallConfidence(finalAnalysisA.items)}</div>
                      </CardContent>
                    </Card>
                    <Card className="border-white/10 bg-white/5">
                      <CardContent className="space-y-3 p-5 text-sm text-slate-300">
                        {finalAnalysisA.procurementRisks.map((risk) => (
                          <div key={risk} className="flex gap-2">
                            <AlertTriangle className="mt-0.5 h-4 w-4 text-amber-300" />
                            <span>{risk}</span>
                          </div>
                        ))}
                      </CardContent>
                    </Card>
                  </div>
                </div>
              </ScrollArea>
            ) : null}
          </div>
        </DialogContent>
      </Dialog>
    </main>
  );
}

function InputPanel(props: {
  panel: PanelId;
  title: string;
  state: PanelState;
  onTabChange: (panel: PanelId, tab: InputTab) => void;
  onManualChange: (panel: PanelId, index: number, field: keyof BomInputItem, value: string) => void;
  onAddRow: (panel: PanelId) => void;
  onDeleteRow: (panel: PanelId, index: number) => void;
  onCsvFile: (panel: PanelId, file: File) => void;
  onConfirmCsvMapping: (panel: PanelId) => void;
  onCsvMappingChange: (panel: PanelId, field: string, value: string) => void;
  onPasteValue: (panel: PanelId, value: string) => void;
  onParsePaste: (panel: PanelId) => void;
}) {
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const previewRows = props.state.activeTab === "manual" ? props.state.manualRows : props.state.parsedRows;

  return (
    <Card className="overflow-hidden border-white/10 bg-white/4">
      <CardHeader className="space-y-3">
        <div className="flex items-center justify-between gap-3">
          <div>
            <div className="text-xs uppercase tracking-[0.22em] text-[#8ebeff]">
              {props.panel === "A" ? "Primary BOM" : "Comparison BOM"}
            </div>
            <CardTitle className="mt-2 text-white">{props.title}</CardTitle>
          </div>
          <Badge className="border-white/10 bg-white/6 text-slate-200">
            {previewRows.filter(rowHasMeaningfulData).length} rows
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-5">
        <Tabs value={props.state.activeTab} onValueChange={(value) => props.onTabChange(props.panel, value as InputTab)}>
          <TabsList className="grid w-full grid-cols-3 bg-white/6">
            <TabsTrigger value="csv">CSV Upload</TabsTrigger>
            <TabsTrigger value="manual">Manual Entry</TabsTrigger>
            <TabsTrigger value="paste">Paste Table</TabsTrigger>
          </TabsList>

          <TabsContent value="csv" className="mt-5 space-y-4">
            <div
              onDragOver={(event) => event.preventDefault()}
              onDrop={(event) => {
                event.preventDefault();
                const file = event.dataTransfer.files?.[0];
                if (file) props.onCsvFile(props.panel, file);
              }}
              className="relative overflow-hidden rounded-[24px] border border-dashed border-[#5f9dff]/45 bg-[linear-gradient(180deg,rgba(0,102,255,0.18),rgba(255,255,255,0.03))] p-6"
            >
              <BorderBeam size={260} duration={16} colorFrom="#0066ff" colorTo="#56c8ff" />
              <div className="relative z-10 flex flex-col items-center justify-center gap-3 text-center">
                <UploadCloud className="h-8 w-8 text-[#8ebeff]" />
                <div>
                  <div className="text-lg font-semibold text-white">Drop a BOM CSV here</div>
                  <p className="mt-2 text-sm text-slate-300">
                    PapaParse will preview the sheet and suggest column mappings automatically.
                  </p>
                </div>
                <Button variant="secondary" className="bg-white/8 text-white" onClick={() => fileInputRef.current?.click()}>
                  Choose CSV File
                </Button>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".csv,text/csv"
                  className="hidden"
                  onChange={(event) => {
                    const file = event.target.files?.[0];
                    if (file) props.onCsvFile(props.panel, file);
                  }}
                />
              </div>
            </div>

            {props.state.csv.headers.length ? (
              <Card className="border-white/10 bg-[#0f1322]">
                <CardContent className="space-y-4 p-5">
                  <div className="grid gap-4 md:grid-cols-2">
                    {Object.keys(DEFAULT_MAPPING).map((field) => (
                      <label key={field} className="grid gap-2 text-sm text-slate-300">
                        <span>{FIELD_LABELS[field as keyof BomInputItem]}</span>
                        <select
                          className="rounded-xl border border-white/12 bg-[#14192d] px-3 py-3 text-white"
                          value={props.state.csv.mapping[field] ?? ""}
                          onChange={(event) => props.onCsvMappingChange(props.panel, field, event.target.value)}
                        >
                          <option value="">Not mapped</option>
                          {props.state.csv.headers.map((header) => (
                            <option key={header} value={header}>
                              {header}
                            </option>
                          ))}
                        </select>
                      </label>
                    ))}
                  </div>
                  <Button className="bg-[#0066ff] text-white" onClick={() => props.onConfirmCsvMapping(props.panel)}>
                    Confirm Mapping
                  </Button>
                </CardContent>
              </Card>
            ) : null}
          </TabsContent>

          <TabsContent value="manual" className="mt-5 space-y-4">
            <div className="dense-table overflow-auto rounded-2xl border border-white/10">
              <div className="min-w-[960px]">
                <div className="grid grid-cols-[1fr_1.4fr_0.55fr_0.65fr_0.9fr_1.1fr_0.3fr] border-b border-white/10 bg-[#20243c]/95 px-4 py-3 text-[11px] uppercase tracking-[0.22em] text-slate-400">
                  <div>Part Number</div>
                  <div>Description</div>
                  <div>Qty</div>
                  <div>Unit</div>
                  <div>Material</div>
                  <div>Notes</div>
                  <div />
                </div>
                {props.state.manualRows.map((row, index) => (
                  <div
                    key={`${props.panel}-${index}`}
                    className={`grid grid-cols-[1fr_1.4fr_0.55fr_0.65fr_0.9fr_1.1fr_0.3fr] gap-3 px-4 py-3 ${index % 2 === 0 ? "bg-white/[0.03]" : ""}`}
                  >
                    <Input value={row.partNumber ?? ""} className="border-white/10 bg-[#101426] font-mono text-white" onChange={(event) => props.onManualChange(props.panel, index, "partNumber", event.target.value)} />
                    <Input value={row.description} className="border-white/10 bg-[#101426] text-white" onChange={(event) => props.onManualChange(props.panel, index, "description", event.target.value)} />
                    <Input value={String(row.quantity)} className="border-white/10 bg-[#101426] font-mono text-white" onChange={(event) => props.onManualChange(props.panel, index, "quantity", event.target.value)} />
                    <select className="rounded-xl border border-white/12 bg-[#101426] px-3 py-2 text-sm text-white" value={row.unit} onChange={(event) => props.onManualChange(props.panel, index, "unit", event.target.value)}>
                      {UNIT_OPTIONS.map((option) => <option key={option} value={option}>{option}</option>)}
                    </select>
                    <select className="rounded-xl border border-white/12 bg-[#101426] px-3 py-2 text-sm text-white" value={row.material} onChange={(event) => props.onManualChange(props.panel, index, "material", event.target.value)}>
                      {MATERIAL_OPTIONS.map((option) => <option key={option} value={option}>{option}</option>)}
                    </select>
                    <Input value={row.notes ?? ""} className="border-white/10 bg-[#101426] text-white" onChange={(event) => props.onManualChange(props.panel, index, "notes", event.target.value)} />
                    <Button variant="ghost" className="h-10 w-10 border border-rose-400/15 bg-rose-500/8 px-0 text-rose-200" onClick={() => props.onDeleteRow(props.panel, index)}>
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                ))}
              </div>
            </div>
            <Button variant="secondary" className="bg-white/7 text-white" onClick={() => props.onAddRow(props.panel)}>
              <Plus className="mr-2 h-4 w-4" />
              Add Row
            </Button>
          </TabsContent>

          <TabsContent value="paste" className="mt-5 space-y-4">
            <Textarea value={props.state.pasteValue} onChange={(event) => props.onPasteValue(props.panel, event.target.value)} className="min-h-[220px] border-white/10 bg-[#101426] text-white" placeholder="Part Number	Description	Quantity	Unit	Material	Notes" />
            <Button className="bg-[#0066ff] text-white" onClick={() => props.onParsePaste(props.panel)}>
              <ClipboardPaste className="mr-2 h-4 w-4" />
              Parse Pasted Table
            </Button>
          </TabsContent>
        </Tabs>

        {previewRows.filter(rowHasMeaningfulData).length ? (
          <>
            <Separator />
            <PreviewTable rows={previewRows.filter(rowHasMeaningfulData)} />
          </>
        ) : null}
      </CardContent>
    </Card>
  );
}

function ResultTable({ items }: { items: BomAnalysis["items"] }) {
  return (
    <div className="dense-table overflow-auto rounded-2xl border border-white/10">
      <div className="min-w-[1180px]">
        <div className="sticky top-0 z-20 grid grid-cols-[1.1fr_1.6fr_0.7fr_0.7fr_0.95fr_1.1fr_0.9fr_0.95fr_0.85fr_1fr_1fr_1.3fr] gap-0 border-b border-white/10 bg-[#20243c]/95 px-4 py-3 text-[11px] uppercase tracking-[0.22em] text-slate-400 backdrop-blur">
          {["Part Number", "Description", "Qty", "Unit", "Material", "Notes", "Unit Cost", "Total Cost", "Confidence", "Suppliers", "Lead Time", "AI Notes"].map((header) => (
            <div key={header}>{header}</div>
          ))}
        </div>
        {items.map((item, index) => (
          <motion.div
            key={`${item.partNumber}-${item.description}-${index}`}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.28, delay: index * 0.04 }}
            className={`grid grid-cols-[1.1fr_1.6fr_0.7fr_0.7fr_0.95fr_1.1fr_0.9fr_0.95fr_0.85fr_1fr_1fr_1.3fr] gap-0 px-4 py-3 text-sm ${index % 2 === 0 ? "bg-white/[0.03]" : "bg-transparent"}`}
          >
            <div className="mono-numeric text-slate-100">{item.partNumber ?? "—"}</div>
            <div className="text-slate-100">{item.description}</div>
            <div className="mono-numeric text-slate-200">{item.quantity}</div>
            <div className="text-slate-300">{item.unit}</div>
            <div className="text-slate-300">{item.material}</div>
            <div className="text-slate-400">{item.notes ?? "—"}</div>
            <div className="mono-numeric text-slate-100">{formatCurrency(item.estimatedUnitCost)}</div>
            <div className="mono-numeric text-slate-100">{formatCurrency(item.estimatedTotalCost)}</div>
            <div><Badge className={confidenceBadgeClass(item.costConfidence)}>{item.costConfidence}</Badge></div>
            <div className="flex flex-wrap gap-1.5">
              {item.commonSuppliers.map((supplier) => <Badge key={supplier} className="border-white/10 bg-white/6 text-[10px] text-slate-200">{supplier}</Badge>)}
            </div>
            <div className="text-slate-300">{item.leadTimeEstimate}</div>
            <div className="text-slate-400">{item.notes ?? "—"}</div>
          </motion.div>
        ))}
      </div>
    </div>
  );
}

function PreviewTable({ rows }: { rows: BomInputItem[] }) {
  return (
    <div className="space-y-3">
      <div className="text-sm font-medium text-white">Preview</div>
      <div className="dense-table overflow-auto rounded-2xl border border-white/10">
        <div className="min-w-[800px]">
          <div className="grid grid-cols-[1fr_1.5fr_0.55fr_0.6fr_0.9fr_1.15fr] border-b border-white/10 bg-[#20243c]/95 px-4 py-3 text-[11px] uppercase tracking-[0.22em] text-slate-400">
            <div>Part Number</div>
            <div>Description</div>
            <div>Qty</div>
            <div>Unit</div>
            <div>Material</div>
            <div>Notes</div>
          </div>
          {rows.map((row, index) => (
            <div key={`${row.partNumber}-${row.description}-${index}`} className={`grid grid-cols-[1fr_1.5fr_0.55fr_0.6fr_0.9fr_1.15fr] px-4 py-3 text-sm ${index % 2 === 0 ? "bg-white/[0.03]" : ""}`}>
              <div className="font-mono text-slate-100">{row.partNumber || "—"}</div>
              <div className="text-slate-100">{row.description}</div>
              <div className="font-mono text-slate-300">{row.quantity}</div>
              <div className="text-slate-300">{row.unit}</div>
              <div className="text-slate-300">{row.material}</div>
              <div className="text-slate-400">{row.notes || "—"}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function AlternativesTable({ items }: { items: BomAnalysis["alternativeSuggestions"] }) {
  return (
    <Card className="overflow-hidden border-white/10 bg-white/4">
      <CardContent className="dense-table overflow-auto p-0">
        <div className="min-w-[760px]">
          <div className="grid grid-cols-[1.3fr_1.2fr_0.8fr_1.1fr] border-b border-white/10 bg-[#20243c]/95 px-4 py-3 text-[11px] uppercase tracking-[0.22em] text-slate-400">
            <div>Original Item</div>
            <div>Alternative</div>
            <div>Savings</div>
            <div>Tradeoff</div>
          </div>
          {items.map((item, index) => (
            <div key={`${item.originalItem}-${index}`} className={`grid grid-cols-[1.3fr_1.2fr_0.8fr_1.1fr] px-4 py-4 text-sm ${index % 2 === 0 ? "bg-white/[0.03]" : ""}`}>
              <div className="text-slate-100">{item.originalItem}</div>
              <div className="text-slate-300">{item.alternativeItem}</div>
              <div className="mono-numeric text-emerald-300">{formatCurrency(item.estimatedSavings)}</div>
              <div className="text-slate-400">{item.tradeoff}</div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

function ComparisonTable({ comparison }: { comparison: BomComparison }) {
  return (
    <Card className="overflow-hidden border-white/10 bg-white/4">
      <CardContent className="dense-table overflow-auto p-0">
        <div className="min-w-[940px]">
          <div className="grid grid-cols-[0.7fr_1.2fr_1.6fr_0.8fr] border-b border-white/10 bg-[#20243c]/95 px-4 py-3 text-[11px] uppercase tracking-[0.22em] text-slate-400">
            <div>Type</div>
            <div>Item</div>
            <div>Change Details</div>
            <div>Cost Impact</div>
          </div>
          {comparison.deltas.map((delta, index) => (
            <div key={`${delta.type}-${delta.item}-${index}`} className={`grid grid-cols-[0.7fr_1.2fr_1.6fr_0.8fr] px-4 py-4 text-sm ${index % 2 === 0 ? "bg-white/[0.03]" : ""}`}>
              <div><Badge className={deltaTypeClass(delta.type)}>{delta.type}</Badge></div>
              <div className="text-slate-100">{delta.item}</div>
              <div className="text-slate-400">{delta.details}</div>
              <div className={`mono-numeric ${delta.costImpact <= 0 ? "text-emerald-300" : "text-rose-300"}`}>{formatCurrency(delta.costImpact)}</div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

function MetricCard(props: { label: string; value: number; prefix?: string; decimals?: number }) {
  return (
    <Card className="border-white/10 bg-white/5">
      <CardContent className="space-y-3 p-5">
        <div className="text-xs uppercase tracking-[0.22em] text-slate-400">{props.label}</div>
        <div className="font-mono text-3xl font-semibold text-white">
          {props.prefix}
          <NumberTicker value={props.value} decimalPlaces={props.decimals ?? 0} />
        </div>
      </CardContent>
    </Card>
  );
}

function SummaryBlock(props: { label: string; value?: number; valueLabel?: string; tone: string }) {
  return (
    <Card className="border-white/10 bg-white/5">
      <CardContent className="space-y-3 p-5">
        <div className="text-xs uppercase tracking-[0.22em] text-slate-400">{props.label}</div>
        <div className={`font-mono text-2xl font-semibold ${props.tone}`}>{props.valueLabel ?? props.value ?? 0}</div>
      </CardContent>
    </Card>
  );
}

function createPanelState(): PanelState {
  return {
    activeTab: "csv",
    manualRows: createEmptyRows(3),
    parsedRows: [],
    pasteValue: "",
    csv: { headers: [], rawRows: [], mapping: {} },
  };
}

function splitDelimited(line: string, delimiter: string) {
  const values: string[] = [];
  let current = "";
  let inQuotes = false;
  for (const char of line) {
    if (char === "\"") {
      inQuotes = !inQuotes;
      continue;
    }
    if (char === delimiter && !inQuotes) {
      values.push(current.trim());
      current = "";
      continue;
    }
    current += char;
  }
  values.push(current.trim());
  return values;
}

async function readNdjson<T>(response: Response, onEvent: (event: T) => void) {
  const reader = response.body?.getReader();
  if (!reader) return;
  const decoder = new TextDecoder();
  let buffer = "";
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    let newlineIndex = buffer.indexOf("\n");
    while (newlineIndex >= 0) {
      const line = buffer.slice(0, newlineIndex).trim();
      buffer = buffer.slice(newlineIndex + 1);
      if (line) onEvent(JSON.parse(line) as T);
      newlineIndex = buffer.indexOf("\n");
    }
  }
  const finalLine = buffer.trim();
  if (finalLine) onEvent(JSON.parse(finalLine) as T);
}

function formatCurrency(value?: number) {
  const amount = Number(value ?? 0);
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 2 }).format(amount);
}

function confidenceBadgeClass(confidence: string) {
  if (confidence === "High") return "border-emerald-400/20 bg-emerald-500/12 text-emerald-200";
  if (confidence === "Medium") return "border-amber-300/20 bg-amber-400/10 text-amber-100";
  return "border-rose-400/20 bg-rose-500/12 text-rose-200";
}

function riskSeverityColor(text: string) {
  const lower = text.toLowerCase();
  if (lower.includes("long-lead") || lower.includes("volatility") || lower.includes("low-confidence")) return "text-rose-300";
  if (lower.includes("inventory") || lower.includes("delay")) return "text-amber-300";
  return "text-emerald-300";
}

function riskSeverityLabel(text: string) {
  const lower = text.toLowerCase();
  if (lower.includes("long-lead") || lower.includes("volatility") || lower.includes("low-confidence")) return "High";
  if (lower.includes("inventory") || lower.includes("delay")) return "Medium";
  return "Low";
}

function deltaTypeClass(type: BomComparison["deltas"][number]["type"]) {
  if (type === "Added") return "border-rose-400/20 bg-rose-500/12 text-rose-200";
  if (type === "Removed") return "border-emerald-400/20 bg-emerald-500/12 text-emerald-200";
  return "border-amber-300/20 bg-amber-400/10 text-amber-100";
}
