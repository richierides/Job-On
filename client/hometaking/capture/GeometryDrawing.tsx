import React from "react";
import Svg, { Line, Polygon, Text as SvgText } from "react-native-svg";
import { Geometry } from "./schema";
import { extents, outline, featureFootprint } from "./geometry";
export function GeometryDrawing({
  geometry: g,
  overlay = false,
}: {
  geometry: Geometry;
  overlay?: boolean;
}) {
  const bounds = extents(g),
    width = Math.max(50, bounds.width),
    depth = Math.max(50, bounds.depth);
  const polygon = outline(g);
  return (
    <Svg
      width="100%"
      height={overlay ? "100%" : 260}
      viewBox={`${overlay ? 0 : -20} ${overlay ? 0 : -35} ${width + (overlay ? 0 : 40)} ${depth + (overlay ? 0 : 70)}`}
      pointerEvents="none"
    >
      {polygon && (
        <Polygon
          points={polygon.map((p) => `${p.x},${p.y}`).join(" ")}
          fill="#EAE5DB"
          stroke="none"
        />
      )}
      {g.walls.map((w, i) => (
        <React.Fragment key={w.id}>
          <Line
            x1={w.a.x}
            y1={w.a.y}
            x2={w.b.x}
            y2={w.b.y}
            stroke="#25251F"
            strokeWidth={3}
          />
          {!overlay && (
            <SvgText
              x={(w.a.x + w.b.x) / 2}
              y={(w.a.y + w.b.y) / 2 + 14}
              fontSize={12}
            >
              {i + 1}
            </SvgText>
          )}
        </React.Fragment>
      ))}
      {g.features.map((f) => {
        const points = featureFootprint(g, f);
        return points ? (
          <Polygon
            key={`footprint-${f.id}`}
            points={points.map((p) => `${p.x},${p.y}`).join(" ")}
            fill="#947132"
            fillOpacity={0.2}
          />
        ) : null;
      })}
      {g.features.map((f, i) => (
        <React.Fragment key={f.id}>
          <Line
            x1={f.a.x}
            y1={f.a.y}
            x2={f.b.x}
            y2={f.b.y}
            stroke={
              f.kind === "window"
                ? "#3693AD"
                : f.kind === "door" || f.kind === "opening"
                  ? "#D74A31"
                  : "#947132"
            }
            strokeWidth={7}
            strokeDasharray={f.kind === "ceiling-slope" ? "10 6" : undefined}
          />
          <SvgText
            x={(f.a.x + f.b.x) / 2}
            y={(f.a.y + f.b.y) / 2 + 20}
            fontSize={12}
          >
            {overlay ? f.kind : `${i + 1} ${f.kind}`}
          </SvgText>
        </React.Fragment>
      ))}
      {!overlay && (
        <SvgText x={width / 2} y={-15} fontSize={14} textAnchor="middle">
          TOP / NORTH
        </SvgText>
      )}
    </Svg>
  );
}
