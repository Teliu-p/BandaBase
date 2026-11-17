# BandaBase — handoff operativo vigente

**Corte:** 2026-11-17 (Argentina).  
**Repositorio:** [Teliu-p/BandaBase](https://github.com/Teliu-p/BandaBase)  
**Rama integrada:** `main`  
**HEAD de `main` inspeccionado para este corte (antes de la PR documental #162):** `85a8a33042e0731dc1fc8eff0d85372090e021c2` — [commit](https://github.com/Teliu-p/BandaBase/commit/85a8a33042e0731dc1fc8eff0d85372090e021c2), 2026-11-12 20:48:43 UTC.  
**Aplicación:** https://teliu-p.github.io/BandaBase/  
**Supabase project ref:** `evuwcikuxptrgzdzejov`.

> Este archivo es un handoff breve, no una fuente independiente de verdad. En cada sesión se debe comprobar el SHA de main y actualizar esta fotografía cuando cambie el estado. La inspección de este documento no sustituye consultar GitHub ni Supabase.

## 1. Estado integrado reciente

| Cambio | Estado integrado | Evidencia / nota |
|---|---|---|
| PR [#157](https://github.com/Teliu-p/BandaBase/pull/157) — preparar audios completos para reproducción | Fusionada en main como `f32dce863d09b2b8a15598c7b67cf8a6838e4be7` | OPFS, preparación individual/grupal secuencial, playback con el reproductor habitual. CI aprobada. Prueba audible con pistas reales en PC/Android sigue pendiente. |
| PR [#159](https://github.com/Teliu-p/BandaBase/pull/159) — límite de Storage de proyecto | Fusionada en main como `7ccfb3b0e4bd7ebc629fa020cb3414d1b8b6e061` | Límite de 700.000.000 bytes, avisos 70/85 %, preflight y defensa PostgreSQL RLS restrictive. |
| PR [#161](https://github.com/Teliu-p/BandaBase/pull/161) — alinear versión de migración | Fusionada; su merge commit es el HEAD actual | El archivo SQL ahora coincide con el tracking remoto `20261112204157`. No vuelve a ejecutar SQL. |

**CI y publicación:** para el HEAD actual, los workflows finales de Tests y Pages terminaron exitosamente: [Tests](https://github.com/Teliu-p/BandaBase/actions/runs/43303988557) · [Pages build/deployment](https://github.com/Teliu-p/BandaBase/actions/runs/43303988828). Volver a verificar para cualquier commit posterior.

## 2. Estado de audio — distinciones importantes

- Audio adjunto a Materiales: biblioteca del equipo anfitrión, servidor Python local y Tailscale Funnel; clave DB `local:`. No se guarda en Supabase Storage y no debe agregarse un fallback de Storage.
- Audio de Comentarios/Propuestas y adjuntos no-audio de Materiales: continúan usando el bucket privado de Supabase `materials`.
- “Preparar para reproducir”: guarda una copia completa en OPFS del navegador. La preparación es local a la cuenta, navegador y dispositivo; no se comparte automáticamente con otros integrantes/dispositivos. Las pistas no preparadas siguen usando streaming.
- Servidor local: versión entregada al usuario v0.5 en `C:\\BandaBaseAudio\\bandabase_audio_server.py`; escucha en localhost:8788 y Funnel configurado con hostname `laptop-2pepu3jl.tail831d95.ts.net`. El deploy de Pages no actualiza el archivo Python. Confirmar la versión instalada en el equipo antes de diagnosticar su comportamiento.
- El host debe estar encendido y con conexión para streaming/descargas desde la biblioteca local. La copia OPFS ya preparada puede reproducirse desde el navegador/dispositivo que la preparó sin depender de la transmisión del host durante esa reproducción.

## 3. Supabase — último estado comprobado

**Última verificación selectiva:** 2026-11-12. No se realizó una auditoría completa de todo el esquema el 2026-11-17.

- Proyecto observado `ACTIVE_HEALTHY`, PostgreSQL 17.11.
- Migración de cuota aplicada y registrada como `20261112204157`; archivo esperado: `supabase/migrations/20261112204157_enforce_storage_quota.sql`.
- Cuota app: 700.000.000 bytes (700 MB decimales) en todos los buckets; warning 70 %, crítico 85 %. La protección cubre subidas autenticadas por los caminos de la app, no operaciones privilegiadas con `service_role`, Studio/Dashboard ni proyectos extra.
- La consulta de la RPC de estado se probó bajo rol `authenticated` y exige membresía activa. En la lectura realizada había un objeto y 0 bytes sumados en `storage.objects`; volver a consultar antes de usar ese número como estado presente.
- El bucket `materials` seguía privado y con máximo individual de 50 MiB.
- Antes de cualquier cambio de DB: consultar el estado real y el historial remoto. No ejecutar `supabase db push`, `migration repair` ni SQL histórico a ciegas.

## 4. Pendientes reales / validaciones no sustituidas por CI

1. Prueba física audible de preparación y reproducción en PC Windows y Android: una pista y un grupo de stems; preparar, reproducir, pausar/reanudar, saltar, marcadores, velocidad y metrónomo sincronizado/calibrado. Registrar navegador, dispositivo y red. No declarar esta validación hecha hasta que el usuario la confirme.
2. Probar desde otra PC o teléfono y desde otra red el acceso autenticado al servidor local/Funnel, según el flujo que se quiera validar. El servidor local y la caché OPFS son cosas distintas.
3. Antes de retomar la precarga temporal de grupos registrada en la sección histórica del 2026-11-09 de `docs/current-state.md`, inspeccionar el código y el estado de su rama/PR; no asumir que ese experimento separado se fusionó con la preparación OPFS.
4. Revisar las PR antiguas que el filtro de PR abiertas devolvió al auditar el repositorio: [#148](https://github.com/Teliu-p/BandaBase/pull/148), diagnóstico temporal de caret (la necesidad funcional se considera superada por #150), y [#98](https://github.com/Teliu-p/BandaBase/pull/98), borrador histórico de política UPDATE (supersedido por la consolidación y PR #149). No fusionar ninguna sin revisar su estado/diff actual; considerar cerrarlas tras confirmar que no se necesitan como archivo.

## 5. Reglas de continuidad

- Empezar cada sesión con `AI_CONTEXT.md` y `docs/ai-work-protocol.md`; seguir luego la lista de lectura indicada allí.
- No confiar en este corte cuando el SHA real de main sea posterior.
- Registrar cada petición estable, decisión aprobada, causa raíz, limitación de prueba o pendiente en el documento especializado correspondiente, no solo en el chat.
- Cerrar cada PR con código y documentación sincronizados; dejar explícito qué no pudo probarse.
