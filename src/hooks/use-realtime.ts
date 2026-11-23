// Hook React para reaccionar a eventos SSE filtrados por recurso y agrupados con debounce.

import { useEffect, useRef } from "react";
import {
  RealtimeAction,
  RealtimeEvent,
  RealtimeResource,
  subscribeRealtime,
} from "../utils/realtime";

export type { RealtimeAction, RealtimeEvent, RealtimeResource };

export interface UseRealtimeOptions {
  enabled?: boolean;
  debounceMs?: number;
}

const DEFAULT_DEBOUNCE_MS = 250;

/**
 * Se suscribe al canal SSE compartido filtrando solo los recursos indicados.
 * Guarda el callback en una ref para evitar reconexiones al re-renderizar y aplica debounce ante ráfagas.
 */
export function useRealtimeEvents(
  resources: RealtimeResource[],
  onEvent: (ev: RealtimeEvent) => void,
  options?: UseRealtimeOptions,
): void {
  const enabled = options?.enabled ?? true;
  const debounceMs = options?.debounceMs ?? DEFAULT_DEBOUNCE_MS;

  const onEventRef = useRef(onEvent);
  useEffect(() => {
    onEventRef.current = onEvent;
  }, [onEvent]);

  // Se serializa la lista de recursos para tolerar arreglos literales inline sin reiniciar la suscripción.
  const resourcesKey = resources.join(",");
  const resourcesSetRef = useRef<Set<RealtimeResource>>(new Set(resources));
  useEffect(() => {
    resourcesSetRef.current = new Set(
      resourcesKey ? (resourcesKey.split(",") as RealtimeResource[]) : [],
    );
  }, [resourcesKey]);

  useEffect(() => {
    if (!enabled) return;

    let debounceTimer: ReturnType<typeof setTimeout> | null = null;
    let lastMatchedEvent: RealtimeEvent | null = null;

    const unsubscribe = subscribeRealtime((ev) => {
      if (!resourcesSetRef.current.has(ev.resource)) return;

      if (debounceMs <= 0) {
        onEventRef.current(ev);
        return;
      }

      lastMatchedEvent = ev;
      if (debounceTimer !== null) {
        clearTimeout(debounceTimer);
      }

      debounceTimer = setTimeout(() => {
        debounceTimer = null;
        const eventToEmit = lastMatchedEvent;
        lastMatchedEvent = null;
        if (eventToEmit) {
          onEventRef.current(eventToEmit);
        }
      }, debounceMs);
    });

    return () => {
      if (debounceTimer !== null) {
        clearTimeout(debounceTimer);
        debounceTimer = null;
      }
      lastMatchedEvent = null;
      unsubscribe();
    };
  }, [enabled, debounceMs]);
}
