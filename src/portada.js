// =====================================================================
// PORTADA Y MÚSICA
// Chrome, Safari y Firefox no dejan reproducir audio con sonido si antes no
// hubo un gesto del usuario. El toque en «Abrir invitación» es ese gesto: por
// eso existe la portada, no por decoración.
// =====================================================================
const portada = document.getElementById('portada');
const abrir = document.getElementById('abrir');
const cancion = document.getElementById('cancion');
const boton = document.getElementById('musica');

const VOLUMEN = 0.6;

let silenciado = false;
try { silenciado = localStorage.getItem('musica') === 'no'; } catch { /* incógnito */ }

// Se bloquea el scroll desde aquí, no desde el HTML: si el JS fallara, una
// clase overflow-hidden puesta a mano dejaría la página imposible de leer.
document.body.classList.add('overflow-hidden');

function pintarBoton() {
  boton.querySelector('[data-icono="nota"]').classList.toggle('hidden', silenciado);
  boton.querySelector('[data-icono="mudo"]').classList.toggle('hidden', !silenciado);
  boton.setAttribute('aria-pressed', String(!silenciado));
  boton.setAttribute('aria-label', silenciado ? 'Reanudar música' : 'Pausar música');
}

// Entrar de golpe al 60% asusta; sube en metro y medio de segundo.
let rampa;
function subirVolumen() {
  clearInterval(rampa);
  rampa = setInterval(() => {
    cancion.volume = Math.min(VOLUMEN, cancion.volume + VOLUMEN / 30);
    if (cancion.volume >= VOLUMEN) clearInterval(rampa);
  }, 50);
}

// Silenciar ANTES de play() y subir con el evento `playing`, no con la promesa
// de play(): esa promesa puede tardar en resolverse y, mientras tanto, la
// canción ya está sonando. Al revés arrancaba a volumen 1.0.
async function reproducir() {
  cancion.volume = 0;
  cancion.addEventListener('playing', subirVolumen, { once: true });
  try {
    await cancion.play();
    // Dos vías a propósito: `playing` puede no llegar y la promesa puede
    // tardar. subirVolumen es idempotente, así que la primera que ocurra vale.
    subirVolumen();
    return true;
  } catch {
    cancion.removeEventListener('playing', subirVolumen);
    return false;
  }
}

async function sonar() {
  if (silenciado) return;
  // Política del navegador, sin red o archivo ausente: se entra igual y el
  // botón queda listo para reintentar. La música nunca bloquea la página.
  if (!(await reproducir())) silenciado = true;
  pintarBoton();
}

function entrar() {
  sonar();
  portada.classList.add('opacity-0');
  document.body.classList.remove('overflow-hidden');
  boton.classList.replace('hidden', 'flex');
  setTimeout(() => {
    portada.remove();
    // El foco estaba en un botón que acaba de desaparecer: hay que moverlo.
    const titulo = document.querySelector('h1');
    titulo.setAttribute('tabindex', '-1');
    titulo.focus({ preventScroll: true });
  }, 200);
}

abrir.addEventListener('click', entrar);

boton.addEventListener('click', () => {
  silenciado = !silenciado;
  try { localStorage.setItem('musica', silenciado ? 'no' : 'si'); } catch { /* incógnito */ }
  if (silenciado) {
    clearInterval(rampa);
    cancion.pause();
    pintarBoton();
  } else {
    reproducir().then((ok) => {
      if (!ok) silenciado = true;
      pintarBoton();
    });
  }
});

pintarBoton();
