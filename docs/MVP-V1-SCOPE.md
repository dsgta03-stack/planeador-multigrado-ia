# Multiplan — Alcance MVP V1

## Objetivo
Lanzar una primera versión pública que permita a un docente completar de principio a fin una planeación contextualizada, trazable y reutilizable, sin depender de funciones decorativas ni módulos incompletos.

## Lo que ya funciona y debe conservarse
- Selección de uno o varios grados.
- Captura de contexto, problemática y condiciones del grupo.
- Recuperación y selección de PDA oficiales.
- Selección docente de PDA por grado.
- Vinculación LTG opcional cuando existe relación.
- Construcción de borrador de planeación.
- Organización multigrado.
- Secuencia de sesiones.
- Evaluación y apoyos.
- Validadores y advertencias.
- Reconstrucción del borrador.
- Motor visible V6.4 con V6.5 en shadow, sin cambiar reglas durante el trabajo de interfaz.

## Funciones faltantes para que se sienta como una aplicación completa

### P0 — indispensables antes de una primera versión pública

#### 1. Guardar planeaciones
El usuario debe poder guardar una planeación completa una vez generada.

Debe conservar como mínimo:
- título;
- fecha de creación y última edición;
- grados;
- contexto y problemática;
- configuración docente;
- PDA seleccionados;
- proyectos LTG elegidos o decisión de no usar LTG;
- borrador completo;
- sesiones;
- evaluación;
- apoyos;
- versión del motor que la generó.

Criterio de aceptación: cerrar la página, volver a entrar y recuperar la misma planeación sin regenerarla.

#### 2. Historial de planeaciones
Crear una vista “Mis planeaciones”.

Funciones mínimas:
- ver planeaciones recientes;
- abrir;
- duplicar;
- renombrar;
- eliminar con confirmación;
- identificar grado(s) y fecha.

Criterio de aceptación: un docente puede localizar una planeación anterior en menos de tres acciones.

#### 3. Edición posterior
Una planeación guardada debe poder editarse sin obligar a volver a generar todo.

Primera versión:
- edición de texto de diagnóstico;
- pregunta guía;
- organización;
- sesiones;
- evaluación;
- apoyos.

La edición manual debe distinguirse de una nueva generación del motor.

#### 4. Exportación
Prioridad de formatos:
1. DOCX editable.
2. PDF para entrega o impresión.

El documento debe incluir:
- datos generales;
- contexto y problemática;
- grados;
- PDA;
- LTG cuando aplique;
- metodología/propuesta;
- sesiones;
- evaluación;
- apoyos;
- trazabilidad curricular esencial.

Criterio de aceptación: el archivo descargado debe ser legible, imprimible y útil sin tener que reacomodarlo manualmente.

#### 5. Persistencia segura de la sesión de trabajo
Evitar perder el trabajo si el usuario recarga accidentalmente antes de guardar.

Implementación inicial sugerida:
- borrador temporal local en navegador;
- posteriormente sincronización con Supabase cuando exista cuenta de usuario.

### P1 — muy valiosas inmediatamente después del MVP

#### 6. Cuenta de usuario y perfil docente
Datos útiles:
- nombre;
- nivel;
- escuela opcional;
- tipo de organización: unigrado/multigrado;
- grados frecuentes;
- duración habitual de sesión;
- recursos disponibles.

Objetivo: evitar capturar la misma información en cada planeación.

#### 7. Grupos
Permitir crear grupos reutilizables con:
- grado;
- número de alumnos;
- nivel lector/escritor;
- autonomía;
- apoyos frecuentes;
- intereses;
- recursos y conectividad.

Una nueva planeación podría iniciar desde un grupo guardado.

#### 8. Materiales didácticos derivados de la planeación
Generar, desde una planeación ya validada:
- hoja de trabajo;
- guía docente;
- actividad imprimible;
- rúbrica;
- lista de cotejo;
- instrumento de evaluación;
- tarjetas o fichas.

Regla de producto: los materiales deben derivarse de PDA, actividades y evidencias ya presentes; no deben convertirse en un segundo motor pedagógico independiente.

#### 9. Evaluaciones reutilizables
Guardar y reutilizar:
- rúbricas;
- listas de cotejo;
- escalas;
- registros de observación.

### P2 — después de validar uso real

#### 10. Biblioteca personal
Favoritos de:
- proyectos LTG;
- planeaciones;
- materiales;
- instrumentos.

#### 11. Compartir planeaciones
Opciones futuras:
- enlace de solo lectura;
- copiar planeación;
- compartir con docentes del mismo centro.

#### 12. Portal para familias o alumnos
No es requisito del MVP. Solo tendría sentido después de comprobar que los docentes usan de forma recurrente planeaciones y materiales.

## Lo que NO debe entrar todavía
- red social docente;
- mensajería;
- calificaciones completas tipo sistema de control escolar;
- portal familiar avanzado;
- marketplace;
- generación de imágenes como función central;
- integración con demasiados servicios externos;
- paneles con métricas ficticias;
- navegación hacia módulos todavía inexistentes.

## Flujo objetivo del MVP
1. Docente entra a Multiplan.
2. Elige un grupo guardado o captura contexto.
3. Define problemática/reto.
4. Recupera PDA pertinentes.
5. Selecciona PDA y LTG opcional.
6. Genera borrador.
7. Revisa multigrado, sesiones, evaluación y apoyos.
8. Corrige manualmente si lo necesita.
9. Guarda la planeación.
10. Exporta DOCX/PDF.
11. La planeación queda disponible en “Mis planeaciones”.

## Orden recomendado de implementación

### Sprint 1 — Persistencia
- modelo de datos de planeación;
- guardar;
- abrir;
- actualizar;
- eliminar;
- historial.

### Sprint 2 — Edición y exportación
- modo editar;
- guardado de cambios;
- DOCX;
- PDF;
- vista de impresión.

### Sprint 3 — Perfil y grupos
- autenticación;
- perfil docente;
- grupos reutilizables;
- carga rápida de contexto.

### Sprint 4 — Materiales y evaluación
- materiales derivados;
- instrumentos;
- reutilización desde una planeación guardada.

## Decisión de alcance
La primera versión pública de Multiplan debe concentrarse en una promesa sencilla:

> Crear, revisar, guardar, editar y exportar una planeación NEM contextualizada y trazable, incluyendo escenarios multigrado.

Todo lo que no ayude directamente a completar esa promesa se pospone hasta después de validar uso real.
