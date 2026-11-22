import { useRouter } from "expo-router";

export type RouterInstance = ReturnType<typeof useRouter>;

/**
 * Safely navigates back if the navigation history permits,
 * otherwise falls back to the specified route (defaults to '/').
 * Fixes the GO_BACK navigation warning (Issue #30) across the app.
 */
export function safeBack(router: RouterInstance, fallback: string = "/") {
  if (router.canGoBack()) {
    router.back();
  } else {
    router.replace(fallback as any);
  }
}
