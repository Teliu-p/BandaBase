# Segunda pasada: reconciliación del historial de migraciones

**Fecha de revisión:** 2026-10-12  
**Repositorio:** `Teliu-p/BandaBase`  
**`main` inspeccionada:** `0fda57683e372d7e1876ac8215e4699c6f329ddb`  
**Proyecto remoto:** `evuwcikuxptrgzdzejov`  
**Alcance:** revisión estática del historial Git, SQL de las migraciones y consultas SQL de solo lectura al esquema remoto. No se modificó el esquema, los datos ni el historial remoto; no se creó una rama de Supabase de pago.

Este documento reemplaza las conclusiones provisionales de la revisión anterior con el resultado del análisis de procedencia y dependencias. No certifica qué comando ejecutó cada SQL en el pasado; distingue la evidencia del esquema actual de lo que todavía no puede probarse históricamente.

## 1. Las dos discrepancias de doce migraciones no eran el mismo problema

El informe anterior del 8 de octubre documentaba doce versiones que **sí estaban registradas en Supabase, pero cuyos archivos SQL faltaban en GitHub**. Esas doce versiones iniciales ya están en `main`. **Ese problema está resuelto y no debe reabrirse.**

La discrepancia actual es la inversa: existen 56 archivos SQL en `supabase/migrations/`, pero el historial remoto registra 44 versiones. Hay doce archivos locales sin fila remota con la misma versión. El listado actual no mostró versiones remotas sin archivo local ni diferencias de nombre para las versiones que sí coinciden.

| Archivo local sin fila remota | Conclusión de esta revisión |
|---|---|
| `20261007173000_comment_attachments_blocks.sql` | **Fundacional; no borrar.** En Supabase existen ambas tablas, índices y RLS. Una migración posterior registrada (`20261008003133_audit_child_content_hardening.sql`) crea triggers de auditoría sobre ambas tablas; otra (`20261008003117_final_permissions_grants_hardening.sql`) revoca permisos de cliente sobre ellas. Esas migraciones posteriores requieren que las tablas ya existan. Las políticas amplias de la primera versión fueron sustituidas por permisos específicos y retiradas de forma explícita más adelante. |
| `20261007190000_band_list_participation_permissions.sql` | **Fundacional y con efecto sobre datos; no borrar ni volver a ejecutar a ciegas.** La tabla `band_list_managers` y el índice único parcial de participantes existen. Las migraciones registradas de participación/cupos dependen de esa estructura. El archivo también normaliza estados con un `UPDATE`; el catálogo actual no permite reconstruir por sí solo cuándo se ejecutó esa escritura. |
| `20261007200000_song_genres_array.sql` | **Migración de tipo/datos; no es una versión desechable.** `songs.genre` es actualmente de tipo array (`text[]`) y este archivo contiene la conversión condicional desde texto separado por comas. No encontré una migración posterior registrada que reproduzca esa conversión. El estado actual prueba el tipo de destino, no recupera los valores históricos previos. |
| `20261007203000_proposal_attachments.sql` | **Fundacional; no borrar.** La tabla existe. La migración posterior registrada de auditoría de contenido crea un trigger sobre `proposal_attachments`; la migración posterior de permisos también la incluye en sus revocaciones de privilegios. No hay otra migración registrada que vuelva a crear la tabla. La política amplia inicial sí evolucionó a permisos más específicos. |
| `20261007210000_proposal_content_blocks.sql` | **Fundacional; no borrar.** `proposal_blocks` existe y una migración posterior registrada crea sobre ella un trigger de auditoría. Las políticas actuales son más específicas que la política inicial, pero eso no reemplaza la creación de la tabla y sus índices. |
| `20261007220000_permissions_audit_and_trash.sql` | **Mixta: base del esquema más una capa de permisos parcialmente reemplazada.** Siguen existiendo `audit_log`, las columnas de papelera y las funciones/triggers de auditoría. Las migraciones registradas posteriores modifican la función de auditoría y endurecen varias políticas, pero no recrean toda esa base. Además, el catálogo actual muestra la política `band_list_items_update_control_v2`, cuya lógica es relevante para el problema aún abierto en la PR #98. Por tanto, no es correcto describir todo este archivo como obsoleto. |
| `20261007221500_secure_anonymous_vote_stats.sql` | **Función y política con efectos actuales.** Existe `get_proposal_vote_stats(uuid[])` y existe `proposal_votes_select_public_or_own`. La migración registrada `20261008045145_make_vote_rpc_invoker.sql` cambia otra función (`replace_my_proposal_votes`), no es un reemplazo equivalente de `get_proposal_vote_stats`. |
| `20261007223000_permissions_hardening.sql` | **Endurecimiento de privilegios con efectos que siguen siendo visibles.** La comprobación actual confirma que `create_band` y `enter_bandabase` no son ejecutables por `anon` ni `authenticated`, mientras que `is_band_member` no se concede a `anon` y sí a `authenticated`. El catálogo acredita el estado actual, aunque no la sentencia histórica exacta que lo produjo. |
| `20261007224000_allow_member_soft_delete.sql` | **Capa intermedia de políticas, reemplazada parcialmente.** Los nombres de las políticas de actualización de este archivo ya no coinciden todos con los del catálogo actual; las políticas actuales de actualización/papelera son más recientes. Esto demuestra evolución de la capa de permisos, no que se pueda eliminar este paso histórico de la secuencia sin diseñar y validar una línea base consolidada. |
| `20261007225000_allow_users_to_complete_soft_delete.sql` | **Políticas con efecto todavía presente.** Las cuatro políticas de lectura `*_select_active_or_own_trash_or_admin` aparecen en el catálogo remoto actual. El archivo no debe clasificarse como completamente supersedido. |
| `20261007225500_remove_legacy_comment_access.sql` | **Limpieza de seguridad importante; no borrar.** Las políticas antiguas `comment_blocks_band_access` y `comment_attachments_band_access` no existen en el esquema actual, y se encuentran políticas separadas más específicas. La migración elimina precisamente las políticas amplias que, si coexistieran con las específicas, podrían seguir concediendo acceso por la combinación permisiva de RLS. No encontré una migración remota registrada posterior que duplique explícitamente esos dos `DROP POLICY`. |
| `20261008180900_harden_material_comment_proposal_storage.sql` | **Endurecimiento adicional de Storage que sigue siendo necesario.** Las cuatro políticas actuales `material_files_{select,insert,update,delete}_...` incluyen rutas para materiales, comentarios y propuestas. La migración registrada anterior `20261008003423_materials_storage_object_hardening.sql` cubre rutas de materiales; no reproduce por sí sola las ramas de comentarios y propuestas añadidas por este archivo local. |

