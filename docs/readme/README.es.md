# Sohjae

[English](../../README.md) | [Español](README.es.md) | [日本語](README.ja.md) | [한국어](README.ko.md)

Editor y renderizador de Markdown integrable en otros proyectos, desarrollado con Rust/WASM, la biblioteca estándar de Rust y las API nativas del navegador. No requiere crates externos, paquetes de JavaScript ni frameworks de edición. Licencia [MIT](../../LICENSE).

Las API públicas del renderizador y del editor individual siguen la [política de estabilidad y compatibilidad de API v1](../api-stability.md). La colaboración sigue el [contrato estable de API v2 y del protocolo](../collaboration-protocol.md), con comprobaciones de versión y esquema antes de intercambiar documentos.

## Inicio rápido

Sirve la carpeta del SDK del editor y carga un solo script. El CSS, WASM y los módulos internos se cargan automáticamente desde la ubicación de ese script.

```html
<script src="./sohjae/sohjae.js"></script>
<textarea id="editor" name="markdown"># Hello, Sohjae!</textarea>
<script>new Sohjae({ selector: '#editor' });</script>
```

[Guía de inicio rápido](../quick-start.md) · [Ejemplo ejecutable](http://127.0.0.1:8080/quick-start.html). El valor del textarea se sincroniza con el formulario; también puedes utilizar un div.

## Ejemplos listos para ejecutar

| Ejemplo | Módulos WASM |
| --- | --- |
| [Renderizador de Markdown](../../examples/sohjae_renderer/index.html) | `sohjae_render.wasm` |
| [Editor de Markdown](../../examples/sohjae_editor/index.html) | `sohjae_editor.wasm` |
| [Editor colaborativo](../../examples/sohjae_collaborator/index.html) | `sohjae_editor.wasm` + `sohjae_collaborator.wasm` opcional |

Cada carpeta contiene `index.html`, JavaScript, CSS, binarios WASM y archivos auxiliares para abrir archivos locales. Conserva la carpeta completa. Con HTTP se carga el binario WASM adyacente; con `file://` se usa un archivo auxiliar que contiene el mismo binario. No se necesitan herramientas de compilación para abrir los ejemplos. La apertura directa de archivos locales no se ha verificado de principio a fin porque la automatización del navegador restringe `file://`; utiliza el servidor HTTP local si el navegador restringe los scripts locales.

```sh
python3 scripts/serve_examples.py --port 8081
```

Abre el [renderizador](http://127.0.0.1:8081/sohjae_renderer/index.html), el [editor](http://127.0.0.1:8081/sohjae_editor/index.html) o el [editor colaborativo](http://127.0.0.1:8081/sohjae_collaborator/index.html). Consulta la [guía de ejemplos](../../examples/README.md).

## Funciones

- Modos de texto enriquecido, híbrido y Markdown, vista completa del código fuente y visibilidad de sintaxis por elemento.
- Resaltado (`==texto==`), listas de definiciones, identificadores de encabezado personalizados y resaltado básico de código. Se admiten subíndices (`H~2~O`) y superíndices (`X^2^`).
- Herramientas de formato, deshacer/rehacer, gestión de composición con IME coreano y correspondencia de selección UTF-8/UTF-16.
- Navegación por tablas, inserción y eliminación de filas y columnas, alineación, selección múltiple y controles de arrastre para reordenarlas.
- Conversión de estructuras HTML compatibles al pegar, imágenes y archivos incrustados en Base64 y descargas.
- Front Matter, diseños CSS, vistas de lectura y solo lectura y paleta de comandos de teclado.
- Edición que conserva el texto fuente y exportación normalizada de la sintaxis compatible.

## Compilar y ejecutar

Instala Rust y Python 3. Node.js se utiliza para las comprobaciones de WASM y las mediciones.

```sh
rustup target add wasm32-unknown-unknown
sh scripts/build.sh
python3 scripts/serve.py --port 8080
```

- [Editor](http://127.0.0.1:8080/), [renderizador](http://127.0.0.1:8080/renderer.html) y [sintaxis extendida](http://127.0.0.1:8080/extended.html) ([fuente](../../web/extended.md)).
- [Pruebas del navegador](http://127.0.0.1:8080/tests.html) y [auditoría GFM](http://127.0.0.1:8080/gfm-audit.html).
- Verificación del WASM del editor: `node scripts/check_wasm.mjs`.
- Generar los tres archivos del SDK: `sh scripts/package.sh`.

El SDK del renderizador utiliza `renderer.js` y `sohjae_render.wasm` sin código de edición, historial, CRDT ni WebRTC. Para generarlo por separado, ejecuta `sh scripts/package_renderer.sh`. Consulta la [API del renderizador](../../docs/renderer.md).

## Integrar el editor

Sirve juntos los módulos JavaScript, CSS y archivos WASM compilados de `web/`, conservando sus rutas relativas. Cada editor utiliza Shadow DOM para aislar sus estilos de la página anfitriona.

```html
<div id="editor"></div>
<script type="module">
  import { create_editor } from './sohjae/editor.js';
  const editor = await create_editor(document.querySelector('#editor'), {
    markdown: '# Document\n\nContent',
    mode: 'hybrid',
    elements: { table: { reveal_markdown: false } }
  });
  editor.addEventListener('change', event => console.log(event.detail.dirty));
  // editor.get_markdown(); editor.set_markdown(source); editor.destroy();
</script>
```

El editor carga `sohjae_editor.wasm` de forma predeterminada y no necesita el WASM del renderizador.

## Colaboración opcional

El WASM del editor independiente no contiene ABI de colaboración ni CRDT. Añade el SDK de colaboración solo cuando sea necesario. Al desplegar su archivo opcional, combina el contenido con la misma raíz del SDK y conserva las rutas relativas.

Utiliza `create_editor(container, { replica })` para conectar las vistas enriquecida, híbrida, Markdown y fuente a un documento compartido. Si omites `replica`, se mantiene el funcionamiento individual. La colaboración ofrece un CRDT de caracteres, identificadores estables de tablas, filas y columnas, deshacer/rehacer por autor, anclas de cursor relativas, captura de IME, una API WASM independiente del transporte y un adaptador WebRTC.

La configuración STUN/TURN se proporciona al transporte. Para conectar participantes en distintos dispositivos también se necesita autenticación y señalización del anfitrión. El ejemplo en una misma página utiliza candidatos ICE locales sin servidores externos.

Consulta el [diseño de colaboración](../../docs/collaboration.md), la [API](../../docs/collaboration_api.md), la [demostración enriquecida/fuente](http://127.0.0.1:8080/collab/rich.html), las [pruebas de integración](http://127.0.0.1:8080/collab/rich-tests.html) y la [verificación de IME](http://127.0.0.1:8080/collab/ime.html). Verifica el WASM colaborativo con `node scripts/check_collab.mjs`.

## Validación y limitaciones

Sohjae es una versión en desarrollo. La comparación estructural registrada de los 672 ejemplos oficiales de GFM muestra **585 coincidencias y 87 diferencias**. Se han mejorado las listas y citas jerárquicas, los delimitadores de énfasis, los enlaces y las definiciones de referencia. Esto no implica compatibilidad completa con GFM. El [informe GFM](../../docs/gfm-conformance.md) documenta los casos resueltos y las diferencias pendientes.

Se verificó en Firefox la entrada real con el IME coreano de dos conjuntos de macOS, incluida la inserción remota durante la composición en las vistas enriquecida y fuente. Esto no sustituye las pruebas en dispositivos móviles, otros sistemas operativos ni toda la matriz de navegadores. Consulta el [estado de implementación](../../docs/implementation_plan.md) y la [compatibilidad](../../docs/compatibility.md) para conocer los límites de la validación.

## Documentación

Los documentos de referencia detallados están escritos actualmente en coreano.

| Documento | Contenido |
| --- | --- |
| [Requisitos](../../docs/requirements.md) | Alcance acordado |
| [Formato y almacenamiento](../../docs/formatting.md) | Normalización, HTML y pegado |
| [Arquitectura](../../docs/architecture.md) | Implementación y diseño previsto |
| [Configuración](../../docs/configuration.md) | Valores predeterminados y precedencia |
| [API y ABI](../../docs/api.md) | Integración, búferes, errores y ciclo de vida |
| [Guía de API individual](../single-user-api.md) | Integración tipada, configuración, comandos y ciclo de vida |
| [Plan de implementación](../../docs/implementation_plan.md) | Resultados y trabajo pendiente |
| [Validación](../../docs/validation.md) | GFM, entrada del sistema y pruebas móviles |
| [Compatibilidad](../../docs/compatibility.md) | Cobertura de sintaxis y navegadores |
| [Mejoras del editor](../../docs/editor-hardening.md) | Caché, agrupación de deshacer, normalización y accesibilidad |
| [Registro de traspaso](../../docs/handoff.md) | Decisiones y migración del entorno |

`tests/` se reserva para la verificación local y se excluye del seguimiento de Git. Los ejemplos oficiales necesarios para la compilación y auditoría se guardan en `spec/`. Las herramientas auxiliares de Rust están en `tools/`; se conservan sus nombres de ejemplo de Cargo y sus comandos.

## Colaboración opcional y renderizado de div

Activa la colaboración con `new Sohjae({ selector: "#editor", plugins: ["collaboration"] })`. Carga `sohjae-renderer.js` y usa `new SeojaeRenderer({ selector: "#preview" })` para convertir el Markdown del div. Consulta la [guía de inicio](../quick-start.md) para la instalación y conexión.
