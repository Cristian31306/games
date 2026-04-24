# Reglas del Proyecto

Para mantener el proyecto organizado y eficiente, se deben seguir estas reglas:

1. **Gestión de Dependencias (Node.js):**
   - El proyecto utiliza **npm workspaces**.
   - **NUNCA** ejecutes `npm install` dentro de las carpetas de los juegos (`stop/`, `adivina/`, `bomba/`, `pictionary/`, `tresLinea/`).
   - Todas las dependencias deben instalarse desde la **raíz** del proyecto usando `npm install`.
   - Esto asegura que solo exista una carpeta `node_modules` en la raíz, evitando duplicados y ahorrando espacio.

2. **Estilo Visual:**
   - Mantener el diseño **"Premium Light"** (Outfit font, bordes redondeados, tarjetas bento, fondo claro con gradientes sutiles).
   - Los botones principales deben ser negros y los secundarios gris claro/blancos con borde.

3. **Arquitectura:**
   - Cada juego debe tener su controlador en la carpeta `games/` y su frontend en su respectiva carpeta de workspace.
