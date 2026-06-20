// Lembretes push (água e meta) pra quem ativou no app. Roda na Vercel em /api/send-reminders.
// Disparo: de hora em hora pelo GitHub Actions (.github/workflows/lembretes.yml), porque o
// cron gratuito da Vercel só roda 1x por dia. Toda chamada precisa do segredo CRON_SECRET.
//
// Variáveis na Vercel (nunca no código): VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY,
// FIREBASE_SERVICE_ACCOUNT (JSON em uma linha) e CRON_SECRET.
import webpush from 'web-push';
import { initializeApp, cert, getApps } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

// Hora e data de agora em São Paulo (o servidor roda em UTC).
function agoraEmSaoPaulo(data = new Date()) {
  const partes = Object.fromEntries(new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Sao_Paulo', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', hour12: false,
  }).formatToParts(data).map((p) => [p.type, p.value]));
  return { hora: Number(partes.hour) % 24, dia: `${partes.year}-${partes.month}-${partes.day}` };
}

// Decide quais lembretes essa pessoa recebe nesta hora.
// Meta: 20h, ou 12h se ela costuma treinar de manhã e ainda não registrou nada hoje.
function lembretesDaHora(usuario, { hora, dia }) {
  const lembretes = usuario.reminders || {};
  const saida = [];
  if (lembretes.water && hora >= 8 && hora <= 22 && hora % 2 === 0) {
    saida.push({ title: '💧 Hora de beber água!', body: 'Um copo agora já ajuda a bater a meta de hoje.', url: '/?action=quick-water' });
  }
  const registrouHoje = usuario.ultimoRegistro === dia;
  const madrugador = typeof usuario.horaHabitual === 'number' && usuario.horaHabitual < 12;
  if (lembretes.goal && !registrouHoje && (hora === 20 || (madrugador && hora === 12))) {
    saida.push({ title: '🎯 Suas metas te esperam!', body: madrugador && hora === 12 ? 'Você costuma treinar de manhã e hoje ainda não registrou nada.' : 'Ainda dá tempo de cumprir as metas de hoje!', url: '/' });
  }
  return saida;
}

function banco() {
  if (!getApps().length) {
    const bruto = process.env.FIREBASE_SERVICE_ACCOUNT;
    if (!bruto) throw new Error('FIREBASE_SERVICE_ACCOUNT não configurada.');
    initializeApp({ credential: cert(JSON.parse(bruto)) });
  }
  return getFirestore();
}

export default async function handler(req, res) {
  // A Vercel manda "Authorization: Bearer <CRON_SECRET>" no cron; o GitHub Actions também.
  const segredo = process.env.CRON_SECRET;
  if (!segredo || req.headers.authorization !== `Bearer ${segredo}`) {
    return res.status(401).json({ error: 'não autorizado' });
  }
  const { VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY } = process.env;
  if (!VAPID_PUBLIC_KEY || !VAPID_PRIVATE_KEY) {
    return res.status(500).json({ error: 'VAPID_PUBLIC_KEY/VAPID_PRIVATE_KEY não configuradas' });
  }
  webpush.setVapidDetails('mailto:contato@corpobem.app', VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY);

  let db;
  try {
    db = banco();
  } catch (erro) {
    return res.status(500).json({ error: erro.message });
  }

  const agora = agoraEmSaoPaulo();
  const usuarios = await db.collection('users').where('pushSubscription', '!=', null).get();
  const resumo = { enviados: 0, falhas: 0, inscricoesRemovidas: 0 };
  const envios = [];

  usuarios.forEach((docUsuario) => {
    const usuario = docUsuario.data();
    for (const mensagem of lembretesDaHora(usuario, agora)) {
      envios.push(
        webpush.sendNotification(usuario.pushSubscription, JSON.stringify(mensagem))
          .then(() => { resumo.enviados++; })
          .catch(async (erro) => {
            // 404/410 = inscrição morta (app desinstalado, permissão revogada): limpa pra não tentar de novo.
            if (erro.statusCode === 404 || erro.statusCode === 410) {
              resumo.inscricoesRemovidas++;
              await docUsuario.ref.update({ pushSubscription: null }).catch(() => {});
            } else {
              resumo.falhas++;
              console.error('Erro enviando push para', docUsuario.id, erro.message);
            }
          }),
      );
    }
  });

  await Promise.allSettled(envios);
  console.log('Lembretes', agora, resumo);
  return res.status(200).json({ hora: agora.hora, ...resumo });
}
