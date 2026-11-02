export interface User {
  id: number;
  username: string;
  email: string;
  first_name?: string;
  last_name?: string;
  is_staff: boolean;
  date_joined?: string;
}

export interface AuthResponse {
  token: string;
  user_id: number;
  username: string;
  email: string;
  first_name?: string;
  last_name?: string;
  is_staff: boolean;
  detail?: string;
}

export interface Categoria {
  id: number;
  nombre: string;
  descripcion?: string;
  muebles_count?: number;
}

export interface Proveedor {
  id: number;
  nombre: string;
  contacto?: string;
  telefono?: string;
  email?: string;
  creado_en?: string;
  muebles_count?: number;
}

export interface Mueble {
  id: number;
  nombre: string;
  descripcion: string;
  precio: string | number;
  stock: number;
  imagen: string | null;
  categoria?: {
    id: number;
    nombre: string;
    descripcion?: string;
  } | null;
  proveedor?: {
    id: number;
    nombre: string;
    contacto?: string;
    telefono?: string;
    email?: string;
  };
  categoria_id?: number | null;
  proveedor_id?: number;
  is_favorito?: boolean;
  favoritos_count?: number;
  creado_en: string;
  actualizado_en: string;
}

export interface Favorito {
  id: number;
  usuario: number;
  mueble: Mueble;
  fecha_agregado: string;
}

export interface MovimientoInventario {
  id: number;
  mueble?: Mueble;
  mueble_id?: number;
  tipo_movimiento: 'ENTRADA' | 'SALIDA' | 'AJUSTE';
  cantidad: number;
  motivo: string;
  usuario?: number;
  usuario_username?: string;
  fecha_movimiento: string;
}

export interface PaginatedResponse<T> {
  count: number;
  total_pages: number;
  current_page: number;
  page_size: number;
  next: string | null;
  previous: string | null;
  results: T[];
}

export interface MuebleFilterParams {
  page?: number;
  page_size?: number;
  search?: string;
  categoria?: number;
  proveedor?: number;
  precio_min?: number;
  precio_max?: number;
  en_stock?: boolean;
  ordering?: string;
}
