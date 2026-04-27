"use client";

import { Badge } from "@/components/ui/badge";
import { BorderBeam } from "@/components/ui/border-beam";
import { Card, CardContent } from "@/components/ui/card";

export function FeaturedWithImageOnRight() {
  return (
    <Card className="relative overflow-hidden border-white/10 bg-white/4 backdrop-blur-sm">
      <BorderBeam colorFrom="#0066ff" colorTo="#20c997" size={280} duration={18} />
      <CardContent className="grid gap-6 p-6 md:grid-cols-[1.1fr_0.9fr] md:p-8">
        <div className="space-y-5">
          <Badge className="bg-[#0066ff]/15 text-[#8ebeff] hover:bg-[#0066ff]/20">
            Procurement Snapshot
          </Badge>
          <div className="space-y-3">
            <h3 className="font-mono text-2xl font-semibold tracking-tight text-white">
              Real-time BOM insight for prototype sourcing
            </h3>
            <p className="max-w-xl text-sm leading-6 text-slate-300">
              Upload engineering material lists, stream line-item pricing, and spot
              cost concentration before the purchasing rush starts.
            </p>
          </div>
          <div className="grid gap-3 text-sm text-slate-300 md:grid-cols-2">
            <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
              <div className="font-mono text-[#8ebeff]">Input fidelity</div>
              <div className="mt-2">CSV mapping, manual rows, and paste-from-sheet workflows.</div>
            </div>
            <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
              <div className="font-mono text-[#8ebeff]">Procurement output</div>
              <div className="mt-2">Suppliers, risks, alternatives, and one-page print export.</div>
            </div>
          </div>
        </div>
        <div className="relative overflow-hidden rounded-[28px] border border-white/10 bg-[linear-gradient(180deg,rgba(0,102,255,0.18),rgba(255,255,255,0.03))] p-5">
          <div className="grid gap-3 text-sm text-slate-100">
            <div className="rounded-2xl border border-white/10 bg-[#111528]/80 p-4">
              <div className="text-xs uppercase tracking-[0.28em] text-slate-400">Category Load</div>
              <div className="mt-2 font-mono text-xl">$1,964.40</div>
              <div className="mt-3 h-2 rounded-full bg-white/8">
                <div className="h-2 w-[64%] rounded-full bg-[#0066ff]" />
              </div>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="rounded-2xl border border-white/10 bg-white/6 p-4">
                <div className="text-xs uppercase tracking-[0.22em] text-slate-400">Lead Time</div>
                <div className="mt-2 font-mono text-lg">2-4 weeks</div>
              </div>
              <div className="rounded-2xl border border-white/10 bg-white/6 p-4">
                <div className="text-xs uppercase tracking-[0.22em] text-slate-400">Savings</div>
                <div className="mt-2 font-mono text-lg text-emerald-300">$214.60</div>
              </div>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
