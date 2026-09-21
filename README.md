# Multiplan — Planeador Multigrado IA

Aplicación para construir planeaciones de primaria multigrado alineadas con la Nueva Escuela Mexicana, usando PDA oficiales y, cuando el docente los elige, proyectos de los Libros de Texto Gratuitos (LTG) verificados en Supabase.

## Estado actual

- Interfaz: **V0.8.5** en Railway.
- Motor pedagógico: **PLAN-SEQUENCE-MULTIGRADE-V6.2.1-STRICT-TRACE**.
- Modelo actual: Gemini a través de Edge Functions de Supabase.
- Autenticación: Supabase Auth por correo y contraseña.
- Corpus curricular: **1,333 PDA oficiales**.
- Proyectos LTG: **427/427 cubiertos**.
- Actividades LTG verificadas y enriquecidas: **2,364/2,364**.
- Vínculos proyecto ↔ PDA: **1,418**.

## Flujo

1. El docente inicia sesión.
2. Captura grados, matrícula por grado, contexto, problemática, niveles observables, conectividad y recursos.
3. El sistema recupera candidatos PDA oficiales por grado.
4. El docente selecciona los PDA y, de forma **opcional**, los LTG oficialmente vinculados.
5. V6.2.1 genera la secuencia multigrado. Si hay LTG seleccionados, utiliza únicamente actividades verificadas; si no hay LTG, trabaja desde PDA y contexto sin inventar libros, páginas ni actividades.
6. El validador determinístico comprueba tiempos, cobertura de grados, atención docente, PDA, vínculos PDA↔LTG y trazabilidad de actividades cuando corresponde.
7. Cuando una salida no cumple las reglas estructurales, se permite una reparación automática y se vuelve a validar; una salida que continúa inválida no se entrega como aprobada.
8. La interfaz puede solicitar materiales didácticos contextuales únicamente cuando son útiles para una actividad.

## Reglas principales de V6.2.1

- No inventar ni modificar el texto oficial de un PDA.
- El LTG es opcional.
- Sin LTG seleccionado, las referencias LTG deben permanecer vacías y no se permiten invenciones de libros, actividades o páginas.
- Con LTG seleccionado, validar cada par PDA ↔ proyecto contra `project_pda`.
- Reconstruir títulos y páginas desde `ltg_project_activities`.
- Registrar sólo los `activity_order` realmente usados en la secuencia.
- Cada sesión debe sumar exactamente los minutos solicitados.
- En multigrado, cada momento debe indicar qué bloque recibe atención directa y qué hacen simultáneamente los demás grados.
- Para 3 o más grados, la atención directa se limita a un máximo de 2 grados por momento.
- En alfabetización emergente se admiten oralidad, dibujo, pictogramas, dictado al docente y materiales manipulables.
- Las actividades deben poder funcionar sin internet cuando la conectividad declarada no sea estable.

## Seguridad

Las rutas que generan consumo de modelo requieren un `access_token` válido de Supabase Auth:

- `evaluate-pda-gemini-lab`
- `plan-support-gemini-lab`
- `generate-teaching-material-lab`

La validación de usuario se realiza dentro de las Edge Functions antes de llamar a Gemini. Las tablas públicas de Supabase tienen RLS habilitado y actualmente no se exponen directamente a usuarios finales; las operaciones del motor se realizan desde funciones de servidor.

El antiguo publicador V0.8 fue desactivado y el generador OpenAI V2 quedó deprecado.

## Despliegue actual

El servicio de producción de Railway ejecuta `server-v085b.mjs`. Esta capa:

- conserva la interfaz V0.8.4c como proceso interno;
- agrega la autenticación de Supabase;
- propaga el bearer token a las Edge Functions protegidas;
- expone `/health` con la versión de la interfaz y la familia del motor activo.

El archivo activo se define también en `package.json`.

## Nota de desarrollo

No agregar `service_role` ni secretos de Gemini al navegador o al repositorio. La clave publicable de Supabase sí puede utilizarse en cliente; los secretos permanecen en Supabase/Railway según corresponda.
