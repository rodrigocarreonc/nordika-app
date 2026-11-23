// Cliente SSE singleton para sincronización en tiempo real: usa EventSource en Web y XHR incremental en móvil.

import { Platform } from "react-native";
import { getToken } from "./tokenStorage";

export type RealtimeResource =
  "mueble" | "categoria" | "proveedor" | "apartado" | "favorito";

export type RealtimeAction = "created" | "updated" | "deleted";

export interface RealtimeEvent {
  resource: RealtimeResource;
  action: RealtimeAction;
  id: number | null;
  timestamp: string;
}

export type RealtimeListener = (event: RealtimeEvent) => void;

const VALID_RESOURCES = new Set<RealtimeResource>([
  "mueble",
  "categoria",
  "proveedor",
  "apartado",
  "favorito",
]);

const VALID_ACTIONS = new Set<RealtimeAction>([
  "created",
  "updated",
  "deleted",
]);

const INITIAL_RECONNECT_DELAY_MS = 1000;
const MAX_RECONNECT_DELAY_MS = 30000;

// Misma base que api.ts sin '/' final para construir `${API_URL}/events/`.
const API_URL = (process.env.EXPO_PUBLIC_API_URL ?? "").replace(/\/+$/, "");

// Estado singleton compartido por toda la aplicación para mantener una sola conexión SSE activa.
const listeners = new Set<RealtimeListener>();
let activeEventSource: EventSource | null = null;
let activeXhr: XMLHttpRequest | null = null;
let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
let reconnectAttempts = 0;
let isConnecting = false;
// Contador de generación: invalida callbacks rezagados tras desconectar o abrir una nueva conexión.
let connectionEpoch = 0;

function clearReconnectTimer(): void {
  if (reconnectTimer !== null) {
    clearTimeout(reconnectTimer);
    reconnectTimer = null;
  }
}

function closeActiveTransport(): void {
  if (activeEventSource) {
    try {
      activeEventSource.close();
    } catch {
      // Ignora errores al cerrar EventSource ya cerrado.
    }
    activeEventSource = null;
  }

  if (activeXhr) {
    const xhrToAbort = activeXhr;
    activeXhr = null;
    try {
      xhrToAbort.onprogress = null;
      xhrToAbort.onreadystatechange = null;
      xhrToAbort.onerror = null;
      xhrToAbort.ontimeout = null;
      xhrToAbort.abort();
    } catch {
      // Ignora errores si la petición ya concluyó.
    }
  }
}

function isValidRealtimeEvent(payload: unknown): payload is RealtimeEvent {
  if (!payload || typeof payload !== "object") return false;
  const candidate = payload as Record<string, unknown>;
  const validId = candidate.id === null || typeof candidate.id === "number";
  return (
    typeof candidate.resource === "string" &&
    VALID_RESOURCES.has(candidate.resource as RealtimeResource) &&
    typeof candidate.action === "string" &&
    VALID_ACTIONS.has(candidate.action as RealtimeAction) &&
    validId &&
    typeof candidate.timestamp === "string"
  );
}

function dispatchUpdatePayload(rawData: string): void {
  if (!rawData) return;
  let parsed: unknown;
  try {
    parsed = JSON.parse(rawData);
  } catch {
    return;
  }

  if (!isValidRealtimeEvent(parsed)) return;

  // Itera sobre una copia para tolerar bajas de suscriptores durante la notificación.
  for (const listener of Array.from(listeners)) {
    try {
      listener(parsed);
    } catch {
      // Un suscriptor con error no debe interrumpir al resto.
    }
  }
}

/**
 * Parsea un bloque SSE individual (delimitado por `\n\n`) y despacha `connected` o `update`.
 */
function processSseBlock(rawBlock: string): void {
  if (!rawBlock.trim()) return;

  let eventName = "message";
  const dataLines: string[] = [];

  for (const line of rawBlock.split("\n")) {
    // Las líneas que inician con ':' son comentarios/heartbeats SSE.
    if (!line || line.startsWith(":")) continue;

    if (line.startsWith("event:")) {
      eventName = line.slice(6).replace(/^ /, "").trim();
    } else if (line.startsWith("data:")) {
      dataLines.push(line.slice(5).replace(/^ /, ""));
    }
  }

  if (eventName === "connected") {
    reconnectAttempts = 0;
    return;
  }

  if (eventName === "update" && dataLines.length > 0) {
    dispatchUpdatePayload(dataLines.join("\n"));
  }
}

function scheduleReconnect(epoch: number): void {
  if (epoch !== connectionEpoch || listeners.size === 0) return;
  if (reconnectTimer !== null) return;

  const baseDelay = Math.min(
    INITIAL_RECONNECT_DELAY_MS * Math.pow(2, reconnectAttempts),
    MAX_RECONNECT_DELAY_MS,
  );
  // Pequeña variación aleatoria para evitar reconexiones simultáneas masivas tras reinicio del backend.
  const jitter = Math.floor(Math.random() * 250);
  reconnectAttempts += 1;

  reconnectTimer = setTimeout(() => {
    reconnectTimer = null;
    if (epoch !== connectionEpoch || listeners.size === 0) return;
    void openConnection();
  }, baseDelay + jitter);
}

