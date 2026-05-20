/**
 * Floor plan geometry — pure functions, zero dependencies.
 */

export interface Room {
  id: string;
  name: string;
  bounds: { x1: number; y1: number; x2: number; y2: number };
  color?: string;
}

export interface FloorPlan {
  rooms: Room[];
  width: number;
  height: number;
}

/**
 * Find which room contains the point (x, y), or null if none.
 */
export function roomAtPoint(rooms: Room[], x: number, y: number): Room | null {
  for (const room of rooms) {
    const { x1, y1, x2, y2 } = room.bounds;
    if (x >= x1 && x <= x2 && y >= y1 && y <= y2) return room;
  }
  return null;
}

/**
 * Compute the geometric center of a room's bounding box.
 */
export function getRoomCenter(room: Room): { x: number; y: number } {
  const { x1, y1, x2, y2 } = room.bounds;
  return { x: (x1 + x2) / 2, y: (y1 + y2) / 2 };
}

/**
 * Return a new FloorPlan with all coordinates multiplied by `scale`.
 */
export function scaleFloorPlan(plan: FloorPlan, scale: number): FloorPlan {
  return {
    rooms: plan.rooms.map((room) => ({
      ...room,
      bounds: {
        x1: room.bounds.x1 * scale,
        y1: room.bounds.y1 * scale,
        x2: room.bounds.x2 * scale,
        y2: room.bounds.y2 * scale,
      },
    })),
    width: plan.width * scale,
    height: plan.height * scale,
  };
}
