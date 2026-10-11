# Auditoría del historial de migraciones de Supabase

**Corte de la auditoría:** 2026-10-11  
**Proyecto:** `evuwcikuxptrgzdzejov`  
**`main` inspeccionado:** `7a1abde0f5c5f5469d2fe103c11ab2951ec56ee6`  
**Tipo de inspección:** solo lectura. No se aplicaron migraciones ni se modificó el historial remoto.

## Resultado comprobado

- Repositorio: **56** archivos `supabase/migrations/*.sql`.
- Registro remoto `supabase_migrations.schema_migrations`: **44** versiones.
- Versiones presentes en el registro remoto pero ausentes en Git: **0**.
- Versiones cuyo nombre no coincide entre el archivo y el registro remoto: **0**, después del PR #96, que alineó `20261009005905_auth_signup_auto_band_member.sql`.
- Archivos presentes en Git pero sin fila de historial remoto: **12**, listados abajo.

Esto confirma una **desalineación de historial**, no que falten necesariamente esos objetos del esquema vivo. La inspección de catálogos encontró los efectos actuales indicados en la tabla; eso no demuestra por sí solo que cada archivo exacto se ejecutara completo ni permite reconstruir todas sus transformaciones históricas de datos.

## Archivos sin fila en el historial remoto

| Versión / migración | Evidencia observada en el esquema actual | Límite de la evidencia |
|---|---|---|
| `20261007173000_comment_attachments_blocks` | Existen `comment_attachments` y `comment_blocks`; ambas tienen RLS habilitado, índices y políticas más específicas de lectura/escritura. Las políticas antiguas `*_band_access` no aparecen. | Las políticas actuales fueron endurecidas en migraciones posteriores; no prueba que el primer SQL se ejecutara intacto. |
| `20261007190000_band_list_participation_permissions` | Existe `band_list_managers` con RLS, políticas e índices; existe el índice único parcial para una participación por integrante/lista. También están presentes las validaciones de capacidad y forma de los ítems. | La migración incluye un saneamiento de estados; el catálogo no identifica qué operación histórica produjo los valores actuales. |
| `20261007200000_song_genres_array` | `songs.genre` es actualmente `text[]` (`ARRAY` de tipo `_text`). | El tipo actual coincide con el objetivo, pero no prueba cómo se convirtieron todos los valores históricos. |
| `20261007203000_proposal_attachments` | Existe `proposal_attachments`, con RLS, políticas e índices. | Las políticas actuales pueden haber sido recreadas después. |
| `20261007210000_proposal_content_blocks` | Existe `proposal_blocks`, con RLS, restricciones de tipo y políticas. | Las políticas actuales pueden haber sido recreadas después. |
| `20261007220000_permissions_audit_and_trash` | Existe `audit_log` con RLS; están las columnas de papelera en canciones, listas, propuestas y comentarios; hay funciones y triggers de auditoría. | No se puede atribuir cada trigger/ajuste de permisos a un solo archivo porque hubo endurecimientos posteriores. |
| `20261007221500_secure_anonymous_vote_stats` | Existe `get_proposal_vote_stats(uuid[])`; la función limita los datos a propuestas activas de bandas donde el usuario tiene membresía activa. Está la política `proposal_votes_select_public_or_own`. | Es evidencia de la definición actual, no de la secuencia exacta de despliegue. |
| `20261007223000_permissions_hardening` | Los permisos actuales de `create_band` y `enter_bandabase` no conceden ejecución a `anon`/`authenticated`; `is_band_member` sí tiene permisos para usuarios autenticados. | Los permisos son el estado actual, no un registro de cuándo se cambiaron. |
| `20261007224000_allow_member_soft_delete` | Existen políticas de actualización para mover canciones, listas, propuestas y comentarios a la papelera, con restricciones de propietario/administrador. | Varias políticas se modificaron en migraciones posteriores. |
| `20261007225000_allow_users_to_complete_soft_delete` | Existen las políticas de lectura de papelera `*_select_active_or_own_trash_or_admin` en las cuatro entidades. | El catálogo solo demuestra las políticas actuales. |
| `20261007225500_remove_legacy_comment_access` | Las políticas antiguas `comment_blocks_band_access` y `comment_attachments_band_access` no existen; están las políticas más específicas actuales. | El efecto final coincide con la eliminación, aunque la política pudo haberse quitado de otra forma. |
| `20261008180900_harden_material_comment_proposal_storage` | Las cuatro políticas actuales de `storage.objects` para `materials` contemplan las rutas de materiales, comentarios y propuestas. | No se verificó la historia de cada objeto almacenado; solo las definiciones actuales de autorización. |

## Qué no hacer

**No ejecutar `supabase db push` contra producción mientras existan estos archivos locales sin reconciliar.** El CLI puede interpretarlos como versiones pendientes y tratar de ejecutar SQL antiguo sobre objetos ya existentes. Tampoco insertar filas directamente en `supabase_migrations.schema_migrations`, borrar archivos antiguos para hacer coincidir los conteos, ni marcar las doce versiones como aplicadas solo porque existan tablas con nombres parecidos.

## Procedimiento seguro pendiente

1. Crear una rama aislada de la base de datos y verificar que se crea correctamente a partir del esquema vivo, sin datos de producción.
2. Comparar allí, por cada versión, tablas, columnas, restricciones, índices, políticas RLS, funciones, permisos y triggers. Para los archivos con saneamientos de datos, verificar además los invariantes resultantes; el catálogo por sí solo no basta.
3. Probar el SQL propuesto para la política de actualización de `band_list_items` con roles y usuarios de prueba: administrador que no creó la lista, creador, responsable de lista, integrante anotado, integrante confirmado e integrante ajeno/inactivo. Incluir rechazos para canción de otra banda e integrante inactivo.
4. Solo después de esa validación, usar el mecanismo oficial de reparación del historial para las versiones que se demuestre que ya están aplicadas. Esa operación corrige metadatos; no debe ejecutar de nuevo sus SQL.
5. Volver a comprobar la lista de migraciones, revisar el plan de cambios pendientes sin ejecutarlos y conservar una copia exportada del estado previo.

Hasta completar esos pasos, la situación se considera **diagnosticada parcialmente, pero no reconciliada**.