function openWebEventSource(url: string, epoch: number): void {
  const es = new EventSource(url);
  activeEventSource = es;

  es.addEventListener("connected", () => {
    if (epoch !== connectionEpoch) return;
    reconnectAttempts = 0;
  });

  es.addEventListener("update", (event: MessageEvent) => {
    if (epoch !== connectionEpoch) return;
    if (typeof event.data === "string") {
      dispatchUpdatePayload(event.data);
    }
  });

  es.onerror = () => {
    if (epoch !== connectionEpoch) return;
    // Se cierra explícitamente para reintentar con backoff exponencial y releer el token vigente.
    closeActiveTransport();
    scheduleReconnect(epoch);
  };
}

function openNativeXhrStream(url: string, epoch: number): void {
  const xhr = new XMLHttpRequest();
  activeXhr = xhr;

  let lastProcessedIndex = 0;
  let buffer = "";
  let handledFailure = false;

  const handleFailure = (shouldRetry: boolean) => {
    if (handledFailure || epoch !== connectionEpoch) return;
    handledFailure = true;
    closeActiveTransport();
    if (shouldRetry) {
      scheduleReconnect(epoch);
    }
  };

  xhr.open("GET", url, true);
  xhr.setRequestHeader("Accept", "text/event-stream");
  xhr.setRequestHeader("Cache-Control", "no-cache");

  xhr.onprogress = () => {
    if (epoch !== connectionEpoch) {
      closeActiveTransport();
      return;
    }
    const text = xhr.responseText ?? "";
    if (text.length <= lastProcessedIndex) return;

    const chunk = text.slice(lastProcessedIndex);
    lastProcessedIndex = text.length;
    buffer += chunk.replace(/\r\n/g, "\n");

    let separatorIndex = buffer.indexOf("\n\n");
    while (separatorIndex !== -1) {
      const rawBlock = buffer.slice(0, separatorIndex);
      buffer = buffer.slice(separatorIndex + 2);
      processSseBlock(rawBlock);
      separatorIndex = buffer.indexOf("\n\n");
    }
  };

  xhr.onreadystatechange = () => {
    if (epoch !== connectionEpoch) return;

    if (xhr.readyState === XMLHttpRequest.HEADERS_RECEIVED) {
      if (xhr.status >= 200 && xhr.status < 300) {
        reconnectAttempts = 0;
      } else if (xhr.status === 401 || xhr.status === 403) {
        // Token inválido o expirado: detiene reintentos hasta iniciar nueva sesión.
        handleFailure(false);
      }
      return;
    }

    if (xhr.readyState === XMLHttpRequest.DONE) {
      const unauthorized = xhr.status === 401 || xhr.status === 403;
      handleFailure(!unauthorized);
    }
  };

  xhr.onerror = () => {
    handleFailure(true);
  };

  xhr.ontimeout = () => {
    handleFailure(true);
  };

  xhr.send();
}

async function openConnection(): Promise<void> {
  if (!API_URL || listeners.size === 0) return;
  if (activeEventSource || activeXhr || isConnecting) return;

  isConnecting = true;
  const epoch = ++connectionEpoch;

  let token: string | null = null;
  try {
    token = await getToken();
  } catch {
    token = null;
  } finally {
    if (epoch === connectionEpoch) {
      isConnecting = false;
    }
  }

  // Si mientras se leía el token se cerró sesión o se cancelaron los suscriptores, no abre conexión.
  if (epoch !== connectionEpoch || listeners.size === 0 || !token) {
    return;
  }

  const url = `${API_URL}/events/?token=${encodeURIComponent(token)}`;

  if (Platform.OS === "web" && typeof EventSource !== "undefined") {
    openWebEventSource(url, epoch);
  } else {
    openNativeXhrStream(url, epoch);
  }
}

/**
 * Suscribe un callback a los eventos SSE en tiempo real.
 * Abre la conexión al primer suscriptor y la cierra automáticamente cuando no quedan suscriptores.
 */
export function subscribeRealtime(listener: RealtimeListener): () => void {
  listeners.add(listener);

  if (!activeEventSource && !activeXhr && !isConnecting && !reconnectTimer) {
    void openConnection();
  }

  let unsubscribed = false;
  return () => {
    if (unsubscribed) return;
    unsubscribed = true;
    listeners.delete(listener);

    if (listeners.size === 0) {
      disconnectRealtime();
    }
  };
}

/**
 * Cierra la conexión SSE activa y cancela cualquier reconexión pendiente (p. ej. al cerrar sesión).
 */
export function disconnectRealtime(): void {
  connectionEpoch += 1;
  isConnecting = false;
  reconnectAttempts = 0;
  clearReconnectTimer();
  closeActiveTransport();
}
