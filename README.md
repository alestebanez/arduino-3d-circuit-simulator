# HardwareLab 3D — Simulador Arduino Uno R3 & Protoboard 830

Simulador web interactivo de electrónica y microcontroladores en **3D nativo sobre HTML5 Canvas 2D**, sin dependencias externas ni servidores requeridos (100 % compatible con apertura directa en `file://` o cualquier servidor HTTP estático).

Diseñado con una estética técnica minimalista blanco papel (`#FAF9F5`), combina un **solucionador eléctrico nodal en tiempo real**, un **emulador C++/INO no bloqueante para Arduino Uno R3 (ATmega328P)** y **hojas de datos técnicas (Datasheets)** integradas para todo el Starter Kit.

---

## Características Principales

- **Escenario 3D interactivo sin librerías externas**: Motor propio sobre Canvas 2D (`js/scene3d.js`) con proyección perspectiva, cámara orbital (`yaw`/`pitch`), pan, zoom, sombras en el suelo y sobre la protoboard, cuadrícula milimétrica (`10 mm` / `50 mm`) y modelos 3D detallados de cada componente y cable Dupont curvo.
- **Maqueta inicial funcional al arrancar**: Al abrir `index.html`, se carga automáticamente un circuito completo conectado y en marcha con Arduino Uno R3, Protoboard MB-102 de 830 puntos, 3 LEDs con resistencias de 220 Ω, pulsador táctil, potenciómetro 10 kΩ, micro servo SG90 y pantalla LCD 16×2 mostrando telemetría en vivo.
- **Click derecho inteligente (Inspector contextual)**:
  - Muestra nombre, modelo, fabricante, insignia **`Programable`** (solo en el Arduino Uno R3), especificaciones clave y **telemetría eléctrica en tiempo real** (tensión, corriente en mA, brillo %, ángulo, alertas de sobrecorriente).
  - Controles rápidos adaptados por componente (ohmios con preview de 4 bandas EIA en resistencias, 5 colores en LEDs, sliders en potenciómetro / LDR / HC-SR04 / TMP36, pulsador momentáneo o fijo, rotación 90° y eliminación).
  - Acceso directo al **Datasheet Resumido** de cualquier componente o cable.
  - Botón destacado **`💻 Abrir IDE e Inyectar Código`** exclusivo para placas programables (`Arduino Uno R3`).
- **IDE Arduino + Monitor Serie en vivo**:
  - Editor con numeración de líneas sincronizada, soporte de tabulación (`Tab`) y atajo `Ctrl+Enter` / `Cmd+Enter` para compilar.
  - Transpilador C++/INO a generadores JavaScript no bloqueantes (`delay()` y `delayMicroseconds()` corren sin congelar el render 3D ni la interfaz).
  - Estimación de uso de **Flash (32 KB)** y **SRAM (2 KB)** o notificación clara de errores de sintaxis.
  - 6 sketches de ejemplo listos en `Sketches.PRESETS` y Monitor Serie a 9600 baud con auto-scroll y control de sonido WebAudio para el zumbador piezoeléctrico.
- **Motor eléctrico realista**: Agrupamiento nodal con Union-Find sobre cables Dupont, las 830 perforaciones reales de la protoboard MB-102 y contactos internos de pulsadores; cálculo de división de tensión, equivalente de Thevenin para LEDs con $V_f$ específica por color y detección visual de sobrecorriente (`¡SOBRECORRIENTE!`).

---

## Componentes del Starter Kit Incluidos

| Categoría | Componente | Modelo / Referencia | Pines principales |
| :--- | :--- | :--- | :--- |
| **Placas** | **Arduino Uno Rev3** *(Programable)* | A000066 · ATmega328P @ 16 MHz | `D0..D13`, `A0..A5`, `5V`, `3.3V`, `VIN`, `GND1..3`, `RESET`, `AREF`, `IOREF` |
| **Protoboard y Pasivos** | Protoboard 830 Puntos | MB-102 (165 × 55 × 9 mm) | 830 puntos (`tp_1..50`, `tn_1..50`, `a1..e63`, `f1..j63`, `bp_1..50`, `bn_1..50`) |
| **Protoboard y Pasivos** | Resistencia Axial 1/4 W ±5 % | Yageo CFR-25 (100 Ω – 10 kΩ, 4 bandas EIA) | `P1`, `P2` |
| **Protoboard y Pasivos** | Pulsador Táctil 6×6 mm SPST-NO | Omron B3F-1000 | `1A`, `1B`, `2A`, `2B` (`1A-1B` y `2A-2B` unidos internamente) |
| **Protoboard y Pasivos** | Potenciómetro Lineal 10 kΩ | Bourns PTV09A / B10K (300°) | `VCC`, `WIPER`, `GND` |
| **Protoboard y Pasivos** | Cable Puente Dupont 22 AWG | Dupont M-M (6 colores configurables) | Conexión libre punto a punto en escena 3D |
| **Actuadores** | LED 5 mm Difuso | Kingbright L-53 (Rojo, Verde, Amarillo, Azul, Blanco) | `ANODE`, `CATHODE` |
| **Actuadores** | Micro Servomotor SG90 | TowerPro SG90 (0–180°, PWM 50 Hz) | `GND`, `VCC`, `PWM` |
| **Actuadores** | Zumbador Piezoeléctrico Pasivo | Murata PKM17EPP-4001-B0 | `POS`, `NEG` |
| **Sensores** | Sensor Ultrasónico de Distancia | HC-SR04 (2–400 cm, $d = t / 58$) | `VCC`, `TRIG`, `ECHO`, `GND` |
| **Sensores** | Fotorresistencia CdS (LDR) | GL5528 (540 nm) | `P1`, `P2` |
| **Sensores** | Sensor de Temperatura Analógico | Analog Devices TMP36GZ (10 mV/°C) | `VCC`, `VOUT`, `GND` |
| **Pantalla** | Pantalla LCD Alfanumérica 16×2 | LCM1602A (HD44780U, modo 4 bits) | `VSS`, `VDD`, `V0`, `RS`, `RW`, `E`, `D4..D7`, `A`, `K` |

