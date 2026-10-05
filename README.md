# Ruta Perú · Planificador de itinerarios

Página web para turistas que llegan al Perú. Eligen la ciudad (fase 1: **Lima**), la fecha y hora de llegada, el número de días y la hora de su vuelo de salida, y la página arma un itinerario día por día con:

- Horarios de cada actividad, respetando los días y horas de apertura (por ejemplo, museos cerrados los lunes).
- Almuerzo y cena en restaurantes cercanos según el presupuesto.
- Traslados estimados (a pie o en taxi/app) considerando el tráfico de Lima.
- Logística de llegada (migración, traslado, check-in) y de salida (recoger equipaje, salida al aeropuerto con 3 h de anticipación en vuelos internacionales y 2 h en nacionales).
- Preferencias: intereses, zona de hospedaje, ritmo y presupuesto.
- Precios en soles y en dólares (tipo de cambio editable).
- Gasto estimado por día y total, enlaces a Google Maps, impresión/PDF y versión en español e inglés.

## Panel de administración

Permite editar precios, horarios por día, duración, importancia, textos (español/inglés), ocultar lugares, y ajustes generales (tipo de cambio y tarifa de taxi).

- **Publicada en Claude:** el botón "Admin" solo aparece para el dueño o Editores; los cambios se guardan en la base de datos compartida y todos los visitantes los ven.
- **Como sitio estático:** abre `index.html#admin`. Los cambios se guardan solo en ese navegador (útil para probar); para cambios permanentes edita `js/data/lima.js`.

## Cómo usarla

No necesita instalación ni servidor: abre `index.html` en el navegador.
Para publicarla gratis puedes usar GitHub Pages (Settings → Pages → rama `main`, carpeta raíz).

## Estructura

```
index.html          Página y formulario
css/styles.css      Estilos (modo claro/oscuro, responsive, impresión)
js/i18n.js          Textos en español e inglés
js/data/lima.js     Atracciones, restaurantes, zonas y consejos de Lima
js/planner.js       Motor de reglas que arma el itinerario
js/store.js         Cambios del administrador (base compartida o localStorage)
js/admin.js         Panel de administración
js/app.js           Interfaz: formulario, render y eventos
```

## Agregar una nueva ciudad

1. Crea `js/data/<ciudad>.js` con la misma forma que `lima.js` (`zones`, `attractions`, `restaurants`, `tips`, `airport`).
2. Inclúyelo con un `<script>` en `index.html`.
3. Habilita la tarjeta de la ciudad en el paso 1 del formulario.

> Los horarios y precios son aproximados; conviene revisarlos periódicamente.
