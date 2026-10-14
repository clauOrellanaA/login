---
name: flujo-fullstack
description: Coordina los agentes frontend, backend y base-datos para implementar e integrar funcionalidades del proyecto login. Úsala cuando pidan trabajar con los tres agentes, ejecutar el flujo fullstack o coordinar interfaz, API y persistencia.
---

Coordina a los tres subagentes siguiendo el patrón de flujo-calidad: tú eres el orquestador, recopilas sus resultados y pasas a cada uno las dependencias del anterior. Los subagentes no se llaman entre sí.

## Preparación y contrato

1. Lee las instrucciones del proyecto y revisa su estructura y comandos disponibles. Usa los agentes de `.codex/agents/frontend.toml`, `.codex/agents/backend.toml` y `.codex/agents/base-datos.toml`. No implementes funcionalidades fuera de la petición.
2. Si el proyecto está vacío, acuerda el stack antes de delegar: puedes adoptar una elección explícita del usuario o proponer una elección concreta y solicitar la información que falte. La creación de estos archivos de configuración no autoriza por sí sola construir la aplicación.
3. Define criterios de aceptación y un contrato compartido: endpoints, solicitudes, respuestas, errores, autenticación/sesión y entidades persistentes. Para un login, cubre credenciales válidas e inválidas, validación y acceso protegido; incluye registro o cierre de sesión solo si están pedidos.
4. Asigna a cada agente archivos y pruebas concretos. Los modelos ORM y migraciones pertenecen a base-datos; los endpoints y servicios a backend; los componentes y clientes de API a frontend. Ajusta las rutas al repositorio real. Reserva archivos compartidos, manifiestos y lockfiles al orquestador o a un único propietario. Diles que no están solos y que no reviertan cambios ajenos.

## Implementación y entrega entre agentes

1. **base-datos**: entrega el esquema, restricciones, migraciones y modo de preparar una base de prueba. Pasa ese resultado al backend.
2. **backend**: implementa la API sobre ese esquema y verifica el contrato. Pasa al frontend los endpoints reales, requisitos de sesión y resultados.
3. **frontend**: implementa la interfaz y conecta la API; comprueba estados de carga, errores y éxito.

Puedes ejecutar tareas independientes en paralelo después de fijar el contrato y separar los archivos: por ejemplo, interfaz con mocks mientras se preparan las migraciones. Espera las entregas necesarias antes de realizar la integración real. Si cambia un contrato, comunica la versión actual a todos los afectados antes de que continúen.

Cada agente entrega archivos modificados, decisiones de integración, comandos ejecutados y resultados, y bloqueos o dependencias pendientes. Si un rol personalizado no está disponible, utiliza un agente de implementación disponible con las instrucciones del TOML correspondiente; informa de esa sustitución sin afirmar que cargaste un rol inexistente.

## Integración, corrección y cierre

1. Reúne los resultados y ejecuta las comprobaciones pertinentes del proyecto. Verifica el recorrido interfaz → API → base de datos en un entorno local de prueba; un mock no demuestra integración real.
2. Pasa cada fallo reproducible al agente propietario con pasos de reproducción, resultado esperado y obtenido. Repite las comprobaciones afectadas tras corregir. Como en flujo-calidad, permite una segunda llamada de corrección si quedan fallos; si persisten, informa de su causa y del trabajo pendiente sin declarar éxito.
3. Actualiza la documentación existente con los comandos reales para ejecutar frontend/backend, preparar la base, configurar variables de entorno sin secretos y correr pruebas. Si no hay documentación, crea un README breve del proyecto.
4. Muestra una tabla: `Etapa | Subagente | Archivos/cambios | Verificación`. Indica pruebas fallidas antes y después cuando exista una medición inicial; si no la hay, indícalo sin inventarla. Distingue verificaciones realizadas, omitidas y bloqueadas, y explica cualquier integración pendiente.

No ejecutes despliegues ni modificaciones de bases reales como parte implícita de este flujo.
