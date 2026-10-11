# Segunda pasada: reconciliación de historial de migraciones

**Fecha de comprobación:** 2026-10-11  
**Repositorio:** `Teliu-p/BandaBase`  
**Commit de `main` inspeccionado:** `097057b6ee5f3aedbfc9320169e3b7ffb6f404c4`  
**Proyecto remoto:** `evuwcikuxptrgzdzejov`  
**Alcance:** inspección estática de archivos y consultas SQL de solo lectura. No se modificó el esquema, los datos ni el historial de migraciones remoto. No se creó una rama de Supabase de pago.

Este documento amplía la auditoría inicial de [database-migration-history-audit.md](./database-migration-history-audit.md). No certifica que cada archivo se ejecutara literalmente en el pasado; describe qué estado actual se ha podido comprobar y cuál es la evidencia que falta.

## 1. Desalineación confirmada

- Hay **56** archivos locales en `supabase/migrations/`.
- La tabla remota `supabase_migrations.schema_migrations` registra **44** versiones.
- No se detectaron versiones remotas sin archivo local ni diferencias de nombre para las versiones presentes en ambos lados.
- Hay **12 versiones locales sin fila remota**, listadas en la sección siguiente.

La tabla remota tiene las columnas `version`, `statements`, `name`, `created_by`, `idempotency_key` y `rollback`. En las 44 filas existentes se observó: cero nombres vacíos, cero arrays `statements` nulos y cero arrays vacíos. Por eso no se debe “arreglar” el historial insertando filas mínimas manualmente: no reproducirían fielmente la forma de los registros existentes. El procedimiento preferido es el comando oficial `supabase migration repair`.

## 2. Evidencia observada por versión ausente

| Versión / archivo | Evidencia actual verificada | Riesgo o límite pendiente |
|---|---|---|
| `20261007173000_comment_attachments_blocks` | Existen `comment_attachments` y `comment_blocks`; ambas tienen RLS, índices y políticas actuales separadas para lectura/escritura. | Las políticas amplias `*_band_access` ya no existen. El estado actual parece provenir de endurecimientos posteriores, así que no demuestra que se aplicara exactamente esta primera versión. |
| `20261007190000_band_list_participation_permissions` | Existe `band_list_managers`, su RLS/políticas/índices y el índice único parcial `band_list_items_one_member_per_list_idx`. | El archivo también ejecuta un `UPDATE` que normaliza los estados de todos los ítems de integrantes. La consulta actual devolvió 3 filas de integrantes, todas en `Confirmado`; eso es compatible con estados normalizados, pero no demuestra cómo se llegó a ellos. No se debe volver a ejecutar este archivo. |
| `20261007200000_song_genres_array` | `songs.genre` es `text[]`. La comprobación actual encontró 5 canciones con array no nulo, 2 arrays vacíos, cero elementos vacíos y cero elementos con comas internas. | El archivo cambia el tipo de columna y transforma los valores separados por coma. El estado presente es compatible con el formato destino, pero no reconstruye los valores históricos previos a la conversión. No se debe volver a ejecutar la transformación. |
| `20261007203000_proposal_attachments` | Existe `proposal_attachments`, con RLS, índice por propuesta y políticas actuales específicas. | La política amplia original fue sustituida por políticas posteriores. El catálogo no prueba qué versión histórica la creó. |
| `20261007210000_proposal_content_blocks` | Existe `proposal_blocks`, con RLS, índices y políticas actuales específicas. | Las políticas actuales fueron endurecidas posteriormente; el nombre de la tabla no prueba la ejecución exacta del archivo original. |
| `20261007220000_permissions_audit_and_trash` | Existen las columnas de papelera de canciones, listas, propuestas y comentarios; existe `audit_log` con RLS e índices; hay función de auditoría y triggers en las tablas principales y de contenido relacionado. La restricción de roles acepta `member`, `admin` y `owner`. | La función y las políticas actuales evolucionaron en migraciones posteriores. No se halló una escritura de datos de primer nivel en este archivo fuera de la función de trigger; sus inserciones en `audit_log` ocurren en futuras operaciones. El estado actual acredita el sistema de auditoría presente, no toda su historia. |
| `20261007221500_secure_anonymous_vote_stats` | Existe `get_proposal_vote_stats(uuid[])`, limita el resultado a propuestas no eliminadas de bandas en las que el usuario tiene membresía activa; existe `proposal_votes_select_public_or_own`. | Es evidencia de las definiciones actuales, no de la secuencia exacta de despliegue. |
| `20261007223000_permissions_hardening` | `create_band` y `enter_bandabase` no son ejecutables por `anon` ni por `authenticated`; `is_band_member` no es ejecutable por `anon` y sí por `authenticated`. | La política de permisos actual coincide con el propósito del archivo, pero el catálogo no demuestra qué comando lo produjo históricamente. |
| `20261007224000_allow_member_soft_delete` | Existen políticas diferenciadas para actualización activa, envío a papelera y restauración en las entidades pertinentes. | Los nombres/definiciones no coinciden literalmente con todas las políticas de este archivo porque hubo cambios posteriores. No se debe volver a aplicar esta versión sobre la base actual. |
| `20261007225000_allow_users_to_complete_soft_delete` | Existen las políticas de lectura `*_select_active_or_own_trash_or_admin` en las entidades verificadas. | Las definiciones actuales pueden haber sido recreadas o endurecidas después. |
| `20261007225500_remove_legacy_comment_access` | Las políticas antiguas `comment_blocks_band_access` y `comment_attachments_band_access` no existen; hay políticas más específicas. | El efecto final coincide con retirar las reglas antiguas, aunque el catálogo no identifica por sí solo qué operación las quitó. |
| `20261008180900_harden_material_comment_proposal_storage` | Existen las cuatro políticas de Storage `material_files_{select,insert,update,delete}_...`; sus rutas contemplan materiales, comentarios y propuestas. | Solo se inspeccionaron las reglas de autorización actuales, no la historia de cada objeto de Storage ni qué migración creó por primera vez cada política. |

