// Contratos TypeScript alineados con los serializers REST del backend de Nordika.

export interface User {
  id: number;
  username: string;
  email: string;
  first_name?: string;
  last_name?: string;
  is_staff: boolean;
  date_joined?: string;
}

// Respuesta de login y registro: trae el token y el perfil en un solo viaje para ahorrar /me/.
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

// Al leer llega con categoría/proveedor anidados; al escribir se usan categoria_id/proveedor_id.
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

// Registro contable generado por el backend solo cuando un apartado pasa a ACEPTADO.
export interface Venta {
  id: number;
  precio_unitario: string;
  total: string;
  fecha_venta: string;
}

// Reserva temporal de stock; expone datos de contacto del cliente para que el staff lo contacte.
export interface Apartado {
  id: number;
  codigo: string;
  usuario: number;
  usuario_username: string;
  usuario_email?: string;
  usuario_nombre?: string;
  usuario_activo?: boolean;
  mueble: Mueble;
  cantidad: number;
  estado: "PENDIENTE" | "ACEPTADO" | "RECHAZADO" | "CANCELADO";
  venta: Venta | null;
  expira_en: string;
  creado_en: string;
  actualizado_en: string;
}

// Envoltorio devuelto por ConfigurablePageNumberPagination para dibujar la barra de páginas.
export interface PaginatedResponse<T> {
  count: number;
  total_pages: number;
  current_page: number;
  page_size: number;
  next: string | null;
  previous: string | null;
  results: T[];
}

// Query params aceptados por GET /muebles/ (filtros, búsqueda, orden y tamaño de página).
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
