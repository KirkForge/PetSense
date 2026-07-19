/**
 * Multilateration — estimate 2D position from RSSI values at known node locations.
 *
 * Uses weighted centroid with RSSI-based weights (stronger signal = closer).
 * For production, swap to nonlinear least-squares (Gauss-Newton) or fingerprinting.
 */

export interface NodePosition {
  x: number;
  y: number;
}

export interface CSINodeReading {
  nodeId: string;
  rssi: number;
}

const DEFAULT_PATH_LOSS_EXPONENT = 2.5;
const DEFAULT_REF_RSSI = -40;
const DEFAULT_REF_DISTANCE = 1.0;

/**
 * Convert RSSI to approximate distance using log-distance path loss model.
 * d = d_ref * 10^((ref_rssi - rssi) / (10 * n))
 */
export function rssiToDistance(
  rssi: number,
  refRssi = DEFAULT_REF_RSSI,
  pathLossExponent = DEFAULT_PATH_LOSS_EXPONENT,
  refDistance = DEFAULT_REF_DISTANCE,
): number {
  return refDistance * Math.pow(10, (refRssi - rssi) / (10 * pathLossExponent));
}

/**
 * Estimate position via weighted centroid of node locations.
 * Weight = 1 / distance^2 (closer nodes have more influence).
 */
export function multilaterate(
  nodes: Array<CSINodeReading & NodePosition>,
  pathLossExponent = DEFAULT_PATH_LOSS_EXPONENT,
): { x: number; y: number } | null {
  if (nodes.length === 0) return null;
  if (nodes.length === 1) return { x: nodes[0].x, y: nodes[0].y };

  // Convert RSSI to distances
  const weighted = nodes.map(n => ({
    ...n,
    distance: rssiToDistance(n.rssi, DEFAULT_REF_RSSI, pathLossExponent),
  }));

  // Weighted centroid (inverse-distance-squared weighting)
  let sumWeight = 0;
  let sumX = 0;
  let sumY = 0;

  for (const n of weighted) {
    // Clamp minimum distance to avoid division by zero
    const d = Math.max(n.distance, 0.1);
    const w = 1 / (d * d);
    sumWeight += w;
    sumX += w * n.x;
    sumY += w * n.y;
  }

  if (sumWeight === 0) return null;

  return {
    x: sumX / sumWeight,
    y: sumY / sumWeight,
  };
}

/**
 * Multilaterate from aggregated frame + node positions config.
 * Returns estimated {x, y} or null if insufficient data.
 */
export function estimatePosition(
  rssiMap: Map<string, number>,
  nodePositions: Map<string, NodePosition>,
  pathLossExponent = DEFAULT_PATH_LOSS_EXPONENT,
): { x: number; y: number } | null {
  const nodes: Array<CSINodeReading & NodePosition> = [];

  for (const [nodeId, rssi] of rssiMap) {
    const pos = nodePositions.get(nodeId);
    if (pos) {
      nodes.push({ nodeId, rssi, x: pos.x, y: pos.y });
    }
  }

  return multilaterate(nodes, pathLossExponent);
}
