// Central HTTP client: attaches the Token, handles 401/errors and groups every REST endpoint.

import { router } from "expo-router";
import {
  AuthResponse,
  Category,
  Furniture,
  FurnitureFilterParams,
  PaginatedResponse,
  Reservation,
  ReservationStatus,
  Supplier,
  User,
} from "../types";
import { deleteToken, getToken, saveToken, saveUser } from "./tokenStorage";

// Set at build time from EXPO_PUBLIC_API_URL (.env); trailing '/' is trimmed to avoid double slashes.
const API_URL = (process.env.EXPO_PUBLIC_API_URL ?? "").replace(/\/+$/, "");
if (!API_URL) throw new Error("Missing EXPO_PUBLIC_API_URL in .env");

// Spanish labels for API field names, used when an error message is tied to a field.
const FIELD_LABELS: Record<string, string> = {
  name: "Nombre",
  description: "Descripción",
  price: "Precio",
  stock: "Stock",
  image: "Imagen",
  category_id: "Categoría",
  supplier_id: "Proveedor",
  contact_name: "Contacto",
  phone: "Teléfono",
  email: "Correo",
  quantity: "Cantidad",
  furniture_id: "Mueble",
  username: "Usuario",
  password: "Contraseña",
  password_confirm: "Confirmar contraseña",
  first_name: "Nombre",
  last_name: "Apellido",
};

// Typed error that keeps the HTTP status and raw payload to decide actions by status (e.g. 409).
export class ApiError extends Error {
  status: number;
  data: any;

  constructor(message: string, status: number, data?: any) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.data = data;
  }
}

/**
 * Sends HTTP requests to the backend, injecting the Token and normalizing error messages.
 */
async function request<T>(
  endpoint: string,
  options: RequestInit = {},
): Promise<T> {
  const baseUrl = API_URL;
  const token = await getToken();

  const url = `${baseUrl}${endpoint.startsWith("/") ? endpoint : `/${endpoint}`}`;

  const headers: Record<string, string> = {
    Accept: "application/json",
    ...(options.headers as Record<string, string>),
  };

  // Content-Type is omitted for FormData so fetch generates the multipart boundary itself.
  if (!(options.body instanceof FormData) && !headers["Content-Type"]) {
    headers["Content-Type"] = "application/json";
  }

  if (token) {
    headers["Authorization"] = `Token ${token}`;
  }

  let response: Response;
  try {
    response = await fetch(url, {
      ...options,
      headers,
    });
  } catch (err: any) {
    throw new ApiError(
      `No se pudo conectar con el servidor en ${baseUrl}. Verifica tu conexión o EXPO_PUBLIC_API_URL en .env.`,
      0,
      err,
    );
  }

  if (response.status === 204) {
    return {} as T;
  }

  let responseData: any = null;
  const contentType = response.headers.get("content-type");
  if (contentType && contentType.includes("application/json")) {
    try {
      responseData = await response.json();
    } catch {
      responseData = null;
    }
  } else {
    responseData = await response.text();
  }

  if (!response.ok) {
    // On 401 (revoked or expired token) the local session is closed, except during login itself.
    if (response.status === 401 && !endpoint.includes("/api-token-auth/")) {
      await deleteToken();
      router.replace("/(auth)/login");
    }

    // Pulls a readable message out of DRF's error formats (detail, non_field_errors or per field).
    let errorMessage = `Error del servidor (${response.status})`;
    if (responseData) {
      if (typeof responseData === "string") {
        errorMessage = responseData;
      } else if (responseData.detail) {
        errorMessage = responseData.detail;
      } else if (responseData.non_field_errors) {
        errorMessage = Array.isArray(responseData.non_field_errors)
          ? responseData.non_field_errors.join(", ")
          : responseData.non_field_errors;
      } else {
        const firstKey = Object.keys(responseData)[0];
        if (firstKey) {
          const val = responseData[firstKey];
          const label = FIELD_LABELS[firstKey] ?? firstKey;
          errorMessage = `${label}: ${Array.isArray(val) ? val[0] : val}`;
        }
      }
    }
    throw new ApiError(errorMessage, response.status, responseData);
  }

  return responseData as T;
}

// ==========================================
// AUTHENTICATION SERVICES
// ==========================================

