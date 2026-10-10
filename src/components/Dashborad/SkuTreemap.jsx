import React from "react";
import { ResponsiveContainer, Tooltip, Treemap } from "recharts";
import { CURRENCY, formatCurrencyAED, formatNumber } from "@/utils/format";
import { compactAmount, fitLabel, tip, treemapPalette } from "./helpers";

// The SKU revenue map: one tile per item, its area the item's net revenue. Three things the chart used to get
// wrong, each visible on the screen:
//  - recharts also hands the ROOT node to `content`, with no fill; it was drawn as a black rectangle behind the
//    tiles (the dark specks at their rounded corners). Depth 0 draws nothing.
//  - the name was one unbroken line, cut by the next tile mid-word. It now wraps on words to the room the tile
//    has and ends in an ellipsis; the full name and the amount are in the tooltip.
//  - the text inherited the tiles' outline stroke (a halo round every letter) and was white on every fill,
//    including the light greys. Each fill has its own ink (`treemapPalette`) and the text is never stroked.

const PAD = 10;
const LINE = 15;

export function SkuTile({ x, y, width, height, depth, name, size, share, fill, textColour }) {
  const clipId = `sku${React.useId().replace(/[^a-zA-Z0-9]/g, "")}`;
  if (depth === 0 || !(width > 0) || !(height > 0)) return null;

  const radius = Math.max(2, Math.min(10, width / 4, height / 4));
  const inner = width - PAD * 2;
  const rows = Math.floor((height - PAD - 6) / LINE);
  const lines = rows > 0 ? fitLabel(name, inner, { fontSize: 12, maxLines: Math.min(3, rows) }) : [];
  const amountText = `${CURRENCY} ${compactAmount(size)}`;
  const showAmount = lines.length > 0 && rows > lines.length && fitLabel(amountText, inner, { fontSize: 11, maxLines: 1 })[0] === amountText;
  const pct = `${formatNumber((share || 0) * 100, 1)}%`;

  return (
    <g role="img" aria-label={`${name}: ${formatCurrencyAED(size)}, ${pct} of the items shown`}>
      <clipPath id={clipId}>
        <rect x={x} y={y} width={width} height={height} rx={radius} />
      </clipPath>
      <rect x={x} y={y} width={width} height={height} rx={radius} fill={fill} stroke="var(--card)" strokeWidth={3} />
      <g clipPath={`url(#${clipId})`} fill={textColour} stroke="none" strokeWidth={0} pointerEvents="none">
        {lines.map((line, i) => (
          <text key={i} x={x + PAD} y={y + PAD + 11 + i * LINE} fontSize={12} fontWeight={600}>
            {line}
          </text>
        ))}
        {showAmount && (
          <text x={x + PAD} y={y + PAD + 11 + lines.length * LINE + 2} fontSize={11} fontWeight={400}>
            {amountText}
          </text>
        )}
      </g>
    </g>
  );
}

function SkuTip({ active, payload }) {
  const node = active ? payload?.[0]?.payload : null;
  if (!node?.name) return null;
  return (
    <div style={{ ...tip, padding: "8px 12px", maxWidth: 260 }} className="text-sm">
      <p className="font-semibold">{node.name}</p>
      <p className="mt-0.5 text-muted-foreground">
        {formatCurrencyAED(node.size)} · {formatNumber((node.share || 0) * 100, 1)}% of the items shown
      </p>
    </div>
  );
}

export default function SkuTreemap({ rows, theme, height = 260 }) {
  const palette = treemapPalette(theme);
  const total = rows.reduce((t, r) => t + (Number(r.size) || 0), 0);
  const data = rows.map((r, i) => ({
    name: r.name,
    size: r.size,
    share: total ? r.size / total : 0,
    fill: palette[i % palette.length].fill,
    textColour: palette[i % palette.length].text,
  }));
  return (
    <ResponsiveContainer width="100%" height={height}>
      <Treemap data={data} dataKey="size" nameKey="name" aspectRatio={4 / 3} content={<SkuTile />}>
        <Tooltip content={<SkuTip />} />
      </Treemap>
    </ResponsiveContainer>
  );
}
