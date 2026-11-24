// Safe navigation helper that avoids GO_BACK warnings when there is no previous history.

import { useRouter } from "expo-router";

export type RouterInstance = ReturnType<typeof useRouter>;

// If the user came in through a link or a Web reload with no previous stack, redirects to the fallback.
export function safeBack(router: RouterInstance, fallback: string = "/") {
  if (router.canGoBack()) {
    router.back();
  } else {
    router.replace(fallback as any);
  }
}
