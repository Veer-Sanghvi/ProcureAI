"use client";

import { useMemo, useState } from "react";
import { motion } from "framer-motion";
import { cn } from "@/lib/utils";

type TiltedCardProps = {
  className?: string;
  children: React.ReactNode;
  glare?: boolean;
};

export function TiltedCard({ className, children, glare = true }: TiltedCardProps) {
  const [rotation, setRotation] = useState({ x: 0, y: 0 });

  const glareStyle = useMemo(
    () => ({
      background: `radial-gradient(circle at ${50 + rotation.y * 6}% ${50 - rotation.x * 6}%, rgba(255,255,255,0.16), transparent 44%)`,
    }),
    [rotation],
  );

  return (
    <motion.div
      className={cn("relative transform-gpu [perspective:1200px]", className)}
      onMouseMove={(event) => {
        const rect = event.currentTarget.getBoundingClientRect();
        const offsetX = (event.clientX - rect.left) / rect.width - 0.5;
        const offsetY = (event.clientY - rect.top) / rect.height - 0.5;
        setRotation({ x: offsetY * -10, y: offsetX * 12 });
      }}
      onMouseLeave={() => setRotation({ x: 0, y: 0 })}
    >
      <motion.div
        animate={{ rotateX: rotation.x, rotateY: rotation.y }}
        transition={{ type: "spring", stiffness: 140, damping: 16, mass: 0.5 }}
        className="relative h-full w-full rounded-[28px]"
      >
        {glare ? (
          <div
            style={glareStyle}
            className="pointer-events-none absolute inset-0 rounded-[inherit]"
          />
        ) : null}
        {children}
      </motion.div>
    </motion.div>
  );
}
