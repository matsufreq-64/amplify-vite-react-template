export const errorText = (e: unknown) =>
  e instanceof Error ? e.message : "処理に失敗しました。再試行してください。";