// Logs in and stores the token and profile to restore the session when the app reopens.
export async function apiLogin(
  username: string,
  password: string,
): Promise<AuthResponse> {
  const data = await request<AuthResponse>("/api-token-auth/", {
    method: "POST",
    body: JSON.stringify({ username, password }),
  });
  if (data.token) {
    await saveToken(data.token);
    await saveUser({
      id: data.user_id,
      username: data.username,
      email: data.email,
      first_name: data.first_name,
      last_name: data.last_name,
      is_staff: data.is_staff,
    });
  }
  return data;
}

export async function apiRegister(userData: {
  username: string;
  email: string;
  password: string;
  password_confirm?: string;
  first_name?: string;
  last_name?: string;
}): Promise<AuthResponse> {
  const data = await request<AuthResponse>("/api-register/", {
    method: "POST",
    body: JSON.stringify(userData),
  });
  if (data.token) {
    await saveToken(data.token);
    await saveUser({
      id: data.user_id,
      username: data.username,
      email: data.email,
      first_name: data.first_name,
      last_name: data.last_name,
      is_staff: data.is_staff,
    });
  }
  return data;
}

export async function apiGetMe(): Promise<User> {
  return await request<User>("/me/");
}

export async function apiUpdateMe(profileData: Partial<User>): Promise<User> {
  return await request<User>("/me/", {
    method: "PATCH",
    body: JSON.stringify(profileData),
  });
}

export async function apiChangePassword(
  current_password: string,
  new_password: string,
): Promise<void> {
  const data = await request<{ token: string }>("/change-password/", {
    method: "POST",
    body: JSON.stringify({ current_password, new_password }),
  });
  // The backend rotates the token: without saving it, the next request would get a 401
  await saveToken(data.token);
}

export async function apiDeleteAccount(password: string): Promise<void> {
  await request("/me/", {
    method: "DELETE",
    body: JSON.stringify({ password }),
  });
  await deleteToken();
}

export async function apiLogout(): Promise<void> {
  try {
    await request("/logout/", { method: "POST" });
  } catch {
    // If the backend call fails, the local token is cleared anyway
  } finally {
    await deleteToken();
  }
}

export async function apiCreateCustomer(data: {
  username: string;
  email: string;
  password: string;
  password_confirm?: string;
  first_name?: string;
  last_name?: string;
}): Promise<User> {
  return await request<User>("/users/create_customer/", {
    method: "POST",
    body: JSON.stringify(data),
  });
}

// ==========================================
// FURNITURE CATALOG (CRUD, FILTERS, FAVORITES)
// ==========================================

export async function apiGetFurnitureList(
  params: FurnitureFilterParams = {},
): Promise<PaginatedResponse<Furniture>> {
  const query = new URLSearchParams();

  if (params.page) query.append("page", params.page.toString());
  if (params.page_size) query.append("page_size", params.page_size.toString());
  if (params.search) query.append("search", params.search);
  if (params.category) query.append("category", params.category.toString());
  if (params.supplier) query.append("supplier", params.supplier.toString());
  if (params.price_min !== undefined)
    query.append("price_min", params.price_min.toString());
  if (params.price_max !== undefined)
    query.append("price_max", params.price_max.toString());
  if (params.in_stock !== undefined)
    query.append("in_stock", params.in_stock ? "true" : "false");
  if (params.ordering) query.append("ordering", params.ordering);

  const qs = query.toString();
  return await request<PaginatedResponse<Furniture>>(
    `/furniture/${qs ? `?${qs}` : ""}`,
  );
}

export async function apiGetFurniture(id: number): Promise<Furniture> {
  return await request<Furniture>(`/furniture/${id}/`);
}

// Accepts FormData when the form attaches an image, or plain JSON when there is no file.
export async function apiCreateFurniture(
  data: FormData | Record<string, any>,
): Promise<Furniture> {
  const isFormData =
    typeof FormData !== "undefined" && data instanceof FormData;
  return await request<Furniture>("/furniture/", {
    method: "POST",
    body: isFormData ? data : JSON.stringify(data),
  });
}

export async function apiUpdateFurniture(
  id: number,
  data: FormData | Record<string, any>,
): Promise<Furniture> {
  const isFormData =
    typeof FormData !== "undefined" && data instanceof FormData;
  return await request<Furniture>(`/furniture/${id}/`, {
    method: "PATCH",
    body: isFormData ? data : JSON.stringify(data),
  });
}

export async function apiDeleteFurniture(id: number): Promise<void> {
  await request(`/furniture/${id}/`, {
    method: "DELETE",
  });
}

