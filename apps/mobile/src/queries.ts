import { useQuery } from "@tanstack/react-query";

import { apiRequest, type Product, type Service } from "./api";
import { useSession } from "./session";

// Keys shared by every screen, so a completed sale can invalidate stock everywhere at once.
export const keys = {
  products: ["products"] as const,
  services: ["services"] as const,
  dashboard: ["dashboard"] as const,
  summary: ["summary"] as const,
};

export function useProducts() {
  const session = useSession((state) => state.session);
  return useQuery({ queryKey: keys.products, queryFn: () => apiRequest<Product[]>(session, "/products") });
}

export function useServices() {
  const session = useSession((state) => state.session);
  return useQuery({ queryKey: keys.services, queryFn: () => apiRequest<Service[]>(session, "/services") });
}

export function isLowStock(product: Pick<Product, "stockOnHand" | "minimumStock">) {
  return product.stockOnHand <= product.minimumStock;
}
