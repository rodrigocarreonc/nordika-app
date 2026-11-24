// TypeScript contracts aligned with the Nordika backend REST serializers.

export interface User {
  id: number;
  username: string;
  email: string;
  first_name?: string;
  last_name?: string;
  is_staff: boolean;
  date_joined?: string;
}

// Login and sign-up response: brings the token and profile in one trip to save a call to /me/.
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

export interface Category {
  id: number;
  name: string;
  description?: string;
  furniture_count?: number;
}

export interface Supplier {
  id: number;
  name: string;
  contact_name?: string;
  phone?: string;
  email?: string;
  created_at?: string;
  furniture_count?: number;
}

// On read it comes with nested category/supplier; on write category_id/supplier_id are used.
export interface Furniture {
  id: number;
  name: string;
  description: string;
  price: string | number;
  stock: number;
  image: string | null;
  category?: {
    id: number;
    name: string;
    description?: string;
  } | null;
  supplier?: {
    id: number;
    name: string;
    contact_name?: string;
    phone?: string;
    email?: string;
  };
  category_id?: number | null;
  supplier_id?: number;
  is_favorite?: boolean;
  favorites_count?: number;
  created_at: string;
  updated_at: string;
}

export interface Favorite {
  id: number;
  user: number;
  furniture: Furniture;
  added_at: string;
}

// Accounting record the backend creates only when a reservation becomes ACCEPTED.
export interface Sale {
  id: number;
  unit_price: string;
  total: string;
  sold_at: string;
}

export type ReservationStatus = "PENDING" | "ACCEPTED" | "REJECTED" | "CANCELLED";

// Temporary stock hold; exposes the customer's contact data so staff can reach them.
export interface Reservation {
  id: number;
  code: string;
  user: number;
  user_username: string;
  user_email?: string;
  user_full_name?: string;
  user_active?: boolean;
  furniture: Furniture;
  quantity: number;
  status: ReservationStatus;
  sale: Sale | null;
  expires_at: string;
  created_at: string;
  updated_at: string;
}

// Wrapper returned by ConfigurablePageNumberPagination to draw the page bar.
export interface PaginatedResponse<T> {
  count: number;
  total_pages: number;
  current_page: number;
  page_size: number;
  next: string | null;
  previous: string | null;
  results: T[];
}

// Query params accepted by GET /furniture/ (filters, search, ordering and page size).
export interface FurnitureFilterParams {
  page?: number;
  page_size?: number;
  search?: string;
  category?: number;
  supplier?: number;
  price_min?: number;
  price_max?: number;
  in_stock?: boolean;
  ordering?: string;
}
