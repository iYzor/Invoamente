import { SUPABASE_URL, SUPABASE_ANON_KEY } from './config.js';
// A SDK é carregada pelo CDN antes dos módulos de cada página.
export const configured = !SUPABASE_URL.includes('SEU-PROJETO') && !SUPABASE_ANON_KEY.includes('SUA-CHAVE');
export const supabase = configured ? window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY) : null;
