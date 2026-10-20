# Especificación funcional acordada para BandaBase

Este documento recoge objetivos y comportamientos comunicados por el usuario en conversaciones anteriores. **No todos los ítems se han vuelto a verificar contra main ni deben interpretarse como garantía de que la UI ya los implementa perfectamente.** Al trabajar en una funcionalidad, contrastar cada requisito relevante con el código y anotar diferencias en la PR.

## 1. Propósito

BandaBase organiza el trabajo musical de una banda de iglesia: catálogo, preparación de canciones, repertorio, materiales, listas de servicio/actividad, inscripción de integrantes, propuestas, votaciones y comentarios. La experiencia debe ser práctica en escritorio y móvil; la app debe evitar sorpresas y preservar contenido.

## 2. Canciones

- La creación requiere solamente el título. Artista, género, duración, BPM, métrica, color y otros datos pueden completarse después.
- “Preparación” es Lista o Pendiente y representa si la canción está lista para tocarse. Es independiente de estar en la sección Repertorio.
- Repertorio es derivado: si una canción pertenece a por lo menos una Lista activa, aparece en repertorio; al sacarla de todas las Listas activas, debe dejar de aparecer. No depender de un checkbox manual.
- Estado Activa/Inactiva es independiente de preparación y repertorio.
- Los géneros, artistas, cantantes y colores deben permitir filtros múltiples cuando corresponda.
- El selector de colores debe permanecer plegado o discreto hasta interacción; no ocupar espacio innecesario.
- Formulario móvil en orientación vertical: Título → Artista → Género → Duración → BPM → Métrica. No alterar el orden de escritorio horizontal sin necesidad.
- La comparación con la versión original debe mantener el panel de referencia oscuro, con duración/BPM/métrica/tonalidad a la izquierda y el editor de materiales de la versión propia siempre accesible a la derecha en escritorio.
- Metrónomo vinculado a BPM y métrica; el BPM por defecto interpreta la negra. Permitir otras subdivisiones/valores cuando se configure, tap tempo y sincronización con valores editados. Si un metró­nomo está activo, detenerlo al salir de Canciones.
- Cambios en comparación, cantantes o metrónomo no deben hacer desaparecer Materiales ni borrar sus contenidos.

## 3. Cantantes, tonalidades y perfiles

- Las canciones pueden tener relaciones normalizadas de varios cantantes/tonalidades; mantener compatibilidad con los campos heredados si el código actual los sigue usando.
- Los instrumentos o funciones de integrantes pueden influir en las opciones de participación de una Lista.
- En futuras funciones de cupos, el administrador debe poder ajustar fácilmente cuántos participantes se necesitan por instrumento. Un músico podría anotarse para más de una función (por ejemplo, cantar y tocar teclado), sujeto a la regla de la lista.
- La interfaz debe mostrar la elección del integrante claramente, y el servidor debe validar la relación con miembros activos.

## 4. Listas y participación

- Listas concentran la planificación de canciones y participación de músicos; no crear una sección separada de Ensayos sin una decisión explícita de producto.
- La sección Integrantes debe aparecer antes del Repertorio dentro del detalle de Lista.
- Los miembros pueden marcar intención/presencia y sus instrumentos; creador, administradores o responsables designados pueden confirmar la composición final según permisos definidos.
- La visibilidad pública de los nombres/estados de los que se anotan y de la lista final debe ser consistente con la experiencia acordada.
- Los responsables de lista deben administrarse explícitamente, y las operaciones de participantes/cupos deben conservar integridad y no permitir cambios de campos ajenos al permiso otorgado.
- Repertorio se sincroniza automáticamente desde listas activas.

## 5. Propuestas y votaciones

- Propuestas representan decisiones generales de la banda, no solamente decisiones de canciones.
- Permitir votación sí/no y preguntas con opciones únicas o múltiples según el tipo de propuesta.
- La visibilidad de votos debe ser pública por defecto salvo que se configure anonimato; incluso con anonimato deben poder mostrarse estadísticas sin revelar identidades de forma accidental.
- Las propuestas admiten contenido mixto de texto, archivo y enlaces en un editor coherente con Materiales.
- Estado, borrado/restauración y permisos deben coincidir con las reglas de autor, administrador y banda.

## 6. Comentarios

- Existen comentarios generales y comentarios asociados a una canción.
- Adjuntos son opcionales; la ausencia de un archivo nunca debe impedir guardar un comentario textual normal.
- El compositor admite texto y contenido mixto de archivos/enlaces según el flujo actual previsto.
- El autor puede editar/eliminar su propio comentario conforme a las reglas de producto; administración puede tener permisos ampliados. Ocultar botones en la UI no sustituye RLS.

## 7. Materiales y editor enriquecido

