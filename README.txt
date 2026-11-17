DYAMEDIX - TIENDA VIRTUAL (BASE INICIAL)
========================================

Este proyecto está preparado para Cloudflare Workers + D1 + R2.
Incluye catálogo público, carrito de cotización por WhatsApp y panel privado básico.

IMPORTANTE:
- No publiques ni compartas la contraseña del panel.
- Antes de usarlo en producción hay que crear los recursos D1 y R2 y configurar el secreto ADMIN_PASSWORD.
- Los números de WhatsApp están configurados en public/app.js. Se pueden cambiar allí.
- El logo se puede añadir después en public/logo.png.
- Los productos de demostración son ejemplos; reemplázalos por tu inventario real.

ESTRUCTURA:
- worker.js: API y autenticación del panel.
- public/: página web y panel.
- migrations/0001_init.sql: tablas de productos.
- wrangler.jsonc: configuración de Cloudflare.

SIGUIENTE PASO:
Primero descarga y descomprime este ZIP en tu tablet. Luego te guiaré para crear D1, R2 y publicar el proyecto desde Cloudflare.
