/**
 * js/simulator.js
 * Motor eléctrico, maqueta inicial 3D y emulador C++/INO no bloqueante para Arduino Uno R3.
 * Depende de window.HardwareSim.Datasheets (cargado previamente en index.html).
 * Define window.HardwareSim.Sketches y window.HardwareSim.Simulator.
 */
(function (global) {
  "use strict";

  global.HardwareSim = global.HardwareSim || {};

  // ============================================================================
  // 1. PRESETS DE SKETCHES ARDUINO (window.HardwareSim.Sketches.PRESETS)
  // ============================================================================

  var PRESETS = [
    {
      id: "initial_mockup",
      name: "Maqueta Inicial Completa",
      description:
        "Parpadea LED Rojo + LED L (D13) cada 600 ms, modula el LED Verde PWM (D11) y el Servo SG90 (D9) con el potenciómetro (A0), lee el pulsador (D2 -> LED Amarillo D10) y actualiza LCD 16x2 + Serial.",
      code: [
        "// Maqueta Inicial Completa — Arduino Uno R3 Starter Kit",
        "#include <Servo.h>",
        "#include <LiquidCrystal.h>",
        "",
        "#define LED_ROJO 13",
        "#define LED_AMARILLO 10",
        "#define LED_VERDE_PWM 11",
        "#define PIN_BOTON 2",
        "#define PIN_SERVO 9",
        "#define PIN_POT A0",
        "",
        "// Bus 4 bits: RS=12, E=8, D4=7, D5=6, D6=5, D7=4",
        "LiquidCrystal lcd(12, 8, 7, 6, 5, 4);",
        "Servo miServo;",
        "",
        "unsigned long ultimoBlink = 0;",
        "unsigned long ultimoSerial = 0;",
        "bool estadoRojo = false;",
        "",
        "void setup() {",
        "  Serial.begin(9600);",
        "  pinMode(LED_ROJO, OUTPUT);",
        "  pinMode(LED_AMARILLO, OUTPUT);",
        "  pinMode(LED_VERDE_PWM, OUTPUT);",
        "  pinMode(PIN_BOTON, INPUT_PULLUP);",
        "",
        "  miServo.attach(PIN_SERVO);",
        "  lcd.begin(16, 2);",
        "  lcd.clear();",
        "  lcd.setCursor(0, 0);",
        '  lcd.print("HardwareSim Uno ");',
        "  lcd.setCursor(0, 1);",
        '  lcd.print("Iniciando...    ");',
        "",
        '  Serial.println("=== Arduino Uno R3: Maqueta Inicial Lista ===");',
        "}",
        "",
        "void loop() {",
        "  unsigned long ahora = millis();",
        "",
        "  // 1) Parpadeo sincronizado de LED Rojo y LED integrado L en D13 cada 600 ms",
        "  if (ahora - ultimoBlink >= 600) {",
        "    ultimoBlink = ahora;",
        "    estadoRojo = !estadoRojo;",
        "    digitalWrite(LED_ROJO, estadoRojo ? HIGH : LOW);",
        "  }",
        "",
        "  // 2) Lectura de potenciómetro A0 -> LED PWM D11 y Servo SG90 D9",
        "  int adc = analogRead(PIN_POT);",
        "  int pwm = map(adc, 0, 1023, 0, 255);",
        "  int pct = map(adc, 0, 1023, 0, 100);",
        "  int angulo = map(adc, 0, 1023, 0, 180);",
        "",
        "  // Pulsador activo en LOW (INPUT_PULLUP)",
        "  bool pulsado = (digitalRead(PIN_BOTON) == LOW);",
        "  digitalWrite(LED_AMARILLO, pulsado ? HIGH : LOW);",
        "  if (pulsado) {",
        "    angulo = 180 - angulo;",
        "  }",
        "",
        "  analogWrite(LED_VERDE_PWM, pwm);",
        "  miServo.write(angulo);",
        "",
        "  // 3) Actualizar pantalla LCD 16x2 en vivo",
        "  lcd.setCursor(0, 0);",
        '  lcd.print("PWM:");',
        "  if (pct < 100) lcd.print(\" \");",
        "  if (pct < 10) lcd.print(\" \");",
        '  lcd.print(pct);',
        '  lcd.print("% SRV:");',
        "  if (angulo < 100) lcd.print(\" \");",
        "  if (angulo < 10) lcd.print(\" \");",
        "  lcd.print(angulo);",
        "",
        "  lcd.setCursor(0, 1);",
        '  lcd.print("L13:");',
        '  lcd.print(estadoRojo ? "ON " : "OFF");',
        '  lcd.print(" BTN:");',
        '  lcd.print(pulsado ? "PULS" : "LIBR");',
        "",
        "  // 4) Telemetría periódica por Monitor Serie",
        "  if (ahora - ultimoSerial >= 600) {",
        "    ultimoSerial = ahora;",
        '    Serial.print("t=");',
        "    Serial.print(ahora);",
        '    Serial.print("ms | A0=");',
        "    Serial.print(adc);",
        '    Serial.print(" | PWM=");',
        "    Serial.print(pwm);",
        '    Serial.print(" | Servo=");',
        "    Serial.print(angulo);",
        '    Serial.print("deg | BTN=");',
        '    Serial.println(pulsado ? "PULSADO" : "SUELTO");',
        "  }",
        "",
        "  delay(40);",
        "}"
      ].join("\n")
    },
    {
      id: "blink_d13",
      name: "Blink Clásico D13",
      description:
        "Clásico parpadeo en D13 y LED integrado L con delay(500) no bloqueante.",
      code: [
        "// Blink Clásico D13",
        "const int LED_PIN = 13;",
        "int ciclo = 0;",
        "",
        "void setup() {",
        "  Serial.begin(9600);",
        "  pinMode(LED_PIN, OUTPUT);",
        '  Serial.println("Blink D13 iniciado");',
        "}",
        "",
        "void loop() {",
        "  ciclo++;",
        "  digitalWrite(LED_PIN, HIGH);",
        '  Serial.print("Ciclo #");',
        "  Serial.print(ciclo);",
        '  Serial.println(" -> LED D13 ENCENDIDO");',
        "  delay(500);",
        "",
        "  digitalWrite(LED_PIN, LOW);",
        '  Serial.println("  -> LED D13 APAGADO");',
        "  delay(500);",
        "}"
      ].join("\n")
    },
    {
      id: "traffic_light",
      name: "Semáforo + Pulsador",
      description:
        "Controla LEDs Rojo (D13), Amarillo (D10) y Verde (D11) con prioridad peatonal desde el pulsador (D2).",
      code: [
        "// Semáforo con Paso Peatonal (usa los LEDs de la maqueta inicial)",
        "#include <LiquidCrystal.h>",
        "",
        "#define LED_ROJO 13",
        "#define LED_AMARILLO 10",
        "#define LED_VERDE 11",
        "#define BTN_PEATON 2",
        "",
        "LiquidCrystal lcd(12, 8, 7, 6, 5, 4);",
        "",
        "void mostrarFase(String titulo, String detalle) {",
        "  lcd.clear();",
        "  lcd.setCursor(0, 0);",
        "  lcd.print(titulo);",
        "  lcd.setCursor(0, 1);",
        "  lcd.print(detalle);",
        "}",
        "",
        "void setup() {",
        "  Serial.begin(9600);",
        "  pinMode(LED_ROJO, OUTPUT);",
        "  pinMode(LED_AMARILLO, OUTPUT);",
        "  pinMode(LED_VERDE, OUTPUT);",
        "  pinMode(BTN_PEATON, INPUT_PULLUP);",
        "  lcd.begin(16, 2);",
        '  Serial.println("Semaforo listo. Pulsa D2 para pedir paso.");',
        "}",
        "",
        "void loop() {",
        "  // Fase Verde",
        "  digitalWrite(LED_VERDE, HIGH);",
        "  digitalWrite(LED_AMARILLO, LOW);",
        "  digitalWrite(LED_ROJO, LOW);",
        '  mostrarFase("SEMAFORO: VERDE ", "Pulsa D2 p/paso ");',
        '  Serial.println("[FASE] VERDE - Circulacion abierta");',
        "",
        "  for (int i = 0; i < 30; i++) {",
        "    if (digitalRead(BTN_PEATON) == LOW) {",
        '      Serial.println(">> Solicitud peatonal detectada!");',
        "      break;",
        "    }",
        "    delay(100);",
        "  }",
        "",
        "  // Fase Amarilla",
        "  digitalWrite(LED_VERDE, LOW);",
        "  digitalWrite(LED_AMARILLO, HIGH);",
        '  mostrarFase("SEMAFORO: AMBAR ", "Precaucion...   ");',
        '  Serial.println("[FASE] AMARILLO - Precaucion");',
        "  delay(1200);",
        "",
        "  // Fase Roja",
        "  digitalWrite(LED_AMARILLO, LOW);",
        "  digitalWrite(LED_ROJO, HIGH);",
        '  mostrarFase("SEMAFORO: ROJO  ", "Paso peatonal OK");',
        '  Serial.println("[FASE] ROJO - Peatones cruzan");',
        "  delay(2400);",
        "}"
      ].join("\n")
    },
    {
      id: "pot_servo",
      name: "Potenciómetro + Servo SG90",
      description:
        "Control analógico suave del Servo SG90 (D9) y brillo del LED PWM (D11) desde el potenciómetro (A0).",
      code: [
        "// Potenciómetro A0 -> Servo SG90 (D9) + LED PWM (D11)",
        "#include <Servo.h>",
        "#include <LiquidCrystal.h>",
        "",
        "Servo servo;",
        "LiquidCrystal lcd(12, 8, 7, 6, 5, 4);",
        "int ultimoAngulo = -1;",
        "",
        "void setup() {",
        "  Serial.begin(9600);",
        "  pinMode(11, OUTPUT);",
        "  servo.attach(9);",
        "  lcd.begin(16, 2);",
        '  lcd.setCursor(0, 0);',
        '  lcd.print("Control Servo A0");',
        '  Serial.println("Mueve el potenciometro (click der.) para girar el servo.");',
        "}",
        "",
        "void loop() {",
        "  int lectura = analogRead(A0);",
        "  int angulo = map(lectura, 0, 1023, 0, 180);",
        "  int brillo = map(lectura, 0, 1023, 0, 255);",
        "  float volt = (lectura * 5.0) / 1023.0;",
        "",
        "  servo.write(angulo);",
        "  analogWrite(11, brillo);",
        "",
        "  lcd.setCursor(0, 1);",
        '  lcd.print("Ang:");',
        "  lcd.print(angulo);",
        '  lcd.print("deg V:");',
        "  lcd.print(volt, 1);",
        '  lcd.print("V   ");',
        "",
        "  if (abs(angulo - ultimoAngulo) >= 3) {",
        "    ultimoAngulo = angulo;",
        '    Serial.print("A0=");',
        "    Serial.print(volt, 2);",
        '    Serial.print("V -> Servo=");',
        "    Serial.print(angulo);",
        '    Serial.println(" deg");',
        "  }",
        "  delay(40);",
        "}"
      ].join("\n")
    },
    {
      id: "ultrasonic_radar",
      name: "Radar Ultrasónico HC-SR04 + LCD + Buzzer",
      description:
        "Mide distancia con HC-SR04 (TRIG=D3, ECHO=A1), alerta en Buzzer (A2) y muestra lectura en LCD + Servo.",
      code: [
        "// Radar Ultrasónico HC-SR04 + LCD 16x2 + Buzzer Piezo",
        "// Cableado sugerido: TRIG->D3, ECHO->A1, Buzzer POS->A2, Buzzer NEG->GND",
        "#include <LiquidCrystal.h>",
        "#include <Servo.h>",
        "",
        "#define PIN_TRIG 3",
        "#define PIN_ECHO A1",
        "#define PIN_BUZZER A2",
        "#define PIN_LED_ALERTA 13",
        "",
        "LiquidCrystal lcd(12, 8, 7, 6, 5, 4);",
        "Servo radarServo;",
        "",
        "long medirDistanciaCm() {",
        "  digitalWrite(PIN_TRIG, LOW);",
        "  delayMicroseconds(2);",
        "  digitalWrite(PIN_TRIG, HIGH);",
        "  delayMicroseconds(10);",
        "  digitalWrite(PIN_TRIG, LOW);",
        "  long duracion = pulseIn(PIN_ECHO, HIGH);",
        "  if (duracion <= 0) return 0;",
        "  return duracion / 58;",
        "}",
        "",
        "void setup() {",
        "  Serial.begin(9600);",
        "  pinMode(PIN_TRIG, OUTPUT);",
        "  pinMode(PIN_ECHO, INPUT);",
        "  pinMode(PIN_BUZZER, OUTPUT);",
        "  pinMode(PIN_LED_ALERTA, OUTPUT);",
        "  radarServo.attach(9);",
        "  lcd.begin(16, 2);",
        '  lcd.setCursor(0, 0);',
        '  lcd.print("Radar HC-SR04   ");',
        '  Serial.println("Radar listo: TRIG=D3, ECHO=A1, BUZZER=A2");',
        "}",
        "",
        "void loop() {",
        "  long cm = medirDistanciaCm();",
        "  int barrido = map(constrain(cm, 2, 200), 2, 200, 15, 165);",
        "  radarServo.write(barrido);",
        "",
        "  lcd.setCursor(0, 1);",
        "  if (cm <= 0) {",
        '    lcd.print("Sin eco HC-SR04 ");',
        "    noTone(PIN_BUZZER);",
        "    digitalWrite(PIN_LED_ALERTA, LOW);",
        "  } else {",
        '    lcd.print("Dist: ");',
        "    lcd.print(cm);",
        '    lcd.print(" cm       ");',
        "    if (cm < 25) {",
        "      digitalWrite(PIN_LED_ALERTA, HIGH);",
        "      tone(PIN_BUZZER, 2400, 120);",
        "    } else if (cm < 60) {",
        "      digitalWrite(PIN_LED_ALERTA, HIGH);",
        "      tone(PIN_BUZZER, 1400, 70);",
        "    } else {",
        "      digitalWrite(PIN_LED_ALERTA, LOW);",
        "      noTone(PIN_BUZZER);",
        "    }",
        "  }",
        "",
        '  Serial.print("Distancia: ");',
        "  Serial.print(cm);",
        '  Serial.println(" cm");',
        "  delay(250);",
        "}"
      ].join("\n")
    },
    {
      id: "weather_station",
      name: "Estación TMP36 + LDR",
      description:
        "Monitoriza temperatura TMP36 (A1) e iluminancia LDR (A2) mostrando alertas en LCD 16x2, LED D13 y Serial.",
      code: [
        "// Estación Ambiental TMP36 + LDR + LCD 16x2",
        "// Cableado sugerido: TMP36 VOUT->A1 | LDR divisor->A2",
        "#include <LiquidCrystal.h>",
        "",
        "#define PIN_TMP36 A1",
        "#define PIN_LDR A2",
        "#define PIN_ALERTA 13",
        "",
        "LiquidCrystal lcd(12, 8, 7, 6, 5, 4);",
        "",
        "void setup() {",
        "  Serial.begin(9600);",
        "  pinMode(PIN_ALERTA, OUTPUT);",
        "  lcd.begin(16, 2);",
        '  lcd.setCursor(0, 0);',
        '  lcd.print("Estacion TMP/LDR");',
        '  Serial.println("Estacion ambiental lista: TMP36=A1, LDR=A2");',
        "}",
        "",
        "void loop() {",
        "  int rawTmp = analogRead(PIN_TMP36);",
        "  float voltTmp = (rawTmp * 5.0) / 1023.0;",
        "  float tempC = (voltTmp - 0.5) * 100.0;",
        "",
        "  int rawLdr = analogRead(PIN_LDR);",
        "  int luzPct = map(rawLdr, 0, 1023, 0, 100);",
        "",
        "  bool alerta = (tempC >= 35.0) || (luzPct < 20);",
        "  digitalWrite(PIN_ALERTA, alerta ? HIGH : LOW);",
        "",
        "  lcd.setCursor(0, 0);",
        '  lcd.print("Temp: ");',
        "  lcd.print(tempC, 1);",
        '  lcd.print(" C     ");',
        "",
        "  lcd.setCursor(0, 1);",
        '  lcd.print("Luz: ");',
        "  lcd.print(luzPct);",
        '  lcd.print("% ");',
        '  lcd.print(alerta ? "[ALERTA]" : "[NORMAL]");',
        "",
        '  Serial.print("TMP36=");',
        "  Serial.print(tempC, 1);",
        '  Serial.print(" C (");',
        "  Serial.print(voltTmp, 2);",
        '  Serial.print("V) | LDR=");',
        "  Serial.print(luzPct);",
        '  Serial.println("%");',
        "  delay(500);",
        "}"
      ].join("\n")
    }
  ];

  global.HardwareSim.Sketches = {
    PRESETS: PRESETS
  };

  // ============================================================================
  // 2. UTILIDADES GENERALES Y GEOMETRÍA DE PINES
  // ============================================================================

  var LED_VF_DEFAULTS = {
    red: 1.9,
    green: 2.1,
    yellow: 2.0,
    blue: 3.1,
    white: 3.2
  };

  var ARDUINO_PWM_PINS = {
    D3: true,
    D5: true,
    D6: true,
    D9: true,
    D10: true,
    D11: true
  };

  function clamp(val, min, max) {
    return val < min ? min : val > max ? max : val;
  }

  function cloneShallow(obj) {
    var out = {};
    if (!obj) return out;
    var keys = Object.keys(obj);
    for (var i = 0; i < keys.length; i++) {
      out[keys[i]] = obj[keys[i]];
    }
    return out;
  }

  function getDatasheets() {
    return global.HardwareSim && global.HardwareSim.Datasheets
      ? global.HardwareSim.Datasheets
      : null;
  }

  function getPinsForType(type) {
    var ds = getDatasheets();
    if (!ds) return [];
    if (typeof ds.getPinsForType === "function") {
      return ds.getPinsForType(type) || [];
    }
    var item = typeof ds.get === "function" ? ds.get(type) : null;
    return item && Array.isArray(item.pinout) ? item.pinout : [];
  }

  function getBreadboardGroup(pinId) {
    var ds = getDatasheets();
    if (ds && typeof ds.getBreadboardGroup === "function") {
      return ds.getBreadboardGroup(pinId);
    }
    return null;
  }

  function resolveCanonicalPinKey(breadboardIds, compId, pinId) {
    if (breadboardIds && breadboardIds[compId]) {
      var grp = getBreadboardGroup(pinId);
      if (grp) return compId + ":@bb:" + grp;
    }
    return compId + ":" + pinId;
  }

  function getLedVf(color) {
    var key = String(color || "red").toLowerCase();
    var ds = getDatasheets();
    if (ds && ds.LED_COLORS && ds.LED_COLORS[key] && ds.LED_COLORS[key].vf) {
      return Number(ds.LED_COLORS[key].vf);
    }
    return LED_VF_DEFAULTS[key] || 1.9;
  }

  function getPinWorldPos(comp, pin) {
    var pos = comp.pos || { x: 0, y: 0, z: 0 };
    var lp = (pin && pin.localPos) || { x: 0, y: 0, z: 0 };
    var rot = comp.rotY || 0;
    var cos = Math.cos(rot);
    var sin = Math.sin(rot);
    return {
      x: pos.x + lp.x * cos + lp.z * sin,
      y: pos.y + lp.y,
      z: pos.z - lp.x * sin + lp.z * cos
    };
  }

  function resolveArduinoPinId(rawPin) {
    if (rawPin === null || rawPin === undefined) return null;
    if (typeof rawPin === "string") {
      var trimmed = rawPin.trim().toUpperCase();
      if (/^D([0-9]|1[0-3])$/.test(trimmed)) return trimmed;
      if (/^A[0-5]$/.test(trimmed)) return trimmed;
      var num = Number(trimmed);
      if (!isNaN(num)) rawPin = num;
      else return null;
    }
    var n = Math.trunc(Number(rawPin));
    if (isNaN(n)) return null;
    if (n >= 0 && n <= 13) return "D" + n;
    if (n >= 14 && n <= 19) return "A" + (n - 14);
    return null;
  }

  function resolveAnalogPinId(rawPin) {
    if (typeof rawPin === "string") {
      var trimmed = rawPin.trim().toUpperCase();
      if (/^A[0-5]$/.test(trimmed)) return trimmed;
    }
    var n = Math.trunc(Number(rawPin));
    if (isNaN(n)) return null;
    if (n >= 0 && n <= 5) return "A" + n;
    if (n >= 14 && n <= 19) return "A" + (n - 14);
    return null;
  }

  function formatPrintValue(val, fmt) {
    if (val === undefined || val === null) return "";
    if (typeof val === "boolean") return val ? "1" : "0";
    if (typeof val === "number") {
      if (!isFinite(val)) return String(val);
      if (fmt === 16) return Math.trunc(val).toString(16).toUpperCase();
      if (fmt === 2) return Math.trunc(val).toString(2);
      if (fmt === 8) return Math.trunc(val).toString(8);
      if (typeof fmt === "number" && fmt >= 0 && fmt <= 10) {
        return val.toFixed(fmt);
      }
      if (!Number.isInteger(val)) {
        return val.toFixed(2);
      }
      return String(val);
    }
    return String(val);
  }

  // ============================================================================
  // 3. TRANSPILADOR ARDUINO C++ / INO -> GENERADOR JS NO BLOQUEANTE
  // ============================================================================

  var CPP_TYPE_KEYWORDS = [
    "unsigned\\s+long",
    "unsigned\\s+int",
    "unsigned\\s+short",
    "unsigned\\s+char",
    "signed\\s+long",
    "signed\\s+int",
    "void",
    "int",
    "long",
    "short",
    "byte",
    "char",
    "float",
    "double",
    "bool",
    "boolean",
    "uint8_t",
    "int8_t",
    "uint16_t",
    "int16_t",
    "uint32_t",
    "int32_t",
    "size_t",
    "word",
    "String"
  ];
  var CPP_TYPE_ALT = "(?:" + CPP_TYPE_KEYWORDS.join("|") + ")";

  function defaultValueForCppType(typeStr) {
    var t = String(typeStr || "").trim();
    if (/bool/.test(t)) return "false";
    if (/String|char/.test(t) && !/unsigned/.test(t)) return '""';
    return "0";
  }

  function findMatchingDelimiter(str, openIdx, openChar, closeChar) {
    var depth = 0;
    for (var i = openIdx; i < str.length; i++) {
      var ch = str.charAt(i);
      if (ch === openChar) depth++;
      else if (ch === closeChar) {
        depth--;
        if (depth === 0) return i;
      }
    }
    return -1;
  }

  function tokenizeStringsAndComments(source) {
    var strings = [];
    var chars = [];
    var out = [];
    var len = source.length;
    var i = 0;

    while (i < len) {
      var ch = source.charAt(i);
      var next = i + 1 < len ? source.charAt(i + 1) : "";

      if (ch === "/" && next === "/") {
        i += 2;
        while (i < len && source.charAt(i) !== "\n") i++;
        out.push(" ");
        continue;
      }

      if (ch === "/" && next === "*") {
        i += 2;
        while (i < len - 1 && !(source.charAt(i) === "*" && source.charAt(i + 1) === "/")) {
          if (source.charAt(i) === "\n") out.push("\n");
          i++;
        }
        i += 2;
        out.push(" ");
        continue;
      }

      if (ch === '"') {
        var j = i + 1;
        while (j < len) {
          if (source.charAt(j) === "\\") {
            j += 2;
            continue;
          }
          if (source.charAt(j) === '"') {
            j++;
            break;
          }
          j++;
        }
        var lit = source.slice(i, j);
        var idx = strings.length;
        strings.push(lit);
        out.push("__SIM_STR_" + idx + "__");
        i = j;
        continue;
      }

      if (ch === "'") {
        var k = i + 1;
        while (k < len) {
          if (source.charAt(k) === "\\") {
            k += 2;
            continue;
          }
          if (source.charAt(k) === "'") {
            k++;
            break;
          }
          k++;
        }
        var clit = source.slice(i, k);
        var cidx = chars.length;
        chars.push(clit);
        out.push("__SIM_CHR_" + cidx + "__");
        i = k;
        continue;
      }

      out.push(ch);
      i++;
    }

    return {
      code: out.join(""),
      strings: strings,
      chars: chars
    };
  }

  function restoreLiterals(code, strings, chars) {
    code = code.replace(/__SIM_STR_(\d+)__/g, function (_, idx) {
      return strings[Number(idx)] || '""';
    });
    code = code.replace(/__SIM_CHR_(\d+)__/g, function (_, idx) {
      return chars[Number(idx)] || "''";
    });
    return code;
  }

  function processPreprocessor(code) {
    var includes = [];
    var defines = {};
    var lines = code.split(/\r?\n/);
    var kept = [];

    for (var i = 0; i < lines.length; i++) {
      var line = lines[i];
      var trimmed = line.trim();
      if (trimmed.charAt(0) === "#") {
        var incM = /^#\s*include\s*[<"]([^>"]+)[>"]/i.exec(trimmed);
        if (incM) {
          includes.push(incM[1]);
          kept.push("");
          continue;
        }
        var defM = /^#\s*define\s+([A-Za-z_]\w*)(?:\s+(.*))?$/.exec(trimmed);
        if (defM) {
          var dName = defM[1];
          var dVal = defM[2] !== undefined ? defM[2].trim() : "1";
          if (dVal === "") dVal = "1";
          defines[dName] = dVal;
          kept.push("");
          continue;
        }
        // Ignorar #pragma, #ifdef, #endif, etc. manteniendo número de línea
        kept.push("");
        continue;
      }
      kept.push(line);
    }

    var out = kept.join("\n");
    var defNames = Object.keys(defines).sort(function (a, b) {
      return b.length - a.length;
    });

    if (defNames.length > 0) {
      for (var pass = 0; pass < 4; pass++) {
        var changed = false;
        for (var d = 0; d < defNames.length; d++) {
          var name = defNames[d];
          var val = defines[name];
          var re = new RegExp("\\b" + name + "\\b", "g");
          var nextOut = out.replace(re, function () {
            changed = true;
            return val;
          });
          out = nextOut;
        }
        if (!changed) break;
      }
    }

    return { code: out, includes: includes };
  }

  function cleanParamList(rawParams) {
    var trimmed = rawParams.trim();
    if (!trimmed || trimmed === "void") return "";
    var parts = trimmed.split(",");
    var cleaned = [];

    for (var i = 0; i < parts.length; i++) {
      var p = parts[i].trim();
      if (!p) continue;
      var eqIdx = p.indexOf("=");
      var left = eqIdx !== -1 ? p.slice(0, eqIdx).trim() : p;
      var def = eqIdx !== -1 ? " = " + p.slice(eqIdx + 1).trim() : "";
      left = left.replace(/\[\s*\]/g, "").replace(/[&*]/g, " ").trim();
      var tokens = left.split(/\s+/);
      var paramName = tokens[tokens.length - 1];
      if (paramName) cleaned.push(paramName + def);
    }

    return cleaned.join(", ");
  }

  function transformFunctions(code) {
    var userFuncs = {};
    // Eliminar prototipos adelantados tipo: void miFuncion(int x);
    var protoRegex = new RegExp(
      "(^|[;{}]\\s*)(?:(?:static|inline|volatile|const|unsigned|signed)\\s+)*" +
        CPP_TYPE_ALT +
        "\\s+([A-Za-z_]\\w*)\\s*\\([^;{}]*\\)\\s*;",
      "gm"
    );
    code = code.replace(protoRegex, "$1");

    // Transformar definiciones de función a function*
    var fnRegex = new RegExp(
      "(^|[;{}]|\\n)\\s*(?:(?:static|inline|volatile|const)\\s+)*(" +
        CPP_TYPE_ALT +
        ")\\s+([A-Za-z_]\\w*)\\s*\\(([^)]*)\\)\\s*\\{",
      "gm"
    );

    code = code.replace(fnRegex, function (match, prefix, retType, fnName, rawParams) {
      // Evitar falsos positivos si alguien escribe return(...)
      if (fnName === "if" || fnName === "for" || fnName === "while" || fnName === "switch") {
        return match;
      }
      userFuncs[fnName] = true;
      var jsParams = cleanParamList(rawParams);
      return prefix + "\nfunction* " + fnName + "(" + jsParams + ") {";
    });

    return { code: code, userFuncs: userFuncs };
  }

  function transformDeclarations(code) {
    // Objetos Servo y LiquidCrystal
    code = code.replace(
      /\bLiquidCrystal\s+([A-Za-z_]\w*)\s*\(([^)]+)\)\s*;/g,
      "const $1 = __createLCD($2);"
    );

    code = code.replace(
      /\bServo\s+([A-Za-z_]\w*(?:\s*,\s*[A-Za-z_]\w*)*)\s*;/g,
      function (_, list) {
        var names = list.split(",").map(function (s) {
          return s.trim() + " = __createServo()";
        });
        return "const " + names.join(", ") + ";";
      }
    );

    // Arrays con inicializador: const int pins[] = {10, 11, 13};
    var arrInitRegex = new RegExp(
      "\\b(const\\s+)?(?:(?:static|volatile)\\s+)*(" +
        CPP_TYPE_ALT +
        ")\\s+([A-Za-z_]\\w*)\\s*\\[\\s*\\d*\\s*\\]\\s*=\\s*\\{([^}]*)\\}\\s*;",
      "g"
    );
    code = code.replace(arrInitRegex, function (_, isConst, typeName, varName, items) {
      var kw = isConst ? "const " : "let ";
      return kw + varName + " = [" + items + "];";
    });

    // Arrays sin inicializador: int lecturas[10];
    var arrEmptyRegex = new RegExp(
      "\\b(?:(?:static|volatile)\\s+)*(" +
        CPP_TYPE_ALT +
        ")\\s+([A-Za-z_]\\w*)\\s*\\[\\s*([^\\]]+)\\s*\\]\\s*;",
      "g"
    );
    code = code.replace(arrEmptyRegex, function (_, typeName, varName, sizeExpr) {
      var defVal = defaultValueForCppType(typeName);
      return "let " + varName + " = new Array(" + sizeExpr + ").fill(" + defVal + ");";
    });

    // Declaraciones en cabecera for(int i = 0; ...)
    var forVarRegex = new RegExp(
      "\\bfor\\s*\\(\\s*(?:const\\s+)?(?:(?:static|volatile)\\s+)*(" +
        CPP_TYPE_ALT +
        ")\\s+",
      "g"
    );
    code = code.replace(forVarRegex, "for (let ");

    // Declaraciones de variables generales (en inicio de línea o tras ; / { / })
    var varDeclRegex = new RegExp(
      "(^|[;{}]\\s*|\\n\\s*)(const\\s+)?(?:(?:static|volatile)\\s+)*(" +
        CPP_TYPE_ALT +
        ")\\s+([A-Za-z_]\\w*(?:\\s*=[^;{}]*|\\s*,[^;{}]*)?)(?=;)",
      "gm"
    );

    code = code.replace(varDeclRegex, function (match, prefix, isConst, typeName, rest) {
      var t = String(rest || "").trim();
      if (!t || /^function\b/.test(t)) return match;
      // Split por comas fuera de paréntesis/corchetes
      var parts = [];
      var cur = "";
      var depth = 0;
      for (var i = 0; i < t.length; i++) {
        var ch = t.charAt(i);
        if (ch === "(" || ch === "[" || ch === "{") depth++;
        else if (ch === ")" || ch === "]" || ch === "}") depth--;
        if (ch === "," && depth === 0) {
          parts.push(cur.trim());
          cur = "";
        } else {
          cur += ch;
        }
      }
      if (cur.trim()) parts.push(cur.trim());

      var defVal = defaultValueForCppType(typeName);
      var outParts = [];
      for (var p = 0; p < parts.length; p++) {
        var decl = parts[p];
        if (!decl) continue;
        if (decl.indexOf("=") === -1) {
          outParts.push(decl + " = " + defVal);
        } else {
          outParts.push(decl);
        }
      }
      if (outParts.length === 0) return match;
      var kw = isConst ? "const " : "let ";
      return prefix + kw + outParts.join(", ");
    });

    // Conversiones tipo C: (int)x, (float)x, etc.
    code = code.replace(
      /\(\s*(?:unsigned\s+)?(?:int|long|short|byte|uint8_t|int8_t|uint16_t|int16_t|uint32_t|int32_t)\s*\)\s*(\([^)]*\)|[A-Za-z_]\w*(?:\.[A-Za-z_]\w*|\([^)]*\)|\[[^\]]*\])*|\d+(?:\.\d+)?)/g,
      "Math.trunc($1)"
    );
    code = code.replace(
      /\(\s*(?:float|double)\s*\)\s*(\([^)]*\)|[A-Za-z_]\w*(?:\.[A-Za-z_]\w*|\([^)]*\)|\[[^\]]*\])*|\d+(?:\.\d+)?)/g,
      "Number($1)"
    );
    code = code.replace(
      /\(\s*(?:bool|boolean)\s*\)\s*(\([^)]*\)|[A-Za-z_]\w*(?:\.[A-Za-z_]\w*|\([^)]*\)|\[[^\]]*\])*|\d+)/g,
      "Boolean($1)"
    );

    // String(...) constructor C++ -> __String(...)
    code = code.replace(/([^.\w]|^)\bString\s*\(/g, "$1__String(");

    return code;
  }

  function wrapCallWithYieldStar(code, fnName, runtimeAlias) {
    var target = runtimeAlias || fnName;
    var re = new RegExp("\\b" + fnName + "\\s*\\(", "g");
    var out = "";
    var lastIdx = 0;
    var match;

    while ((match = re.exec(code)) !== null) {
      var idx = match.index;
      // Comprobar que no va precedido de '.' ni de 'function* '
      var before = code.slice(Math.max(0, idx - 20), idx);
      if (/\.\s*$/.test(before) || /function\*\s+$/.test(before)) {
        continue;
      }
      var openParen = code.indexOf("(", idx);
      var closeParen = findMatchingDelimiter(code, openParen, "(", ")");
      if (closeParen === -1) continue;

      out += code.slice(lastIdx, idx);
      var innerArgs = code.slice(openParen + 1, closeParen);
      // Recursivamente procesar llamadas anidadas dentro de argumentos si fuera el mismo nombre
      out += "(yield* " + target + "(" + wrapCallWithYieldStar(innerArgs, fnName, runtimeAlias) + "))";
      lastIdx = closeParen + 1;
      re.lastIndex = closeParen + 1;
    }

    out += code.slice(lastIdx);
    return out;
  }

  function injectLoopYieldGuards(code) {
    // Inserta if (__tickGuard()) yield; dentro de while / for / do para proteger contra bucles infinitos
    var out = "";
    var i = 0;
    var len = code.length;
    var doBlockPendingWhile = false;

    while (i < len) {
      var ch = code.charAt(i);
      if (/[A-Za-z_]/.test(ch)) {
        var prev = i > 0 ? code.charAt(i - 1) : "";
        if (!/[A-Za-z0-9_$]/.test(prev)) {
          var j = i;
          while (j < len && /[A-Za-z0-9_$]/.test(code.charAt(j))) j++;
          var word = code.slice(i, j);

          if (word === "do") {
            var k = j;
            while (k < len && /\s/.test(code.charAt(k))) k++;
            if (code.charAt(k) === "{") {
              out += code.slice(i, k + 1) + " if (__tickGuard()) yield;";
              doBlockPendingWhile = true;
              i = k + 1;
              continue;
            }
          } else if (word === "while" || word === "for") {
            var p = j;
            while (p < len && /\s/.test(code.charAt(p))) p++;
            if (code.charAt(p) === "(") {
              var closeP = findMatchingDelimiter(code, p, "(", ")");
              if (closeP !== -1) {
                var afterP = closeP + 1;
                while (afterP < len && /\s/.test(code.charAt(afterP))) afterP++;
                var nextCh = code.charAt(afterP);

                if (word === "while" && doBlockPendingWhile && nextCh === ";") {
                  doBlockPendingWhile = false;
                  out += code.slice(i, afterP + 1);
                  i = afterP + 1;
                  continue;
                }
                doBlockPendingWhile = false;

                if (nextCh === "{") {
                  out += code.slice(i, afterP + 1) + " if (__tickGuard()) yield;";
                  i = afterP + 1;
                  continue;
                }
                if (nextCh === ";") {
                  out += code.slice(i, closeP + 1) + " { if (__tickGuard()) yield; }";
                  i = afterP + 1;
                  continue;
                }
              }
            }
          }

          out += word;
          i = j;
          continue;
        }
      }

      out += ch;
      i++;
    }

    return out;
  }

  function estimateMemoryUsage(sourceCode, includes, jsCode) {
    var cleanLines = sourceCode
      .split(/\r?\n/)
      .filter(function (l) {
        var t = l.trim();
        return t && t.indexOf("//") !== 0;
      });
    var flash = 924 + cleanLines.length * 26 + Math.round(sourceCode.length * 1.15);
    var sram = 184 + Math.round(cleanLines.length * 3.5);

    var hasServo = includes.indexOf("Servo.h") !== -1 || /\bServo\b/.test(sourceCode);
    var hasLcd = includes.indexOf("LiquidCrystal.h") !== -1 || /\bLiquidCrystal\b/.test(sourceCode);
    var hasSerial = /\bSerial\b/.test(sourceCode);

    if (hasServo) {
      flash += 1680;
      sram += 48;
    }
    if (hasLcd) {
      flash += 1420;
      sram += 64;
    }
    if (hasSerial) {
      flash += 1150;
      sram += 192;
    }

    // Contar literales de texto en SRAM
    var strMatches = sourceCode.match(/"[^"]*"/g) || [];
    for (var i = 0; i < strMatches.length; i++) {
      sram += Math.max(2, strMatches[i].length - 1);
    }

    return {
      flashBytes: flash,
      sramBytes: sram,
      hasSerial: hasSerial
    };
  }

  function transpileAndCompileSketch(sourceCode) {
    var raw = String(sourceCode || "");
    if (!raw.trim()) {
      return {
        compileInfo: {
          ok: false,
          error: "El código está vacío.",
          flashBytes: 0,
          sramBytes: 0,
          warnings: []
        },
        factory: null
      };
    }

    var warnings = [];
    var tok = tokenizeStringsAndComments(raw);
    var pre = processPreprocessor(tok.code);
    var fnRes = transformFunctions(pre.code);
    var jsBody = transformDeclarations(fnRes.code);

    jsBody = wrapCallWithYieldStar(jsBody, "delay", "__delay");
    jsBody = wrapCallWithYieldStar(jsBody, "delayMicroseconds", "__delayMicroseconds");

    var userFuncNames = Object.keys(fnRes.userFuncs);
    for (var f = 0; f < userFuncNames.length; f++) {
      var fnName = userFuncNames[f];
      if (fnName !== "setup" && fnName !== "loop") {
        jsBody = wrapCallWithYieldStar(jsBody, fnName, fnName);
      }
    }

    jsBody = injectLoopYieldGuards(jsBody);
    jsBody = restoreLiterals(jsBody, tok.strings, tok.chars);

    if (!fnRes.userFuncs.setup) {
      return {
        compileInfo: {
          ok: false,
          error: "Falta la función obligatoria void setup() { ... }.",
          flashBytes: 0,
          sramBytes: 0,
          warnings: []
        },
        factory: null
      };
    }

    if (!fnRes.userFuncs.loop) {
      return {
        compileInfo: {
          ok: false,
          error: "Falta la función obligatoria void loop() { ... }.",
          flashBytes: 0,
          sramBytes: 0,
          warnings: []
        },
        factory: null
      };
    }

    var mem = estimateMemoryUsage(raw, pre.includes, jsBody);
    if (mem.hasSerial && !/\bSerial\s*\.\s*begin\s*\(/.test(raw)) {
      warnings.push("Se usa Serial sin Serial.begin(9600) en setup().");
    }
    if (mem.flashBytes > 32256) {
      return {
        compileInfo: {
          ok: false,
          error: "Sketch supera la memoria Flash del ATmega328P (" + mem.flashBytes + " / 32256 B).",
          flashBytes: mem.flashBytes,
          sramBytes: mem.sramBytes,
          warnings: warnings
        },
        factory: null
      };
    }
    if (mem.sramBytes > 2048) {
      warnings.push("Uso crítico de SRAM (" + mem.sramBytes + " / 2048 B).");
    }

    var wrappedSource =
      '"use strict";\n' +
      "var HIGH = 1, LOW = 0, INPUT = 0, OUTPUT = 1, INPUT_PULLUP = 2;\n" +
      "var LED_BUILTIN = 13;\n" +
      "var A0 = 14, A1 = 15, A2 = 16, A3 = 17, A4 = 18, A5 = 19;\n" +
      "var PI = Math.PI, HALF_PI = Math.PI / 2, TWO_PI = Math.PI * 2;\n" +
      "var DEC = 10, HEX = 16, OCT = 8, BIN = 2;\n" +
      "var NULL = null;\n" +
      "var pinMode = __api.pinMode;\n" +
      "var digitalWrite = __api.digitalWrite;\n" +
      "var digitalRead = __api.digitalRead;\n" +
      "var analogWrite = __api.analogWrite;\n" +
      "var analogRead = __api.analogRead;\n" +
      "var millis = __api.millis;\n" +
      "var micros = __api.micros;\n" +
      "var pulseIn = __api.pulseIn;\n" +
      "var tone = __api.tone;\n" +
      "var noTone = __api.noTone;\n" +
      "var map = __api.map;\n" +
      "var constrain = __api.constrain;\n" +
      "var abs = Math.abs;\n" +
      "var min = Math.min;\n" +
      "var max = Math.max;\n" +
      "var pow = Math.pow;\n" +
      "var sqrt = Math.sqrt;\n" +
      "var sq = __api.sq;\n" +
      "var sin = Math.sin;\n" +
      "var cos = Math.cos;\n" +
      "var tan = Math.tan;\n" +
      "var random = __api.random;\n" +
      "var randomSeed = __api.randomSeed;\n" +
      "var Serial = __api.Serial;\n" +
      "var F = __api.F;\n" +
      "var __String = __api.ArduinoString;\n" +
      "var __createServo = __api.createServo;\n" +
      "var __createLCD = __api.createLCD;\n" +
      "var __delay = __api.delay;\n" +
      "var __delayMicroseconds = __api.delayMicroseconds;\n" +
      "var __tickGuard = __api.tickGuard;\n" +
      jsBody +
      "\nreturn { setup: setup, loop: loop };";

    try {
      var factory = new Function("__api", wrappedSource);
      return {
        compileInfo: {
          ok: true,
          error: null,
          flashBytes: mem.flashBytes,
          sramBytes: mem.sramBytes,
          warnings: warnings
        },
        factory: factory
      };
    } catch (err) {
      return {
        compileInfo: {
          ok: false,
          error: err && err.message ? err.message : "Error de sintaxis en el sketch.",
          flashBytes: 0,
          sramBytes: 0,
          warnings: warnings
        },
        factory: null
      };
    }
  }

  // ============================================================================
  // 4. SOLUCIONADOR ELÉCTRICO (UNION-FIND + MNA + THEVENIN LEDs + SENSORES)
  // ============================================================================

  function createUnionFind() {
    var parent = Object.create(null);

    function find(x) {
      if (!(x in parent)) {
        parent[x] = x;
        return x;
      }
      var root = x;
      while (parent[root] !== root) {
        root = parent[root];
      }
      var cur = x;
      while (cur !== root) {
        var nxt = parent[cur];
        parent[cur] = root;
        cur = nxt;
      }
      return root;
    }

    function union(a, b) {
      var ra = find(a);
      var rb = find(b);
      if (ra !== rb) {
        parent[rb] = ra;
      }
    }

    return { find: find, union: union };
  }

  function solveLinearSystem(A, b) {
    var n = b.length;
    if (n === 0) return [];
    var M = new Array(n);
    var rhs = new Array(n);
    for (var i = 0; i < n; i++) {
      M[i] = A[i].slice();
      rhs[i] = b[i];
    }

    for (var col = 0; col < n; col++) {
      var pivotRow = col;
      var maxVal = Math.abs(M[col][col]);
      for (var r = col + 1; r < n; r++) {
        var v = Math.abs(M[r][col]);
        if (v > maxVal) {
          maxVal = v;
          pivotRow = r;
        }
      }
      if (maxVal < 1e-12) continue;

      if (pivotRow !== col) {
        var tmpRow = M[col];
        M[col] = M[pivotRow];
        M[pivotRow] = tmpRow;
        var tmpRhs = rhs[col];
        rhs[col] = rhs[pivotRow];
        rhs[pivotRow] = tmpRhs;
      }

      var diag = M[col][col];
      for (var row = col + 1; row < n; row++) {
        var factor = M[row][col] / diag;
        if (factor === 0) continue;
        for (var c = col; c < n; c++) {
          M[row][c] -= factor * M[col][c];
        }
        rhs[row] -= factor * rhs[col];
      }
    }

    var x = new Array(n);
    for (var k = n - 1; k >= 0; k--) {
      var sum = rhs[k];
      for (var j = k + 1; j < n; j++) {
        sum -= M[k][j] * x[j];
      }
      x[k] = Math.abs(M[k][k]) > 1e-12 ? sum / M[k][k] : 0;
    }
    return x;
  }

  // ============================================================================
  // 5. MOTOR WEBAUDIO SUAVE PARA BUZZER PIEZOELÉCTRICO
  // ============================================================================

  var AudioEngine = {
    ctx: null,
    osc: null,
    gain: null,
    activeFreq: 0,

    update: function (shouldPlay, freqHz) {
      if (!shouldPlay || !freqHz || freqHz < 20) {
        this.stop();
        return;
      }
      var AudioCtx = global.AudioContext || global.webkitAudioContext;
      if (!AudioCtx) return;

      try {
        if (!this.ctx) {
          this.ctx = new AudioCtx();
        }
        if (this.ctx.state === "suspended") {
          // Solo reanudar silenciosamente; si el navegador exige gesto usuario, no lanza error
          this.ctx.resume()["catch"](function () {});
        }
        if (this.ctx.state !== "running") return;

        if (!this.osc) {
          this.osc = this.ctx.createOscillator();
          this.gain = this.ctx.createGain();
          this.osc.type = "triangle";
          this.gain.gain.value = 0.0;
          this.osc.connect(this.gain);
          this.gain.connect(this.ctx.destination);
          this.osc.start();
        }

        var safeFreq = clamp(Number(freqHz), 40, 10000);
        if (this.activeFreq !== safeFreq) {
          this.osc.frequency.setValueAtTime(safeFreq, this.ctx.currentTime);
          this.activeFreq = safeFreq;
        }
        this.gain.gain.setTargetAtTime(0.032, this.ctx.currentTime, 0.015);
      } catch (e) {
        // Ignorar entornos sin soporte WebAudio
      }
    },

    stop: function () {
      try {
        if (this.gain && this.ctx && this.ctx.state === "running") {
          this.gain.gain.setTargetAtTime(0.0, this.ctx.currentTime, 0.015);
        }
      } catch (e) {
        // noop
      }
      this.activeFreq = 0;
    }
  };

  // ============================================================================
  // 6. OBJETO PRINCIPAL window.HardwareSim.Simulator
  // ============================================================================

  function createEmptyMcuState() {
    var pins = {};
    var pinModes = {};
    var pwm = {};
    var analogInputs = {};
    var digitalInputs = {};
    for (var d = 0; d <= 13; d++) {
      var did = "D" + d;
      pins[did] = 0;
      pinModes[did] = "INPUT";
      pwm[did] = null;
      digitalInputs[did] = 0;
    }
    for (var a = 0; a <= 5; a++) {
      var aid = "A" + a;
      pins[aid] = 0;
      pinModes[aid] = "INPUT";
      pwm[aid] = null;
      analogInputs[aid] = 0;
      digitalInputs[aid] = 0;
    }
    return {
      pins: pins,
      pinModes: pinModes,
      pwm: pwm,
      analogInputs: analogInputs,
      digitalInputs: digitalInputs,
      ledL: false,
      txActive: false,
      rxActive: false,
      txPulseMs: 0,
      rxPulseMs: 0,
      vcc: 5.0,
      tonePin: null,
      toneFreq: 0,
      toneEndMs: null,
      servos: [],
      lcd: {
        cols: 16,
        rows: 2,
        cursorCol: 0,
        cursorRow: 0,
        buffer: [new Array(16).fill(" "), new Array(16).fill(" ")],
        line1: "",
        line2: "",
        initialized: false,
        pins: null
      }
    };
  }

  var Simulator = {
    components: [],
    wires: [],
    running: false,
    simTimeMs: 0,
    sketchCode: "",
    sketchName: "",
    serialLines: [],
    compileInfo: {
      ok: true,
      error: null,
      flashBytes: 0,
      sramBytes: 0,
      warnings: []
    },
    mcuState: createEmptyMcuState(),
    soundEnabled: true,

    // Estado interno
    _listeners: {},
    _nextCompNum: 1,
    _nextWireNum: 1,
    _serialPartial: "",
    _netSolve: {
      pinVoltage: {},
      pinPeakVoltage: {},
      pinDuty: {},
      pinNet: {},
      netVoltage: {},
      netPeakVoltage: {},
      netDuty: {},
      netFixed: {},
      netDrivers: {},
      shortCircuits: {}
    },
    _runner: {
      factory: null,
      hooks: null,
      phase: "idle",
      gen: null,
      waitUntilMs: 0,
      guardCounter: 0,
      hadYieldThisLoop: false
    },
    _breadboardCache: null,

    on: function (event, cb) {
      if (typeof cb !== "function" || !event) return;
      if (!this._listeners[event]) this._listeners[event] = [];
      if (this._listeners[event].indexOf(cb) === -1) {
        this._listeners[event].push(cb);
      }
    },

    off: function (event, cb) {
      var list = this._listeners[event];
      if (!list) return;
      var idx = list.indexOf(cb);
      if (idx !== -1) list.splice(idx, 1);
    },

    _emit: function (event, payload) {
      var list = this._listeners[event];
      if (!list || list.length === 0) return;
      for (var i = 0; i < list.length; i++) {
        try {
          list[i](payload);
        } catch (e) {
          // Proteger bucle de simulación frente a listeners externos
        }
      }
    },

    getState: function () {
      return {
        components: this.components,
        wires: this.wires,
        running: this.running,
        simTimeMs: this.simTimeMs,
        sketchCode: this.sketchCode,
        sketchName: this.sketchName,
        serialLines: this.serialLines,
        compileInfo: this.compileInfo,
        mcuState: this.mcuState,
        soundEnabled: this.soundEnabled
      };
    },

    init: function () {
      this._invalidateBreadboardCache();
      if (!this.sketchCode && PRESETS.length > 0) {
        this.loadSketch(PRESETS[0].code, PRESETS[0].name);
      } else {
        this.solveCircuit(0);
      }
      return this.getState();
    },

    _invalidateBreadboardCache: function () {
      this._breadboardCache = null;
    },

    _makeDefaultState: function (type, props) {
      if (type === "arduino_uno_r3") {
        return { ledL: false, txActive: false, rxActive: false, vcc: 5.0 };
      }
      if (type === "led") {
        return {
          lit: false,
          brightness: 0,
          currentMa: 0,
          voltageDrop: 0,
          overcurrent: false
        };
      }
      if (type === "resistor") {
        return { voltageDrop: 0, currentMa: 0, powerMw: 0 };
      }
      if (type === "pushbutton") {
        return { pressed: Boolean(props && props.pressed), voltageA: null, voltageB: null };
      }
      if (type === "potentiometer") {
        var v = props && props.value != null ? Number(props.value) : 0.5;
        return { value: v, wiperVoltage: null, angleDeg: -135 + v * 270 };
      }
      if (type === "servo_sg90") {
        var ang = props && props.angle != null ? Number(props.angle) : 90;
        return { currentAngle: ang, targetAngle: ang, powered: false, attachedPin: null };
      }
      if (type === "ultrasonic_hcsr04") {
        var dist = props && props.distanceCm != null ? Number(props.distanceCm) : 45;
        return {
          distanceCm: dist,
          echoUs: 0,
          powered: false,
          active: false,
          lastTrigMs: -9999
        };
      }
      if (type === "lcd_1602") {
        return { line1: "", line2: "", powered: false, backlight: false, wiredOk: false };
      }
      if (type === "ldr") {
        var lux = props && props.lux != null ? Number(props.lux) : 300;
        return { lux: lux, resistance: 15000, voltageP1: null, voltageP2: null };
      }
      if (type === "tmp36") {
        var tc = props && props.tempC != null ? Number(props.tempC) : 25;
        return { tempC: tc, vout: 0, powered: false };
      }
      if (type === "buzzer") {
        return { active: false, frequency: 0, voltageDrop: 0 };
      }
      return {};
    },

    addComponent: function (type, pos, props, customId) {
      var ds = getDatasheets();
      var info = ds && typeof ds.get === "function" ? ds.get(type) : null;
      var baseProps = info && info.defaultProps ? cloneShallow(info.defaultProps) : {};
      if (props) {
        var pk = Object.keys(props);
        for (var i = 0; i < pk.length; i++) {
          baseProps[pk[i]] = props[pk[i]];
        }
      }
      var id = customId || "comp_" + this._nextCompNum++;
      var comp = {
        id: id,
        type: type,
        label: (info && (info.shortName || info.name)) || type,
        pos: {
          x: pos && pos.x != null ? Number(pos.x) : 0,
          y: pos && pos.y != null ? Number(pos.y) : 0,
          z: pos && pos.z != null ? Number(pos.z) : 0
        },
        rotY: 0,
        props: baseProps,
        state: this._makeDefaultState(type, baseProps)
      };
      this.components.push(comp);
      this._invalidateBreadboardCache();
      this.solveCircuit(0);
      this._emit("circuit", { action: "addComponent", component: comp });
      return comp;
    },

    removeComponent: function (compId) {
      var idx = -1;
      for (var i = 0; i < this.components.length; i++) {
        if (this.components[i].id === compId) {
          idx = i;
          break;
        }
      }
      if (idx === -1) return false;
      this.components.splice(idx, 1);

      // Eliminar cables conectados a este componente
      this.wires = this.wires.filter(function (w) {
        return w.from.compId !== compId && w.to.compId !== compId;
      });

      this._invalidateBreadboardCache();
      this.solveCircuit(0);
      this._emit("circuit", { action: "removeComponent", compId: compId });
      return true;
    },

    _findComponent: function (compId) {
      for (var i = 0; i < this.components.length; i++) {
        if (this.components[i].id === compId) return this.components[i];
      }
      return null;
    },

    updateComponentPos: function (compId, pos) {
      var comp = this._findComponent(compId);
      if (!comp || !pos) return false;
      if (pos.x != null) comp.pos.x = Number(pos.x);
      if (pos.y != null) comp.pos.y = Number(pos.y);
      if (pos.z != null) comp.pos.z = Number(pos.z);
      if (comp.type === "breadboard_830") {
        this._invalidateBreadboardCache();
      }
      this.solveCircuit(0);
      this._emit("circuit", { action: "moveComponent", compId: compId, pos: comp.pos });
      return true;
    },

    rotateComponent: function (compId, deltaDeg) {
      var comp = this._findComponent(compId);
      if (!comp) return false;
      var deg = Number(deltaDeg || 0);
      comp.rotY = (comp.rotY || 0) + (deg * Math.PI) / 180;
      if (comp.type === "breadboard_830") {
        this._invalidateBreadboardCache();
      }
      this.solveCircuit(0);
      this._emit("circuit", { action: "rotateComponent", compId: compId, rotY: comp.rotY });
      return true;
    },

    updateComponentProps: function (compId, patch) {
      var comp = this._findComponent(compId);
      if (!comp || !patch) return false;
      if (!comp.props) comp.props = {};
      if (!comp.state) comp.state = {};

      var keys = Object.keys(patch);
      for (var i = 0; i < keys.length; i++) {
        var k = keys[i];
        comp.props[k] = patch[k];
      }

      if (comp.type === "pushbutton" && "pressed" in patch) {
        comp.state.pressed = Boolean(patch.pressed);
      }
      if (comp.type === "potentiometer" && "value" in patch) {
        comp.props.value = clamp(Number(patch.value), 0, 1);
        comp.state.value = comp.props.value;
      }
      if (comp.type === "ldr" && "lux" in patch) {
        comp.props.lux = Math.max(0.1, Number(patch.lux));
      }
      if (comp.type === "tmp36" && "tempC" in patch) {
        comp.props.tempC = clamp(Number(patch.tempC), -40, 125);
      }
      if (comp.type === "ultrasonic_hcsr04" && "distanceCm" in patch) {
        comp.props.distanceCm = clamp(Number(patch.distanceCm), 2, 400);
      }
      if (comp.type === "resistor" && "ohms" in patch) {
        comp.props.ohms = Math.max(1, Number(patch.ohms));
      }

      this.solveCircuit(0);
      this._emit("circuit", { action: "updateProps", compId: compId, props: comp.props });
      return true;
    },

    addWire: function (from, to, color) {
      if (!from || !to || !from.compId || !from.pinId || !to.compId || !to.pinId) {
        return null;
      }
      if (from.compId === to.compId && from.pinId === to.pinId) {
        return null;
      }
      // Evitar duplicado exacto
      for (var i = 0; i < this.wires.length; i++) {
        var w = this.wires[i];
        var sameForward =
          w.from.compId === from.compId &&
          w.from.pinId === from.pinId &&
          w.to.compId === to.compId &&
          w.to.pinId === to.pinId;
        var sameReverse =
          w.from.compId === to.compId &&
          w.from.pinId === to.pinId &&
          w.to.compId === from.compId &&
          w.to.pinId === from.pinId;
        if (sameForward || sameReverse) return w;
      }

      var wire = {
        id: "wire_" + this._nextWireNum++,
        from: { compId: from.compId, pinId: from.pinId },
        to: { compId: to.compId, pinId: to.pinId },
        color: color || "#EF4444"
      };
      this.wires.push(wire);
      this.solveCircuit(0);
      this._emit("circuit", { action: "addWire", wire: wire });
      return wire;
    },

    removeWire: function (wireId) {
      var idx = -1;
      for (var i = 0; i < this.wires.length; i++) {
        if (this.wires[i].id === wireId) {
          idx = i;
          break;
        }
      }
      if (idx === -1) return false;
      this.wires.splice(idx, 1);
      this.solveCircuit(0);
      this._emit("circuit", { action: "removeWire", wireId: wireId });
      return true;
    },

    updateWireColor: function (wireId, color) {
      for (var i = 0; i < this.wires.length; i++) {
        if (this.wires[i].id === wireId) {
          this.wires[i].color = color || "#EF4444";
          this._emit("circuit", { action: "updateWireColor", wireId: wireId, color: color });
          return true;
        }
      }
      return false;
    },

    clearCircuit: function () {
      this.pause();
      this.components = [];
      this.wires = [];
      this._nextCompNum = 1;
      this._nextWireNum = 1;
      this._invalidateBreadboardCache();
      this.reset();
      this.solveCircuit(0);
      this._emit("circuit", { action: "clearCircuit" });
    },

    clearSerial: function () {
      this.serialLines = [];
      this._serialPartial = "";
      this._emit("serial", { lines: this.serialLines });
    },

    _appendSerialText: function (text) {
      var str = String(text === undefined || text === null ? "" : text);
      this._serialPartial += str;
      this.mcuState.txPulseMs = 90;
      this.mcuState.txActive = true;

      var parts = this._serialPartial.split("\n");
      if (parts.length > 1) {
        for (var i = 0; i < parts.length - 1; i++) {
          this.serialLines.push({
            timeMs: Math.round(this.simTimeMs),
            text: parts[i].replace(/\r$/, "")
          });
        }
        this._serialPartial = parts[parts.length - 1];
        if (this.serialLines.length > 250) {
          this.serialLines.splice(0, this.serialLines.length - 250);
        }
        this._emit("serial", { lines: this.serialLines });
      } else if (this._serialPartial.length > 120) {
        this.serialLines.push({
          timeMs: Math.round(this.simTimeMs),
          text: this._serialPartial
        });
        this._serialPartial = "";
        if (this.serialLines.length > 250) {
          this.serialLines.splice(0, this.serialLines.length - 250);
        }
        this._emit("serial", { lines: this.serialLines });
      }
    },

    // ==========================================================================
    // MAQUETA INICIAL 3D (Simulator.loadInitialMockup())
    // ==========================================================================

    loadInitialMockup: function () {
      var wasRunning = this.running;
      this.pause();
      this.components = [];
      this.wires = [];
      this._nextCompNum = 1;
      this._nextWireNum = 1;
      this._invalidateBreadboardCache();

      // 1. Placa Arduino Uno R3 en (-75, 0, 0) y Protoboard 830 en (65, 0, 0)
      var uno = this.addComponent("arduino_uno_r3", { x: -75, y: 0, z: 0 }, {}, "comp_arduino");
      var bb = this.addComponent("breadboard_830", { x: 65, y: 0, z: 0 }, {}, "comp_breadboard");

      // Mapa de agujeros reales de la protoboard desde Datasheets
      var bbPins = getPinsForType("breadboard_830");
      var holeMap = {};
      for (var i = 0; i < bbPins.length; i++) {
        holeMap[bbPins[i].id] = bbPins[i].localPos;
      }
      var holeWorld = function (holeId) {
        var lp = holeMap[holeId] || { x: 0, y: 9.2, z: 0 };
        return {
          x: Number((bb.pos.x + lp.x).toFixed(3)),
          y: Number((bb.pos.y + lp.y).toFixed(3)),
          z: Number((bb.pos.z + lp.z).toFixed(3))
        };
      };

      // Helper para montar LED (ANODE en hA, CATHODE en hC) respetando pinout real
      var placeBreadboardLed = function (self, colStart, color, idSuffix) {
        var hA = holeWorld("d" + colStart);
        var hC = holeWorld("d" + (colStart + 1));
        var ledPos = {
          x: Number(((hA.x + hC.x) / 2).toFixed(3)),
          y: hA.y,
          z: hA.z
        };
        return self.addComponent("led", ledPos, { color: color }, "comp_led_" + idSuffix);
      };

      // Helper para montar Resistencia axial 220 Ohm (P1 en bColStart, P2 en bColStart+4)
      var placeBreadboardResistor = function (self, colStart, ohms, idSuffix) {
        var h1 = holeWorld("b" + colStart);
        var h2 = holeWorld("b" + (colStart + 4));
        var rPos = {
          x: Number(((h1.x + h2.x) / 2).toFixed(3)),
          y: h1.y,
          z: h1.z
        };
        return self.addComponent("resistor", rPos, { ohms: ohms }, "comp_res_" + idSuffix);
      };

      // 2. Tres LEDs + Resistencias de 220 Ohm hacia bus negativo GND
      // LED Rojo (D13 -> a10, d10..d11 -> R220 b11..b15 -> a15 -> tn_8 GND)
      placeBreadboardLed(this, 10, "red", "red");
      placeBreadboardResistor(this, 11, 220, "red");

      // LED Amarillo (D10 -> a20, d20..d21 -> R220 b21..b25 -> a25 -> tn_17 GND)
      placeBreadboardLed(this, 20, "yellow", "yellow");
      placeBreadboardResistor(this, 21, 220, "yellow");

      // LED Verde PWM (D11 -> a30, d30..d31 -> R220 b31..b35 -> a35 -> tn_26 GND)
      placeBreadboardLed(this, 30, "green", "green");
      placeBreadboardResistor(this, 31, 220, "green");

      // 3. Pulsador táctil en protoboard cruzando canal central DIP (e39..f41)
      var pbAnchor = holeWorld("e40");
      this.addComponent(
        "pushbutton",
        { x: pbAnchor.x, y: pbAnchor.y, z: bb.pos.z },
        { pressed: false },
        "comp_button"
      );

      // 4. Potenciómetro 10k con pines en h51 (VCC), h52 (WIPER), h53 (GND)
      var potWiperHole = holeWorld("h52");
      var potPinInfo = getPinsForType("potentiometer");
      var wiperOffsetZ = 5.08;
      for (var p = 0; p < potPinInfo.length; p++) {
        if (potPinInfo[p].id === "WIPER") {
          wiperOffsetZ = potPinInfo[p].localPos.z;
          break;
        }
      }
      this.addComponent(
        "potentiometer",
        {
          x: potWiperHole.x,
          y: potWiperHole.y,
          z: Number((potWiperHole.z - wiperOffsetZ).toFixed(3))
        },
        { value: 0.65, resistance: 10000 },
        "comp_pot"
      );

      // 5. Micro Servo SG90 en (-75, 0, 68)
      var servo = this.addComponent(
        "servo_sg90",
        { x: -75, y: 0, z: 68 },
        { angle: 117 },
        "comp_servo"
      );

      // 6. Pantalla LCD 16x2 en (65, 0, -68)
      var lcd = this.addComponent(
        "lcd_1602",
        { x: 65, y: 0, z: -68 },
        { contrast: 0.7, backlight: true },
        "comp_lcd"
      );

      // 7. Cableado Dupont ordenado y funcional
      // Alimentación principal Arduino <-> Buses de Protoboard
      this.addWire({ compId: uno.id, pinId: "5V" }, { compId: bb.id, pinId: "bp_2" }, "#EF4444");
      this.addWire({ compId: uno.id, pinId: "GND2" }, { compId: bb.id, pinId: "bn_2" }, "#1F2937");
      this.addWire({ compId: bb.id, pinId: "bp_49" }, { compId: bb.id, pinId: "tp_49" }, "#EF4444");
      this.addWire({ compId: bb.id, pinId: "bn_50" }, { compId: bb.id, pinId: "tn_50" }, "#1F2937");

      // LEDs desde Arduino y retorno a GND por resistencias
      this.addWire({ compId: uno.id, pinId: "D13" }, { compId: bb.id, pinId: "a10" }, "#EF4444");
      this.addWire({ compId: bb.id, pinId: "a15" }, { compId: bb.id, pinId: "tn_8" }, "#1F2937");

      this.addWire({ compId: uno.id, pinId: "D10" }, { compId: bb.id, pinId: "a20" }, "#F59E0B");
      this.addWire({ compId: bb.id, pinId: "a25" }, { compId: bb.id, pinId: "tn_17" }, "#1F2937");

      this.addWire({ compId: uno.id, pinId: "D11" }, { compId: bb.id, pinId: "a30" }, "#22C55E");
      this.addWire({ compId: bb.id, pinId: "a35" }, { compId: bb.id, pinId: "tn_26" }, "#1F2937");

      // Pulsador -> D2 (INPUT_PULLUP) y GND
      this.addWire({ compId: uno.id, pinId: "D2" }, { compId: bb.id, pinId: "a39" }, "#3B82F6");
      this.addWire({ compId: bb.id, pinId: "j39" }, { compId: bb.id, pinId: "bn_32" }, "#1F2937");

      // Potenciómetro -> 5V, A0, GND
      this.addWire({ compId: bb.id, pinId: "j51" }, { compId: bb.id, pinId: "bp_41" }, "#EF4444");
      this.addWire({ compId: bb.id, pinId: "j52" }, { compId: uno.id, pinId: "A0" }, "#EAB308");
      this.addWire({ compId: bb.id, pinId: "j53" }, { compId: bb.id, pinId: "bn_43" }, "#1F2937");

      // Servo SG90 -> 5V, GND, D9
      this.addWire({ compId: bb.id, pinId: "bp_10" }, { compId: servo.id, pinId: "VCC" }, "#EF4444");
      this.addWire({ compId: bb.id, pinId: "bn_10" }, { compId: servo.id, pinId: "GND" }, "#1F2937");
      this.addWire({ compId: uno.id, pinId: "D9" }, { compId: servo.id, pinId: "PWM" }, "#F59E0B");

      // LCD 16x2 modo 4 bits: RS->D12, E->D8, D4->D7, D5->D6, D6->D5, D7->D4, VDD->5V, VSS/RW->GND
      this.addWire({ compId: lcd.id, pinId: "VSS" }, { compId: bb.id, pinId: "tn_1" }, "#1F2937");
      this.addWire({ compId: lcd.id, pinId: "VDD" }, { compId: bb.id, pinId: "tp_1" }, "#EF4444");
      this.addWire({ compId: lcd.id, pinId: "RW" }, { compId: bb.id, pinId: "tn_2" }, "#1F2937");
      this.addWire({ compId: lcd.id, pinId: "RS" }, { compId: uno.id, pinId: "D12" }, "#3B82F6");
      this.addWire({ compId: lcd.id, pinId: "E" }, { compId: uno.id, pinId: "D8" }, "#8B5CF6");
      this.addWire({ compId: lcd.id, pinId: "D4" }, { compId: uno.id, pinId: "D7" }, "#22C55E");
      this.addWire({ compId: lcd.id, pinId: "D5" }, { compId: uno.id, pinId: "D6" }, "#EAB308");
      this.addWire({ compId: lcd.id, pinId: "D6" }, { compId: uno.id, pinId: "D5" }, "#3B82F6");
      this.addWire({ compId: lcd.id, pinId: "D7" }, { compId: uno.id, pinId: "D4" }, "#8B5CF6");

      // Cargar sketch por defecto y arrancar la maqueta en vivo
      var initialPreset = PRESETS[0];
      this.loadSketch(initialPreset.code, initialPreset.name);
      this.start();
      if (!wasRunning) {
        // step inicial breve para que LCD, LEDs y Servo muestren telemetría inmediata en el primer frame
        this.step(16);
      }
      this._emit("circuit", { action: "loadInitialMockup" });
    },

    // ==========================================================================
    // CARGA Y EJECUCIÓN DEL SKETCH ARDUINO
    // ==========================================================================

    loadSketch: function (code, name) {
      this.sketchCode = String(code || "");
      this.sketchName = name || "sketch.ino";

      var compiled = transpileAndCompileSketch(this.sketchCode);
      this.compileInfo = compiled.compileInfo;
      this._runner.factory = compiled.factory;

      // Pulso visual RX al inyectar código
      this.mcuState.rxPulseMs = 180;
      this.mcuState.rxActive = true;

      this.reset();
      this._emit("compile", { compileInfo: this.compileInfo });
      return this.compileInfo;
    },

    start: function () {
      this.running = true;
      this._emit("state", { running: this.running });
    },

    pause: function () {
      this.running = false;
      AudioEngine.stop();
      this._emit("state", { running: this.running });
    },

    reset: function () {
      var prevRx = this.mcuState ? this.mcuState.rxPulseMs : 0;
      this.simTimeMs = 0;
      this.serialLines = [];
      this._serialPartial = "";
      this.mcuState = createEmptyMcuState();
      if (prevRx > 0) {
        this.mcuState.rxPulseMs = prevRx;
        this.mcuState.rxActive = true;
      }
      AudioEngine.stop();

      // Reiniciar estado transitorio de componentes manteniendo propiedades de usuario
      for (var i = 0; i < this.components.length; i++) {
        var c = this.components[i];
        c.state = this._makeDefaultState(c.type, c.props);
      }

      this._runner.hooks = null;
      this._runner.phase = "init";
      this._runner.gen = null;
      this._runner.waitUntilMs = 0;
      this._runner.guardCounter = 0;
      this._runner.hadYieldThisLoop = false;

      if (this.compileInfo.ok && this._runner.factory) {
        this._initSketchInstance();
      }

      this.solveCircuit(0);
      this._emit("serial", { lines: this.serialLines });
      this._emit("state", { running: this.running, simTimeMs: this.simTimeMs });
    },

    _initSketchInstance: function () {
      var self = this;
      var api = {
        pinMode: function (pin, mode) {
          var pid = resolveArduinoPinId(pin);
          if (!pid) return;
          if (mode === 1) self.mcuState.pinModes[pid] = "OUTPUT";
          else if (mode === 2) self.mcuState.pinModes[pid] = "INPUT_PULLUP";
          else self.mcuState.pinModes[pid] = "INPUT";
        },

        digitalWrite: function (pin, val) {
          var pid = resolveArduinoPinId(pin);
          if (!pid) return;
          var high = val ? 1 : 0;
          self.mcuState.pins[pid] = high;
          self.mcuState.pwm[pid] = null;
          if (pid === "D13") {
            self.mcuState.ledL = Boolean(high);
          }
          // Detectar flanco en TRIG de HC-SR04 conectados a este pin
          if (high) {
            self._markUltrasonicTriggers(pid);
          }
        },

        digitalRead: function (pin) {
          var pid = resolveArduinoPinId(pin);
          if (!pid) return 0;
          if (self.mcuState.pinModes[pid] === "OUTPUT") {
            return self.mcuState.pins[pid] ? 1 : 0;
          }
          var val = self.mcuState.digitalInputs[pid];
          if (val === undefined) {
            return self.mcuState.pinModes[pid] === "INPUT_PULLUP" ? 1 : 0;
          }
          return val ? 1 : 0;
        },

        analogWrite: function (pin, val) {
          var pid = resolveArduinoPinId(pin);
          if (!pid) return;
          var duty = clamp(Math.round(Number(val) || 0), 0, 255);
          self.mcuState.pinModes[pid] = "OUTPUT";
          if (ARDUINO_PWM_PINS[pid]) {
            self.mcuState.pwm[pid] = duty;
            self.mcuState.pins[pid] = duty > 0 ? 1 : 0;
          } else {
            // Pines no-PWM en ATmega328P caen a digital >=128
            self.mcuState.pwm[pid] = null;
            self.mcuState.pins[pid] = duty >= 128 ? 1 : 0;
          }
          if (pid === "D13") {
            self.mcuState.ledL = Boolean(self.mcuState.pins[pid]);
          }
        },

        analogRead: function (pin) {
          var aid = resolveAnalogPinId(pin);
          if (!aid) return 0;
          var v = self.mcuState.analogInputs[aid];
          if (v === undefined || v === null) return 0;
          return clamp(Math.round((v / 5.0) * 1023), 0, 1023);
        },

        millis: function () {
          return Math.floor(self.simTimeMs);
        },

        micros: function () {
          return Math.floor(self.simTimeMs * 1000);
        },

        pulseIn: function (pin, stateVal) {
          var pid = resolveArduinoPinId(pin);
          if (!pid) return 0;
          var wantHigh = stateVal === undefined ? 1 : stateVal ? 1 : 0;
          if (!wantHigh) return 0;
          return self._measureUltrasonicPulseUs(pid);
        },

        tone: function (pin, freq, durationMs) {
          var pid = resolveArduinoPinId(pin);
          if (!pid) return;
          self.mcuState.pinModes[pid] = "OUTPUT";
          self.mcuState.tonePin = pid;
          self.mcuState.toneFreq = Math.max(0, Number(freq) || 0);
          self.mcuState.toneEndMs =
            durationMs != null && Number(durationMs) > 0
              ? self.simTimeMs + Number(durationMs)
              : null;
        },

        noTone: function (pin) {
          if (pin === undefined || pin === null) {
            self.mcuState.tonePin = null;
            self.mcuState.toneFreq = 0;
            self.mcuState.toneEndMs = null;
            return;
          }
          var pid = resolveArduinoPinId(pin);
          if (!self.mcuState.tonePin || self.mcuState.tonePin === pid) {
            self.mcuState.tonePin = null;
            self.mcuState.toneFreq = 0;
            self.mcuState.toneEndMs = null;
          }
        },

        map: function (x, inMin, inMax, outMin, outMax) {
          var denom = inMax - inMin;
          if (denom === 0) return outMin;
          return Math.trunc(((x - inMin) * (outMax - outMin)) / denom + outMin);
        },

        constrain: function (x, a, b) {
          return clamp(x, a, b);
        },

        sq: function (x) {
          return x * x;
        },

        random: function (minOrMax, maxVal) {
          if (maxVal === undefined) {
            var hi = Math.max(1, Math.trunc(Number(minOrMax) || 1));
            return Math.floor(Math.random() * hi);
          }
          var lo = Math.trunc(Number(minOrMax) || 0);
          var hi2 = Math.trunc(Number(maxVal) || lo + 1);
          if (hi2 <= lo) return lo;
          return lo + Math.floor(Math.random() * (hi2 - lo));
        },

        randomSeed: function () {},

        F: function (s) {
          return s;
        },

        ArduinoString: function (val, base) {
          if (val === undefined || val === null) return "";
          if (typeof val === "number") {
            if (base === 16) return Math.trunc(val).toString(16).toUpperCase();
            if (base === 2) return Math.trunc(val).toString(2);
            if (base === 8) return Math.trunc(val).toString(8);
          }
          return String(val);
        },

        Serial: {
          begin: function () {},
          available: function () {
            return 0;
          },
          print: function (val, fmt) {
            self._appendSerialText(formatPrintValue(val, fmt));
          },
          println: function (val, fmt) {
            var txt = val === undefined ? "" : formatPrintValue(val, fmt);
            self._appendSerialText(txt + "\n");
          }
        },

        createServo: function () {
          var servoObj = {
            pinId: null,
            angle: 90,
            isAttached: false
          };
          self.mcuState.servos.push(servoObj);
          return {
            attach: function (pin) {
              var pid = resolveArduinoPinId(pin);
              if (!pid) return;
              servoObj.pinId = pid;
              servoObj.isAttached = true;
              self.mcuState.pinModes[pid] = "OUTPUT";
            },
            detach: function () {
              servoObj.isAttached = false;
              servoObj.pinId = null;
            },
            attached: function () {
              return servoObj.isAttached;
            },
            write: function (deg) {
              var val = Number(deg);
              if (isNaN(val)) return;
              if (val >= 500) {
                // Algunos códigos pasan microsegundos a write()
                val = ((val - 544) / (2400 - 544)) * 180;
              }
              servoObj.angle = clamp(val, 0, 180);
            },
            writeMicroseconds: function (us) {
              var deg = ((Number(us) - 544) / (2400 - 544)) * 180;
              servoObj.angle = clamp(deg, 0, 180);
            },
            read: function () {
              return Math.round(servoObj.angle);
            }
          };
        },

        createLCD: function () {
          var args = Array.prototype.slice.call(arguments);
          var pinMap = null;
          if (args.length === 6) {
            pinMap = {
              rs: resolveArduinoPinId(args[0]),
              rw: null,
              en: resolveArduinoPinId(args[1]),
              d4: resolveArduinoPinId(args[2]),
              d5: resolveArduinoPinId(args[3]),
              d6: resolveArduinoPinId(args[4]),
              d7: resolveArduinoPinId(args[5])
            };
          } else if (args.length >= 7) {
            pinMap = {
              rs: resolveArduinoPinId(args[0]),
              rw: resolveArduinoPinId(args[1]),
              en: resolveArduinoPinId(args[2]),
              d4: resolveArduinoPinId(args[3]),
              d5: resolveArduinoPinId(args[4]),
              d6: resolveArduinoPinId(args[5]),
              d7: resolveArduinoPinId(args[6])
            };
          }
          self.mcuState.lcd.pins = pinMap;

          var syncLcdStrings = function () {
            var lcd = self.mcuState.lcd;
            lcd.line1 = lcd.buffer[0].join("");
            lcd.line2 = lcd.buffer[1].join("");
          };

          var clearBuffer = function () {
            var lcd = self.mcuState.lcd;
            lcd.buffer = [new Array(16).fill(" "), new Array(16).fill(" ")];
            lcd.cursorCol = 0;
            lcd.cursorRow = 0;
            syncLcdStrings();
          };

          return {
            begin: function (cols, rows) {
              self.mcuState.lcd.cols = cols || 16;
              self.mcuState.lcd.rows = rows || 2;
              self.mcuState.lcd.initialized = true;
              clearBuffer();
            },
            clear: function () {
              clearBuffer();
            },
            home: function () {
              self.mcuState.lcd.cursorCol = 0;
              self.mcuState.lcd.cursorRow = 0;
            },
            setCursor: function (col, row) {
              self.mcuState.lcd.cursorCol = clamp(Math.trunc(Number(col) || 0), 0, 15);
              self.mcuState.lcd.cursorRow = clamp(Math.trunc(Number(row) || 0), 0, 1);
            },
            print: function (val, fmt) {
              var lcd = self.mcuState.lcd;
              if (!lcd.initialized) lcd.initialized = true;
              var str = formatPrintValue(val, fmt);
              for (var i = 0; i < str.length; i++) {
                if (lcd.cursorCol < 16 && lcd.cursorRow < 2) {
                  lcd.buffer[lcd.cursorRow][lcd.cursorCol] = str.charAt(i);
                  lcd.cursorCol++;
                }
              }
              syncLcdStrings();
            },
            write: function (ch) {
              var s = typeof ch === "number" ? String.fromCharCode(ch) : String(ch || "");
              this.print(s);
            },
            display: function () {},
            noDisplay: function () {},
            cursor: function () {},
            noCursor: function () {}
          };
        },

        delay: function* (ms) {
          var waitMs = Math.max(0, Number(ms) || 0);
          yield { type: "delay", ms: waitMs };
        },

        delayMicroseconds: function* (us) {
          var waitMs = Math.max(0, (Number(us) || 0) / 1000);
          yield { type: "delay", ms: waitMs };
        },

        tickGuard: function () {
          self._runner.guardCounter++;
          if (self._runner.guardCounter >= 1500) {
            self._runner.guardCounter = 0;
            return true;
          }
          return false;
        }
      };

      try {
        this._runner.hooks = this._runner.factory(api);
        this._runner.phase = "setup";
        this._runner.gen = this._runner.hooks.setup();
        this._runner.waitUntilMs = 0;
        this._runner.hadYieldThisLoop = false;
      } catch (err) {
        this.compileInfo = {
          ok: false,
          error: "Error en tiempo de ejecución inicial: " + (err && err.message ? err.message : err),
          flashBytes: this.compileInfo.flashBytes,
          sramBytes: this.compileInfo.sramBytes,
          warnings: this.compileInfo.warnings
        };
        this._emit("compile", { compileInfo: this.compileInfo });
      }
    },

    _markUltrasonicTriggers: function (arduinoPinId) {
      var uno = this._findArduino();
      if (!uno) return;
      var trigNet = this._netSolve.pinNet[uno.id + ":" + arduinoPinId];
      if (!trigNet) return;

      for (var i = 0; i < this.components.length; i++) {
        var c = this.components[i];
        if (c.type !== "ultrasonic_hcsr04") continue;
        var echoCompNet = this._netSolve.pinNet[c.id + ":TRIG"];
        if (echoCompNet && echoCompNet === trigNet) {
          c.state.lastTrigMs = this.simTimeMs;
          c.state.active = true;
        }
      }
    },

    _measureUltrasonicPulseUs: function (arduinoPinId) {
      var uno = this._findArduino();
      if (!uno) return 0;
      var echoNet = this._netSolve.pinNet[uno.id + ":" + arduinoPinId];
      if (!echoNet) return 0;

      for (var i = 0; i < this.components.length; i++) {
        var c = this.components[i];
        if (c.type !== "ultrasonic_hcsr04") continue;
        var compEchoNet = this._netSolve.pinNet[c.id + ":ECHO"];
        if (compEchoNet && compEchoNet === echoNet && c.state.powered) {
          c.state.lastTrigMs = this.simTimeMs;
          c.state.active = true;
          var dist = clamp(Number(c.props && c.props.distanceCm != null ? c.props.distanceCm : 45), 2, 400);
          return Math.round(dist * 58);
        }
      }
      return 0;
    },

    step: function (dtMs) {
      var stepDt = clamp(Number(dtMs) || 0, 0, 100);
      if (!this.running) {
        return;
      }

      // Decaer pulsos TX/RX
      if (this.mcuState.txPulseMs > 0) {
        this.mcuState.txPulseMs = Math.max(0, this.mcuState.txPulseMs - stepDt);
        this.mcuState.txActive = this.mcuState.txPulseMs > 0;
      }
      if (this.mcuState.rxPulseMs > 0) {
        this.mcuState.rxPulseMs = Math.max(0, this.mcuState.rxPulseMs - stepDt);
        this.mcuState.rxActive = this.mcuState.rxPulseMs > 0;
      }

      var targetTime = this.simTimeMs + stepDt;

      if (this.compileInfo.ok && this._runner.hooks && this._runner.gen) {
        var budget = 1800;
        var loopRestartsThisFrame = 0;

        while (budget-- > 0) {
          if (this.simTimeMs < this._runner.waitUntilMs) {
            if (this._runner.waitUntilMs <= targetTime) {
              this.simTimeMs = this._runner.waitUntilMs;
              // Actualizar entradas antes de reanudar el código
              this.solveCircuit(0);
            } else {
              this.simTimeMs = targetTime;
              break;
            }
          }

          if (this.mcuState.toneEndMs !== null && this.simTimeMs >= this.mcuState.toneEndMs) {
            this.mcuState.tonePin = null;
            this.mcuState.toneFreq = 0;
            this.mcuState.toneEndMs = null;
          }

          this._runner.guardCounter = 0;
          var res;
          try {
            res = this._runner.gen.next();
          } catch (runtimeErr) {
            this.compileInfo = {
              ok: false,
              error: "Error en ejecución: " + (runtimeErr && runtimeErr.message ? runtimeErr.message : runtimeErr),
              flashBytes: this.compileInfo.flashBytes,
              sramBytes: this.compileInfo.sramBytes,
              warnings: this.compileInfo.warnings
            };
            this.pause();
            this._emit("compile", { compileInfo: this.compileInfo });
            break;
          }

          if (res.done) {
            if (this._runner.phase === "setup") {
              this._runner.phase = "loop";
              this._runner.gen = this._runner.hooks.loop();
              this._runner.hadYieldThisLoop = false;
              this.solveCircuit(0);
              continue;
            }
            // loop() terminó; reiniciarlo
            var hadYield = this._runner.hadYieldThisLoop;
            this._runner.gen = this._runner.hooks.loop();
            this._runner.hadYieldThisLoop = false;
            loopRestartsThisFrame++;
            // Si loop() no tuvo ningún yield/delay positivo en todo su ciclo, o superó el tope de seguridad, esperar al siguiente frame
            if (!hadYield || loopRestartsThisFrame >= 250) {
              this.simTimeMs = targetTime;
              break;
            }
            continue;
          }

          var yielded = res.value;
          if (yielded && yielded.type === "delay") {
            if (yielded.ms > 0) {
              this._runner.hadYieldThisLoop = true;
            }
            this._runner.waitUntilMs = this.simTimeMs + yielded.ms;
            this.solveCircuit(0);
            if (this._runner.waitUntilMs > targetTime) {
              this.simTimeMs = targetTime;
              break;
            }
            if (yielded.ms <= 0) {
              this.simTimeMs = targetTime;
              break;
            }
          } else {
            // Yield de tickGuard (bucle largo sin delay)
            this._runner.hadYieldThisLoop = true;
            this.simTimeMs = targetTime;
            break;
          }
        }
        if (this.simTimeMs < targetTime) {
          this.simTimeMs = targetTime;
        }
      } else {
        this.simTimeMs = targetTime;
      }

      if (this.mcuState.toneEndMs !== null && this.simTimeMs >= this.mcuState.toneEndMs) {
        this.mcuState.tonePin = null;
        this.mcuState.toneFreq = 0;
        this.mcuState.toneEndMs = null;
      }

      this.solveCircuit(stepDt);
      this._emit("step", { simTimeMs: this.simTimeMs });
    },

    // ==========================================================================
    // SOLUCIONADOR ELÉCTRICO (Simulator.solveCircuit(dtMs))
    // ==========================================================================

    _findArduino: function () {
      for (var i = 0; i < this.components.length; i++) {
        if (this.components[i].type === "arduino_uno_r3") return this.components[i];
      }
      return null;
    },

    _getBreadboardHolesWorld: function (bb) {
      if (!this._breadboardCache) this._breadboardCache = {};
      var cacheKey = bb.id + "@" + bb.pos.x + "," + bb.pos.y + "," + bb.pos.z + "," + (bb.rotY || 0);
      if (this._breadboardCache[cacheKey]) {
        return this._breadboardCache[cacheKey];
      }
      var pins = getPinsForType("breadboard_830");
      var list = new Array(pins.length);
      for (var i = 0; i < pins.length; i++) {
        var p = pins[i];
        var wp = getPinWorldPos(bb, p);
        list[i] = { id: p.id, x: wp.x, y: wp.y, z: wp.z };
      }
      this._breadboardCache[cacheKey] = list;
      return list;
    },

    solveCircuit: function (dtMs) {
      var dt = Number(dtMs) || 0;
      var uf = createUnionFind();

      // Normalizador de clave de pin (agrupa internamente agujeros de la misma columna/bus de protoboard)
      var breadboardIds = {};
      var breadboards = [];
      for (var i = 0; i < this.components.length; i++) {
        if (this.components[i].type === "breadboard_830") {
          breadboardIds[this.components[i].id] = true;
          breadboards.push(this.components[i]);
        }
      }

      // 1. Unir cables explícitos
      for (var w = 0; w < this.wires.length; w++) {
        var wire = this.wires[w];
        if (!wire || !wire.from || !wire.to) continue;
        uf.union(
          resolveCanonicalPinKey(breadboardIds, wire.from.compId, wire.from.pinId),
          resolveCanonicalPinKey(breadboardIds, wire.to.compId, wire.to.pinId)
        );
      }

      // 2. Unir inserción física de componentes en agujeros de protoboard
      var insertedBreadboardPins = [];
      if (breadboards.length > 0) {
        for (var b = 0; b < breadboards.length; b++) {
          var bb = breadboards[b];
          var holes = this._getBreadboardHolesWorld(bb);

          for (var c = 0; c < this.components.length; c++) {
            var comp = this.components[c];
            if (comp.type === "breadboard_830" || comp.type === "arduino_uno_r3") continue;
            if (Math.abs((comp.pos.y || 0) - ((bb.pos.y || 0) + 9.2)) > 5.0) continue;

            var cPins = getPinsForType(comp.type);
            for (var cp = 0; cp < cPins.length; cp++) {
              var cPin = cPins[cp];
              var wp = getPinWorldPos(comp, cPin);
              var bestHole = null;
              var bestDistSq = 1.45 * 1.45;

              for (var h = 0; h < holes.length; h++) {
                var hole = holes[h];
                var dx = wp.x - hole.x;
                var dz = wp.z - hole.z;
                var dSq = dx * dx + dz * dz;
                if (dSq <= bestDistSq) {
                  bestDistSq = dSq;
                  bestHole = hole;
                }
              }

              if (bestHole) {
                uf.union(
                  resolveCanonicalPinKey(breadboardIds, comp.id, cPin.id),
                  resolveCanonicalPinKey(breadboardIds, bb.id, bestHole.id)
                );
                insertedBreadboardPins.push({ compId: bb.id, pinId: bestHole.id });
              }
            }
          }
        }
      }

      // 3. Unir contactos internos de pulsadores (1A<->1B, 2A<->2B, y 1<->2 si pressed)
      for (var pb = 0; pb < this.components.length; pb++) {
        var pcomp = this.components[pb];
        if (pcomp.type !== "pushbutton") continue;
        uf.union(resolveCanonicalPinKey(breadboardIds, pcomp.id, "1A"), resolveCanonicalPinKey(breadboardIds, pcomp.id, "1B"));
        uf.union(resolveCanonicalPinKey(breadboardIds, pcomp.id, "2A"), resolveCanonicalPinKey(breadboardIds, pcomp.id, "2B"));
        var isPressed = Boolean(
          (pcomp.props && pcomp.props.pressed) || (pcomp.state && pcomp.state.pressed)
        );
        if (pcomp.state) pcomp.state.pressed = isPressed;
        if (isPressed) {
          uf.union(resolveCanonicalPinKey(breadboardIds, pcomp.id, "1A"), resolveCanonicalPinKey(breadboardIds, pcomp.id, "2A"));
        }
      }

      // Mapear nets conocidos y fuentes fijas
      var netFixedV = Object.create(null);
      var netPeakV = Object.create(null);
      var netDuty = Object.create(null);
      var netDrivers = Object.create(null);
      var shortCircuits = Object.create(null);

      var setFixedSource = function (net, avgV, peakV, duty, driverTag) {
        if (driverTag) {
          if (!netDrivers[net]) netDrivers[net] = [];
          netDrivers[net].push(driverTag);
        }
        if (net in netFixedV) {
          if (Math.abs(netFixedV[net] - avgV) > 0.3) {
            shortCircuits[net] = true;
          }
          // GND (0V) o fuente más rígida prevalece en conflicto
          if (avgV === 0) {
            netFixedV[net] = 0;
            netPeakV[net] = 0;
            netDuty[net] = 0;
          }
          return;
        }
        netFixedV[net] = avgV;
        netPeakV[net] = peakV;
        netDuty[net] = duty;
      };

      var pullups = []; // { net, vTarget, rOhms }
      var resistors = []; // { n1, n2, rOhms }
      var pinNet = Object.create(null);

      // Registrar pines de todos los componentes y fuentes del Arduino / TMP36
      for (var ci = 0; ci < this.components.length; ci++) {
        var cm = this.components[ci];
        var cmPins = cm.type === "breadboard_830" ? [] : getPinsForType(cm.type);
        for (var pi = 0; pi < cmPins.length; pi++) {
          var pId = cmPins[pi].id;
          var key = resolveCanonicalPinKey(breadboardIds, cm.id, pId);
          pinNet[cm.id + ":" + pId] = uf.find(key);
        }

        if (cm.type === "arduino_uno_r3") {
          setFixedSource(pinNet[cm.id + ":5V"], 5.0, 5.0, 1.0, cm.id + ":5V");
          setFixedSource(pinNet[cm.id + ":IOREF"], 5.0, 5.0, 1.0, cm.id + ":IOREF");
          setFixedSource(pinNet[cm.id + ":3.3V"], 3.3, 3.3, 1.0, cm.id + ":3.3V");
          setFixedSource(pinNet[cm.id + ":VIN"], 9.0, 9.0, 1.0, cm.id + ":VIN");
          setFixedSource(pinNet[cm.id + ":GND1"], 0.0, 0.0, 0.0, cm.id + ":GND1");
          setFixedSource(pinNet[cm.id + ":GND2"], 0.0, 0.0, 0.0, cm.id + ":GND2");
          setFixedSource(pinNet[cm.id + ":GND3"], 0.0, 0.0, 0.0, cm.id + ":GND3");

          var allMcuPins = Object.keys(this.mcuState.pinModes);
          for (var mp = 0; mp < allMcuPins.length; mp++) {
            var mPin = allMcuPins[mp];
            var mNet = pinNet[cm.id + ":" + mPin];
            if (!mNet) continue;
            var mode = this.mcuState.pinModes[mPin];

            if (mode === "OUTPUT") {
              if (this.mcuState.tonePin === mPin && this.mcuState.toneFreq > 0) {
                setFixedSource(mNet, 2.5, 5.0, 0.5, cm.id + ":" + mPin);
              } else if (this.mcuState.pwm[mPin] !== null && this.mcuState.pwm[mPin] !== undefined) {
                var duty = clamp(this.mcuState.pwm[mPin] / 255, 0, 1);
                setFixedSource(mNet, 5.0 * duty, duty > 0 ? 5.0 : 0.0, duty, cm.id + ":" + mPin);
              } else {
                var isHigh = Boolean(this.mcuState.pins[mPin]);
                setFixedSource(mNet, isHigh ? 5.0 : 0.0, isHigh ? 5.0 : 0.0, isHigh ? 1.0 : 0.0, cm.id + ":" + mPin);
              }
            } else if (mode === "INPUT_PULLUP") {
              pullups.push({ net: mNet, vTarget: 5.0, rOhms: 35000 });
            }
          }
        } else if (cm.type === "resistor") {
          var ohms = Math.max(1, Number((cm.props && cm.props.ohms) || 220));
          resistors.push({
            n1: pinNet[cm.id + ":P1"],
            n2: pinNet[cm.id + ":P2"],
            rOhms: ohms
          });
        } else if (cm.type === "ldr") {
          var lux = Math.max(0.1, Number(cm.props && cm.props.lux != null ? cm.props.lux : 300));
          var rLdr = Math.round(clamp(15000 * Math.pow(10 / lux, 0.75), 200, 1000000));
          cm.state.lux = lux;
          cm.state.resistance = rLdr;
          resistors.push({
            n1: pinNet[cm.id + ":P1"],
            n2: pinNet[cm.id + ":P2"],
            rOhms: rLdr
          });
        } else if (cm.type === "potentiometer") {
          var potVal = clamp(Number(cm.props && cm.props.value != null ? cm.props.value : 0.5), 0, 1);
          var rTotalPot = Math.max(100, Number((cm.props && cm.props.resistance) || 10000));
          var rTop = Math.max(1, rTotalPot * (1 - potVal));
          var rBot = Math.max(1, rTotalPot * potVal);
          var nVcc = pinNet[cm.id + ":VCC"];
          var nWiper = pinNet[cm.id + ":WIPER"];
          var nGnd = pinNet[cm.id + ":GND"];
          resistors.push({ n1: nVcc, n2: nWiper, rOhms: rTop });
          resistors.push({ n1: nWiper, n2: nGnd, rOhms: rBot });
        }
      }

      // Asegurar que todo pin de cable o inserción en breadboard también tiene su net mapeado
      for (var w2 = 0; w2 < this.wires.length; w2++) {
        var wr = this.wires[w2];
        pinNet[wr.from.compId + ":" + wr.from.pinId] = uf.find(resolveCanonicalPinKey(breadboardIds, wr.from.compId, wr.from.pinId));
        pinNet[wr.to.compId + ":" + wr.to.pinId] = uf.find(resolveCanonicalPinKey(breadboardIds, wr.to.compId, wr.to.pinId));
      }
      for (var ib = 0; ib < insertedBreadboardPins.length; ib++) {
        var ibp = insertedBreadboardPins[ib];
        pinNet[ibp.compId + ":" + ibp.pinId] = uf.find(resolveCanonicalPinKey(breadboardIds, ibp.compId, ibp.pinId));
      }

      // Resolver nodos desconocidos lineales (sin LEDs todavía) para poder detectar alimentación de TMP36 y después Thevenin
      var solveLinearSubnetwork = function (extraFixedMap) {
        var fixedMap = Object.create(null);
        var fk = Object.keys(netFixedV);
        for (var i = 0; i < fk.length; i++) fixedMap[fk[i]] = netFixedV[fk[i]];
        if (extraFixedMap) {
          var ek = Object.keys(extraFixedMap);
          for (var j = 0; j < ek.length; j++) {
            if (!(ek[j] in fixedMap)) fixedMap[ek[j]] = extraFixedMap[ek[j]];
          }
        }

        // Reunir nodos flotantes conectados a alguna rama lineal o pullup
        var adj = Object.create(null);
        var addEdge = function (a, b, g) {
          if (!a || !b || a === b) return;
          if (!adj[a]) adj[a] = [];
          if (!adj[b]) adj[b] = [];
          adj[a].push({ to: b, g: g });
          adj[b].push({ to: a, g: g });
        };

        for (var r = 0; r < resistors.length; r++) {
          addEdge(resistors[r].n1, resistors[r].n2, 1.0 / resistors[r].rOhms);
        }

        var puNets = Object.create(null);
        for (var pu = 0; pu < pullups.length; pu++) {
          var pObj = pullups[pu];
          if (!(pObj.net in fixedMap)) {
            if (!puNets[pObj.net]) puNets[pObj.net] = { gSum: 0, iSum: 0 };
            var gPu = 1.0 / pObj.rOhms;
            puNets[pObj.net].gSum += gPu;
            puNets[pObj.net].iSum += gPu * pObj.vTarget;
          }
        }

        // BFS desde nodos fijos y pullups para identificar nodos energizados
        var reachable = Object.create(null);
        var queue = [];
        var fKeys = Object.keys(fixedMap);
        for (var q = 0; q < fKeys.length; q++) {
          reachable[fKeys[q]] = true;
          queue.push(fKeys[q]);
        }
        var pKeys = Object.keys(puNets);
        for (var pq = 0; pq < pKeys.length; pq++) {
          if (!reachable[pKeys[pq]]) {
            reachable[pKeys[pq]] = true;
            queue.push(pKeys[pq]);
          }
        }
        var head = 0;
        while (head < queue.length) {
          var cur = queue[head++];
          var nbrs = adj[cur];
          if (!nbrs) continue;
          for (var nb = 0; nb < nbrs.length; nb++) {
            var nxt = nbrs[nb].to;
            if (!reachable[nxt]) {
              reachable[nxt] = true;
              queue.push(nxt);
            }
          }
        }

        var unknowns = [];
        var unknownIndex = Object.create(null);
        var rKeys = Object.keys(reachable);
        for (var u = 0; u < rKeys.length; u++) {
          var node = rKeys[u];
          if (!(node in fixedMap)) {
            unknownIndex[node] = unknowns.length;
            unknowns.push(node);
          }
        }

        var n = unknowns.length;
        var netVolt = Object.create(null);
        for (var f2 = 0; f2 < fKeys.length; f2++) {
          netVolt[fKeys[f2]] = fixedMap[fKeys[f2]];
        }

        var matA = null;
        if (n > 0 && n <= 80) {
          matA = new Array(n);
          var vecB = new Array(n);
          for (var row = 0; row < n; row++) {
            matA[row] = new Array(n).fill(0);
            vecB[row] = 0;
          }

          for (var ui = 0; ui < n; ui++) {
            var uNode = unknowns[ui];
            var edges = adj[uNode] || [];
            var diagG = 0;
            for (var e = 0; e < edges.length; e++) {
              var ed = edges[e];
              diagG += ed.g;
              if (ed.to in fixedMap) {
                vecB[ui] += ed.g * fixedMap[ed.to];
              } else if (ed.to in unknownIndex) {
                matA[ui][unknownIndex[ed.to]] -= ed.g;
              }
            }
            if (uNode in puNets) {
              diagG += puNets[uNode].gSum;
              vecB[ui] += puNets[uNode].iSum;
            }
            matA[ui][ui] += diagG;
          }

          var sol = solveLinearSystem(matA, vecB);
          for (var si = 0; si < n; si++) {
            netVolt[unknowns[si]] = sol[si];
          }
        } else if (n > 80) {
          // Fallback Gauss-Seidel para redes masivas
          for (var gsInit = 0; gsInit < n; gsInit++) netVolt[unknowns[gsInit]] = 0;
          for (var iter = 0; iter < 60; iter++) {
            for (var gi = 0; gi < n; gi++) {
              var gNode = unknowns[gi];
              var gEdges = adj[gNode] || [];
              var num = 0;
              var den = 0;
              for (var ge = 0; ge < gEdges.length; ge++) {
                num += gEdges[ge].g * (netVolt[gEdges[ge].to] || 0);
                den += gEdges[ge].g;
              }
              if (gNode in puNets) {
                num += puNets[gNode].iSum;
                den += puNets[gNode].gSum;
              }
              if (den > 0) netVolt[gNode] = num / den;
            }
          }
        }

        // Calcular resistencia equivalente de Thevenin vista por cualquier nodo
        var getTheveninR = function (node) {
          if (!node) return Infinity;
          if (node in fixedMap) return 0;
          if (!(node in unknownIndex)) return Infinity;
          if (!matA) return 220;
          var idx = unknownIndex[node];
          var unitB = new Array(n).fill(0);
          unitB[idx] = 1.0;
          var rx = solveLinearSystem(matA, unitB);
          return Math.max(0, rx[idx]);
        };

        return { netVolt: netVolt, getTheveninR: getTheveninR };
      };

      // Primera pasada: resolver red base y comprobar TMP36 alimentados
      var baseNet = solveLinearSubnetwork(null);
      var extraTmpSources = Object.create(null);

      for (var t = 0; t < this.components.length; t++) {
        var tc = this.components[t];
        if (tc.type !== "tmp36") continue;
        var vccV = baseNet.netVolt[pinNet[tc.id + ":VCC"]];
        var gndV = baseNet.netVolt[pinNet[tc.id + ":GND"]];
        var tempC = clamp(Number(tc.props && tc.props.tempC != null ? tc.props.tempC : 25), -40, 125);
        var powered = vccV !== undefined && gndV !== undefined && vccV - gndV >= 2.7;
        var vout = powered ? clamp(0.5 + tempC * 0.01, 0.1, 2.0) : 0;
        tc.state.tempC = tempC;
        tc.state.powered = powered;
        tc.state.vout = vout;
        if (powered) {
          var nOut = pinNet[tc.id + ":VOUT"];
          extraTmpSources[nOut] = (gndV || 0) + vout;
          netFixedV[nOut] = (gndV || 0) + vout;
          netPeakV[nOut] = (gndV || 0) + vout;
          netDuty[nOut] = 1.0;
        }
      }

      // Resolver red lineal final (con tensiones medias y con tensiones pico PWM)
      var solvedAvg = solveLinearSubnetwork(extraTmpSources);
      var solvedPeak = (function () {
        // Si hay pines PWM activos, sustituimos netFixedV temporalmente por netPeakV para calcular corriente pico LED
        var saved = Object.create(null);
        var kList = Object.keys(netFixedV);
        for (var i = 0; i < kList.length; i++) {
          var k = kList[i];
          saved[k] = netFixedV[k];
          if (k in netPeakV) netFixedV[k] = netPeakV[k];
        }
        var res = solveLinearSubnetwork(extraTmpSources);
        for (var j = 0; j < kList.length; j++) {
          netFixedV[kList[j]] = saved[kList[j]];
        }
        return res;
      })();

      // Estimar ciclo de trabajo efectivo en cada net
      var netAvgVolt = solvedAvg.netVolt;
      var netPeakVolt = solvedPeak.netVolt;
      var resolvedDuty = Object.create(null);
      var allNets = Object.keys(netPeakVolt);
      for (var dn = 0; dn < allNets.length; dn++) {
        var netId = allNets[dn];
        if (netId in netDuty) {
          resolvedDuty[netId] = netDuty[netId];
        } else if (netPeakVolt[netId] > 0.05 && netAvgVolt[netId] !== undefined) {
          resolvedDuty[netId] = clamp(netAvgVolt[netId] / netPeakVolt[netId], 0, 1);
        } else {
          resolvedDuty[netId] = 1.0;
        }
      }

      // 4. Resolver LEDs (Vf por color + R_total de Thevenin + sobrecorriente < 20 Ohm)
      for (var li = 0; li < this.components.length; li++) {
        var led = this.components[li];
        if (led.type !== "led") continue;

        var nA = pinNet[led.id + ":ANODE"];
        var nC = pinNet[led.id + ":CATHODE"];
        var vPeakA = netPeakVolt[nA];
        var vPeakC = netPeakVolt[nC];
        var vf = getLedVf(led.props && led.props.color);

        if (vPeakA === undefined || vPeakC === undefined) {
          led.state.lit = false;
          led.state.brightness = 0;
          led.state.currentMa = 0;
          led.state.voltageDrop = 0;
          led.state.overcurrent = false;
          continue;
        }

        var vDrive = vPeakA - vPeakC;
        var rA = solvedPeak.getTheveninR(nA);
        var rC = solvedPeak.getTheveninR(nC);
        var rTotal = rA + rC;
        var dutyLed = clamp(
          nA in netDuty ? netDuty[nA] : (resolvedDuty[nA] !== undefined ? resolvedDuty[nA] : 1.0),
          0,
          1
        );

        if (vDrive > vf && isFinite(rTotal)) {
          if (rTotal < 20) {
            led.state.overcurrent = dutyLed > 0.02;
            led.state.currentMa = Number((65 * dutyLed).toFixed(2));
            led.state.brightness = dutyLed > 0.02 ? 1.0 : 0;
            led.state.lit = dutyLed > 0.02;
            led.state.voltageDrop = Number(vDrive.toFixed(2));
          } else {
            var iPeakMa = ((vDrive - vf) / rTotal) * 1000;
            var iAvgMa = iPeakMa * dutyLed;
            led.state.overcurrent = false;
            led.state.currentMa = Number(iAvgMa.toFixed(2));
            led.state.lit = iAvgMa > 0.5 || (iPeakMa > 0.5 && dutyLed > 0.02);
            led.state.brightness = clamp((iPeakMa / 20) * dutyLed, 0, 1);
            led.state.voltageDrop = Number(vf.toFixed(2));

            // Reflejar caída real Vf en nodo intermedio si uno de los lados no es fuente fija
            var iAmpsAvg = (iAvgMa / 1000);
            if (!(nC in netFixedV) && rC > 0 && isFinite(rC)) {
              netAvgVolt[nC] = (netAvgVolt[nC] || 0) + iAmpsAvg * rC;
            }
            if (!(nA in netFixedV) && rA > 0 && isFinite(rA)) {
              netAvgVolt[nA] = (netAvgVolt[nA] || 0) - iAmpsAvg * rA;
            }
          }
        } else {
          led.state.lit = false;
          led.state.brightness = 0;
          led.state.currentMa = 0;
          led.state.voltageDrop = Number(Math.max(0, vDrive).toFixed(2));
          led.state.overcurrent = false;
        }
      }

      // 5. Actualizar estados de componentes pasivos, actuadores, sensores y Arduino MCU
      var anyBuzzerActive = false;
      var activeBuzzerFreq = 0;
      var unoComp = this._findArduino();

      for (var ui2 = 0; ui2 < this.components.length; ui2++) {
        var comp = this.components[ui2];

        if (comp.type === "resistor") {
          var v1 = netAvgVolt[pinNet[comp.id + ":P1"]];
          var v2 = netAvgVolt[pinNet[comp.id + ":P2"]];
          var rVal = Math.max(1, Number((comp.props && comp.props.ohms) || 220));
          if (v1 !== undefined && v2 !== undefined) {
            var dv = Math.abs(v1 - v2);
            var ima = (dv / rVal) * 1000;
            comp.state.voltageDrop = Number(dv.toFixed(3));
            comp.state.currentMa = Number(ima.toFixed(2));
            comp.state.powerMw = Number((dv * ima).toFixed(2));
          } else {
            comp.state.voltageDrop = 0;
            comp.state.currentMa = 0;
            comp.state.powerMw = 0;
          }
        } else if (comp.type === "pushbutton") {
          var va = netAvgVolt[pinNet[comp.id + ":1A"]];
          var vb = netAvgVolt[pinNet[comp.id + ":2A"]];
          comp.state.voltageA = va !== undefined ? Number(va.toFixed(2)) : null;
          comp.state.voltageB = vb !== undefined ? Number(vb.toFixed(2)) : null;
        } else if (comp.type === "potentiometer") {
          var pv = clamp(Number(comp.props && comp.props.value != null ? comp.props.value : 0.5), 0, 1);
          var wv = netAvgVolt[pinNet[comp.id + ":WIPER"]];
          comp.state.value = pv;
          comp.state.wiperVoltage = wv !== undefined ? Number(wv.toFixed(3)) : null;
          comp.state.angleDeg = Number((-135 + pv * 270).toFixed(1));
        } else if (comp.type === "ldr") {
          var l1 = netAvgVolt[pinNet[comp.id + ":P1"]];
          var l2 = netAvgVolt[pinNet[comp.id + ":P2"]];
          comp.state.voltageP1 = l1 !== undefined ? Number(l1.toFixed(3)) : null;
          comp.state.voltageP2 = l2 !== undefined ? Number(l2.toFixed(3)) : null;
        } else if (comp.type === "servo_sg90") {
          var svVcc = netAvgVolt[pinNet[comp.id + ":VCC"]];
          var svGnd = netAvgVolt[pinNet[comp.id + ":GND"]];
          var svPwmNet = pinNet[comp.id + ":PWM"];
          var svPowered = svVcc !== undefined && svGnd !== undefined && svVcc - svGnd >= 4.0;
          comp.state.powered = svPowered;

          var matchedServo = null;
          if (unoComp && svPwmNet) {
            for (var sIdx = 0; sIdx < this.mcuState.servos.length; sIdx++) {
              var sObj = this.mcuState.servos[sIdx];
              if (sObj.isAttached && sObj.pinId) {
                var ardServoNet = pinNet[unoComp.id + ":" + sObj.pinId];
                if (ardServoNet && ardServoNet === svPwmNet) {
                  matchedServo = sObj;
                  break;
                }
              }
            }
          }

          if (matchedServo) {
            comp.state.attachedPin = matchedServo.pinId;
            comp.state.targetAngle = matchedServo.angle;
          } else {
            comp.state.attachedPin = null;
          }

          if (svPowered && matchedServo) {
            var curA = comp.state.currentAngle != null ? Number(comp.state.currentAngle) : 90;
            var tgtA = Number(comp.state.targetAngle);
            if (dt > 0) {
              var maxDelta = 0.6 * dt; // 0.1s / 60° = 0.6 deg/ms
              var diff = tgtA - curA;
              if (Math.abs(diff) <= maxDelta) curA = tgtA;
              else curA += (diff > 0 ? 1 : -1) * maxDelta;
            }
            comp.state.currentAngle = clamp(curA, 0, 180);
          }
        } else if (comp.type === "ultrasonic_hcsr04") {
          var uVcc = netAvgVolt[pinNet[comp.id + ":VCC"]];
          var uGnd = netAvgVolt[pinNet[comp.id + ":GND"]];
          var uPowered = uVcc !== undefined && uGnd !== undefined && uVcc - uGnd >= 4.0;
          var distCm = clamp(Number(comp.props && comp.props.distanceCm != null ? comp.props.distanceCm : 45), 2, 400);
          comp.state.powered = uPowered;
          comp.state.distanceCm = distCm;
          comp.state.echoUs = uPowered ? Math.round(distCm * 58) : 0;
          comp.state.active = uPowered && (this.simTimeMs - (comp.state.lastTrigMs || -9999) < 350);
        } else if (comp.type === "lcd_1602") {
          var lVdd = netAvgVolt[pinNet[comp.id + ":VDD"]];
          var lVss = netAvgVolt[pinNet[comp.id + ":VSS"]];
          var lPowered = lVdd !== undefined && lVss !== undefined && lVdd - lVss >= 4.0;
          var lAnode = netAvgVolt[pinNet[comp.id + ":A"]];
          var lWiredOk = false;

          if (lPowered && unoComp && this.mcuState.lcd.pins) {
            var lp = this.mcuState.lcd.pins;
            var rwOk =
              pinNet[comp.id + ":RW"] === undefined ||
              netAvgVolt[pinNet[comp.id + ":RW"]] === undefined ||
              netAvgVolt[pinNet[comp.id + ":RW"]] <= 0.8 ||
              (lp.rw && pinNet[comp.id + ":RW"] === pinNet[unoComp.id + ":" + lp.rw]);

            lWiredOk =
              Boolean(rwOk) &&
              lp.rs && pinNet[comp.id + ":RS"] === pinNet[unoComp.id + ":" + lp.rs] &&
              lp.en && pinNet[comp.id + ":E"] === pinNet[unoComp.id + ":" + lp.en] &&
              lp.d4 && pinNet[comp.id + ":D4"] === pinNet[unoComp.id + ":" + lp.d4] &&
              lp.d5 && pinNet[comp.id + ":D5"] === pinNet[unoComp.id + ":" + lp.d5] &&
              lp.d6 && pinNet[comp.id + ":D6"] === pinNet[unoComp.id + ":" + lp.d6] &&
              lp.d7 && pinNet[comp.id + ":D7"] === pinNet[unoComp.id + ":" + lp.d7];
          }

          comp.state.powered = lPowered;
          comp.state.wiredOk = lWiredOk;
          comp.state.backlight = lPowered && !(lAnode !== undefined && lAnode < 1.0);
          if (lPowered && lWiredOk && this.mcuState.lcd.initialized) {
            comp.state.line1 = this.mcuState.lcd.line1;
            comp.state.line2 = this.mcuState.lcd.line2;
          } else {
            comp.state.line1 = "";
            comp.state.line2 = "";
          }
        } else if (comp.type === "buzzer") {
          var bPosNet = pinNet[comp.id + ":POS"];
          var bNegNet = pinNet[comp.id + ":NEG"];
          var bPosV = netAvgVolt[bPosNet];
          var bNegV = netAvgVolt[bNegNet];
          var bFreq = 0;
          var bActive = false;

          if (unoComp && this.mcuState.tonePin && this.mcuState.toneFreq > 0) {
            var toneNet = pinNet[unoComp.id + ":" + this.mcuState.tonePin];
            if (
              (bPosNet === toneNet && bNegV !== undefined && bNegV <= 0.8) ||
              (bNegNet === toneNet && bPosV !== undefined && bPosV <= 0.8)
            ) {
              bActive = true;
              bFreq = this.mcuState.toneFreq;
            }
          } else if (bPosV !== undefined && bNegV !== undefined && Math.abs(bPosV - bNegV) >= 2.0) {
            // Señal PWM o excitación continua (ej. analogWrite)
            var dCycle = resolvedDuty[bPosNet];
            if (dCycle !== undefined && dCycle > 0.05 && dCycle < 0.95) {
              bActive = true;
              bFreq = 490;
            }
          }

          comp.state.active = bActive;
          comp.state.frequency = bFreq;
          comp.state.voltageDrop =
            bPosV !== undefined && bNegV !== undefined ? Number(Math.abs(bPosV - bNegV).toFixed(2)) : 0;

          if (bActive) {
            anyBuzzerActive = true;
            activeBuzzerFreq = bFreq;
          }
        }
      }

      // 6. Retroalimentar entradas digitales y analógicas hacia Arduino Uno R3
      if (unoComp) {
        for (var d2 = 0; d2 <= 13; d2++) {
          var did = "D" + d2;
          var dvNet = netAvgVolt[pinNet[unoComp.id + ":" + did]];
          if (dvNet !== undefined) {
            this.mcuState.digitalInputs[did] = dvNet >= 2.5 ? 1 : 0;
          } else {
            this.mcuState.digitalInputs[did] = this.mcuState.pinModes[did] === "INPUT_PULLUP" ? 1 : 0;
          }
        }
        for (var a2 = 0; a2 <= 5; a2++) {
          var aid = "A" + a2;
          var avNet = netAvgVolt[pinNet[unoComp.id + ":" + aid]];
          if (avNet !== undefined) {
            this.mcuState.analogInputs[aid] = clamp(avNet, 0, 5.0);
            this.mcuState.digitalInputs[aid] = avNet >= 2.5 ? 1 : 0;
          } else {
            var isPullup = this.mcuState.pinModes[aid] === "INPUT_PULLUP";
            this.mcuState.analogInputs[aid] = isPullup ? 5.0 : 0;
            this.mcuState.digitalInputs[aid] = isPullup ? 1 : 0;
          }
        }

        // LED integrado 'L' sigue el estado de D13
        var d13Volt = netAvgVolt[pinNet[unoComp.id + ":D13"]];
        if (this.mcuState.pinModes.D13 === "OUTPUT") {
          this.mcuState.ledL = Boolean(this.mcuState.pins.D13) || (this.mcuState.pwm.D13 || 0) > 0;
        } else {
          this.mcuState.ledL = d13Volt !== undefined && d13Volt >= 2.5;
        }

        unoComp.state.ledL = this.mcuState.ledL;
        unoComp.state.txActive = this.mcuState.txActive;
        unoComp.state.rxActive = this.mcuState.rxActive;
        unoComp.state.vcc = 5.0;
      }

      // Guardar resultados para consulta por pin (tooltip y telemetría)
      this._netSolve = {
        pinNet: pinNet,
        netVoltage: netAvgVolt,
        netPeakVoltage: netPeakVolt,
        netDuty: resolvedDuty,
        netFixed: netFixedV,
        shortCircuits: shortCircuits
      };

      // Audio WebAudio suave solo si está habilitado y ejecutándose
      AudioEngine.update(this.soundEnabled && this.running && anyBuzzerActive, activeBuzzerFreq);
    },

    // ==========================================================================
    // TELEMETRÍA Y CONSULTAS PÚBLICAS
    // ==========================================================================

    getPinVoltage: function (compId, pinId) {
      var comp = this._findComponent(compId);
      if (!comp) {
        return { voltage: null, mode: "N/A", label: "Desconocido", connected: false, netId: null };
      }

      var netId = this._netSolve.pinNet[compId + ":" + pinId];
      if (!netId && comp.type === "breadboard_830") {
        var grp = getBreadboardGroup(pinId);
        if (grp) {
          // Buscar si algún cable o pin está unido a ese grupo de protoboard
          var bbKey = compId + ":@bb:" + grp;
          var allKeys = Object.keys(this._netSolve.pinNet);
          for (var i = 0; i < allKeys.length; i++) {
            var k = allKeys[i];
            if (k.indexOf(compId + ":") === 0) {
              var pName = k.slice(compId.length + 1);
              if (getBreadboardGroup(pName) === grp) {
                netId = this._netSolve.pinNet[k];
                break;
              }
            }
          }
          // Fallback: verificar si el propio grupo existe en netVoltage
          if (!netId && bbKey in this._netSolve.netVoltage) {
            netId = bbKey;
          }
        }
      }

      var voltage = netId && netId in this._netSolve.netVoltage ? this._netSolve.netVoltage[netId] : null;
      var mode = "PASSIVE";
      if (comp.type === "arduino_uno_r3") {
        if (pinId === "5V" || pinId === "3.3V" || pinId === "IOREF" || pinId === "VIN") mode = "POWER";
        else if (/^GND/.test(pinId)) mode = "GND";
        else if (this.mcuState.pinModes[pinId]) mode = this.mcuState.pinModes[pinId];
      }

      return {
        voltage: voltage !== null && voltage !== undefined ? Number(voltage.toFixed(2)) : null,
        mode: mode,
        label: comp.label + " · " + pinId,
        connected: Boolean(netId && voltage !== null && voltage !== undefined),
        netId: netId || null
      };
    },

    getComponentTelemetry: function (compId) {
      var comp = this._findComponent(compId);
      if (!comp) return { summary: "Componente no encontrado", fields: [], warnings: [] };

      var st = comp.state || {};
      var props = comp.props || {};
      var fields = [];
      var warnings = [];
      var out = { summary: comp.label, fields: fields, warnings: warnings };

      if (comp.type === "arduino_uno_r3") {
        fields.push({ label: "Reloj MCU", value: "16 MHz" });
        fields.push({ label: "Tensión Vop", value: "5.00 V" });
        fields.push({ label: "LED integrado L", value: this.mcuState.ledL ? "ON (HIGH)" : "OFF (LOW)" });
        fields.push({ label: "Ejecución", value: this.running ? "En marcha" : "Pausado" });
        if (this.compileInfo.ok) {
          fields.push({ label: "Flash usada", value: this.compileInfo.flashBytes + " / 32256 B" });
        } else {
          warnings.push("Error de compilación: " + this.compileInfo.error);
        }
        var scKeys = Object.keys(this._netSolve.shortCircuits || {});
        if (scKeys.length > 0) {
          warnings.push("Cortocircuito detectado entre fuentes o pines de salida.");
        }
        return out;
      }

      if (comp.type === "breadboard_830") {
        var vTopP = this.getPinVoltage(comp.id, "tp_1").voltage;
        var vBotP = this.getPinVoltage(comp.id, "bp_1").voltage;
        fields.push({ label: "Bus Superior (+)", value: vTopP !== null ? vTopP.toFixed(2) + " V" : "Sin señal" });
        fields.push({ label: "Bus Inferior (+)", value: vBotP !== null ? vBotP.toFixed(2) + " V" : "Sin señal" });
        fields.push({ label: "Cables en circuito", value: String(this.wires.length) });
        return out;
      }

      if (comp.type === "led") {
        var colorName = String(props.color || "red");
        var vf = getLedVf(colorName);
        var pct = Math.round((st.brightness || 0) * 100);
        fields.push({ label: "Estado", value: st.lit ? "Encendido" : "Apagado" });
        fields.push({ label: "Vf nominal (" + colorName + ")", value: vf.toFixed(1) + " V" });
        fields.push({ label: "Corriente", value: Number(st.currentMa || 0).toFixed(1) + " mA" });
        fields.push({ label: "Brillo", value: pct + "%" });
        out.voltage = st.voltageDrop || 0;
        out.currentMa = st.currentMa || 0;
        out.brightness = st.brightness || 0;
        out.lit = Boolean(st.lit);
        out.overcurrent = Boolean(st.overcurrent);
        if (st.overcurrent) {
          warnings.push("¡SOBRECORRIENTE (>40 mA)! Falta resistencia limitadora en serie.");
        }
        return out;
      }

      if (comp.type === "resistor") {
        var ohms = Number(props.ohms || 220);
        var labelOhms = ohms >= 1000 ? (ohms / 1000).toFixed(ohms % 1000 === 0 ? 0 : 1) + " kΩ" : ohms + " Ω";
        fields.push({ label: "Resistencia", value: labelOhms });
        fields.push({ label: "Caída ΔV", value: Number(st.voltageDrop || 0).toFixed(2) + " V" });
        fields.push({ label: "Corriente", value: Number(st.currentMa || 0).toFixed(1) + " mA" });
        fields.push({ label: "Potencia", value: Number(st.powerMw || 0).toFixed(1) + " mW" });
        if ((st.powerMw || 0) > 250) {
          warnings.push("Disipación supera 1/4 W (250 mW).");
        }
        return out;
      }

      if (comp.type === "pushbutton") {
        fields.push({ label: "Contacto", value: st.pressed ? "PULSADO (Cerrado)" : "SUELTO (Abierto)" });
        fields.push({ label: "Tensión Polo 1", value: st.voltageA !== null && st.voltageA !== undefined ? st.voltageA.toFixed(2) + " V" : "Flotante" });
        fields.push({ label: "Tensión Polo 2", value: st.voltageB !== null && st.voltageB !== undefined ? st.voltageB.toFixed(2) + " V" : "Flotante" });
        out.pressed = Boolean(st.pressed);
        return out;
      }

      if (comp.type === "potentiometer") {
        var pv = st.value != null ? st.value : (props.value != null ? props.value : 0.5);
        var wv = st.wiperVoltage;
        fields.push({ label: "Giro cursor", value: Math.round(pv * 100) + "%" });
        fields.push({ label: "Tensión WIPER", value: wv !== null && wv !== undefined ? wv.toFixed(2) + " V" : "Sin señal" });
        fields.push({ label: "ADC estimado", value: wv !== null && wv !== undefined ? String(Math.round((wv / 5) * 1023)) : "--" });
        return out;
      }

      if (comp.type === "servo_sg90") {
        var curAng = Math.round(st.currentAngle != null ? st.currentAngle : 90);
        fields.push({ label: "Alimentación", value: st.powered ? "OK (5 V)" : "Sin alimentación" });
        fields.push({ label: "Ángulo actual", value: curAng + "°" });
        fields.push({ label: "Pin PWM", value: st.attachedPin || "No enlazado" });
        out.angle = curAng;
        if (!st.powered) warnings.push("Conecta VCC (5V) y GND para mover el servo.");
        return out;
      }

      if (comp.type === "ultrasonic_hcsr04") {
        fields.push({ label: "Alimentación", value: st.powered ? "OK (5 V)" : "Sin alimentación" });
        fields.push({ label: "Distancia", value: Math.round(st.distanceCm || props.distanceCm || 45) + " cm" });
        fields.push({ label: "Pulso ECHO", value: (st.echoUs || 0) + " µs" });
        out.distanceCm = st.distanceCm;
        return out;
      }

      if (comp.type === "lcd_1602") {
        fields.push({ label: "Alimentación", value: st.powered ? "OK (5 V)" : "Sin alimentación" });
        fields.push({ label: "Bus 4 bits", value: st.wiredOk ? "Sincronizado" : "Revisar pines" });
        fields.push({ label: "Backlight", value: st.backlight ? "Encendido" : "Apagado" });
        out.line1 = st.line1 || "";
        out.line2 = st.line2 || "";
        if (st.powered && !st.wiredOk) {
          warnings.push("Verifica las conexiones RS, E, D4..D7 con el constructor LiquidCrystal.");
        }
        return out;
      }

      if (comp.type === "ldr") {
        fields.push({ label: "Iluminancia", value: Math.round(st.lux || props.lux || 300) + " lux" });
        fields.push({ label: "Resistencia CdS", value: Math.round(st.resistance || 15000) + " Ω" });
        fields.push({ label: "Tensión P1", value: st.voltageP1 !== null && st.voltageP1 !== undefined ? st.voltageP1.toFixed(2) + " V" : "Flotante" });
        out.lux = st.lux;
        return out;
      }

      if (comp.type === "tmp36") {
        fields.push({ label: "Alimentación", value: st.powered ? "OK" : "Sin alimentación" });
        fields.push({ label: "Temperatura", value: Math.round(st.tempC != null ? st.tempC : 25) + " °C" });
        fields.push({ label: "Salida VOUT", value: st.powered ? Number(st.vout || 0).toFixed(2) + " V" : "0.00 V" });
        out.tempC = st.tempC;
        return out;
      }

      if (comp.type === "buzzer") {
        fields.push({ label: "Estado", value: st.active ? "Sonando" : "Silencio" });
        fields.push({ label: "Frecuencia", value: st.active ? Math.round(st.frequency) + " Hz" : "0 Hz" });
        fields.push({ label: "Tensión", value: Number(st.voltageDrop || 0).toFixed(2) + " V" });
        return out;
      }

      return out;
    },

    setSoundEnabled: function (enabled) {
      this.soundEnabled = Boolean(enabled);
      if (!this.soundEnabled) {
        AudioEngine.stop();
      }
      this.solveCircuit(0);
      this._emit("state", { soundEnabled: this.soundEnabled });
    }
  };

  global.HardwareSim.Simulator = Simulator;
})(window);
