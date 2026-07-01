import { createContext, useContext, useEffect, useState } from "react";

const CartCtx = createContext(null);
const KEY = "bxlrp_cart_v1";

export function CartProvider({ children }) {
  const [items, setItems] = useState(() => {
    try { return JSON.parse(localStorage.getItem(KEY) || "[]"); }
    catch { return []; }
  });

  useEffect(() => {
    localStorage.setItem(KEY, JSON.stringify(items));
  }, [items]);

  const add = (pkg) => {
    setItems((prev) => {
      const i = prev.findIndex((x) => x.id === pkg.id);
      if (i >= 0) {
        const copy = [...prev]; copy[i] = { ...copy[i], quantity: copy[i].quantity + 1 };
        return copy;
      }
      return [...prev, { id: pkg.id, name: pkg.name, price: pkg.price, currency: pkg.currency, quantity: 1 }];
    });
  };

  const remove = (id) => setItems((prev) => prev.filter((x) => x.id !== id));

  const setQty = (id, qty) => setItems((prev) => prev.map((x) => x.id === id ? { ...x, quantity: Math.max(1, Math.min(10, qty)) } : x));

  const clear = () => setItems([]);

  const total = items.reduce((s, x) => s + x.price * x.quantity, 0);
  const count = items.reduce((s, x) => s + x.quantity, 0);

  return (
    <CartCtx.Provider value={{ items, add, remove, setQty, clear, total, count }}>
      {children}
    </CartCtx.Provider>
  );
}

export const useCart = () => useContext(CartCtx);
