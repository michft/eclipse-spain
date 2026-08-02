export const isPageHidden = (): boolean =>
  typeof document !== "undefined" && document.visibilityState === "hidden";

export const subscribeToPageVisibility = (
  listener: (hidden: boolean) => void,
): (() => void) => {
  if (typeof document === "undefined") {
    return () => undefined;
  }
  const handleChange = (): void => listener(isPageHidden());
  document.addEventListener("visibilitychange", handleChange);
  return () => document.removeEventListener("visibilitychange", handleChange);
};
