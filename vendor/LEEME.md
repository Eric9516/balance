# Paquetes que no vienen de npm

## xlsx-0.20.3.tgz (SheetJS, lectura y escritura de Excel)

- **Por qué está acá:** la versión de npm (0.18.5) tiene dos fallas de seguridad conocidas (contaminación de prototipos y ReDoS al leer un archivo armado a propósito) y **no hay versión corregida en npm**: el fabricante solo publica las nuevas en su propio sitio.
- **Origen:** https://cdn.sheetjs.com/xlsx-0.20.3/xlsx-0.20.3.tgz (sitio oficial de SheetJS). Copiado del proyecto de referencia "Gestión empresarial", que lo descargó el 2026-10-11. Al 2026-10-19, 0.20.3 sigue siendo la última versión publicada.
- **Huella (sha256):** `8dc73fc3b00203e72d176e85b50938627c7b086e607c682e8d3c22c02bb99fe8`. El archivo de bloqueo (`pnpm-lock.yaml`) guarda además su huella de integridad.
- **Contenido:** sin dependencias y sin scripts de instalación. Licencia Apache-2.0.
- **Se guarda en el repositorio** para que instalar la app no dependa de que el sitio del fabricante esté en línea.
- **Para actualizarlo:** bajar la versión nueva de https://cdn.sheetjs.com, verificar su huella, reemplazar el archivo, cambiar la ruta en `package.json` y correr `pnpm install`, `pnpm test` y `pnpm audit --prod`.
