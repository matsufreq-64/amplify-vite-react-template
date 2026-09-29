// Never bypass the sign-in screen in a production build, including --mode ui-test.
export const isUiTestMode =
  import.meta.env.DEV && import.meta.env.MODE === "ui-test";
