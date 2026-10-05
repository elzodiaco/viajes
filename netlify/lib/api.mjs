/*
 * API del panel de administración en Netlify.
 *
 *   GET  /api/data   → cambios del administrador (público, lo lee la página)
 *   POST /api/login  → comprueba la contraseña
 *   POST /api/data   → guarda un cambio (requiere contraseña)
 *
 * Todo se guarda en un solo documento JSON en Netlify Blobs. La contraseña
 * es la variable de entorno ADMIN_PASSWORD del sitio en Netlify.
 */
import { createHash, timingSafeEqual } from "node:crypto";

const KEY = "overrides";
const KINDS = ["attractions", "restaurants", "tours"];
const ID_RE = /^[a-z0-9][a-z0-9_-]{0,80}$/i;
const MAX_BODY = 200 * 1024;

function empty() {
  return { attractions: {}, restaurants: {}, tours: {}, settings: {} };
}

function json(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" }
  });
}

function sameSecret(a, b) {
  const ha = createHash("sha256").update(String(a)).digest();
  const hb = createHash("sha256").update(String(b)).digest();
  return timingSafeEqual(ha, hb);
}

function isPlainObject(v) {
  return v !== null && typeof v === "object" && !Array.isArray(v);
}

async function load(store) {
  const data = await store.get(KEY, { type: "json" });
  return Object.assign(empty(), isPlainObject(data) ? data : {});
}

export function createHandler(getStore, getPassword) {
  return async function handler(req) {
    const url = new URL(req.url);
    const isLogin = url.pathname.endsWith("/login");
    const store = getStore();

    if (req.method === "GET" && !isLogin) {
      return json(await load(store));
    }
    if (req.method !== "POST") {
      return json({ error: "method_not_allowed" }, 405);
    }

    const password = getPassword();
    if (!password) {
      return json({ error: "not_configured", message: "Falta la variable ADMIN_PASSWORD en Netlify." }, 503);
    }
    const auth = req.headers.get("authorization") || "";
    const given = auth.startsWith("Bearer ") ? auth.slice(7) : "";
    if (!given || !sameSecret(given, password)) {
      // Una pequeña espera frena los intentos de adivinar la contraseña.
      await new Promise((r) => setTimeout(r, 600));
      return json({ error: "unauthorized" }, 401);
    }
    if (isLogin) return json({ ok: true });

    const raw = await req.text();
    if (raw.length > MAX_BODY) return json({ error: "too_large" }, 413);
    let body;
    try { body = JSON.parse(raw); } catch { return json({ error: "bad_json" }, 400); }
    if (!isPlainObject(body)) return json({ error: "bad_request" }, 400);

    const state = await load(store);
    if (body.action === "settings") {
      if (!isPlainObject(body.data)) return json({ error: "bad_request" }, 400);
      state.settings = body.data;
    } else if (body.action === "save" || body.action === "remove") {
      if (!KINDS.includes(body.kind) || !ID_RE.test(body.id || "")) return json({ error: "bad_request" }, 400);
      if (body.action === "save") {
        if (!isPlainObject(body.data)) return json({ error: "bad_request" }, 400);
        state[body.kind][body.id] = body.data;
      } else {
        delete state[body.kind][body.id];
      }
    } else {
      return json({ error: "bad_request" }, 400);
    }
    await store.setJSON(KEY, state);
    return json(state);
  };
}