## 2. Qué demuestra la arqueología y qué no

El historial Git confirma que los doce archivos forman parte de cambios de funcionalidad y endurecimiento incorporados entre el 7 y el 8 de octubre. Más importante: las migraciones posteriores que **sí** están registradas en Supabase referencian tablas, políticas, funciones o privilegios que estos archivos crean o configuran. El esquema remoto contiene esos objetos y efectos.

La explicación más consistente con la evidencia es que **partes sustanciales de esta secuencia llegaron al esquema remoto sin que quedaran registradas esas doce versiones en `supabase_migrations.schema_migrations`** —por ejemplo, ejecución de SQL fuera del flujo normal de migraciones— y que algunas de sus políticas iniciales se endurecieron más tarde. El estado actual por sí solo no permite afirmar que cada sentencia de cada archivo se ejecutó literalmente, ni identificar qué sesión o comando la aplicó.

Así que la hipótesis “son doce archivos viejos ya descartados” **no queda respaldada como explicación general**. Algunas políticas de los archivos 1, 6 y 9 cambiaron; sin embargo, los archivos 1–8, 10–12 contienen objetos o efectos que siguen existiendo o de los que dependen migraciones registradas posteriores. No debe eliminarse en bloque ninguno de los doce de `supabase/migrations/`.

### Advertencia sobre las dos versiones que escriben datos

- `20261007190000_band_list_participation_permissions.sql` normaliza el estado de todos los ítems de integrantes con un `UPDATE`.
- `20261007200000_song_genres_array.sql` convierte la columna `genre` de texto a array. Ese cambio está protegido por una comprobación del tipo de columna y el tipo actual ya es array.

Son operaciones distintas. La consulta actual es compatible con que sus resultados estén presentes, pero no es prueba histórica suficiente para ejecutar el archivo completo ni para dar por acreditadas todas sus sentencias. Algunas migraciones también crean o reemplazan políticas; al aplicarlas después de versiones posteriores pueden dejar el esquema peor que el actual.

## 3. Decisión operativa

**No ejecutar `supabase db push`, no borrar/mover los doce archivos y no ejecutar un `migration repair --status applied` masivo por ahora.** El primero puede intentar reproducir SQL histórico en una base que ya tiene migraciones más nuevas; el segundo rompería la reconstrucción de una base limpia; el tercero cambiaría el registro sin ejecutar ni verificar SQL.

La reparación del tracking sigue pendiente, pero ahora queda acotada: confirmar con el resultado del CLI del checkout del usuario si esas doce versiones figuran como pendientes y decidir, versión por versión, si se registra como aplicada, si se reemplaza con una migración consolidada o si existe evidencia suficiente para otra corrección. El procedimiento oficial de `supabase migration repair` solo modifica el registro de versiones, no aplica el SQL; por eso solo corresponde tras validar el SQL y sus efectos. No insertar filas manualmente en `supabase_migrations.schema_migrations`.

No se creó una rama de Supabase de pago ni se modificó la base en esta revisión. La PR #98 sigue siendo un trabajo separado: su política UPDATE de `band_list_items` debe probarse antes de desplegar; la existencia de la política `band_list_items_update_control_v2` en el catálogo actual refuerza que no hay que aplicar cambios a ciegas.
