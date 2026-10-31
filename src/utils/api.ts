import { AuthResponse, Categoria, Favorito, MovimientoInventario, Mueble, MuebleFilterParams, PaginatedResponse, Proveedor, User } from '../types';
import { getStoredApiUrl } from './settingsStorage';
import { deleteToken, getToken, saveToken, saveUser } from './tokenStorage';

export class ApiError extends Error {
  status: number;
  data: any;

  constructor(message: string, status: number, data?: any) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.data = data;
  }
}

/**
 * Realiza una petición HTTP genérica al backend con token de autenticación.
 */
async function request<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
  const baseUrl = await getStoredApiUrl();
  const token = await getToken();

  const url = `${baseUrl}${endpoint.startsWith('/') ? endpoint : `/${endpoint}`}`;

  const headers: Record<string, string> = {
    Accept: 'application/json',
    ...(options.headers as Record<string, string>),
  };

  // Solo agregar Content-Type: application/json si no es FormData (para subida de imágenes)
  if (!(options.body instanceof FormData) && !headers['Content-Type']) {
    headers['Content-Type'] = 'application/json';
  }

  if (token) {
    headers['Authorization'] = `Token ${token}`;
  }

  let response: Response;
  try {
    response = await fetch(url, {
      ...options,
      headers,
    });
  } catch (err: any) {
    throw new ApiError(
      `No se pudo conectar con el servidor en ${baseUrl}. Verifica tu conexión o cambia la URL en Ajustes.`,
      0,
      err
    );
  }

  if (response.status === 204) {
    return {} as T;
  }

  let responseData: any = null;
  const contentType = response.headers.get('content-type');
  if (contentType && contentType.includes('application/json')) {
    try {
      responseData = await response.json();
    } catch {
      responseData = null;
    }
  } else {
    responseData = await response.text();
  }

  if (!response.ok) {
    let errorMessage = `Error del servidor (${response.status})`;
    if (responseData) {
      if (typeof responseData === 'string') {
        errorMessage = responseData;
      } else if (responseData.detail) {
        errorMessage = responseData.detail;
      } else if (responseData.non_field_errors) {
        errorMessage = Array.isArray(responseData.non_field_errors)
          ? responseData.non_field_errors.join(', ')
          : responseData.non_field_errors;
      } else {
        // Concatenar primer mensaje de error encontrado en campos
        const firstKey = Object.keys(responseData)[0];
        if (firstKey) {
          const val = responseData[firstKey];
          errorMessage = `${firstKey}: ${Array.isArray(val) ? val[0] : val}`;
        }
      }
    }
    throw new ApiError(errorMessage, response.status, responseData);
  }

  return responseData as T;
}

// ==========================================
// SERVICIOS DE AUTENTICACIÓN
// ==========================================

