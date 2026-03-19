export const SLOT_CUTOFF_HOURS: Record<string, number> = {
  breakfast: 10,
  lunch: 14,
  snack: 16,
  snacks: 16,
  dinner: 20,
};

export function isSlotPast(dateStr: string, slotKey: string, now?: Date): boolean {
  const ref = now ?? new Date();
  const today = `${ref.getFullYear()}-${String(ref.getMonth() + 1).padStart(2, "0")}-${String(ref.getDate()).padStart(2, "0")}`;

  if (dateStr < today) return true;
  if (dateStr > today) return false;

  const cutoff = SLOT_CUTOFF_HOURS[slotKey.toLowerCase()];
  if (cutoff === undefined) return false;

  const currentHour = ref.getHours() + ref.getMinutes() / 60;
  return currentHour >= cutoff;
}

export function isDayPast(dateStr: string, now?: Date): boolean {
  const ref = now ?? new Date();
  const today = `${ref.getFullYear()}-${String(ref.getMonth() + 1).padStart(2, "0")}-${String(ref.getDate()).padStart(2, "0")}`;
  return dateStr < today;
}

export function isTodayDateStr(dateStr: string, now?: Date): boolean {
  const ref = now ?? new Date();
  const today = `${ref.getFullYear()}-${String(ref.getMonth() + 1).padStart(2, "0")}-${String(ref.getDate()).padStart(2, "0")}`;
  return dateStr === today;
}
