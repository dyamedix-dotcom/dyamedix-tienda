const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET,POST,PATCH,DELETE,OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization"
};

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json; charset=utf-8", ...corsHeaders }
  });
}

function b64url(bytes) {
  let binary = "";
  bytes.forEach(b => binary += String.fromCharCode(b));
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}
function fromB64url(s) {
  s = s.replace(/-/g, "+").replace(/_/g, "/");
  while (s.length % 4) s += "=";
  return Uint8Array.from(atob(s), c => c.charCodeAt(0));
}
async function sign(payload, secret) {
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const body = b64url(new TextEncoder().encode(JSON.stringify(payload)));
  const sig = new Uint8Array(await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(body)));
  return body + "." + b64url(sig);
}
async function verify(token, secret) {
  try {
    const [body, signature] = token.split(".");
    if (!body || !signature) return false;
    const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(secret),
      { name: "HMAC", hash: "SHA-256" }, false, ["verify"]);
    const ok = await crypto.subtle.verify("HMAC", key, fromB64url(signature), new TextEncoder().encode(body));
    if (!ok) return false;
    const payload = JSON.parse(new TextDecoder().decode(fromB64url(body)));
    return payload.exp > Math.floor(Date.now() / 1000);
  } catch { return false; }
}
async function authorized(request, env) {
  const h = request.headers.get("Authorization") || "";
  const token = h.startsWith("Bearer ") ? h.slice(7) : "";
  return !!(token && env.ADMIN_PASSWORD && await verify(token, env.ADMIN_PASSWORD));
}
function cleanProduct(p) {
  return {
    name: String(p.name || "").trim().slice(0, 120),
    category: String(p.category || "").trim().slice(0, 80),
    description: String(p.description || "").trim().slice(0, 1200),
    price_note: String(p.price_note || "").trim().slice(0, 120),
    image_key: String(p.image_key || "").trim().slice(0, 300),
    variants_json: JSON.stringify(Array.isArray(p.variants) ? p.variants.slice(0, 50) : []),
    active: p.active === false ? 0 : 1
  };
}
async function listProducts(env, admin = false) {
  const sql = admin
    ? "SELECT * FROM products ORDER BY created_at DESC"
    : "SELECT * FROM products WHERE active=1 ORDER BY category,name";
  const { results } = await env.DB.prepare(sql).all();
  return results.map(p => ({
    ...p,
    variants: (() => { try { return JSON.parse(p.variants_json || "[]"); } catch { return []; } })(),
    image_url: p.image_key ? `/media/${encodeURIComponent(p.image_key)}` : ""
  }));
}

export default {
  async fetch(request, env) {
    if (request.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
    const url = new URL(request.url);
    try {
      if (url.pathname === "/api/login" && request.method === "POST") {
        const body = await request.json();
        if (!env.ADMIN_PASSWORD) return json({ error: "Falta configurar ADMIN_PASSWORD en Cloudflare." }, 500);
        if (String(body.password || "") !== env.ADMIN_PASSWORD) return json({ error: "Contraseña incorrecta." }, 401);
        const token = await sign({ exp: Math.floor(Date.now()/1000) + 60*60*8 }, env.ADMIN_PASSWORD);
        return json({ token });
      }
      if (url.pathname === "/api/products" && request.method === "GET") {
        const admin = await authorized(request, env);
        return json(await listProducts(env, admin));
      }
      if (url.pathname.startsWith("/api/") && !(await authorized(request, env))) {
        return json({ error: "Debes iniciar sesión." }, 401);
      }
      if (url.pathname === "/api/products" && request.method === "POST") {
        const p = cleanProduct(await request.json());
        if (!p.name) return json({ error: "Escribe el nombre del producto." }, 400);
        const result = await env.DB.prepare(
          "INSERT INTO products (name,category,description,price_note,image_key,variants_json,active) VALUES (?,?,?,?,?,?,?)"
        ).bind(p.name,p.category,p.description,p.price_note,p.image_key,p.variants_json,p.active).run();
        return json({ id: result.meta.last_row_id, ok: true }, 201);
      }
      const match = url.pathname.match(/^\/api\/products\/(\d+)$/);
      if (match && request.method === "PATCH") {
        const p = cleanProduct(await request.json());
        await env.DB.prepare(
          "UPDATE products SET name=?,category=?,description=?,price_note=?,image_key=?,variants_json=?,active=?,updated_at=CURRENT_TIMESTAMP WHERE id=?"
        ).bind(p.name,p.category,p.description,p.price_note,p.image_key,p.variants_json,p.active,Number(match[1])).run();
        return json({ ok: true });
      }
      if (match && request.method === "DELETE") {
        await env.DB.prepare("DELETE FROM products WHERE id=?").bind(Number(match[1])).run();
        return json({ ok: true });
      }
      if (url.pathname === "/api/upload" && request.method === "POST") {
        const form = await request.formData();
        const file = form.get("file");
        if (!file || typeof file === "string") return json({ error: "Selecciona una imagen." }, 400);
        if (!file.type.startsWith("image/")) return json({ error: "Solo se permiten imágenes." }, 400);
        if (file.size > 5 * 1024 * 1024) return json({ error: "La imagen debe pesar menos de 5 MB." }, 400);
        const ext = (file.name.split(".").pop() || "jpg").toLowerCase().replace(/[^a-z0-9]/g,"") || "jpg";
        const key = `${crypto.randomUUID()}.${ext}`;
        await env.IMAGES.put(key, file.stream(), { httpMetadata: { contentType: file.type } });
        return json({ key });
      }
      if (url.pathname.startsWith("/media/") && request.method === "GET") {
        const key = decodeURIComponent(url.pathname.slice(7));
        const object = await env.IMAGES.get(key);
        if (!object) return new Response("No encontrada", { status: 404 });
        const headers = new Headers();
        object.writeHttpMetadata(headers);
        headers.set("etag", object.httpEtag);
        headers.set("Cache-Control", "public, max-age=86400");
        return new Response(object.body, { headers });
      }
      return env.ASSETS.fetch(request);
    } catch (e) {
      return json({ error: "Ocurrió un error. Revisa la configuración de la tienda." }, 500);
    }
  }
};
