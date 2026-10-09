const months = [
  "I",
  "II",
  "III",
  "IV",
  "V",
  "VI",
  "VII",
  "VIII",
  "IX",
  "X",
  "XI",
  "XII",
];

export function labelDate(date: string): string {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(date);
  if (!match || !months[Number(match[2]) - 1]) return date;
  return `${match[3]}-${months[Number(match[2]) - 1]}-${match[1]}`;
}
