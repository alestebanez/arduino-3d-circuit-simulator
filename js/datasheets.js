(function (global) {
  "use strict";

  global.HardwareSim = global.HardwareSim || {};

  var PITCH = 2.54;

  function round3(value) {
    return Math.round(value * 1000) / 1000;
  }

  /**
   * Categorías ordenadas para el catálogo lateral de la aplicación.
   */
  var CATEGORIES = [
    {
      id: "Placas",
      name: "Placas",
      label: "Placas",
      order: 1,
      description: "Placas de desarrollo y microcontroladores programables"
    },
    {
      id: "Protoboard y Pasivos",
      name: "Protoboard y Pasivos",
      label: "Protoboard y Pasivos",
      order: 2,
      description: "Protoboards, resistencias, pulsadores, potenciómetros y cables"
    },
    {
      id: "Actuadores",
      name: "Actuadores",
      label: "Actuadores",
      order: 3,
      description: "Indicadores luminosos, servomotores y zumbadores piezoeléctricos"
    },
    {
      id: "Sensores",
      name: "Sensores",
      label: "Sensores",
      order: 4,
      description: "Sensores de distancia ultrasónicos, luz y temperatura"
    },
    {
      id: "Pantalla",
      name: "Pantalla",
      label: "Pantalla",
      order: 5,
      description: "Módulos de visualización alfanuméricos LCD"
    }
  ];

  /**
   * Variantes estándar del LED difuso de 5 mm (serie Kingbright L-53).
   */
  var LED_COLORS = {
    red: {
      id: "red",
      name: "Rojo",
      vf: 1.9,
      wavelengthNm: 625,
      spectrum: "625 nm",
      hex: "#EF4444",
      glowHex: "#FF6B6B",
      lensHex: "rgba(239, 68, 68, 0.85)"
    },
    green: {
      id: "green",
      name: "Verde",
      vf: 2.1,
      wavelengthNm: 565,
      spectrum: "565 nm",
      hex: "#22C55E",
      glowHex: "#4ADE80",
      lensHex: "rgba(34, 197, 94, 0.85)"
    },
    yellow: {
      id: "yellow",
      name: "Amarillo",
      vf: 2.0,
      wavelengthNm: 590,
      spectrum: "590 nm",
      hex: "#EAB308",
      glowHex: "#FDE047",
      lensHex: "rgba(234, 179, 8, 0.85)"
    },
    blue: {
      id: "blue",
      name: "Azul",
      vf: 3.1,
      wavelengthNm: 470,
      spectrum: "470 nm",
      hex: "#3B82F6",
      glowHex: "#60A5FA",
      lensHex: "rgba(59, 130, 246, 0.85)"
    },
    white: {
      id: "white",
      name: "Blanco",
      vf: 3.2,
      wavelengthNm: null,
      spectrum: "6000 K",
      hex: "#F8FAFC",
      glowHex: "#FFFFFF",
      lensHex: "rgba(248, 250, 252, 0.90)"
    }
  };

  var STANDARD_RESISTOR_VALUES = [100, 220, 330, 1000, 4700, 10000];

  var EIA_DIGIT_COLORS = [
    { name: "Negro", hex: "#1C1917" },
    { name: "Marrón", hex: "#78350F" },
    { name: "Rojo", hex: "#DC2626" },
    { name: "Naranja", hex: "#EA580C" },
    { name: "Amarillo", hex: "#EAB308" },
    { name: "Verde", hex: "#16A34A" },
    { name: "Azul", hex: "#2563EB" },
    { name: "Violeta", hex: "#7C3AED" },
    { name: "Gris", hex: "#6B7280" },
    { name: "Blanco", hex: "#F8FAFC" }
  ];

  var EIA_MULTIPLIER_SPECIAL = {
    "-1": { name: "Dorado", hex: "#D4AF37" },
    "-2": { name: "Plateado", hex: "#9CA3AF" }
  };

  var EIA_TOLERANCE_GOLD = { name: "Dorado", hex: "#D4AF37" };

  function isArray(v) {
    return Object.prototype.toString.call(v) === "[object Array]";
  }

  function isInt(v) {
    return typeof v === "number" && isFinite(v) && Math.floor(v) === v;
  }

  function log10(v) {
    return Math.log(v) / Math.LN10;
  }

  function formatOhmsLabel(ohms) {
    if (ohms >= 1000000) {
      var m = ohms / 1000000;
      return (isInt(m) ? String(m) : m.toFixed(2).replace(/\.?0+$/, "")) + " MΩ";
    }
    if (ohms >= 1000) {
      var k = ohms / 1000;
      return (isInt(k) ? String(k) : k.toFixed(2).replace(/\.?0+$/, "")) + " kΩ";
    }
    return (isInt(ohms) ? String(ohms) : ohms.toFixed(2).replace(/\.?0+$/, "")) + " Ω";
  }

  /**
   * Calcula las 4 bandas EIA exactas para resistencias de película de carbón (±5%).
   */
  function getResistorBands(ohms) {
    var val = Number(ohms);
    if (!isFinite(val) || val <= 0) {
      val = 220;
    }

    var exp = Math.floor(log10(val)) - 1;
    var sig = Math.round(val / Math.pow(10, exp));
    if (sig >= 100) {
      sig = Math.round(sig / 10);
      exp += 1;
    }
    if (sig < 10) {
      sig = sig * 10;
      exp -= 1;
    }

    var d1 = Math.max(0, Math.min(9, Math.floor(sig / 10)));
    var d2 = Math.max(0, Math.min(9, sig % 10));

    var multBand;
    if (exp >= 0 && exp <= 9) {
      multBand = EIA_DIGIT_COLORS[exp];
    } else if (EIA_MULTIPLIER_SPECIAL[String(exp)]) {
      multBand = EIA_MULTIPLIER_SPECIAL[String(exp)];
    } else {
      multBand = EIA_DIGIT_COLORS[0];
    }

    return {
      ohms: val,
      label: formatOhmsLabel(val),
      bands: [
        { name: EIA_DIGIT_COLORS[d1].name, hex: EIA_DIGIT_COLORS[d1].hex },
        { name: EIA_DIGIT_COLORS[d2].name, hex: EIA_DIGIT_COLORS[d2].hex },
        { name: multBand.name, hex: multBand.hex },
        { name: EIA_TOLERANCE_GOLD.name, hex: EIA_TOLERANCE_GOLD.hex }
      ]
    };
  }

  /**
   * Devuelve el nodo eléctrico interno de la protoboard MB-102 para un pinId dado.
   */
  function getBreadboardGroup(pinId) {
    if (typeof pinId !== "string") return null;
    var id = pinId.replace(/^\s+|\s+$/g, "");
    var m;

    m = /^(tp|tn|bp|bn)_(\d+)$/.exec(id);
    if (m) {
      var railNum = parseInt(m[2], 10);
      if (railNum < 1 || railNum > 50) return null;
      if (m[1] === "tp") return "top_pos";
      if (m[1] === "tn") return "top_neg";
      if (m[1] === "bp") return "bot_pos";
      return "bot_neg";
    }

    m = /^([a-j])(\d+)$/.exec(id);
    if (m) {
      var col = parseInt(m[2], 10);
      if (col < 1 || col > 63) return null;
      return m[1] <= "e" ? "top_col_" + col : "bot_col_" + col;
    }

    return null;
  }

  /**
   * Genera y cachea los 830 agujeros físicos de la protoboard MB-102 (165 x 55 x 9 mm)
   * sobre el plano superior y = 9.2 mm con paso exacto de 2.54 mm.
   */
  var cachedBreadboardPins = null;

  function appendPowerRail(pins, prefix, zPos, ySurface, pinType, railLabel, nodeName) {
    for (var i = 1; i <= 50; i++) {
      var zeroIdx = i - 1;
      var block = Math.floor(zeroIdx / 5);
      var offset = zeroIdx % 5;
      var slot = block * 6 + offset; // 10 bloques de 5 puntos separados por 1 paso vacío
      var xPos = round3((slot - 29) * PITCH);
      pins.push({
        id: prefix + "_" + i,
        name: railLabel + " #" + i,
        type: pinType,
        description: "Punto " + i + " del " + railLabel + " (nodo interno " + nodeName + ")",
        localPos: { x: xPos, y: ySurface, z: zPos }
      });
    }
  }

  function appendMatrixRows(pins, rows, ySurface, nodePrefix, areaLabel) {
    for (var r = 0; r < rows.length; r++) {
      var row = rows[r];
      for (var col = 1; col <= 63; col++) {
        var xCol = round3((col - 32) * PITCH);
        pins.push({
          id: row.letter + col,
          name: row.letter.toUpperCase() + col,
          type: "IO",
          description: areaLabel + " fila " + row.letter + ", columna " + col + " (nodo " + nodePrefix + col + ")",
          localPos: { x: xCol, y: ySurface, z: row.z }
        });
      }
    }
  }

  function buildBreadboard830Pins() {
    if (cachedBreadboardPins) return cachedBreadboardPins;

    var pins = [];
    var ySurface = 9.2;

    // Buses superiores e inferiores (50 puntos cada uno)
    appendPowerRail(pins, "tp", -22.86, ySurface, "POWER", "Bus Superior (+)", "top_pos");
    appendPowerRail(pins, "tn", -20.32, ySurface, "GND", "Bus Superior (-)", "top_neg");

    // Matriz superior: filas a..e, columnas 1..63
    appendMatrixRows(
      pins,
      [
        { letter: "a", z: -13.97 },
        { letter: "b", z: -11.43 },
        { letter: "c", z: -8.89 },
        { letter: "d", z: -6.35 },
        { letter: "e", z: -3.81 }
      ],
      ySurface,
      "top_col_",
      "Matriz superior"
    );

    // Matriz inferior: filas f..j, columnas 1..63 (canal DIP de 7.62 mm entre e y f)
    appendMatrixRows(
      pins,
      [
        { letter: "f", z: 3.81 },
        { letter: "g", z: 6.35 },
        { letter: "h", z: 8.89 },
        { letter: "i", z: 11.43 },
        { letter: "j", z: 13.97 }
      ],
      ySurface,
      "bot_col_",
      "Matriz inferior"
    );

    appendPowerRail(pins, "bp", 20.32, ySurface, "POWER", "Bus Inferior (+)", "bot_pos");
    appendPowerRail(pins, "bn", 22.86, ySurface, "GND", "Bus Inferior (-)", "bot_neg");

    cachedBreadboardPins = pins;
    return cachedBreadboardPins;
  }

  /**
   * Base de datos técnica completa de los 13 componentes del Starter Kit + cableado.
   */
  var ITEMS = {
    arduino_uno_r3: {
      type: "arduino_uno_r3",
      name: "Arduino Uno Rev3",
      shortName: "Arduino Uno R3",
      category: "Placas",
      model: "A000066 (ATmega328P-PU)",
      manufacturer: "Arduino AG",
      "package": "PCB THT 68.6 × 53.4 mm (MCU DIP-28)",
      isProgrammable: true,
      defaultProps: {},
      summary:
        "Placa microcontroladora basada en ATmega328P a 16 MHz con 14 pines de entrada/salida digital (6 PWM), 6 entradas analógicas de 10 bits, interfaz USB-Serie ATmega16U2, regulador lineal de 5 V y LED integrado en D13.",
      keySpecs: [
        { label: "Microcontrolador", value: "ATmega328P", unit: "8-bit AVR @ 16 MHz" },
        { label: "Tensión operativa (Vop)", value: "5", unit: "V DC" },
        { label: "Alimentación recomendada (Vin)", value: "7 – 12", unit: "V DC" },
        { label: "Corriente por pin E/S", value: "20 rec. / 40 máx.", unit: "mA" },
        { label: "Memoria Flash", value: "32", unit: "KB (0.5 KB bootloader)" },
        { label: "SRAM / EEPROM", value: "2 / 1", unit: "KB" }
      ],
      absoluteMaxRatings: [
        { parameter: "Tensión de entrada Vin (límite)", value: "6 – 20 V", notes: "Por encima de 12 V el regulador NCP1117 disipa calor excesivo" },
        { parameter: "Tensión en cualquier pin E/S", value: "-0.5 V a Vcc + 0.5 V", notes: "Máximo absoluto 5.5 V en entradas digitales/analógicas" },
        { parameter: "Corriente DC máxima por pin E/S", value: "40 mA", notes: "Límite absoluto; no superar 20 mA continuos recomendados" },
        { parameter: "Corriente DC total en pines Vcc / GND", value: "200 mA", notes: "Suma máxima combinada en todos los puertos" },
        { parameter: "Corriente pin 3.3 V", value: "50 mA", notes: "Regulador auxiliar LP2985 de 3.3 V" },
        { parameter: "Temperatura de operación", value: "-40 °C a +85 °C", notes: "Especificación industrial del ATmega328P" }
      ],
      electricalCharacteristics: [
        { parameter: "Tensión lógica baja de entrada (VIL)", min: "-0.5", typ: "0.0", max: "1.5", unit: "V", conditions: "Vcc = 5.0 V" },
        { parameter: "Tensión lógica alta de entrada (VIH)", min: "3.0", typ: "5.0", max: "5.5", unit: "V", conditions: "Vcc = 5.0 V" },
        { parameter: "Tensión lógica baja de salida (VOL)", min: "0.0", typ: "0.1", max: "0.9", unit: "V", conditions: "IOL = 20 mA, Vcc = 5.0 V" },
        { parameter: "Tensión lógica alta de salida (VOH)", min: "4.2", typ: "4.8", max: "5.0", unit: "V", conditions: "IOH = -20 mA, Vcc = 5.0 V" },
        { parameter: "Frecuencia de reloj del sistema", min: "15.9", typ: "16.0", max: "16.1", unit: "MHz", conditions: "Resonador cerámico/cristal externo" },
        { parameter: "Resolución ADC (A0–A5)", min: "10", typ: "10", max: "10", unit: "bits", conditions: "0–1023 cuentas (4.88 mV/paso @ 5 V)" },
        { parameter: "Frecuencia PWM estándar", min: "490", typ: "490 / 980", max: "980", unit: "Hz", conditions: "980 Hz en D5 y D6; 490 Hz en D3, D9, D10, D11" }
      ],
      pinout: [
        // Header superior (z = -24.13 mm, de izquierda a derecha: AREF, GND1, D13..D0)
        { id: "AREF", name: "AREF", type: "ANALOG", description: "Tensión de referencia externa para el conversor ADC.", localPos: { x: -7.88, y: 10.1, z: -24.13 } },
        { id: "GND1", name: "GND1", type: "GND", description: "Referencia de tierra digital superior (0 V).", localPos: { x: -5.34, y: 10.1, z: -24.13 } },
        { id: "D13", name: "D13 (SCK / LED L)", type: "IO", description: "E/S digital 13, reloj SPI SCK y conectado al LED integrado 'L'.", localPos: { x: -2.80, y: 10.1, z: -24.13 } },
        { id: "D12", name: "D12 (MISO)", type: "IO", description: "E/S digital 12 / entrada de datos SPI MISO.", localPos: { x: -0.26, y: 10.1, z: -24.13 } },
        { id: "D11", name: "D11 (PWM / MOSI)", type: "PWM", description: "E/S digital 11 con salida PWM (~490 Hz) y salida SPI MOSI.", localPos: { x: 2.28, y: 10.1, z: -24.13 } },
        { id: "D10", name: "D10 (PWM / SS)", type: "PWM", description: "E/S digital 10 con salida PWM (~490 Hz) y selección SPI SS.", localPos: { x: 4.82, y: 10.1, z: -24.13 } },
        { id: "D9", name: "D9 (PWM)", type: "PWM", description: "E/S digital 9 con salida PWM (~490 Hz, ideal para Servo).", localPos: { x: 7.36, y: 10.1, z: -24.13 } },
        { id: "D8", name: "D8", type: "IO", description: "E/S digital 8 de propósito general.", localPos: { x: 9.90, y: 10.1, z: -24.13 } },
        { id: "D7", name: "D7", type: "IO", description: "E/S digital 7 de propósito general.", localPos: { x: 13.96, y: 10.1, z: -24.13 } },
        { id: "D6", name: "D6 (PWM)", type: "PWM", description: "E/S digital 6 con salida PWM (~980 Hz).", localPos: { x: 16.50, y: 10.1, z: -24.13 } },
        { id: "D5", name: "D5 (PWM)", type: "PWM", description: "E/S digital 5 con salida PWM (~980 Hz).", localPos: { x: 19.04, y: 10.1, z: -24.13 } },
        { id: "D4", name: "D4", type: "IO", description: "E/S digital 4 de propósito general.", localPos: { x: 21.58, y: 10.1, z: -24.13 } },
        { id: "D3", name: "D3 (PWM / INT1)", type: "PWM", description: "E/S digital 3 con PWM (~490 Hz) e interrupción externa INT1.", localPos: { x: 24.12, y: 10.1, z: -24.13 } },
        { id: "D2", name: "D2 (INT0)", type: "IO", description: "E/S digital 2 con soporte para interrupción externa INT0.", localPos: { x: 26.66, y: 10.1, z: -24.13 } },
        { id: "D1", name: "D1 (TX)", type: "IO", description: "E/S digital 1 / transmisor serie UART TX.", localPos: { x: 29.20, y: 10.1, z: -24.13 } },
        { id: "D0", name: "D0 (RX)", type: "IO", description: "E/S digital 0 / receptor serie UART RX.", localPos: { x: 31.74, y: 10.1, z: -24.13 } },

        // Header inferior (z = +24.13 mm, de izquierda a derecha: IOREF..VIN y A0..A5)
        { id: "IOREF", name: "IOREF", type: "POWER", description: "Referencia de tensión lógica de E/S de la placa (5 V).", localPos: { x: -1.28, y: 10.1, z: 24.13 } },
        { id: "RESET", name: "RESET", type: "CONTROL", description: "Entrada activa en nivel bajo para reiniciar el ATmega328P.", localPos: { x: 1.26, y: 10.1, z: 24.13 } },
        { id: "3.3V", name: "3.3V", type: "POWER", description: "Salida regulada de 3.3 V DC (máx. 50 mA).", localPos: { x: 3.80, y: 10.1, z: 24.13 } },
        { id: "5V", name: "5V", type: "POWER", description: "Salida regulada de 5.0 V DC para alimentar circuitos externos.", localPos: { x: 6.34, y: 10.1, z: 24.13 } },
        { id: "GND2", name: "GND2", type: "GND", description: "Referencia de tierra de alimentación (0 V).", localPos: { x: 8.88, y: 10.1, z: 24.13 } },
        { id: "GND3", name: "GND3", type: "GND", description: "Referencia de tierra de alimentación (0 V).", localPos: { x: 11.42, y: 10.1, z: 24.13 } },
        { id: "VIN", name: "VIN", type: "POWER", description: "Entrada de alimentación no regulada (7–12 V recomendados).", localPos: { x: 13.96, y: 10.1, z: 24.13 } },
        { id: "A0", name: "A0", type: "ANALOG", description: "Entrada analógica ADC 0 (también E/S digital D14).", localPos: { x: 19.04, y: 10.1, z: 24.13 } },
        { id: "A1", name: "A1", type: "ANALOG", description: "Entrada analógica ADC 1 (también E/S digital D15).", localPos: { x: 21.58, y: 10.1, z: 24.13 } },
        { id: "A2", name: "A2", type: "ANALOG", description: "Entrada analógica ADC 2 (también E/S digital D16).", localPos: { x: 24.12, y: 10.1, z: 24.13 } },
        { id: "A3", name: "A3", type: "ANALOG", description: "Entrada analógica ADC 3 (también E/S digital D17).", localPos: { x: 26.66, y: 10.1, z: 24.13 } },
        { id: "A4", name: "A4 (SDA)", type: "ANALOG", description: "Entrada analógica ADC 4 / línea de datos I2C SDA.", localPos: { x: 29.20, y: 10.1, z: 24.13 } },
        { id: "A5", name: "A5 (SCL)", type: "ANALOG", description: "Entrada analógica ADC 5 / reloj I2C SCL.", localPos: { x: 31.74, y: 10.1, z: 24.13 } }
      ],
      formulas: [
        {
          title: "Conversión analógica ADC (10 bits)",
          formula: "V_in = (ADC / 1023) × V_ref",
          explanation: "Con V_ref = 5.0 V, cada unidad leída por analogRead() equivale a ≈ 4.888 mV."
        },
        {
          title: "Tensión media en salida PWM",
          formula: "V_avg = V_cc × (duty / 255)",
          explanation: "analogWrite(pin, duty) modula el ciclo de trabajo entre 0 (0 %) y 255 (100 %)."
        },
        {
          title: "Corriente segura por pin digital",
          formula: "I_pin = (V_OH - V_carga) / R_serie ≤ 20 mA",
          explanation: "Mantener la corriente por debajo de 20 mA evita caídas de tensión y daño térmico en el puerto."
        }
      ],
      applicationNotes: [
        "Inserta siempre una resistencia limitadora en serie (p. ej. 220 Ω) al conectar un LED a un pin digital.",
        "Evita usar D0 (RX) y D1 (TX) si estás utilizando el Monitor Serie simultáneamente.",
        "Activa la resistencia interna de ~20–50 kΩ con pinMode(pin, INPUT_PULLUP) para leer pulsadores conectados a GND sin resistencia externa.",
        "Al usar Servo.h se desactiva la salida PWM nativa en los pines D9 y D10 del Timer1."
      ]
    },

    breadboard_830: {
      type: "breadboard_830",
      name: "Protoboard 830 Puntos (MB-102)",
      shortName: "Protoboard 830",
      category: "Protoboard y Pasivos",
      model: "MB-102",
      manufacturer: "Genérico / BusBoard",
      "package": "Cuerpo ABS 165 × 55 × 9 mm, paso 2.54 mm",
      isProgrammable: false,
      defaultProps: {},
      summary:
        "Placa de pruebas sin soldadura MB-102 de 830 puntos de inserción con paso estándar de 2.54 mm: 630 contactos en matriz principal (filas a–e y f–j en 63 columnas) y 200 puntos en 4 buses de alimentación.",
      keySpecs: [
        { label: "Puntos totales", value: "830", unit: "630 matriz + 200 buses" },
        { label: "Dimensiones", value: "165 × 55 × 9", unit: "mm" },
        { label: "Paso entre contactos", value: "2.54", unit: "mm (0.1\")" },
        { label: "Material de contactos", value: "Bronce fosforoso", unit: "baño níquel" },
        { label: "Capacidad máxima", value: "36 V / 2 A", unit: "DC" },
        { label: "Calibre admitido", value: "20 – 29", unit: "AWG (0.3–0.8 mm)" }
      ],
      absoluteMaxRatings: [
        { parameter: "Tensión máxima entre pistas adyacentes", value: "36 V", notes: "Recomendado ≤ 12 V DC para prototipos lógicos" },
        { parameter: "Corriente máxima continua por pinza", value: "2 A", notes: "Evitar sobrecalentamiento en los clips de bronce fosforoso" },
        { parameter: "Diámetro máximo de patilla", value: "0.8 mm", notes: "Patillas más gruesas deforman los resortes internos" }
      ],
      electricalCharacteristics: [
        { parameter: "Resistencia de contacto", min: "10", typ: "20", max: "50", unit: "mΩ", conditions: "Pin macho estándar 0.64 mm (22 AWG)" },
        { parameter: "Capacitancia parásita entre columnas", min: "2", typ: "5", max: "10", unit: "pF", conditions: "Columnas adyacentes a 2.54 mm" },
        { parameter: "Resistencia de aislamiento", min: "500", typ: "> 1000", max: "—", unit: "MΩ", conditions: "500 V DC entre pistas adyacentes" }
      ],
      pinout: [
        { id: "tp_1..tp_50", name: "Bus Superior (+)", type: "POWER", description: "50 puntos horizontales interconectados en línea roja superior (nodo interno top_pos).", localPos: { x: 0, y: 9.2, z: -22.86 } },
        { id: "tn_1..tn_50", name: "Bus Superior (-)", type: "GND", description: "50 puntos horizontales interconectados en línea azul superior (nodo interno top_neg).", localPos: { x: 0, y: 9.2, z: -20.32 } },
        { id: "a1..e63", name: "Matriz Superior (a–e, 1–63)", type: "IO", description: "315 puntos en 63 columnas verticales de 5 contactos unidos entre sí (nodos top_col_1..63).", localPos: { x: 0, y: 9.2, z: -8.89 } },
        { id: "f1..j63", name: "Matriz Inferior (f–j, 1–63)", type: "IO", description: "315 puntos en 63 columnas verticales de 5 contactos unidos entre sí (nodos bot_col_1..63).", localPos: { x: 0, y: 9.2, z: 8.89 } },
        { id: "bp_1..bp_50", name: "Bus Inferior (+)", type: "POWER", description: "50 puntos horizontales interconectados en línea roja inferior (nodo interno bot_pos).", localPos: { x: 0, y: 9.2, z: 20.32 } },
        { id: "bn_1..bn_50", name: "Bus Inferior (-)", type: "GND", description: "50 puntos horizontales interconectados en línea azul inferior (nodo interno bot_neg).", localPos: { x: 0, y: 9.2, z: 22.86 } }
      ],
      formulas: [
        {
          title: "Caída de tensión en pista de bus",
          formula: "ΔV_bus = I_total × R_contacto",
          explanation: "Las corrientes altas (> 500 mA) deben distribuirse evitando encadenar múltiples puentes finos."
        }
      ],
      applicationNotes: [
        "El canal central de 7.62 mm separa eléctricamente las filas a–e de las filas f–j, ideal para encapsulados DIP y pulsadores de 4 patas.",
        "Las 5 perforaciones verticales de cada columna comparten nodo interno; no insertes ambos terminales de un mismo componente en la misma columna.",
        "Los buses superior e inferior son independientes hasta que los puentees con cables Dupont."
      ]
    },

    led: {
      type: "led",
      name: "Diodo Emisor de Luz (LED 5 mm Difuso)",
      shortName: "LED 5 mm",
      category: "Actuadores",
      model: "Serie L-53 (L-53ID / GD / YD / BD / WD)",
      manufacturer: "Kingbright",
      "package": "T-1 3/4 (Ø 5 mm) epoxi difuso, 2 terminales",
      isProgrammable: false,
      defaultProps: { color: "red" },
      summary:
        "Diodo emisor de luz estándar de 5 mm con encapsulado epoxi difuso y patilla larga para el ánodo (+). Disponible en rojo, verde, amarillo, azul y blanco con distinta tensión directa Vf.",
      keySpecs: [
        { label: "Corriente directa típica (If)", value: "20", unit: "mA" },
        { label: "Corriente directa máxima", value: "30", unit: "mA" },
        { label: "Tensión inversa máxima (Vr)", value: "5", unit: "V" },
        { label: "Vf Rojo / Amarillo / Verde", value: "1.9 / 2.0 / 2.1", unit: "V" },
        { label: "Vf Azul / Blanco", value: "3.1 / 3.2", unit: "V" },
        { label: "Ángulo de visión", value: "60", unit: "° (difuso)" }
      ],
      absoluteMaxRatings: [
        { parameter: "Corriente directa continua (IF max)", value: "30 mA", notes: "Superar 30 mA degrada o destruye la unión semiconductora" },
        { parameter: "Corriente pico pulsada", value: "100 mA", notes: "Ciclo 1/10, ancho de pulso ≤ 0.1 ms" },
        { parameter: "Tensión inversa máxima (VR)", value: "5 V", notes: "No polarizar en inversa por encima de 5 V" },
        { parameter: "Disipación de potencia máxima", value: "75 – 105 mW", notes: "Según color del chip (AlGaInP / InGaN)" }
      ],
      electricalCharacteristics: [
        { parameter: "Tensión directa Vf — Rojo (625 nm)", min: "1.7", typ: "1.9", max: "2.3", unit: "V", conditions: "IF = 20 mA, Ta = 25 °C" },
        { parameter: "Tensión directa Vf — Amarillo (590 nm)", min: "1.8", typ: "2.0", max: "2.4", unit: "V", conditions: "IF = 20 mA, Ta = 25 °C" },
        { parameter: "Tensión directa Vf — Verde (565 nm)", min: "1.9", typ: "2.1", max: "2.5", unit: "V", conditions: "IF = 20 mA, Ta = 25 °C" },
        { parameter: "Tensión directa Vf — Azul (470 nm)", min: "2.8", typ: "3.1", max: "3.6", unit: "V", conditions: "IF = 20 mA, Ta = 25 °C" },
        { parameter: "Tensión directa Vf — Blanco (6000 K)", min: "2.9", typ: "3.2", max: "3.6", unit: "V", conditions: "IF = 20 mA, Ta = 25 °C" },
        { parameter: "Corriente inversa (IR)", min: "—", typ: "< 1", max: "10", unit: "µA", conditions: "VR = 5 V" }
      ],
      pinout: [
        { id: "ANODE", name: "Ánodo (+)", type: "POWER", description: "Terminal positivo (patilla más larga). Conectar hacia fuente o pin digital mediante resistencia.", localPos: { x: -1.27, y: 0.4, z: 0 } },
        { id: "CATHODE", name: "Cátodo (-)", type: "GND", description: "Terminal negativo (patilla más corta y lado plano del collarín). Conectar hacia GND.", localPos: { x: 1.27, y: 0.4, z: 0 } }
      ],
      formulas: [
        {
          title: "Cálculo de resistencia limitadora",
          formula: "R = (V_cc - V_f) / I_f",
          explanation: "Para Arduino (5 V), LED rojo (1.9 V) e I_f ≈ 14 mA: R = (5 - 1.9) / 0.014 = 221 Ω → estándar 220 Ω."
        },
        {
          title: "Corriente real resultante",
          formula: "I_LED = máx(0, (V_ánodo - V_cátodo - V_f) / R_total)",
          explanation: "Sin resistencia en serie ocurre sobrecorriente peligrosa tanto para el LED como para el pin del Arduino."
        }
      ],
      applicationNotes: [
        "Nunca conectes un LED directamente entre 5 V y GND o entre un pin HIGH y GND sin resistencia limitadora.",
        "Los LEDs azul y blanco tienen Vf superior a 3 V, por lo que no encienden con tensiones inferiores a su umbral."
      ]
    },

    resistor: {
      type: "resistor",
      name: "Resistencia Axial de Película de Carbón 1/4 W",
      shortName: "Resistencia 1/4W",
      category: "Protoboard y Pasivos",
      model: "CFR-25JB-52 (±5%)",
      manufacturer: "Yageo",
      "package": "Axial CFR-25 (Ø 2.4 × 6.3 mm)",
      isProgrammable: false,
      defaultProps: { ohms: 220 },
      standardValues: STANDARD_RESISTOR_VALUES.slice(),
      summary:
        "Resistencia axial fija de película de carbón de 1/4 W (0.25 W) con código de 4 bandas EIA y tolerancia ±5 % (banda dorada). Valores incluidos en el kit: 100 Ω, 220 Ω, 330 Ω, 1 kΩ, 4.7 kΩ y 10 kΩ.",
      keySpecs: [
        { label: "Potencia nominal", value: "0.25", unit: "W (1/4 W)" },
        { label: "Tolerancia", value: "±5", unit: "% (banda dorada)" },
        { label: "Tensión máxima de trabajo", value: "250", unit: "V RMS / DC" },
        { label: "Valores estándar del kit", value: "100 – 10k", unit: "Ω (6 valores)" },
        { label: "Código de color", value: "4 bandas", unit: "EIA" }
      ],
      absoluteMaxRatings: [
        { parameter: "Tensión máxima de trabajo (Vmax)", value: "250 V", notes: "Tensión de sobrecarga máx. 500 V (5 s)" },
        { parameter: "Disipación máxima a 70 °C", value: "0.25 W", notes: "Aplicar reducción lineal hasta 0 W a 155 °C" },
        { parameter: "Temperatura de operación", value: "-55 °C a +155 °C", notes: "Cuerpo recubierto de laca ignífuga beige" }
      ],
      electricalCharacteristics: [
        { parameter: "Coeficiente térmico (TCR)", min: "-500", typ: "±350", max: "+350", unit: "ppm/°C", conditions: "Valores de 100 Ω a 10 kΩ" },
        { parameter: "Tolerancia resistiva", min: "-5", typ: "0", max: "+5", unit: "%", conditions: "Medición a 25 °C" },
        { parameter: "Ruido térmico / corriente", min: "—", typ: "< 0.1", max: "0.4", unit: "µV/V", conditions: "Serie CFR-25" }
      ],
      pinout: [
        { id: "P1", name: "Terminal 1", type: "PASSIVE", description: "Terminal axial no polarizado (intercambiable con P2).", localPos: { x: -5.08, y: 0.4, z: 0 } },
        { id: "P2", name: "Terminal 2", type: "PASSIVE", description: "Terminal axial no polarizado (intercambiable con P1).", localPos: { x: 5.08, y: 0.4, z: 0 } }
      ],
      formulas: [
        {
          title: "Ley de Ohm",
          formula: "V = I × R",
          explanation: "La caída de tensión en bornes es directamente proporcional a la corriente que la atraviesa."
        },
        {
          title: "Potencia disipada",
          formula: "P = I² × R = V² / R ≤ 0.25 W",
          explanation: "Con 5 V sobre 100 Ω se disipan 0.25 W (en el límite); sobre 220 Ω son 0.11 W."
        }
      ],
      applicationNotes: [
        "Las resistencias no tienen polaridad: P1 y P2 son totalmente intercambiables.",
        "Usa 220 Ω o 330 Ω para proteger LEDs a 5 V, y 10 kΩ como resistencia pull-down/pull-up o divisor con LDR."
      ]
    },

    wire: {
      type: "wire",
      name: "Cable Puente Dupont 22 AWG",
      shortName: "Cable Dupont",
      category: "Protoboard y Pasivos",
      model: "Dupont M-M 22 AWG",
      manufacturer: "Genérico",
      "package": "Conductor 22 AWG cobre estañado, aislamiento PVC, pin 0.64 mm",
      isProgrammable: false,
      defaultProps: { color: "#EF4444" },
      summary:
        "Cable flexible de interconexión para protoboard y pines Arduino con conductor de cobre estañado calibre 22 AWG, cubierta aislante de PVC en múltiples colores y conectores macho de paso 2.54 mm.",
      keySpecs: [
        { label: "Calibre conductor", value: "22", unit: "AWG (0.326 mm²)" },
        { label: "Conductor / Aislamiento", value: "Cobre estañado / PVC", unit: "Flexible" },
        { label: "Tensión máxima", value: "300", unit: "V" },
        { label: "Corriente máxima", value: "3", unit: "A" }
      ],
      absoluteMaxRatings: [
        { parameter: "Tensión nominal de aislamiento", value: "300 V", notes: "Aislamiento PVC estándar UL1007" },
        { parameter: "Corriente máxima recomendada", value: "3 A", notes: "Limitada por calentamiento del contacto Dupont (~2 A típico)" },
        { parameter: "Temperatura máxima del PVC", value: "80 °C", notes: "No exponer a soldador directo" }
      ],
      electricalCharacteristics: [
        { parameter: "Resistencia lineal del cobre 22 AWG", min: "50", typ: "53", max: "58", unit: "mΩ/m", conditions: "20 °C, cobre estañado" },
        { parameter: "Resistencia de contacto Dupont", min: "5", typ: "15", max: "30", unit: "mΩ", conditions: "Acoplamiento en header 2.54 mm" }
      ],
      pinout: [
        { id: "EXTREMO_A", name: "Extremo A", type: "PASSIVE", description: "Conector macho Dupont de 0.64 mm para inserción en protoboard o Arduino.", localPos: { x: -10, y: 1.0, z: 0 } },
        { id: "EXTREMO_B", name: "Extremo B", type: "PASSIVE", description: "Conector macho Dupont de 0.64 mm unido eléctricamente al extremo A.", localPos: { x: 10, y: 1.0, z: 0 } }
      ],
      formulas: [
        {
          title: "Caída de tensión en cable",
          formula: "ΔV = I × R_cable",
          explanation: "Para longitudes típicas de 15 cm y corrientes < 1 A, la caída es inferior a 10 mV."
        }
      ],
      applicationNotes: [
        "Convención recomendada: rojo para +5 V, negro para GND, y amarillo/azul/verde/blanco para señales."
      ]
    },

    pushbutton: {
      type: "pushbutton",
      name: "Pulsador Táctil 6×6 mm SPST-NO",
      shortName: "Pulsador B3F",
      category: "Protoboard y Pasivos",
      model: "B3F-1000",
      manufacturer: "Omron",
      "package": "THT 6.0 × 6.0 × 4.3 mm, 4 terminales",
      isProgrammable: false,
      defaultProps: { pressed: false },
      summary:
        "Interruptor momentáneo normalmente abierto (SPST-NO) de acción táctil. Sus 4 patas están agrupadas en dos pares internos permanentes: 1A–1B conectados entre sí y 2A–2B conectados entre sí; al pulsar se cierra 1↔2.",
      keySpecs: [
        { label: "Configuración", value: "SPST-NO", unit: "Momentáneo 4 pines" },
        { label: "Capacidad de carga máx.", value: "24 V DC / 50 mA", unit: "Resistiva" },
        { label: "Resistencia de contacto (Rc)", value: "< 100", unit: "mΩ" },
        { label: "Fuerza de actuación", value: "0.98", unit: "N (100 gf)" },
        { label: "Conexión interna", value: "1A–1B y 2A–2B", unit: "Puente al pulsar" }
      ],
      absoluteMaxRatings: [
        { parameter: "Tensión máxima conmutada", value: "24 V DC", notes: "Carga resistiva; mínimo 5 V DC / 1 mA" },
        { parameter: "Corriente máxima de contacto", value: "50 mA", notes: "No apto para conmutación directa de motores" },
        { parameter: "Vida mecánica eléctrica", value: "1 000 000 ciclos", notes: "Versión estándar 0.98 N" }
      ],
      electricalCharacteristics: [
        { parameter: "Resistencia de contacto inicial (Rc)", min: "10", typ: "30", max: "100", unit: "mΩ", conditions: "5 V DC, 1 mA" },
        { parameter: "Tiempo de rebote (bounce)", min: "0.5", typ: "2.0", max: "5.0", unit: "ms", conditions: "Requiere antirrebote por software o RC" },
        { parameter: "Resistencia de aislamiento", min: "100", typ: "> 100", max: "—", unit: "MΩ", conditions: "250 V DC entre polos abiertos" }
      ],
      pinout: [
        { id: "1A", name: "Polo 1 – Pin A", type: "PASSIVE", description: "Conectado internamente de forma permanente con 1B.", localPos: { x: -2.54, y: 0.4, z: -3.81 } },
        { id: "1B", name: "Polo 1 – Pin B", type: "PASSIVE", description: "Conectado internamente de forma permanente con 1A.", localPos: { x: 2.54, y: 0.4, z: -3.81 } },
        { id: "2A", name: "Polo 2 – Pin A", type: "PASSIVE", description: "Conectado internamente de forma permanente con 2B; une con Polo 1 al pulsar.", localPos: { x: -2.54, y: 0.4, z: 3.81 } },
        { id: "2B", name: "Polo 2 – Pin B", type: "PASSIVE", description: "Conectado internamente de forma permanente con 2A; une con Polo 1 al pulsar.", localPos: { x: 2.54, y: 0.4, z: 3.81 } }
      ],
      formulas: [
        {
          title: "Lectura con INPUT_PULLUP",
          formula: "digitalRead(pin) == LOW ⇔ Pulsado",
          explanation: "Al conectar Polo 1 a GND y Polo 2 al pin configurado como INPUT_PULLUP, al pulsar el pin cae a 0 V (LOW)."
        }
      ],
      applicationNotes: [
        "Coloca el pulsador salvando el canal central de la protoboard para evitar cortocircuitar 1A–1B o 2A–2B con la misma columna.",
        "Implementa un retardo antirrebote (debounce) de 20–50 ms si cuentas pulsaciones por flanco."
      ]
    },

    potentiometer: {
      type: "potentiometer",
      name: "Potenciómetro Lineal 10 kΩ (B10K)",
      shortName: "Potenciómetro 10k",
      category: "Protoboard y Pasivos",
      model: "PTV09A / B10K",
      manufacturer: "Bourns",
      "package": "Giratorio de eje vertical 9 mm, 3 pines paso 2.54 mm",
      isProgrammable: false,
      defaultProps: { value: 0.5, resistance: 10000 },
      summary:
        "Divisor de tensión resistivo lineal de 10 kΩ y 0.1 W con ángulo de rotación de 300°. El cursor central (WIPER) varía proporcionalmente la tensión de salida entre GND y VCC.",
      keySpecs: [
        { label: "Resistencia total", value: "10", unit: "kΩ (±20 %)" },
        { label: "Ley de variación", value: "Lineal (Tipo B)", unit: "Proporcional" },
        { label: "Potencia nominal", value: "0.1", unit: "W (100 mW)" },
        { label: "Ángulo de giro mecánico", value: "300", unit: "° (±5°)" }
      ],
      absoluteMaxRatings: [
        { parameter: "Tensión máxima de operación", value: "50 V DC", notes: "En circuitos Arduino se alimenta a 5 V DC" },
        { parameter: "Potencia máxima disipada", value: "0.1 W", notes: "A 5 V sobre 10 kΩ disipa solo 2.5 mW" },
        { parameter: "Vida rotacional", value: "10 000 ciclos", notes: "Pista de carbón conductivo" }
      ],
      electricalCharacteristics: [
        { parameter: "Resistencia nominal (VCC–GND)", min: "8.0", typ: "10.0", max: "12.0", unit: "kΩ", conditions: "Tolerancia ±20 %" },
        { parameter: "Resistencia residual en extremos", min: "0", typ: "< 10", max: "20", unit: "Ω", conditions: "Cursor en 0 % o 100 %" },
        { parameter: "Corriente de reposo del divisor @ 5 V", min: "0.42", typ: "0.50", max: "0.62", unit: "mA", conditions: "VCC = 5.0 V" }
      ],
      pinout: [
        { id: "VCC", name: "Extremo A (VCC)", type: "POWER", description: "Extremo superior de la pista resistiva (conectar a 5 V).", localPos: { x: -2.54, y: 0.4, z: 5.08 } },
        { id: "WIPER", name: "Cursor (WIPER)", type: "ANALOG", description: "Salida analógica variable proporcional al giro (conectar a A0–A5).", localPos: { x: 0, y: 0.4, z: 5.08 } },
        { id: "GND", name: "Extremo B (GND)", type: "GND", description: "Extremo inferior de la pista resistiva (conectar a GND).", localPos: { x: 2.54, y: 0.4, z: 5.08 } }
      ],
      formulas: [
        {
          title: "Divisor de tensión del cursor",
          formula: "V_WIPER = V_GND + (V_VCC - V_GND) × α",
          explanation: "Si α ∈ [0, 1] es la posición normalizada del eje, con 5 V y GND el rango de salida es 0.00 V a 5.00 V (ADC 0–1023)."
        }
      ],
      applicationNotes: [
        "No conectes el pin WIPER directamente como salida de potencia: la entrada analógica de Arduino es de alta impedancia y apenas consume corriente.",
        "Puedes intercambiar VCC y GND para invertir el sentido de crecimiento del valor leído."
      ]
    },

    servo_sg90: {
      type: "servo_sg90",
      name: "Micro Servomotor TowerPro SG90",
      shortName: "Servo SG90",
      category: "Actuadores",
      model: "SG90 (9 g)",
      manufacturer: "TowerPro",
      "package": "Caja 22.2 × 11.8 × 31 mm con brazo y conector 3 pines",
      isProgrammable: false,
      defaultProps: { angle: 90 },
      summary:
        "Actuador posicional en lazo cerrado con tren de engranajes de nailon y control por pulsos PWM a 50 Hz. Permite posicionar el eje entre 0° y 180° mediante pulsos de 500 a 2400 µs.",
      keySpecs: [
        { label: "Tensión de alimentación", value: "4.8 – 6.0", unit: "V DC" },
        { label: "Torque de parada (@ 4.8 V)", value: "1.8", unit: "kg·cm" },
        { label: "Velocidad sin carga", value: "0.10", unit: "s / 60° (@ 4.8 V)" },
        { label: "Rango de giro", value: "0 – 180", unit: "°" },
        { label: "Señal PWM", value: "50 Hz", unit: "500 – 2400 µs" }
      ],
      absoluteMaxRatings: [
        { parameter: "Tensión máxima de alimentación", value: "6.0 V", notes: "No alimentar por encima de 6 V para evitar dañar el puente H interno" },
        { parameter: "Corriente pico de bloqueo (stall)", value: "650 – 800 mA", notes: "Alimentar con fuente externa si se bloquea o se usan varios servos" },
        { parameter: "Temperatura de operación", value: "0 °C a +55 °C", notes: "Engranajes de POM/nailon" }
      ],
      electricalCharacteristics: [
        { parameter: "Tensión de alimentación", min: "4.8", typ: "5.0", max: "6.0", unit: "V", conditions: "Pin rojo (VCC)" },
        { parameter: "Corriente en reposo", min: "3", typ: "5", max: "10", unit: "mA", conditions: "Sin carga ni movimiento" },
        { parameter: "Corriente en movimiento libre", min: "100", typ: "180", max: "250", unit: "mA", conditions: "5.0 V sin carga externa" },
        { parameter: "Frecuencia de control PWM", min: "45", typ: "50", max: "60", unit: "Hz", conditions: "Periodo nominal 20 ms" },
        { parameter: "Ancho de pulso de control", min: "500", typ: "1500 (90°)", max: "2400", unit: "µs", conditions: "500 µs ≈ 0°, 1500 µs = 90°, 2400 µs ≈ 180°" }
      ],
      pinout: [
        { id: "GND", name: "GND (Marrón)", type: "GND", description: "Referencia negativa de alimentación y señal (cable marrón/negro).", localPos: { x: 14.5, y: 3.0, z: -2.54 } },
        { id: "VCC", name: "VCC (Rojo)", type: "POWER", description: "Alimentación positiva 4.8–6.0 V (cable rojo).", localPos: { x: 14.5, y: 3.0, z: 0 } },
        { id: "PWM", name: "PWM / Señal (Naranja)", type: "PWM", description: "Entrada de pulsos de control 50 Hz (cable naranja/amarillo).", localPos: { x: 14.5, y: 3.0, z: 2.54 } }
      ],
      formulas: [
        {
          title: "Relación ancho de pulso ↔ ángulo",
          formula: "t_pulso(µs) ≈ 544 + (ángulo / 180) × (2400 - 544)",
          explanation: "La librería estándar Servo.h de Arduino mapea 0°–180° por defecto entre 544 µs y 2400 µs cada 20 ms."
        }
      ],
      applicationNotes: [
        "Conecta siempre una masa común (GND) entre la alimentación del servo y el Arduino.",
        "Evita forzar manualmente el brazo cuando está energizado para no dañar los engranajes plásticos."
      ]
    },

    ultrasonic_hcsr04: {
      type: "ultrasonic_hcsr04",
      name: "Sensor Ultrasónico de Distancia HC-SR04",
      shortName: "Ultrasonido HC-SR04",
      category: "Sensores",
      model: "HC-SR04",
      manufacturer: "ElecFreaks / Cytron",
      "package": "PCB 45 × 20 × 15 mm con cápsulas T/R 40 kHz",
      isProgrammable: false,
      defaultProps: { distanceCm: 45 },
      summary:
        "Módulo transductor ultrasónico sin contacto para medición de distancias entre 2 y 400 cm mediante ráfaga de 8 pulsos a 40 kHz y lectura de tiempo de vuelo en el pin ECHO.",
      keySpecs: [
        { label: "Tensión de alimentación", value: "5", unit: "V DC" },
        { label: "Corriente de trabajo", value: "15", unit: "mA" },
        { label: "Frecuencia ultrasónica", value: "40", unit: "kHz" },
        { label: "Rango de medición", value: "2 – 400", unit: "cm" },
        { label: "Fórmula de distancia", value: "d = t / 58", unit: "cm (t en µs)" }
      ],
      absoluteMaxRatings: [
        { parameter: "Tensión de alimentación VCC", value: "5.5 V", notes: "Operar estrictamente a 5.0 V DC" },
        { parameter: "Tensión en pin TRIG", value: "5.5 V", notes: "Lógica TTL 5 V" },
        { parameter: "Temperatura de trabajo", value: "-15 °C a +70 °C", notes: "La velocidad del sonido varía con la temperatura" }
      ],
      electricalCharacteristics: [
        { parameter: "Corriente en reposo", min: "—", typ: "2", max: "3", unit: "mA", conditions: "Sin disparo activo" },
        { parameter: "Corriente activa de medición", min: "10", typ: "15", max: "20", unit: "mA", conditions: "Durante ráfaga de 40 kHz" },
        { parameter: "Pulso mínimo de disparo (TRIG)", min: "10", typ: "10", max: "—", unit: "µs", conditions: "Flanco de bajada inicia 8 ciclos a 40 kHz" },
        { parameter: "Resolución de distancia", min: "—", typ: "0.3", max: "—", unit: "cm", conditions: "Ángulo efectivo de cono ≈ 15°" }
      ],
      pinout: [
        { id: "VCC", name: "VCC", type: "POWER", description: "Alimentación positiva regulada de 5 V DC.", localPos: { x: -3.81, y: 0.4, z: 0 } },
        { id: "TRIG", name: "TRIG", type: "IO", description: "Entrada de disparo: aplicar pulso HIGH ≥ 10 µs.", localPos: { x: -1.27, y: 0.4, z: 0 } },
        { id: "ECHO", name: "ECHO", type: "IO", description: "Salida de pulso HIGH proporcional al tiempo de ida y vuelta.", localPos: { x: 1.27, y: 0.4, z: 0 } },
        { id: "GND", name: "GND", type: "GND", description: "Referencia de tierra (0 V).", localPos: { x: 3.81, y: 0.4, z: 0 } }
      ],
      formulas: [
        {
          title: "Distancia a partir del pulso ECHO",
          formula: "d(cm) = t_echo(µs) / 58 = (t_echo × 0.0343) / 2",
          explanation: "El sonido recorre ~343 m/s (0.0343 cm/µs) en ida y vuelta, lo que equivale a 58.3 µs por centímetro."
        }
      ],
      applicationNotes: [
        "Deja al menos 60 ms entre disparos consecutivos para evitar ecos fantasma de la medición anterior.",
        "Objetos muy blandos o inclinados más de 15° respecto a la normal reflejan mal el haz ultrasónico."
      ]
    },

    lcd_1602: {
      type: "lcd_1602",
      name: "Pantalla LCD Alfanumérica 16×2 (HD44780)",
      shortName: "LCD 16×2",
      category: "Pantalla",
      model: "LCM1602A (HD44780U)",
      manufacturer: "Hitachi / Winstar",
      "package": "Módulo COB 80 × 36 × 12 mm, interfaz paralela 4 bits",
      isProgrammable: false,
      defaultProps: { contrast: 0.7, backlight: true },
      summary:
        "Pantalla de cristal líquido de 2 líneas × 16 caracteres basada en controlador compatible HD44780. Admite modo de 4 bits (D4–D7) para ahorrar pines de E/S en Arduino mediante LiquidCrystal.h.",
      keySpecs: [
        { label: "Formato de pantalla", value: "16 × 2", unit: "caracteres (matriz 5×8)" },
        { label: "Controlador", value: "HD44780", unit: "Interfaz 4 / 8 bits" },
        { label: "Tensión lógica (VDD)", value: "5.0", unit: "V DC" },
        { label: "Consumo lógica / Backlight", value: "1.5 / 20", unit: "mA" }
      ],
      absoluteMaxRatings: [
        { parameter: "Tensión de alimentación VDD", value: "0 a 7.0 V", notes: "Operación normal a 4.7 – 5.3 V DC" },
        { parameter: "Tensión en pines de datos/control", value: "-0.3 a VDD + 0.3 V", notes: "No inyectar señales si VDD está apagado" },
        { parameter: "Corriente directa LED backlight (A–K)", value: "25 mA", notes: "Usar resistencia limitadora si no está integrada en la PCB" }
      ],
      electricalCharacteristics: [
        { parameter: "Tensión de alimentación lógica (VDD)", min: "4.7", typ: "5.0", max: "5.3", unit: "V", conditions: "VSS = 0 V" },
        { parameter: "Corriente de operación lógica (IDD)", min: "0.8", typ: "1.5", max: "2.5", unit: "mA", conditions: "VDD = 5.0 V, sin backlight" },
        { parameter: "Tensión directa backlight LED (A–K)", min: "3.9", typ: "4.2", max: "4.5", unit: "V", conditions: "IF ≈ 15–20 mA" },
        { parameter: "Ancho mínimo de pulso Enable (E)", min: "450", typ: "1000", max: "—", unit: "ns", conditions: "Captura de nibble en flanco de bajada" }
      ],
      pinout: [
        { id: "VSS", name: "VSS (Pin 1)", type: "GND", description: "Tierra lógica del controlador (0 V).", localPos: { x: -30.48, y: 3.5, z: -15.5 } },
        { id: "VDD", name: "VDD (Pin 2)", type: "POWER", description: "Alimentación positiva lógica (+5 V).", localPos: { x: -27.94, y: 3.5, z: -15.5 } },
        { id: "V0", name: "V0 (Contraste)", type: "ANALOG", description: "Ajuste de contraste del LCD (0–5 V mediante potenciómetro).", localPos: { x: -25.40, y: 3.5, z: -15.5 } },
        { id: "RS", name: "RS (Register Select)", type: "IO", description: "0 = registro de comandos, 1 = registro de datos/caracteres.", localPos: { x: -22.86, y: 3.5, z: -15.5 } },
        { id: "RW", name: "RW (Read/Write)", type: "IO", description: "0 = escritura (conectar a GND en Arduino), 1 = lectura.", localPos: { x: -20.32, y: 3.5, z: -15.5 } },
        { id: "E", name: "E (Enable)", type: "IO", description: "Habilitación de lectura/escritura por flanco descendente.", localPos: { x: -17.78, y: 3.5, z: -15.5 } },
        { id: "D4", name: "D4 (Data 4)", type: "IO", description: "Bit 4 del bus de datos paralelo (modo 4 bits).", localPos: { x: -15.24, y: 3.5, z: -15.5 } },
        { id: "D5", name: "D5 (Data 5)", type: "IO", description: "Bit 5 del bus de datos paralelo (modo 4 bits).", localPos: { x: -12.70, y: 3.5, z: -15.5 } },
        { id: "D6", name: "D6 (Data 6)", type: "IO", description: "Bit 6 del bus de datos paralelo (modo 4 bits).", localPos: { x: -10.16, y: 3.5, z: -15.5 } },
        { id: "D7", name: "D7 (Data 7)", type: "IO", description: "Bit 7 del bus de datos paralelo (modo 4 bits).", localPos: { x: -7.62, y: 3.5, z: -15.5 } },
        { id: "A", name: "A (Ánodo Backlight)", type: "POWER", description: "Ánodo positivo de la retroiluminación LED (+5 V con resistencia 220 Ω).", localPos: { x: -5.08, y: 3.5, z: -15.5 } },
        { id: "K", name: "K (Cátodo Backlight)", type: "GND", description: "Cátodo negativo de la retroiluminación LED (GND).", localPos: { x: -2.54, y: 3.5, z: -15.5 } }
      ],
      formulas: [
        {
          title: "Inicialización en modo 4 bits",
          formula: "LiquidCrystal lcd(RS, E, D4, D5, D6, D7); lcd.begin(16, 2);",
          explanation: "Conectar RW a GND libera un pin de Arduino cuando no se requiere lectura del flag ocupado."
        }
      ],
      applicationNotes: [
        "Si ves rectángulos sólidos o texto invisible, ajusta la tensión en V0 alrededor de 0.5–1.2 V.",
        "Evita llamar lcd.clear() en cada iteración rápida de loop(); sobrescribe con espacios para eliminar parpadeos."
      ]
    },

    ldr: {
      type: "ldr",
      name: "Fotorresistencia CdS (LDR GL5528)",
      shortName: "LDR GL5528",
      category: "Sensores",
      model: "GL5528",
      manufacturer: "Senba / Token",
      "package": "Disco cerámico Ø 5 mm recubierto epoxi, 2 pines",
      isProgrammable: false,
      defaultProps: { lux: 300 },
      summary:
        "Resistencia dependiente de la luz (fotorresistencia de sulfuro de cadmio) con pico de sensibilidad espectral a 540 nm. Su resistencia disminuye al aumentar la iluminancia ambiental.",
      keySpecs: [
        { label: "Resistencia a 10 lux", value: "10 – 20", unit: "kΩ" },
        { label: "Resistencia en oscuridad", value: "1", unit: "MΩ (mín.)" },
        { label: "Pico espectral", value: "540", unit: "nm (verde-amarillo)" },
        { label: "Tensión / Potencia máx.", value: "150 V / 100 mW", unit: "DC" }
      ],
      absoluteMaxRatings: [
        { parameter: "Tensión máxima aplicada", value: "150 V DC", notes: "Aislamiento del recubrimiento epoxi" },
        { parameter: "Disipación máxima a 25 °C", value: "100 mW", notes: "No usar en cargas de potencia sin transistor o MOSFET" },
        { parameter: "Temperatura de operación", value: "-30 °C a +70 °C", notes: "Humedad relativa < 85 %" }
      ],
      electricalCharacteristics: [
        { parameter: "Resistencia luminosa (10 lux)", min: "10", typ: "15", max: "20", unit: "kΩ", conditions: "Luz estándar 2856 K tras 2 h adaptación" },
        { parameter: "Resistencia en oscuridad", min: "1.0", typ: "2.0", max: "—", unit: "MΩ", conditions: "10 s tras retirar fuente de luz" },
        { parameter: "Valor Gamma (γ 100/10)", min: "0.5", typ: "0.6", max: "0.7", unit: "—", conditions: "Pendiente log(R) vs log(lux)" },
        { parameter: "Tiempo de respuesta (subida / bajada)", min: "—", typ: "20 / 30", max: "—", unit: "ms", conditions: "Transición rápida de iluminancia" }
      ],
      pinout: [
        { id: "P1", name: "Terminal 1", type: "PASSIVE", description: "Terminal no polarizado de la celda CdS.", localPos: { x: -1.27, y: 0.4, z: 0 } },
        { id: "P2", name: "Terminal 2", type: "PASSIVE", description: "Terminal no polarizado de la celda CdS.", localPos: { x: 1.27, y: 0.4, z: 0 } }
      ],
      formulas: [
        {
          title: "Ley potencial de la LDR",
          formula: "R_LDR(lux) ≈ R_10 × (10 / lux)^γ",
          explanation: "Con R_10 ≈ 15 kΩ y γ ≈ 0.6, a 300 lux la resistencia baja a ≈ 1.9 kΩ y a 1000 lux a ≈ 0.95 kΩ."
        },
        {
          title: "Divisor de tensión hacia entrada analógica",
          formula: "V_out = V_cc × R_fija / (R_LDR + R_fija)",
          explanation: "Usando R_fija = 10 kΩ hacia GND y LDR hacia 5 V, a mayor luz aumenta la tensión leída en A0."
        }
      ],
      applicationNotes: [
        "La fotorresistencia es pasiva y no tiene polaridad; siempre necesita una resistencia fija en serie (p. ej. 10 kΩ) para formar un divisor de tensión.",
        "La respuesta espectral de 540 nm imita aproximadamente la sensibilidad del ojo humano."
      ]
    },

    tmp36: {
      type: "tmp36",
      name: "Sensor de Temperatura Analógico TMP36",
      shortName: "Sensor TMP36",
      category: "Sensores",
      model: "TMP36GZ",
      manufacturer: "Analog Devices",
      "package": "TO-92 (3 pines, paso 2.54 mm)",
      isProgrammable: false,
      defaultProps: { tempC: 25 },
      summary:
        "Sensor monolítico de temperatura de baja tensión con salida analógica lineal calibrada directamente en °C (+10 mV/°C y offset de 500 mV, por lo que entrega 750 mV a 25 °C).",
      keySpecs: [
        { label: "Alimentación", value: "2.7 – 5.5", unit: "V DC" },
        { label: "Factor de escala", value: "10", unit: "mV / °C" },
        { label: "Tensión de salida @ 25 °C", value: "750", unit: "mV (offset 500 mV)" },
        { label: "Rango de medida", value: "-40 a +125", unit: "°C" },
        { label: "Precisión típica", value: "±2", unit: "°C" }
      ],
      absoluteMaxRatings: [
        { parameter: "Tensión de alimentación (+Vs)", value: "5.5 V", notes: "Máximo absoluto 7.0 V; inversión de polaridad daña el chip" },
        { parameter: "Corriente máxima de salida VOUT", value: "±50 µA", notes: "Capacitancia de carga máxima sin aislar: 10 nF" },
        { parameter: "Rango térmico del encapsulado", value: "-55 °C a +150 °C", notes: "Operación lineal garantizada -40..+125 °C" }
      ],
      electricalCharacteristics: [
        { parameter: "Tensión de salida a 25 °C", min: "730", typ: "750", max: "770", unit: "mV", conditions: "+Vs = 5.0 V" },
        { parameter: "Pendiente térmica", min: "9.8", typ: "10.0", max: "10.2", unit: "mV/°C", conditions: "-40 °C a +125 °C" },
        { parameter: "Corriente de reposo", min: "—", typ: "30", max: "50", unit: "µA", conditions: "Autocalentamiento < 0.1 °C en aire" },
        { parameter: "No linealidad", min: "—", typ: "±0.5", max: "—", unit: "°C", conditions: "Todo el rango operativo" }
      ],
      pinout: [
        { id: "VCC", name: "VCC (+Vs, Pin 1)", type: "POWER", description: "Alimentación positiva 2.7–5.5 V (pin izquierdo mirando la cara plana).", localPos: { x: -2.54, y: 0.4, z: 0 } },
        { id: "VOUT", name: "VOUT (Pin 2)", type: "ANALOG", description: "Salida analógica lineal proporcional a la temperatura (pin central).", localPos: { x: 0, y: 0.4, z: 0 } },
        { id: "GND", name: "GND (Pin 3)", type: "GND", description: "Referencia de tierra (pin derecho mirando la cara plana).", localPos: { x: 2.54, y: 0.4, z: 0 } }
      ],
      formulas: [
        {
          title: "Conversión de lectura ADC a grados Celsius",
          formula: "V_mV = (analogRead(pin) / 1023.0) × 5000.0; T(°C) = (V_mV - 500.0) / 10.0",
          explanation: "El offset de 500 mV a 0 °C permite medir temperaturas negativas (hasta -40 °C = 100 mV) sin alimentación dual."
        }
      ],
      applicationNotes: [
        "Verifica la orientación de la cara plana del TO-92 antes de energizar: invertir VCC y GND calienta rápidamente el encapsulado.",
        "Coloca un condensador cerámico de 100 nF cerca de VCC–GND si usas cables largos para reducir ruido en VOUT."
      ]
    },

    buzzer: {
      type: "buzzer",
      name: "Zumbador Piezoeléctrico Pasivo",
      shortName: "Buzzer Piezo",
      category: "Actuadores",
      model: "PKM17EPP-4001-B0",
      manufacturer: "Murata",
      "package": "Cilindro Ø 17 × 9.5 mm, paso pines 7.62 mm",
      isProgrammable: false,
      defaultProps: { frequency: 2700 },
      summary:
        "Transductor acústico piezoeléctrico pasivo que convierte señales cuadradas o PWM de audio en sonido con hasta 85 dB de presión sonora en su banda de resonancia (2–4 kHz). Ideal para la función tone() de Arduino.",
      keySpecs: [
        { label: "Tensión de excitación", value: "3 – 12", unit: "Vpp (onda cuadrada)" },
        { label: "Banda de frecuencia", value: "2 – 4", unit: "kHz (óptimo ~2.7–4 kHz)" },
        { label: "Nivel de presión sonora (SPL)", value: "85", unit: "dB @ 10 cm" },
        { label: "Capacitancia electrostática", value: "12", unit: "nF (@ 1 kHz)" }
      ],
      absoluteMaxRatings: [
        { parameter: "Tensión máxima pico a pico", value: "30 Vpp", notes: "No aplicar tensión continua DC prolongada sin señal alterna" },
        { parameter: "Temperatura de operación", value: "-20 °C a +70 °C", notes: "Carcasa plástica sellada acústicamente" }
      ],
      electricalCharacteristics: [
        { parameter: "Presión sonora mínima (SPL)", min: "80", typ: "85", max: "—", unit: "dB", conditions: "5 Vpp onda cuadrada a 4 kHz, 10 cm" },
        { parameter: "Frecuencia de resonancia principal", min: "2.0", typ: "4.0", max: "4.5", unit: "kHz", conditions: "Banda efectiva audible 2–4 kHz" },
        { parameter: "Consumo medio @ 5 V", min: "1", typ: "5", max: "15", unit: "mA", conditions: "Carga predominantemente capacitiva (≈ 12 nF)" }
      ],
      pinout: [
        { id: "POS", name: "POS (+)", type: "IO", description: "Terminal de excitación de señal (conectar a pin digital con tone() o PWM).", localPos: { x: -3.81, y: 0.4, z: 0 } },
        { id: "NEG", name: "NEG (-)", type: "GND", description: "Terminal de retorno (conectar a GND).", localPos: { x: 3.81, y: 0.4, z: 0 } }
      ],
      formulas: [
        {
          title: "Excitación acústica en Arduino",
          formula: "tone(pin, f_Hz, duracion_ms); noTone(pin);",
          explanation: "Genera una onda cuadrada al 50 % de ciclo de trabajo en el rango audible (p. ej. 2000–4000 Hz)."
        }
      ],
      applicationNotes: [
        "Al ser un piezo pasivo, no suena con DC constante: requiere señal oscilante generada por tone() o conmutación rápida.",
        "Una resistencia de 100 Ω en serie ayuda a suavizar los picos de corriente capacitivos en el pin del Arduino."
      ]
    }
  };

  var ORDERED_TYPES = [
    "arduino_uno_r3",
    "breadboard_830",
    "led",
    "resistor",
    "pushbutton",
    "potentiometer",
    "servo_sg90",
    "ultrasonic_hcsr04",
    "lcd_1602",
    "ldr",
    "tmp36",
    "buzzer",
    "wire"
  ];

  function getItem(type) {
    if (!type || !Object.prototype.hasOwnProperty.call(ITEMS, type)) {
      return null;
    }
    return ITEMS[type];
  }

  function list() {
    var result = [];
    for (var i = 0; i < ORDERED_TYPES.length; i++) {
      result.push(ITEMS[ORDERED_TYPES[i]]);
    }
    return result;
  }

  function getPinsForType(type) {
    if (type === "breadboard_830") {
      return buildBreadboard830Pins();
    }
    var item = getItem(type);
    return item && isArray(item.pinout) ? item.pinout : [];
  }

  global.HardwareSim.Datasheets = {
    ITEMS: ITEMS,
    CATEGORIES: CATEGORIES,
    LED_COLORS: LED_COLORS,
    RESISTOR_VALUES: STANDARD_RESISTOR_VALUES,
    "get": getItem,
    list: list,
    getResistorBands: getResistorBands,
    getPinsForType: getPinsForType,
    getBreadboardGroup: getBreadboardGroup
  };
})(window);
