# Contexto de Ricardo en Pi

Responder en español.

## Memoria y skills

- Personal: `~/workspace/rtovar-os`; memoria, scripts y skills personales de Ricardo.
- Empresa: `~/workspace/mart-os`; memoria, skills y contexto empresarial de MART Automations.

Para consultar, retomar o guardar contexto, leer el `AGENTS.md` y `memory/index.md`
del repositorio correspondiente y trabajar directamente con sus archivos.
Cargar solo el contexto pertinente; mantener separadas la memoria personal y empresarial.
Las reglas de cada repositorio gobiernan sus escrituras y publicaciones.

## Integraciones con terceros

Para toda acción o consulta que requiera un servicio externo de terceros (por ejemplo,
calendario, correo, CRM o tareas), usar primero el gateway autenticado de Composio vía
CLI. Antes de concluir que una integración no está disponible, comprobar `composio --help`
y buscar la acción con `composio search`; ejecutar las herramientas encontradas con
`composio execute` y verificar el resultado devuelto. Si falta la conexión o la acción,
explicar el bloqueo y solicitar habilitación o autorización necesaria; no asumir que la
falta de herramientas MCP implica falta de acceso cuando Composio CLI puede estar
configurado. Respetar los permisos y confirmaciones requeridos por la acción, y no exponer
credenciales ni secretos.

### Instant Tools: búsqueda, scraping y OCR

Las Instant Tools corren con las cuentas de proveedor de Composio, sin API key propia.
Usarlas para búsqueda y lectura web y para OCR de documentos, antes de montar un scraper
o abrir una cuenta nueva en otro servicio.

- Tope vigente: **$5 de prueba**. Se cobra por llamada contra el saldo y **no lo detiene
  el cupo del plan**; si una corrida puede superarlo, pedir confirmación primero.
- La disponibilidad es **por herramienta, no por app**: el catálogo lista más de lo que la
  cuenta instant permite. Verificar con una llamada real; el rechazo
  (`ManagedCredential_ToolNotAllowed`) no tiene costo.
- Verificadas funcionando el 2026-10-14: `PARALLEL_SEARCH_WEB` (~$0.001, resultados con
  url y extractos), `TAVILY_SEARCH` ($0.008), `FIRECRAWL_SCRAPE` ($0.003), 
  `MISTRAL_AI_CREATE_OCR` ($0.004 por página; exige `model: mistral-ocr-4-1`) y
  `SUPADATA_GET_TRANSCRIPT` (~$0.01; YouTube https con `mode: native`).
  `PARALLEL_SEARCH` no está permitida.
- Encadenar varias llamadas en una sola corrida con `composio run` en lugar de N comandos
  sueltos, y usar `composio proxy` para endpoints de una API ya conectada.
- Para lo que ya está conectado por OAuth propio (correo, Drive, ClickUp, GitHub) seguir
  usando esas cuentas: no pagar Instant por lo mismo.
