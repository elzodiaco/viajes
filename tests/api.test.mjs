import { test } from "node:test";
import assert from "node:assert/strict";
import { createHandler } from "../netlify/lib/api.mjs";

function memoryStore() {
  const data = new Map();
  return {
    async get(key) { return data.has(key) ? JSON.parse(data.get(key)) : null; },
    async setJSON(key, value) { data.set(key, JSON.stringify(value)); }
  };
}

function setup(password = "secreto-123") {
  const store = memoryStore();
  return createHandler(() => store, () => password);
}

const req = (path, opts = {}) => new Request("https://sitio.netlify.app" + path, opts);
const post = (path, body, pw) => req(path, {
  method: "POST",
  headers: pw ? { authorization: "Bearer " + pw } : {},
  body: body === undefined ? undefined : JSON.stringify(body)
});

test("GET devuelve la estructura vacía al inicio", async () => {
  const res = await setup()(req("/api/data"));
  assert.equal(res.status, 200);
  assert.deepEqual(await res.json(), { attractions: {}, restaurants: {}, tours: {}, settings: {} });
});

test("login rechaza la contraseña incorrecta y acepta la correcta", async () => {
  const h = setup();
  assert.equal((await h(post("/api/login", undefined, "otra"))).status, 401);
  assert.equal((await h(post("/api/login"))).status, 401);
  assert.equal((await h(post("/api/login", undefined, "secreto-123"))).status, 200);
});

test("guardar requiere contraseña y luego aparece en GET", async () => {
  const h = setup();
  const item = { name: { es: "Museo X" }, cost: 20, custom: true };
  assert.equal((await h(post("/api/data", { action: "save", kind: "attractions", id: "museo-x", data: item }))).status, 401);
  const ok = await h(post("/api/data", { action: "save", kind: "attractions", id: "museo-x", data: item }, "secreto-123"));
  assert.equal(ok.status, 200);
  const all = await (await h(req("/api/data"))).json();
  assert.deepEqual(all.attractions["museo-x"], item);
});

test("eliminar y ajustes", async () => {
  const h = setup();
  await h(post("/api/data", { action: "save", kind: "tours", id: "t1", data: { priceUsd: 10 } }, "secreto-123"));
  await h(post("/api/data", { action: "remove", kind: "tours", id: "t1" }, "secreto-123"));
  await h(post("/api/data", { action: "settings", data: { exchangeRate: 3.7 } }, "secreto-123"));
  const all = await (await h(req("/api/data"))).json();
  assert.deepEqual(all.tours, {});
  assert.equal(all.settings.exchangeRate, 3.7);
});

test("rechaza tipos e ids inválidos", async () => {
  const h = setup();
  const bad = [
    { action: "save", kind: "users", id: "x", data: {} },
    { action: "save", kind: "tours", id: "../x", data: {} },
    { action: "save", kind: "tours", id: "x", data: [1] },
    { action: "borrar-todo" }
  ];
  for (const body of bad) {
    assert.equal((await h(post("/api/data", body, "secreto-123"))).status, 400);
  }
});

test("sin ADMIN_PASSWORD configurada no deja escribir", async () => {
  const h = setup("");
  assert.equal((await h(post("/api/login", undefined, "algo"))).status, 503);
});
