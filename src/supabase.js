// =====================================================================
// CAPA SUPABASE — configuración y acceso a datos.
// Aquí no hay nada de UI. La UI vive en src/app.js e index.html.
// =====================================================================
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

// La anon key es pública por diseño: lo que protege la tabla es la RLS
// de supabase/schema.sql, no el secreto de esta cadena.
export const SUPABASE_URL = 'https://maynsqxvbhvjyrzlyyps.supabase.co';
export const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1heW5zcXh2Ymh2anlyemx5eXBzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODg4NzY4NTQsImV4cCI6MjEwNDQ1Mjg1NH0.vFsGw5MC-jpjFOBan-afHCSxBe7dVyoED_odI9-p9PY';

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: { persistSession: false },
});

/** Inserta el voto. Lanza Error con .code para que la UI decida el mensaje. */
export async function enviarVoto({ guest_name, prediction, is_attending, message }) {
  const { data, error } = await supabase
    .from('guest_votes')
    .insert({
      guest_name: guest_name.trim(),
      prediction,
      is_attending,
      message: message?.trim() || null,
    })
    .select()
    .single();
  if (error) throw Object.assign(new Error(error.message), { code: error.code });
  return data;
}

/** Conteo agregado {'niño': n, 'niña': n} vía la función SQL vote_tally(). */
export async function obtenerConteo() {
  const { data, error } = await supabase.rpc('vote_tally');
  if (error) throw Object.assign(new Error(error.message), { code: error.code });
  return Object.fromEntries(data.map((r) => [r.prediction, Number(r.votes)]));
}

/**
 * Realtime: Postgres replica los INSERT → Supabase los reenvía por WebSocket.
 * Requiere que la tabla esté en la publicación `supabase_realtime` y que
 * exista política de SELECT para anon (ambas cosas en schema.sql).
 * Devuelve la función para darse de baja.
 */
export function suscribirseAVotos(onInsert, onEstado) {
  const canal = supabase
    .channel('guest_votes:live')
    .on(
      'postgres_changes',
      { event: 'INSERT', schema: 'public', table: 'guest_votes' },
      (payload) => onInsert(payload.new),
    )
    .subscribe((status) => onEstado?.(status)); // SUBSCRIBED | CHANNEL_ERROR | TIMED_OUT
  return () => supabase.removeChannel(canal);
}
