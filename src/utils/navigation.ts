// Utilidad de navegación segura para evitar advertencias GO_BACK cuando no existe historial previo.

import { useRouter } from "expo-router";

export type RouterInstance = ReturnType<typeof useRouter>;

// Si el usuario entró directo por enlace o recarga en Web sin stack previo, redirige al fallback.
export function safeBack(router: RouterInstance, fallback: string = "/") {
  if (router.canGoBack()) {
    router.back();
  } else {
    router.replace(fallback as any);
  }
}
