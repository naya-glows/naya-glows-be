export type TrackingStageKey =
  | "PLACED"
  | "PROCESSING"
  | "DISPATCHED"
  | "OUT_FOR_DELIVERY"
  | "DELIVERED";

// Fixed day-offsets from payment confirmation — the "1 week span" the
// client asked for. No cron/background job needed: the current stage is
// just "which offset has elapsed," computed fresh on every read.
const STAGE_DEFS: { key: TrackingStageKey; label: string; dayOffset: number }[] = [
  { key: "PLACED", label: "Order Placed", dayOffset: 0 },
  { key: "PROCESSING", label: "Processing", dayOffset: 1 },
  { key: "DISPATCHED", label: "Dispatched", dayOffset: 3 },
  { key: "OUT_FOR_DELIVERY", label: "Out for Delivery", dayOffset: 6 },
  { key: "DELIVERED", label: "Delivered", dayOffset: 7 },
];

const DAY_MS = 24 * 60 * 60 * 1000;

export type TrackingInfo = {
  currentStage: TrackingStageKey | null;
  stages: { key: TrackingStageKey; label: string; date: string; reached: boolean }[];
  estimatedDelivery: string | null;
};

export function computeTracking(
  paidAt: Date | null,
  status: string,
  manualStage?: string | null,
): TrackingInfo {
  if (!paidAt || status !== "PAID") {
    return {
      currentStage: null,
      stages: STAGE_DEFS.map((s) => ({ ...s, date: "", reached: false })),
      estimatedDelivery: null,
    };
  }

  const estimatedDelivery = new Date(paidAt.getTime() + 7 * DAY_MS).toISOString();

  // Admin override: reached is by stage position, not elapsed time — lets
  // an admin correct the automatic simulation when reality doesn't match it.
  const manualIndex = manualStage ? STAGE_DEFS.findIndex((s) => s.key === manualStage) : -1;
  if (manualIndex >= 0) {
    const stages = STAGE_DEFS.map((s, i) => ({
      key: s.key,
      label: s.label,
      date: new Date(paidAt.getTime() + s.dayOffset * DAY_MS).toISOString(),
      reached: i <= manualIndex,
    }));
    return { currentStage: STAGE_DEFS[manualIndex].key, stages, estimatedDelivery };
  }

  const now = Date.now();
  const stages = STAGE_DEFS.map((s) => {
    const date = new Date(paidAt.getTime() + s.dayOffset * DAY_MS);
    return { key: s.key, label: s.label, date: date.toISOString(), reached: now >= date.getTime() };
  });

  const reachedStages = stages.filter((s) => s.reached);
  const currentStage = reachedStages.length > 0 ? reachedStages[reachedStages.length - 1].key : null;

  return { currentStage, stages, estimatedDelivery };
}

export const TRACKING_STAGE_KEYS = STAGE_DEFS.map((s) => s.key);

