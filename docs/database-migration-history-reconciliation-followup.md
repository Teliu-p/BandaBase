# Segunda pasada: reconciliación de historial de migraciones

**Fecha de comprobación:** 2026-10-11  
**Repositorio:** `Teliu-p/BandaBase`  
**Commit de `main` inspeccionado:** `097057b6ee5f3aedbfc9320169e3b7ffb6f404c4`  
**Proyecto remoto:** `evuwcikuxptrgzdzejov`  
**Alcance:** inspección estática de archivos y consultas SQL de solo lectura. No se modificó el esquema, los datos ni el historial de migraciones remoto. No se creó una rama de Supabase de pago.

Este documento amplía la auditoría inicial de [database-migration-history-audit.md](./database-migration-history-audit.md). No certifica que cada archivo se ejecutara literalmente en el pasado; describe qué estado actual se ha podido comprobar y cuál es la evidencia que falta.

## Aclaración importante: hubo dos grupos distintos de doce migraciones

El informe recuperado del **8 de octubre** documentaba la discrepancia inversa: doce versiones que **sí estaban registradas en Supabase pero cuyos archivos SQL faltaban en GitHub**. Eran estas versiones iniciales:

- `20261007032329_enriched_materials`
- `20261007032335_material_storage_bucket`
- `20261007033157_create_band_comments`
- `20261007034524_link_comments_to_songs`
- `20261007034906_allow_general_and_song_comments`
- `20261007035841_link_rehearsals_to_songs`
- `20261007040838_create_band_lists_and_material_blocks`
- `20261007043657_simplify_band_lists_structure`
- `20261007044821_remove_band_list_date_time`
- `20261007172727_expand_proposals_for_voting`
- `20261007172940_finish_proposals_voting_access`
- `20261007184046_add_proposal_vote_visibility`

La comprobación actual confirma que esas doce versiones siguen en el historial remoto y que ahora también existe el conjunto correspondiente de archivos locales. **Ese problema anterior quedó resuelto y no debe volver a abrirse como tarea pendiente.**

Este documento trata un **segundo grupo, diferente**, de doce archivos que aparecen en Git pero no tienen una fila remota con la misma versión. Que el número también sea doce no significa que sean las mismas migraciones ni que deba repetirse la reparación anterior.

## 1. Estado de la segunda discrepancia

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

Las doce versiones locales sin fila remota son versiones posteriores y distintas del primer grupo. Varias parecen representar definiciones iniciales o intermedias de objetos que luego fueron modificados por migraciones remotas posteriores. Esto es compatible con una colección de archivos históricos obsoletos o con SQL ejecutado fuera del seguimiento normal de migraciones; los catálogos por sí solos no permiten distinguir esas posibilidades.

Por eso, el conteo 56 local / 44 remoto **no es por sí solo prueba de que haya que marcar las doce como aplicadas**. Este informe anterior se excedía al presentar esos comandos como la reparación propuesta. Se corrige aquí: no debe ejecutarse un lote de `migration repair --status applied` para estas doce versiones basándose solo en la presencia actual de objetos.

Las dos versiones que requieren atención especial por transformar contenido son:

- `20261007190000_band_list_participation_permissions`: normaliza estados de participación mediante un `UPDATE`.
- `20261007200000_song_genres_array`: cambia `genre` a array y convierte valores históricos.

Sus precondiciones/postcondiciones actuales son compatibles con el resultado esperado, pero volver a ejecutar los SQL antiguos podría provocar escrituras innecesarias y efectos de triggers/auditoría. No se deben aplicar de nuevo.

## 4. Qué hacer ahora (sin reparar ni pagar)

**No ejecutar ahora comandos `migration repair` para estas doce versiones, ni `supabase db push`.** Tampoco borrarlas del repositorio sin revisar su procedencia.

El siguiente paso es clasificar cada archivo, no cambiar el historial:

1. Recuperar del terminal el resultado que el usuario ya obtuvo anteriormente, si está disponible, y contrastarlo con `supabase migration list --linked` ejecutado desde el checkout actual. No repetir reparaciones previas por intuición.
2. Para cada uno de estos doce archivos, identificar el commit/PR que lo introdujo y las migraciones posteriores registradas en Supabase que cambiaron las mismas tablas, funciones, políticas o triggers.
3. Clasificar cada archivo como: **(a)** SQL aplicado manualmente y verificable; **(b)** versión intermedia reemplazada por otra migración aplicada; o **(c)** cambio escrito en Git pero nunca aplicado. Solo la primera categoría podría justificar marcar la versión como `applied`, después de verificar el SQL exacto. Las categorías (b) y (c) requieren tratamiento distinto; no deben marcarse como aplicadas por conveniencia.
4. Si el CLI propone estas versiones como pendientes, detenerse. Guardar el listado de propuestas sin ejecutar un push y revisar el SQL exacto de cada una antes de decidir si se conserva, se consolida fuera de la carpeta de migraciones o se corrige el seguimiento mediante el procedimiento oficial.

El comando oficial `supabase migration repair` solo modifica el historial de versiones; no ejecuta el SQL de la migración. Precisamente por eso, marcar una versión como `applied` sin evidencia puede falsear el historial, aunque sea menos peligroso que ejecutar SQL antiguo. Documentación: [Supabase Database Migrations](https://supabase.com/docs/guides/deployment/database-migrations#diagnosing-and-fixing-sync-errors).

La conexión de Supabase disponible en esta sesión permite consultas y migraciones, pero no ofrece una acción dedicada para recuperar el resultado de los comandos ejecutados en la terminal del usuario ni para ejecutar `supabase migration repair`. No debe sustituirse el CLI por escrituras manuales en `supabase_migrations.schema_migrations`.

## 5. Límites de esta verificación

- Todas las consultas a Supabase de esta segunda pasada fueron de solo lectura.
- No se creó una rama de Supabase ni se generó ningún coste adicional.
- No se ejecutó `supabase migration repair`, `supabase db push` ni ninguna migración en producción.
- El PR #98, que endurece la política UPDATE de `band_list_items`, sigue en borrador y no forma parte de esta reparación histórica.
