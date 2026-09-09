// =====================================================================
// CAPA UI — sin SQL, sin claves y sin colores. El color vive en los tokens
// de index.html; aquí solo se alterna estado.
// =====================================================================
import { enviarVoto, obtenerConteo, suscribirseAVotos } from './supabase.js';
import { tally } from './tally.js';

// Datos del evento. Reemplaza los [CORCHETES] antes de publicar.
const EVENTO = {
  fechaISO: '2026-09-19T17:00:00-05:00',
  fechaTexto: 'Sábado 19 de septiembre',
  horaTexto: '3:30 PM',
  // Búsqueda por dirección: funciona ya. Si quieres el pin exacto, abre el
  // sitio en Google Maps, «Compartir» y pega aquí el enlace maps.app.goo.gl.
  mapaUrl: 'https://www.google.com/maps/search/?api=1&query=' +
    encodeURIComponent('Centro Comercial Palmetto Plaza, Calle 9 # 48-81'),
};

const $ = (id) => document.getElementById(id);
const conteo = { 'niño': 0, 'niña': 0 };

// --- Cuenta regresiva -------------------------------------------------
const objetivo = new Date(EVENTO.fechaISO).getTime();
function pintarCuenta() {
  const falta = Math.max(0, objetivo - Date.now());
  const d = Math.floor(falta / 86400000);
  const h = Math.floor(falta / 3600000) % 24;
  const m = Math.floor(falta / 60000) % 60;
  const s = Math.floor(falta / 1000) % 60;
  [['cd-d', d], ['cd-h', h], ['cd-m', m], ['cd-s', s]].forEach(([id, v]) => {
    $(id).textContent = String(v).padStart(2, '0');
  });
}
pintarCuenta();
setInterval(pintarCuenta, 1000);
$('mapa').href = EVENTO.mapaUrl;
$('fecha').textContent = `${EVENTO.fechaTexto} · ${EVENTO.horaTexto}`;

// --- Avisos -----------------------------------------------------------
// El JS no arma clases de color: alterna las de fondo que ya existen.
let avisoTimer;
function avisar(texto, tono = 'error') {
  const el = $('aviso');
  el.textContent = texto;
  el.classList.toggle('bg-destructive', tono === 'error');
  el.classList.toggle('text-destructive-foreground', tono === 'error');
  el.classList.toggle('bg-success', tono === 'ok');
  el.classList.toggle('text-success-foreground', tono === 'ok');
  el.classList.remove('opacity-0', 'translate-y-3');
  clearTimeout(avisoTimer);
  avisoTimer = setTimeout(() => el.classList.add('opacity-0', 'translate-y-3'), 4500);
}

// --- Validación del nombre -------------------------------------------
const nombreValido = () => $('nombre').value.trim().length >= 2;

function pintarErrorNombre(mostrar) {
  $('error-nombre').classList.toggle('hidden', !mostrar);
  $('ayuda-nombre').classList.toggle('hidden', mostrar);
  $('nombre').classList.toggle('border-destructive-accent', mostrar);
  $('nombre').setAttribute('aria-invalid', mostrar ? 'true' : 'false');
  $('nombre').setAttribute('aria-describedby', mostrar ? 'error-nombre' : 'ayuda-nombre');
}

// Se valida al salir del campo, no en cada tecla.
$('nombre').addEventListener('blur', () => pintarErrorNombre(!nombreValido()));
$('nombre').addEventListener('input', () => {
  if (nombreValido()) pintarErrorNombre(false);
});

// --- Barra de resultados ----------------------------------------------
function pintarResultados() {
  const t = tally(conteo);
  $('barra-nino').style.width = `${t.ninoPct}%`;
  $('barra-nina').style.width = `${t.ninaPct}%`;
  $('pct-nino').textContent = `${t.ninoPct}%`;
  $('pct-nina').textContent = `${t.ninaPct}%`;
  $('total').textContent = t.total === 1 ? '1 voto' : `${t.total} votos`;
}

// Mirar y haber votado son dos estados distintos: antes estaban pegados y
// enseñar la barra obligaba a esconder la votación.
const yaVoto = () => {
  try { return Boolean(localStorage.getItem('voto')); } catch { return false; }
};

function abrirResultados(titulo) {
  $('titulo-resultados').textContent = titulo;
  $('resultados').classList.remove('hidden');
  $('resultados').classList.add('flex');
  requestAnimationFrame(() => $('resultados').classList.remove('opacity-0'));
}

// Solo mirar: la votación se queda disponible debajo.
function verResultados() {
  abrirResultados(yaVoto() ? 'Gracias por votar' : 'Así va la votación');
  const modo = matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth';
  // Se espera a que la portada termine de irse, si no el scroll pasa a ciegas.
  setTimeout(() => $('resultados').scrollIntoView({ behavior: modo, block: 'center' }), 260);
}
document.addEventListener('invitacion:ver-votacion', verResultados);

function trasVotar() {
  $('votacion').classList.add('opacity-0', 'scale-95', 'pointer-events-none');
  setTimeout(() => {
    $('votacion').classList.add('hidden');
    abrirResultados('Gracias por votar');
  }, 200);
}

// --- Envío del voto ---------------------------------------------------
let enviando = false;
async function votar(prediction) {
  if (enviando) return;
  if (!nombreValido()) {
    pintarErrorNombre(true);
    $('nombre').focus();
    return avisar('Escribe tu nombre para registrar tu voto.');
  }

  enviando = true;
  const boton = $(prediction === 'niño' ? 'btn-nino' : 'btn-nina');
  document.querySelectorAll('[data-voto]').forEach((b) => (b.disabled = true));
  boton.querySelector('[data-spinner]').classList.replace('hidden', 'flex');

  try {
    await enviarVoto({
      guest_name: $('nombre').value,
      prediction,
      is_attending: $('asiste').checked,
      message: $('mensaje').value,
    });
    localStorage.setItem('voto', prediction);
    trasVotar();
    avisar('¡Gracias! Tu voto quedó registrado.', 'ok');
  } catch (e) {
    if (e.code === '23505') {
      avisar('Ese nombre ya votó. Si eres otra persona, añade tu apellido.');
    } else {
      avisar('No pudimos conectar. Revisa tu señal e inténtalo otra vez.');
    }
    document.querySelectorAll('[data-voto]').forEach((b) => (b.disabled = false));
  } finally {
    boton.querySelector('[data-spinner]').classList.replace('flex', 'hidden');
    enviando = false;
  }
}
$('btn-nino').onclick = () => votar('niño');
$('btn-nina').onclick = () => votar('niña');

// --- Arranque: conteo inicial + suscripción en vivo -------------------
(async () => {
  if (yaVoto()) {
    $('votacion').classList.add('hidden');
    $('resultados').classList.remove('opacity-0');
    abrirResultados('Gracias por votar');
  }
  try {
    Object.assign(conteo, await obtenerConteo());
    pintarResultados();
  } catch {
    avisar('No pudimos cargar los resultados. Seguimos intentando.');
  }

  suscribirseAVotos(
    (fila) => {
      conteo[fila.prediction] = (conteo[fila.prediction] || 0) + 1;
      pintarResultados();
    },
    (estado) => {
      if (estado === 'CHANNEL_ERROR' || estado === 'TIMED_OUT') {
        avisar('Conexión en vivo interrumpida. Recarga para ver los votos nuevos.');
      }
    },
  );
})();
