"""
simulador_elevador.py
=====================
Simulación en Python del control de puerta de elevador.
Equivalente lógico del simulador HTML/JS.

Uso:
    python simulador_elevador.py
"""

import time
import threading
from datetime import datetime
from dataclasses import dataclass, field
from typing import Optional, Callable


# ==================== ESTADO DEL SISTEMA ====================

@dataclass
class EstadoElevador:
    puerta_abierta: bool = False
    puerta_moviendose: bool = False
    estado_puerta: str = "CERRADA"  # CERRADA, ABRIENDO, ABIERTA, CERRANDO
    piso_actual: int = 1
    piso_objetivo: int = 1
    ciclos: int = 0
    emergencia: bool = False
    seguridad_ok: bool = True
    foto_ok: bool = True
    duracion_apertura: float = 3.0   # segundos
    duracion_cierre: float = 3.0     # segundos
    duracion_espera: float = 5.0     # segundos
    velocidad_motor: int = 80        # % velocidad
    conteo_log: int = 0
    registro: list = field(default_factory=list)

    # Entradas (I/O PLC)
    io: dict = field(default_factory=lambda: {
        "I0.0": False,  # PB Abrir
        "I0.1": False,  # PB Cerrar
        "I0.2": False,  # Límite Abierto
        "I0.3": True,   # Límite Cerrado
        "I0.4": True,   # Borde de seguridad
        "I0.5": True,   # Fotocelda
        "Q0.0": False,  # Motor Abrir
        "Q0.1": False,  # Motor Cerrar
        "Q0.2": False,  # Alarma de seguridad
    })


# ==================== REGISTRO DE EVENTOS ====================

def agregar_log(estado: EstadoElevador, mensaje: str, tipo: str = "") -> None:
    ahora = datetime.now().strftime("%H:%M:%S")
    prefijo = {"ok": "✓", "warn": "⚠", "err": "✗"}.get(tipo, "·")
    entrada = f"[{ahora}] {prefijo} {mensaje}"
    estado.registro.insert(0, entrada)
    estado.conteo_log += 1
    # Mantener máximo 50 entradas
    if len(estado.registro) > 50:
        estado.registro.pop()
    print(entrada)


# ==================== CIRCUITO / I/O ====================

def actualizar_io(estado: EstadoElevador) -> None:
    """Actualiza la tabla I/O según el estado actual de la puerta."""
    io = estado.io
    ds = estado.estado_puerta

    io["I0.0"] = ds == "ABRIENDO"
    io["I0.1"] = ds == "CERRANDO"
    io["I0.2"] = ds == "ABIERTA"
    io["I0.3"] = ds == "CERRADA"
    io["I0.4"] = estado.seguridad_ok
    io["I0.5"] = estado.foto_ok
    io["Q0.0"] = ds == "ABRIENDO"
    io["Q0.1"] = ds == "CERRANDO"
    io["Q0.2"] = estado.emergencia

    if estado.emergencia:
        io["Q0.2"] = True

def mostrar_io(estado: EstadoElevador) -> None:
    """Imprime tabla de entradas/salidas."""
    nombres = {
        "I0.0": "PB Abrir",
        "I0.1": "PB Cerrar",
        "I0.2": "Lím. Abierto",
        "I0.3": "Lím. Cerrado",
        "I0.4": "Borde Seg.",
        "I0.5": "Fotocelda",
        "Q0.0": "Motor Abrir",
        "Q0.1": "Motor Cerrar",
        "Q0.2": "Alarm. Seg.",
    }
    print("\n┌─────────────────────────────────────┐")
    print("│         TABLA I/O — PLC-7200        │")
    print("├──────┬─────────────────┬────────────┤")
    print("│ ADDR │   DESCRIPCIÓN   │   ESTADO   │")
    print("├──────┼─────────────────┼────────────┤")
    for addr, nombre in nombres.items():
        val = estado.io[addr]
        estado_txt = "ON  ●" if val else "OFF  ○"
        print(f"│ {addr} │ {nombre:<15} │ {estado_txt:<10} │")
    print("└──────┴─────────────────┴────────────┘\n")


# ==================== CONTROL DE PUERTA ====================

def abrir_puerta(estado: EstadoElevador,
                 callback_fin: Optional[Callable] = None) -> bool:
    """Inicia la secuencia de apertura de puerta."""
    if estado.puerta_moviendose or estado.puerta_abierta or estado.emergencia:
        print("[INFO] No se puede abrir: puerta en movimiento, ya abierta o emergencia activa.")
        return False

    estado.puerta_moviendose = True
    estado.ciclos += 1
    estado.estado_puerta = "ABRIENDO"
    actualizar_io(estado)
    agregar_log(estado, "Iniciando apertura de puerta", "ok")
    print(f"[PUERTA] Estado: ABRIENDO — Ciclo #{estado.ciclos:03d}")

    def _secuencia_apertura():
        time.sleep(estado.duracion_apertura)
        if not estado.emergencia:
            estado.puerta_abierta = True
            estado.puerta_moviendose = False
            estado.estado_puerta = "ABIERTA"
            actualizar_io(estado)
            agregar_log(estado, "Puerta completamente abierta — LS-Abierto activado", "ok")
            print("[PUERTA] Estado: ABIERTA")
            if callback_fin:
                callback_fin()
            # Auto-cierre
            _timer_cierre = threading.Timer(estado.duracion_espera, cerrar_puerta, args=[estado])
            _timer_cierre.start()

    hilo = threading.Thread(target=_secuencia_apertura, daemon=True)
    hilo.start()
    return True


