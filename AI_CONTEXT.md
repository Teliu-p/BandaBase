# BandaBase — punto de entrada para asistentes de IA

**Última actualización del contexto:** 2026-11-17 (Argentina).  
**Repositorio canónico:** https://github.com/Teliu-p/BandaBase  
**Rama integrada de referencia al actualizar este índice:** `main`  
**Último HEAD de `main` leído antes de esta actualización documental:** `85a8a33042e0731dc1fc8eff0d85372090e021c2`  
**Aplicación:** https://teliu-p.github.io/BandaBase/

## Regla principal

**No dependas del historial de ChatGPT ni de la memoria del modelo para conocer BandaBase.** El conocimiento persistente está versionado en GitHub. En toda sesión de trabajo sobre el proyecto, consulta el estado remoto actual y lee el protocolo/documentos siguientes antes de diagnosticar, recomendar o modificar. Si lo que recuerdas de una conversación contradice el repositorio actual, no lo asumas: verifica y documenta la resolución.

## Lectura obligatoria al iniciar una sesión

1. `AGENTS.md` — instrucciones del repositorio.
2. `docs/ai-work-protocol.md` — procedimiento obligatorio de continuidad, evidencia, cambios y cierre.
3. Este archivo — índice y orientación de alto nivel.
4. `docs/active-work.md` — handoff operativo y pendientes conocidos (comprobar siempre su fecha/SHA).
5. `docs/current-state.md` — fotografía técnica vigente al inicio y registro histórico.
6. `docs/architecture-map.md` — módulos, flujos, dependencias y persistencia.
7. `docs/product-spec.md` — comportamiento acordado con el usuario.
8. `docs/decisions-and-incidents.md` — decisiones, incidentes y regresiones anteriores; leer las secciones pertinentes y las más recientes.
9. Informes especializados enlazados desde esos documentos cuando el área afectada los requiera (por ejemplo, auditoría de migraciones).

## Qué fuente usar

- Código en el SHA actual: qué está implementado.
- Servicios remotos y despliegue consultados: qué está aplicado/publicado.
- `product-spec.md`: qué comportamiento se acordó.
- `current-state.md` y `active-work.md`: fotografía fechada, que debe refrescarse.
- `decisions-and-incidents.md`: memoria histórica; una entrada antigua no prevalece sobre una verificación posterior.
- Chat/memoria del asistente: contexto volátil, nunca registro maestro.

La jerarquía y el proceso exacto están en `docs/ai-work-protocol.md`.

## Foto de alto nivel comprobada al 2026-11-17

- `main`: `85a8a33042e0731dc1fc8eff0d85372090e021c2`.
- PR #157: preparar audios completos en OPFS por usuario/navegador/dispositivo, integrada.
- PR #159: cuota de Storage de 700.000.000 bytes, integrada.
- PR #161: alinear el nombre de migración con la versión remota, integrada.
- La migración de cuota quedó registrada en Supabase como `20261112204157`.
- Tests y Pages del HEAD actual terminaron exitosamente: [Tests](https://github.com/Teliu-p/BandaBase/actions/runs/43303988557) · [Pages](https://github.com/Teliu-p/BandaBase/actions/runs/43303988828).
- Sigue pendiente la prueba audible en dispositivos físicos con audios reales y el flujo completo de grupos/marcadores/velocidad/metrónomo. La CI no la sustituye.
- Supabase project ref: `evuwcikuxptrgzdzejov`. No exponer secretos ni claves privadas en documentos.

## Archivos especializados

| Archivo | Autoridad / propósito |
|---|---|
| `docs/active-work.md` | Handoff corto: HEAD, integraciones recientes, pendientes y puntos que requieren verificación. |
| `docs/current-state.md` | Evidencia técnica, despliegue, estado remoto y cronología de auditorías. La cabecera es la foto vigente; entradas fechadas inferiores son históricas. |
| `docs/architecture-map.md` | Arquitectura real, orden de carga, módulos, tablas, RPC, Storage y flujos de audio. |
| `docs/product-spec.md` | Requisitos y decisiones funcionales aprobadas. |
| `docs/decisions-and-incidents.md` | Por qué se tomaron decisiones, incidentes y pruebas que evitan repetir regresiones. |
| `docs/ai-work-protocol.md` | Obligaciones de lectura, inspección, implementación, pruebas y handoff. |
| `docs/archive/ai-context-pre-2026-11-17.md` | Copia histórica de la antigua puerta de entrada; no usar como estado vigente. |

## Límites de la documentación

Una fotografía nunca sustituye una consulta actual a GitHub, Supabase, Actions, Pages o al servidor/dispositivo real. Las comprobaciones remotas tienen fecha y alcance; no extrapolar una consulta selectiva a una auditoría completa. Antes de modificar permisos, migraciones, Storage, Auth o servidor local, verificar su estado actual.

**Regla de cierre:** el cambio de comportamiento, los tests, la evidencia, las limitaciones y el siguiente paso deben quedar en GitHub en la misma PR. Una tarea no queda documentada solo porque se explicó en el chat.
