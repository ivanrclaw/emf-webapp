# ADR-001: Arquitectura Cliente-Servidor

**Estado:** Aceptado
**Contexto:** Necesitamos decidir si la aplicación será 100% local (navegador) o cliente-servidor.
**Decisión:** Cliente-Servidor con frontend React y backend NestJS + Python.
**Consecuencias:**
- Positivas: operaciones pesadas en servidor, persistencia real, colaboración posible
- Negativas: necesidad de backend desplegado, latencia de red
**Alternativas consideradas:**
- 100% local: rechazado por limitaciones de ecore.js (XMI incompleto) y falta de generación de código compleja

# ADR-002: TypeScript para el Core Ecore

**Estado:** Aceptado
**Contexto:** El núcleo del metametamodelo Ecore debe implementarse en algún lenguaje del ecosistema web.
**Decisión:** TypeScript con interfaces completas para todos los tipos Ecore. El frontend y backend compartirán los tipos.
**Consecuencias:**
- Tipado estricto garantiza corrección en manipulación de metamodelos
- Código compartido entre cliente y servidor (monorepo)
- ecore.js se usará como referencia, no como dependencia directa

# ADR-003: JSON como Formato Nativo, XMI como Exportación

**Estado:** Aceptado
**Contexto:** Necesitamos un formato de serialización para guardar y transmitir modelos.
**Decisión:** JSON es el formato nativo (eficiente, legible). XMI se genera por exportación para compatibilidad con Eclipse.
**Consecuencias:**
- Almacenamiento más compacto que XMI
- Parsing más rápido en JavaScript
- Compatibilidad con Eclipse mediante exportación/importación XMI

# ADR-004: React Flow para Diagramas

**Estado:** Aceptado
**Contexto:** Necesitamos una librería para renderizar diagramas nodo-enlace en el navegador.
**Decisión:** React Flow (xyflow) con nodos personalizados para EClass, EAttribute, EReference.
**Consecuencias:**
- React Flow es maduro, activo, con TypeScript nativo
- Nodos personalizados permiten representar EClasses con atributos
- Soporta edges personalizados para referencias y herencia
- Minimapa, zoom, grid incluidos

# ADR-005: PyEcore como Backend para Validación OCL

**Estado:** Aceptado
**Contexto:** Necesitamos un motor OCL completo para validar invariants.
**Decisión:** PyEcore (Python) ejecutado como subproceso desde Node.js. Alternativa: implementar OCL desde cero en TypeScript para casos simples y delegar los complejos a PyEcore.
**Consecuencias:**
- Mayor dependencia externa (Python runtime)
- PyEcore tiene soporte OCL completo
- Se implementará parser OCL propio en TypeScript para validación en vivo rápida

# ADR-006: Fly.io como Plataforma de Despliegue

**Estado:** Aceptado
**Contexto:** Necesitamos una plataforma para desplegar el backend.
**Decisión:** Fly.io (basado en experiencia exitosa con CTFGuide y DialogCraft).
**Consecuencias:**
- Despliegue simple con fly.toml
- Auto-sleep para ahorrar costos
- Volúmenes persistentes para SQLite
- SSL automático

# ADR-007: Sistema de Plantillas Propio (no Acceleo MTL)

**Estado:** Aceptado
**Contexto:** Necesitamos un sistema de generación de código M2T.
**Decisión:** Implementar un sistema de plantillas con sintaxis MTL-like simplificada, sin depender del motor Java de Acceleo.
**Consecuencias:**
- Más trabajo de implementación inicial
- Sin dependencias Java
- Sintaxis familiar para usuarios de Acceleo
- Se puede añadir compatibilidad con MTL real más adelante