---

## Controles y Uso

### Ratón y Escenario 3D
- **Click izquierdo sobre pin**: inicia o finaliza el tendido de un cable Dupont con el color activo en la barra superior (`Esc` cancela el cable en curso).
- **Hover sobre pin**: resalta el contacto y muestra un tooltip flotante con componente, pin y tensión en vivo.
- **Click izquierdo sobre componente**: selecciona el componente; arrastrar lo mueve sobre el plano XZ con ajuste a la rejilla (`2.54 mm` / `5 mm`) e inserción automática sobre agujeros de la protoboard. En pulsadores, un click rápido alterna su estado pulsado/suelto.
- **Click derecho sobre componente o cable**: abre el menú contextual flotante con especificaciones, telemetría en vivo, controles rápidos, acceso al **Datasheet Resumido** y (en el Arduino Uno R3) botón para abrir el **IDE Arduino**.
- **Arrastrar sobre fondo vacío**: rotar cámara orbital 3D.
- **Shift + arrastrar** (o botón central): desplazar cámara (pan).
- **Rueda del ratón / botones `+` `−`**: acercar o alejar zoom.

### Barra Superior y Catálogo Lateral
- **Ejecutar / Pausar / Reiniciar / Maqueta Inicial / Limpiar**: control completo de la simulación y recuperación instantánea del montaje por defecto.
- **Selector de color de cable**: 6 colores Dupont (Rojo, Negro, Amarillo, Verde, Azul, Naranja).
- **Vistas 3D**: `Isométrica`, `Superior` y `Centrar`.
- **Catálogo izquierdo**: buscador por nombre/modelo, click en un componente para colocarlo en un hueco libre del mapa 3D o icono `📄` para abrir directamente su Datasheet.

---

## Sketches de Ejemplo Incluidos (`Sketches.PRESETS`)

1. **Maqueta Inicial Completa**: Parpadeo D13 + LED `L` cada 600 ms, control de brillo PWM (D11) y servo SG90 (D9) desde potenciómetro (A0), lectura del pulsador (D2 → LED D10), pantalla LCD 16×2 y telemetría por Monitor Serie.
2. **Blink Clásico D13**: Parpadeo con `delay(500)` y conteo de ciclos por puerto serie.
3. **Semáforo + Pulsador**: Secuencia verde/ámbar/rojo con prioridad peatonal desde D2 y mensajes en LCD 16×2.
4. **Potenciómetro + Servo SG90**: Posicionamiento angular proporcional y lectura de tensión en LCD.
5. **Radar Ultrasónico HC-SR04 + LCD + Buzzer**: Medición por `pulseIn()` en `ECHO`, barrido de servo y alertas sonoras con `tone()`.
6. **Estación TMP36 + LDR**: Monitorización térmica y lumínica con avisos en LCD y LED de alerta en D13.

---

## Estructura del Proyecto y Ejecución

```text
proyectoweb/
├── index.html          # Estructura principal, modales Datasheet e IDE Arduino
├── css/
│   └── styles.css      # Estética minimalista blanco papel y diseño responsivo
├── js/
│   ├── datasheets.js   # Base de datos técnica de 13 componentes, pines MB-102 y código EIA
│   ├── simulator.js    # Solucionador eléctrico nodal, maqueta inicial y transpilador C++/INO
│   ├── scene3d.js      # Motor 3D Canvas 2D, modelos, iluminación, halos LED y hit-testing
│   └── app.js          # Controlador UI, menú contextual, modales e integración general
└── README.md
```

### Cómo ejecutarlo
1. Clona o descarga este repositorio.
2. Abre `index.html` directamente en cualquier navegador moderno (Chrome, Edge, Firefox) o sírvelo mediante cualquier servidor estático local:
   ```bash
   python -m http.server 8080
   ```
   y visita `http://localhost:8080`.