export async function apiToggleFavorite(
  furnitureId: number,
): Promise<{ is_favorite: boolean; favorites_count: number; detail: string }> {
  return await request<{
    is_favorite: boolean;
    favorites_count: number;
    detail: string;
  }>(`/furniture/${furnitureId}/toggle_favorite/`, { method: "POST" });
}

export async function apiGetMyFavorites(
  params: { page?: number; page_size?: number } = {},
): Promise<PaginatedResponse<Furniture>> {
  const query = new URLSearchParams();
  if (params.page) query.append("page", params.page.toString());
  if (params.page_size) query.append("page_size", params.page_size.toString());
  const qs = query.toString();
  return await request<PaginatedResponse<Furniture>>(
    `/furniture/my_favorites/${qs ? `?${qs}` : ""}`,
  );
}

export async function apiGetFeatured(): Promise<Furniture[]> {
  return await request<Furniture[]>("/furniture/featured/");
}

// ==========================================
// RESERVATIONS
// ==========================================

export async function apiGetReservations(
  params: {
    page?: number;
    page_size?: number;
    status?: ReservationStatus;
    history?: boolean;
  } = {},
): Promise<PaginatedResponse<Reservation>> {
  const query = new URLSearchParams();
  if (params.page) query.append("page", params.page.toString());
  if (params.page_size) query.append("page_size", params.page_size.toString());
  if (params.status) query.append("status", params.status);
  if (params.history !== undefined)
    query.append("history", params.history.toString());
  const qs = query.toString();
  return await request<PaginatedResponse<Reservation>>(
    `/reservations/${qs ? `?${qs}` : ""}`,
  );
}

export async function apiCreateReservation(
  furnitureId: number,
  quantity: number,
): Promise<Reservation> {
  return await request<Reservation>("/reservations/", {
    method: "POST",
    body: JSON.stringify({ furniture_id: furnitureId, quantity }),
  });
}

export async function apiAcceptReservation(id: number): Promise<Reservation> {
  return await request<Reservation>(`/reservations/${id}/accept/`, {
    method: "POST",
  });
}

export async function apiRejectReservation(id: number): Promise<Reservation> {
  return await request<Reservation>(`/reservations/${id}/reject/`, {
    method: "POST",
  });
}

// ==========================================
// CATEGORIES AND SUPPLIERS (unpaginated: the backend returns the full list)
// ==========================================

export async function apiGetCategories(): Promise<Category[]> {
  return await request<Category[]>("/categories/");
}

export async function apiCreateCategory(data: {
  name: string;
  description?: string;
}): Promise<Category> {
  return await request<Category>("/categories/", {
    method: "POST",
    body: JSON.stringify(data),
  });
}

export async function apiUpdateCategory(
  id: number,
  data: Partial<{ name: string; description: string }>,
): Promise<Category> {
  return await request<Category>(`/categories/${id}/`, {
    method: "PATCH",
    body: JSON.stringify(data),
  });
}

export async function apiDeleteCategory(id: number): Promise<void> {
  await request(`/categories/${id}/`, {
    method: "DELETE",
  });
}

export async function apiGetSuppliers(): Promise<Supplier[]> {
  return await request<Supplier[]>("/suppliers/");
}

export async function apiCreateSupplier(data: {
  name: string;
  contact_name?: string;
  phone?: string;
  email?: string;
}): Promise<Supplier> {
  return await request<Supplier>("/suppliers/", {
    method: "POST",
    body: JSON.stringify(data),
  });
}

export async function apiUpdateSupplier(
  id: number,
  data: Partial<{
    name: string;
    contact_name: string;
    phone: string;
    email: string;
  }>,
): Promise<Supplier> {
  return await request<Supplier>(`/suppliers/${id}/`, {
    method: "PATCH",
    body: JSON.stringify(data),
  });
}

export async function apiDeleteSupplier(id: number): Promise<void> {
  await request(`/suppliers/${id}/`, {
    method: "DELETE",
  });
}

// ==========================================
// IMAGE URL HELPER
// ==========================================

// Turns relative paths (/media/...) into absolute URLs using API_URL so Image can load them.
export async function resolveImageUrl(
  imageUrl: string | null | undefined,
): Promise<string | null> {
  if (!imageUrl) return null;
  if (imageUrl.startsWith("http://") || imageUrl.startsWith("https://")) {
    return imageUrl;
  }
  const baseUrl = API_URL;
  return `${baseUrl}${imageUrl.startsWith("/") ? imageUrl : `/${imageUrl}`}`;
}