## 3. Lectura técnica

La evidencia es consistente con un esquema remoto en el que los efectos importantes de las doce versiones ya están presentes, en parte bajo definiciones posteriores más restrictivas. Sin embargo, **el historial no se considera reconciliado todavía**: la existencia de una tabla o de una política con nombre parecido no prueba la ejecución íntegra de la migración original.

Las dos versiones que requieren atención especial por transformar contenido son:

- `20261007190000_band_list_participation_permissions`: normaliza estados de participación mediante un `UPDATE`.
- `20261007200000_song_genres_array`: cambia `genre` a array y convierte valores históricos.

Sus precondiciones/postcondiciones actuales son compatibles con el resultado esperado, pero volver a ejecutar los SQL antiguos podría provocar escrituras innecesarias y efectos de triggers/auditoría. No se deben aplicar de nuevo.

## 4. Procedimiento gratuito propuesto para completar la reparación

La reparación que falta es **solo de metadatos**; no debe ejecutar el contenido de las doce migraciones.

1. En un checkout actualizado del repositorio, confirmar que el proyecto local está vinculado al ref correcto y ejecutar `supabase migration list --linked`. No ejecutar `db push`.
2. Guardar una copia/exportación del historial actual de `supabase_migrations.schema_migrations` y del estado del esquema antes de cambiar el historial.
3. Con el Supabase CLI oficial, marcar como `applied` únicamente las doce versiones que figuran abajo. El comando `migration repair` modifica el seguimiento de migraciones; no aplica ni revierte el SQL del archivo. Referencia oficial: [Supabase Database Migrations — reparar el historial](https://supabase.com/docs/guides/deployment/database-migrations#diagnosing-and-fixing-sync-errors).
4. Volver a ejecutar `supabase migration list --linked`. Debe mostrar las versiones locales y remotas emparejadas.
5. Ejecutar `supabase db push --linked --dry-run`. Si propone aplicar cualquiera de estos doce archivos o cualquier SQL no previsto, detenerse y no ejecutar un push real.

Comandos de reparación, uno por versión:

```bash
supabase migration repair --linked --status applied 20261007173000
supabase migration repair --linked --status applied 20261007190000
supabase migration repair --linked --status applied 20261007200000
supabase migration repair --linked --status applied 20261007203000
supabase migration repair --linked --status applied 20261007210000
supabase migration repair --linked --status applied 20261007220000
supabase migration repair --linked --status applied 20261007221500
supabase migration repair --linked --status applied 20261007223000
supabase migration repair --linked --status applied 20261007224000
supabase migration repair --linked --status applied 20261007225000
supabase migration repair --linked --status applied 20261007225500
supabase migration repair --linked --status applied 20261008180900
```

**No se han ejecutado estos comandos desde esta sesión.** La conexión de Supabase disponible permite consultas y migraciones, pero no ofrece una acción dedicada para ejecutar `supabase migration repair`. No se sustituye el CLI con `INSERT` directo en `schema_migrations`, porque la tabla real contiene arrays `statements` no vacíos para todas las versiones registradas y un insert manual podría dejar un historial con formato diferente.

## 5. Límites de esta verificación

- Todas las consultas a Supabase de esta segunda pasada fueron de solo lectura.
- No se creó una rama de Supabase ni se generó ningún coste adicional.
- No se ejecutó `supabase migration repair`, `supabase db push` ni ninguna migración en producción.
- El PR #98, que endurece la política UPDATE de `band_list_items`, sigue en borrador y no forma parte de esta reparación histórica.