- Texto, archivos y enlaces pueden coexistir en la misma secuencia de contenido y conservar su orden al guardar.
- Reproducción de audio debe funcionar directamente en la interfaz, sin obligar a instalar una aplicación ni descargar manualmente el archivo. Al guardar un material, los adjuntos deben seguir en línea donde se insertaron y no convertirse en tarjetas grandes separadas.
- Un audio dentro del material se muestra como un chip de una línea con nombre y botón reproducir/pausar. Al tocar el nombre se abre un panel flotante con tiempo actual, duración y barra de posición; el panel no debe empujar el resto del texto ni mostrar el reproductor nativo grande.
- El chip de archivos y enlaces debe mantener la misma escala compacta en edición y vista guardada siempre que el tipo de adjunto lo permita. Nombre largo truncado, sin alterar el alto del renglón.
- Los marcadores de audio se insertan en línea dentro del rich text de Materiales, en la posición del cursor. La herramienta ⏱ captura el tiempo del control de audio que conserva el foco o del único audio que se esté reproduciendo; si no puede identificar un punto de reproducción sin ambigüedad, permite ingresar el tiempo manualmente (mm:ss, hh:mm:ss o segundos). El nombre de la sección (por ejemplo, «Coro») queda como texto normal y el chip muestra solo el tiempo, por ejemplo «0:30», sin repetir el nombre. El marcador se guarda dentro del bloque de texto existente, no en el estado local del navegador ni en una tabla separada.
- Al pulsar un marcador, todos los audios adjuntos a los Materiales de esa canción se posicionan en ese instante, incluidos los de materiales plegados. Se solicitan URLs firmadas/metadatos bajo demanda por la acción explícita del usuario; las pistas pausadas no arrancan automáticamente y las que ya sonaban mantienen la reproducción. El último punto elegido también se aplica cuando se abre después otro Material de la misma canción. El estado del marcador se reinicia al cambiar de canción.
- La sincronización del metrónomo con Materiales es opcional y usa el BPM/métrica ya conocidos y la posición de reproducción de un solo audio de referencia; sigue play, pausa, reanudación, búsqueda, marcadores y cambios de velocidad sin análisis automático del tempo. El modo independiente debe seguir funcionando. Al salir de Canciones se detiene y desarma la sincronización. El primer clic debe empezar con la menor anticipación segura sin sacrificar la regularidad de los siguientes clics.
- Mejorar el volumen percibido del metrónomo mediante una ganancia ajustable. La ganancia de pistas de audio debe investigarse aparte y solo activarse si el procesamiento funciona con CORS en los objetos de Storage y conserva un fallback de reproducción nativa.
- Cargar audio/metadatos de forma perezosa para cuidar datos y almacenamiento; no precargar medios pesados innecesariamente.
- Formato deseado: negrita, cursiva, resaltado, paréntesis, corchetes y dos niveles de ampliación de tamaño que se puedan alternar/desactivar.
- Insertar figuras musicales (negra, corchea, semicorchea y futuras variantes) en el punto actual del cursor para escribir ritmos y tiempos dentro de Materiales.
- La sangría debe mover texto añadiendo o quitando espacios reales de a uno por acción. Si hay texto seleccionado en varias líneas, cada línea debe avanzar un espacio; mantener presionado el botón repite la acción y acelera progresivamente. No usar bloques grandes de margen/blockquote para simular espacios.
- Permitir atajos numéricos para herramientas del editor sin interferir con números escritos normalmente.
- Los adjuntos insertados en línea deben tener altura acotada a un renglón; el nombre puede truncarse, pero el chip de archivo no debe estirar la distancia vertical del texto que comparte línea.
- Los estados visuales de los controles de formato deben reflejar la selección actual.
- Tarjetas de archivos/enlaces deberían resultar familiares y claras, similares en legibilidad a una conversación de mensajería.
- Doble clic en una posición del editor debe colocar el cursor en el lugar previsto cuando corresponda.
- Guardado de material con varios bloques/adjuntos debe ser resistente a fallos parciales: no perder contenido viejo, no dejar objetos huérfanos silenciosos y explicar si una limpieza quedó pendiente.

## 8. Inicio y navegación

- Inicio debe priorizar tres vistas previas: Listas, Propuestas y Comentarios.
- Las vistas previas son de consulta y no deben duplicar controles interactivos de las secciones completas.
- La vista previa de Listas debe mostrar integrantes confirmados; la de Propuestas, estadísticas de votación.
- Evitar texto introductorio que desplace innecesariamente el contenido.
- La detección de nuevas versiones no debe pedir actualizar repetidamente si la versión ya se actualizó/confirmó; verificar específicamente la experiencia móvil.

## 9. Permisos, roles, auditoría y papelera

- Existe una distinción de miembro, admin y owner. El usuario espera poder tener control de owner/admin; no asumir su user ID o modificar roles sin consulta y validación.
- Permisos se aplican por banda, autor/propietario, papel de administrador y, cuando corresponda, responsable de una Lista.
- La política del servidor es fuente autoritativa. Las comprobaciones de interfaz son solamente de UX.
- Debe haber historial de cambios y posibilidad de restaurar contenido eliminado o versiones previas cuando la función esté soportada.
- Los usuarios pueden eliminar/mandar a papelera sus elementos propios conforme a permisos. Administración puede inspeccionar y restaurar según políticas.
- Acciones de borrado múltiple mediante clic derecho en escritorio o pulsación larga en móvil deben ser intencionales y estar bien diferenciadas de la selección normal.
- La eliminación de usuarios de prueba y la limpieza de cuentas deben ser posibles, preservando las referencias y restricciones de Auth/DB.

## 10. Autenticación y acceso

- Preferir inicio de sesión por correo electrónico frente a códigos de banda/teléfono, porque el usuario puede mantener actualizado su email.
- El registro inicial debe dar permisos de integrante ordinario automáticamente solo cuando el esquema permita identificar inequívocamente la banda destino. La migración actual se limita explícitamente al caso en que hay exactamente una banda; con múltiples bandas no debe asignar una al azar.
- Los errores de login/registro deben ser visibles y accionables; un submit no debe fallar silenciosamente.

## 11. Reglas de interacción para futuras modificaciones

- Conservar el comportamiento existente fuera del alcance pedido.
- Antes de modificar un formulario, identificar sus campos obligatorios, defaults, normalización, estado global y el guardado posterior.
- Para datos relacionados, identificar si hay RPC o triggers que aseguran operaciones atómicas o sincronización.
- Si el código actual contradice estos requisitos, documentar el delta; no asumir que el requerimiento ya está cumplido ni hacer una reescritura total por accidente.