export async function apiLogin(username: string, password: string): Promise<AuthResponse> {
  const data = await request<AuthResponse>('/api-token-auth/', {
    method: 'POST',
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
  const data = await request<AuthResponse>('/api-register/', {
    method: 'POST',
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
  return await request<User>('/me/');
}

export async function apiUpdateMe(profileData: Partial<User>): Promise<User> {
  return await request<User>('/me/', {
    method: 'PATCH',
    body: JSON.stringify(profileData),
  });
}

export async function apiLogout(): Promise<void> {
  try {
    await request('/logout/', { method: 'POST' });
  } catch (e) {
    // Si falla en backend, de todas formas limpiar token local
  } finally {
    await deleteToken();
  }
}

// ==========================================
// CATÁLOGO DE MUEBLES (CRUD, FILTROS, FAVORITOS)
// ==========================================

export async function apiGetMuebles(params: MuebleFilterParams = {}): Promise<PaginatedResponse<Mueble>> {
  const query = new URLSearchParams();

  if (params.page) query.append('page', params.page.toString());
  if (params.page_size) query.append('page_size', params.page_size.toString());
  if (params.search) query.append('search', params.search);
  if (params.categoria) query.append('categoria', params.categoria.toString());
  if (params.proveedor) query.append('proveedor', params.proveedor.toString());
  if (params.precio_min !== undefined) query.append('precio_min', params.precio_min.toString());
  if (params.precio_max !== undefined) query.append('precio_max', params.precio_max.toString());
  if (params.en_stock !== undefined) query.append('en_stock', params.en_stock ? 'true' : 'false');
  if (params.ordering) query.append('ordering', params.ordering);

  const qs = query.toString();
  return await request<PaginatedResponse<Mueble>>(`/muebles/${qs ? `?${qs}` : ''}`);
}

export async function apiGetMueble(id: number): Promise<Mueble> {
  return await request<Mueble>(`/muebles/${id}/`);
}

export async function apiCreateMueble(data: FormData | Record<string, any>): Promise<Mueble> {
  const isFormData = typeof FormData !== 'undefined' && data instanceof FormData;
  return await request<Mueble>('/muebles/', {
    method: 'POST',
    body: isFormData ? data : JSON.stringify(data),
  });
}

export async function apiUpdateMueble(id: number, data: FormData | Record<string, any>): Promise<Mueble> {
  const isFormData = typeof FormData !== 'undefined' && data instanceof FormData;
  return await request<Mueble>(`/muebles/${id}/`, {
    method: 'PATCH',
    body: isFormData ? data : JSON.stringify(data),
  });
}

export async function apiDeleteMueble(id: number): Promise<void> {
  await request(`/muebles/${id}/`, {
    method: 'DELETE',
  });
}

export async function apiToggleFavorito(muebleId: number): Promise<{ is_favorito: boolean; total_favoritos: number; detail: string }> {
  return await request<{ is_favorito: boolean; total_favoritos: number; detail: string }>(
    `/muebles/${muebleId}/toggle_favorito/`,
    { method: 'POST' }
  );
}

export async function apiGetMisFavoritos(params: { page?: number; page_size?: number } = {}): Promise<PaginatedResponse<Mueble>> {
  const query = new URLSearchParams();
  if (params.page) query.append('page', params.page.toString());
  if (params.page_size) query.append('page_size', params.page_size.toString());
  const qs = query.toString();
  return await request<PaginatedResponse<Mueble>>(`/muebles/mis_favoritos/${qs ? `?${qs}` : ''}`);
}

export async function apiGetDestacados(): Promise<Mueble[]> {
  return await request<Mueble[]>('/muebles/destacados/');
}

// ==========================================
// CATEGORÍAS Y PROVEEDORES
// ==========================================

export async function apiGetCategorias(): Promise<Categoria[]> {
  const res = await request<any>('/categorias/?page_size=100');
  return res.results || res;
}

export async function apiGetProveedores(): Promise<Proveedor[]> {
  const res = await request<any>('/proveedores/?page_size=100');
  return res.results || res;
}

// ==========================================
// INVENTARIO Y MOVIMIENTOS
// ==========================================

export async function apiGetMovimientos(page = 1, pageSize = 20): Promise<PaginatedResponse<MovimientoInventario>> {
  return await request<PaginatedResponse<MovimientoInventario>>(`/movimientos/?page=${page}&page_size=${pageSize}`);
}

export async function apiRegistrarMovimiento(
  muebleId: number,
  data: { tipo_movimiento: 'ENTRADA' | 'SALIDA' | 'AJUSTE'; cantidad: number; motivo: string }
): Promise<{ movimiento: MovimientoInventario; stock_actual: number; detail: string }> {
  return await request<{ movimiento: MovimientoInventario; stock_actual: number; detail: string }>(
    `/muebles/${muebleId}/registrar_movimiento/`,
    {
      method: 'POST',
      body: JSON.stringify(data),
    }
  );
}

// ==========================================
// HELPER PARA URLs DE IMÁGENES
// ==========================================

export async function resolveImageUrl(imageUrl: string | null | undefined): Promise<string | null> {
  if (!imageUrl) return null;
  if (imageUrl.startsWith('http://') || imageUrl.startsWith('https://')) {
    return imageUrl;
  }
  const baseUrl = await getStoredApiUrl();
  return `${baseUrl}${imageUrl.startsWith('/') ? imageUrl : `/${imageUrl}`}`;
}
