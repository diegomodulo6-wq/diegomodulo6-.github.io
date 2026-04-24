const CONFIG = {
    facil: { filas: 9, cols: 9, minas: 10 },
    medio: { filas: 16, cols: 16, minas: 40 },
    dificil: { filas: 16, cols: 30, minas: 99 },
    experto: { filas: 20, cols: 20, minas: 80 }
};

let tablero = [];
let filas, cols, totalMinas;
let minasRestantes, celdasAbiertas, primerClick;
let juegoActivo, tiempo, timer;
let dificultadActual = 'medio';
let audioDesbloqueado = false;
let intentosTotales = 0;

const tableroDiv = document.getElementById('tablero');
const minasSpan = document.getElementById('minas');
const tiempoSpan = document.getElementById('tiempo');
const intentosSpan = document.getElementById('intentos');
const mensaje = document.getElementById('mensaje');
const btnCara = document.getElementById('btnCara');
const selectDificultad = document.getElementById('dificultad');
const musicaFondo = document.getElementById('musicaFondo');
const avisoAudio = document.getElementById('avisoAudio');
const modalBoom = document.getElementById('modalBoom');

let audioCtx;

// SONIDOS DE EXPLOSIÓN TRIPLES
const explosion1 = new Audio('https://cdn.pixabay.com/download/audio/2022/03/15/audio_8b4f0e4b7a.mp3');
const explosion2 = new Audio('https://cdn.pixabay.com/download/audio/2022/03/24/audio_d1718ab41c.mp3');
const explosion3 = new Audio('https://cdn.pixabay.com/download/audio/2021/08/04/audio_0625c1539c.mp3');
explosion1.volume = 1.0;
explosion2.volume = 1.0;
explosion3.volume = 1.0;

function desbloquearAudio() {
    if (!audioDesbloqueado) {
        audioCtx = new (window.AudioContext || window.webkitAudioContext)();
        audioCtx.resume();
        audioDesbloqueado = true;
        avisoAudio.style.display = 'none';
        explosion1.load();
        explosion2.load();
        explosion3.load();
    }
}

function reproducirExplosion() {
    if (!audioDesbloqueado) return;

    explosion1.currentTime = 0;
    explosion2.currentTime = 0;
    explosion3.currentTime = 0;

    explosion1.play().catch(() => {});
    setTimeout(() => explosion2.play().catch(() => {}), 30);
    setTimeout(() => explosion3.play().catch(() => {}), 60);

    const osc1 = audioCtx.createOscillator();
    const osc2 = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    osc1.connect(gain);
    osc2.connect(gain);
    gain.connect(audioCtx.destination);

    osc1.frequency.value = 40;
    osc2.frequency.value = 80;
    gain.gain.setValueAtTime(1.0, audioCtx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 1.2);

    osc1.start();
    osc2.start();
    osc1.stop(audioCtx.currentTime + 1.2);
    osc2.stop(audioCtx.currentTime + 1.2);

    document.body.classList.add('shake');
    setTimeout(() => document.body.classList.remove('shake'), 800);
}

function sonido(tipo) {
    if (!audioDesbloqueado) return;

    if (tipo === 'mina') {
        reproducirExplosion();
        return;
    }

    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    osc.connect(gain);
    gain.connect(audioCtx.destination);

    if (tipo === 'click') {
        osc.frequency.value = 600;
        gain.gain.setValueAtTime(0.1, audioCtx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.08);
    } else if (tipo === 'bandera') {
        osc.frequency.value = 800;
        gain.gain.setValueAtTime(0.15, audioCtx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.1);
    } else if (tipo === 'ganar') {
        [523, 659, 784, 1047].forEach((freq, i) => {
            setTimeout(() => {
                const o = audioCtx.createOscillator();
                const g = audioCtx.createGain();
                o.connect(g); g.connect(audioCtx.destination);
                o.frequency.value = freq;
                g.gain.setValueAtTime(0.2, audioCtx.currentTime);
                g.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.3);
                o.start(); o.stop(audioCtx.currentTime + 0.3);
            }, i * 150);
        });
        return;
    }
    osc.start();
    osc.stop(audioCtx.currentTime + 0.3);
}

btnCara.onclick = () => {
    desbloquearAudio();
    iniciarJuego();
};

selectDificultad.onchange = () => {
    dificultadActual = selectDificultad.value;
    iniciarJuego();
};

document.addEventListener('contextmenu', e => e.preventDefault());
document.addEventListener('click', desbloquearAudio, { once: true });

musicaFondo.volume = 0.2;

function cerrarModalYReiniciar() {
    modalBoom.classList.remove('mostrar');
    iniciarJuego();
}

function iniciarJuego() {
    const cfg = CONFIG[dificultadActual];
    filas = cfg.filas;
    cols = cfg.cols;
    totalMinas = cfg.minas;

    tablero = [];
    minasRestantes = totalMinas;
    celdasAbiertas = 0;
    primerClick = true;
    juegoActivo = true;
    tiempo = 0;

    clearInterval(timer);
    btnCara.textContent = '😊';
    mensaje.textContent = 'Click para empezar';
    actualizarContadores();

    tableroDiv.className = dificultadActual;
    tableroDiv.innerHTML = '';
    tableroDiv.style.gridTemplateColumns = `repeat(${cols}, 1fr)`;

    for (let i = 0; i < filas; i++) {
        tablero[i] = [];
        for (let j = 0; j < cols; j++) {
            const celda = document.createElement('div');
            celda.className = 'celda';
            celda.dataset.fila = i;
            celda.dataset.col = j;
            celda.onclick = () => clickCelda(i, j);
            celda.oncontextmenu = (e) => {
                e.preventDefault();
                clickDerecho(i, j);
            };
            celda.onmousedown = () => { if (juegoActivo) btnCara.textContent = '😮'; };
            celda.onmouseup = () => { if (juegoActivo) btnCara.textContent = '😊'; };
            tableroDiv.appendChild(celda);

            tablero[i][j] = {
                mina: false,
                abierta: false,
                bandera: false,
                duda: false,
                minasCerca: 0,
                elem: celda
            };
        }
    }
}