def cerrar_puerta(estado: EstadoElevador,
                  callback_fin: Optional[Callable] = None) -> bool:
    """Inicia la secuencia de cierre de puerta."""
    if estado.puerta_moviendose or not estado.puerta_abierta or estado.emergencia:
        print("[INFO] No se puede cerrar: puerta en movimiento, ya cerrada o emergencia activa.")
        return False

    estado.puerta_moviendose = True
    estado.estado_puerta = "CERRANDO"
    actualizar_io(estado)
    agregar_log(estado, "Iniciando cierre de puerta", "warn")
    print("[PUERTA] Estado: CERRANDO")

    def _secuencia_cierre():
        time.sleep(estado.duracion_cierre)
        if not estado.emergencia:
            estado.puerta_abierta = False
            estado.puerta_moviendose = False
            estado.estado_puerta = "CERRADA"
            actualizar_io(estado)
            agregar_log(estado, "Puerta completamente cerrada — LS-Cerrado activado", "ok")
            print("[PUERTA] Estado: CERRADA")
            if callback_fin:
                callback_fin()

    hilo = threading.Thread(target=_secuencia_cierre, daemon=True)
    hilo.start()
    return True


def paro_emergencia(estado: EstadoElevador) -> None:
    """Alterna el estado de emergencia."""
    estado.emergencia = not estado.emergencia

    if estado.emergencia:
        estado.puerta_moviendose = False
        estado.estado_puerta = "EMERGENCIA"
        actualizar_io(estado)
        agregar_log(estado, "⚠ PARO DE EMERGENCIA ACTIVADO", "err")
        print("[EMERGENCIA] Sistema detenido")
    else:
        estado.puerta_abierta = False
        estado.estado_puerta = "CERRADA"
        actualizar_io(estado)
        agregar_log(estado, "Sistema restablecido — paro de emergencia desactivado", "ok")
        print("[SISTEMA] Restablecido — Puerta: CERRADA")


# ==================== CONTROL DE PISOS ====================

def ir_a_piso(estado: EstadoElevador, piso: int) -> bool:
    """Mueve el elevador al piso indicado (1–4)."""
    if not 1 <= piso <= 4:
        print(f"[ERROR] Piso {piso} inválido. Rango: 1–4.")
        return False

    if estado.puerta_abierta:
        cerrar_puerta(estado)
        time.sleep(estado.duracion_cierre + 0.2)

    estado.piso_actual = piso
    agregar_log(estado, f"Moviendo a piso {piso}")
    print(f"[ELEVADOR] En camino al piso {piso}...")

    def _llegada():
        time.sleep(1.2)
        agregar_log(estado, f"Llegó a piso {piso}", "ok")
        print(f"[ELEVADOR] Llegó a piso {piso:02d}")
        abrir_puerta(estado)

    hilo = threading.Thread(target=_llegada, daemon=True)
    hilo.start()
    return True


# ==================== PARÁMETROS ====================

def aplicar_parametros(estado: EstadoElevador,
                        apertura: float = 3.0,
                        cierre: float = 3.0,
                        espera: float = 5.0,
                        velocidad: int = 80) -> None:
    """Actualiza los parámetros de operación del elevador."""
    estado.duracion_apertura = apertura
    estado.duracion_cierre = cierre
    estado.duracion_espera = espera
    estado.velocidad_motor = velocidad
    agregar_log(
        estado,
        f"Parámetros: Apertura={apertura}s, Cierre={cierre}s, Espera={espera}s, Vel={velocidad}%",
        "ok"
    )
    print(f"[CONFIG] Parámetros actualizados.")


# ==================== DEMO ====================

def demo():
    """Ejecuta una demostración básica del simulador."""
    print("=" * 50)
    print("  SIMULADOR PUERTA DE ELEVADOR — Python")
    print("=" * 50)

    estado = EstadoElevador()
    agregar_log(estado, "Sistema iniciado — PLC listo", "ok")
    agregar_log(estado, "Puerta en posición cerrada", "ok")
    agregar_log(estado, "Todos los sensores OK", "ok")

    mostrar_io(estado)
    print("[DEMO] Abriendo puerta en piso 1...")
    abrir_puerta(estado)

    time.sleep(estado.duracion_apertura + 0.5)
    mostrar_io(estado)

    print("[DEMO] Esperando cierre automático...")
    time.sleep(estado.duracion_espera + estado.duracion_cierre + 0.5)
    mostrar_io(estado)

    print("[DEMO] Yendo al piso 3...")
    ir_a_piso(estado, 3)
    time.sleep(2 + estado.duracion_apertura + 0.5)
    mostrar_io(estado)

    print("[DEMO] Simulando paro de emergencia...")
    paro_emergencia(estado)
    mostrar_io(estado)

    time.sleep(1)
    print("[DEMO] Restableciendo sistema...")
    paro_emergencia(estado)
    mostrar_io(estado)

    print("\n[DEMO] Registro de eventos:")
    for entrada in estado.registro[:10]:
        print(" ", entrada)

    print("\n[DEMO] Ciclos totales:", estado.ciclos)
    print("[DEMO] Fin de la demostración.")


if __name__ == "__main__":
    demo()