function colocarMinas(f, c) {
    let minasPuestas = 0;
    while (minasPuestas < totalMinas) {
        const rf = Math.floor(Math.random() * filas);
        const rc = Math.floor(Math.random() * cols);
        if (!tablero[rf][rc].mina && (Math.abs(rf - f) > 1 || Math.abs(rc - c) > 1)) {
            tablero[rf][rc].mina = true;
            minasPuestas++;
        }
    }

    for (let i = 0; i < filas; i++) {
        for (let j = 0; j < cols; j++) {
            if (!tablero[i][j].mina) {
                tablero[i][j].minasCerca = contarVecinos(i, j);
            }
        }
    }
}

function contarVecinos(f, c) {
    let total = 0;
    for (let i = -1; i <= 1; i++) {
        for (let j = -1; j <= 1; j++) {
            const nf = f + i, nc = c + j;
            if (nf >= 0 && nf < filas && nc >= 0 && nc < cols) {
                if (tablero[nf][nc].mina) total++;
            }
        }
    }
    return total;
}

function clickCelda(f, c) {
    if (!juegoActivo || tablero[f][c].abierta || tablero[f][c].bandera) return;

    if (primerClick) {
        desbloquearAudio();
        colocarMinas(f, c);
        primerClick = false;
        iniciarTimer();
        mensaje.textContent = '¡Suerte!';
        if (musicaFondo.paused) musicaFondo.play().catch(() => {});
    }

    abrirCelda(f, c);
}

function abrirCelda(f, c) {
    const celda = tablero[f][c];
    if (celda.abierta || celda.bandera) return;

    celda.abierta = true;
    celda.elem.classList.add('abierta');
    celdasAbiertas++;

    if (celda.mina) {
        perderJuego(f, c);
        return;
    }

    sonido('click');

    if (celda.minasCerca > 0) {
        celda.elem.textContent = celda.minasCerca;
        celda.elem.classList.add(`n${celda.minasCerca}`);
    } else {
        for (let i = -1; i <= 1; i++) {
            for (let j = -1; j <= 1; j++) {
                const nf = f + i, nc = c + j;
                if (nf >= 0 && nf < filas && nc >= 0 && nc < cols) {
                    abrirCelda(nf, nc);
                }
            }
        }
    }

    verificarVictoria();
}

function clickDerecho(f, c) {
    if (!juegoActivo || tablero[f][c].abierta) return;
    if (primerClick) return;

    const celda = tablero[f][c];
    sonido('bandera');

    if (!celda.bandera &&!celda.duda) {
        celda.bandera = true;
        celda.elem.classList.add('bandera');
        minasRestantes--;
    } else if (celda.bandera) {
        celda.bandera = false;
        celda.duda = true;
        celda.elem.classList.remove('bandera');
        celda.elem.classList.add('duda');
        minasRestantes++;
    } else {
        celda.duda = false;
        celda.elem.classList.remove('duda');
    }

    actualizarContadores();
}

function perderJuego(f, c) {
    juegoActivo = false;
    clearInterval(timer);
    sonido('mina');
    btnCara.textContent = '😵';
    intentosTotales++;
    actualizarContadores();

    for (let i = 0; i < filas; i++) {
        for (let j = 0; j < cols; j++) {
            if (tablero[i][j].mina) {
                tablero[i][j].elem.classList.add('abierta');
                if (i === f && j === c) {
                    tablero[i][j].elem.classList.add('mina');
                    tablero[i][j].elem.textContent = '💥';
                } else {
                    tablero[i][j].elem.textContent = '💣';
                }
            } else if (tablero[i][j].bandera) {
                tablero[i][j].elem.textContent = '❌';
            }
        }
    }

    setTimeout(() => {
        modalBoom.classList.add('mostrar');
    }, 800);
}

function verificarVictoria() {
    if (celdasAbiertas === filas * cols - totalMinas) {
        juegoActivo = false;
        clearInterval(timer);
        sonido('ganar');
        btnCara.textContent = '😎';
        mensaje.textContent = `¡Ganaste en ${tiempo}s!`;
        intentosTotales++;
        actualizarContadores();

        for (let i = 0; i < filas; i++) {
            for (let j = 0; j < cols; j++) {
                if (tablero[i][j].mina &&!tablero[i][j].bandera) {
                    tablero[i][j].elem.classList.add('mina-ganadora');
                    tablero[i][j].elem.textContent = '🚩';
                }
            }
        }
    }
}

function iniciarTimer() {
    timer = setInterval(() => {
        tiempo++;
        tiempoSpan.textContent = tiempo.toString().padStart(3, '0');
        if (tiempo >= 999) clearInterval(timer);
    }, 1000);
}

function actualizarContadores() {
    minasSpan.textContent = minasRestantes;
    intentosSpan.textContent = intentosTotales;
}

iniciarJuego();