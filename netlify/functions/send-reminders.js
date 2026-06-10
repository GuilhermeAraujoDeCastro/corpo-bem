// Função agendada da Netlify: envia as notificações push de água/meta pra
// quem ativou os lembretes no app. É essa função que faz o lembrete
// funcionar de verdade com o app fechado. A versão anterior usava a
// Notification API direta, que só dispara com a aba do navegador aberta.
//
// Variáveis de ambiente necessárias (Netlify > Project configuration >
// Environment variables, NUNCA colar essas chaves em código):
//   VAPID_PUBLIC_KEY          a chave pública gerada com `npx web-push generate-vapid-keys`
//   VAPID_PRIVATE_KEY         a chave privada da mesma geração
//   FIREBASE_SERVICE_ACCOUNT  o JSON da conta de serviço do Firebase
//                             (Configurações do projeto > Contas de serviço
//                             > Gerar nova chave privada), colado como uma
//                             única linha
// O passo a passo completo está no README.
import webpush from 'web-push';
import { initializeApp, cert, getApps } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

function getDb() {
    if (!getApps().length) {
        const raw = Netlify.env.get('FIREBASE_SERVICE_ACCOUNT');
        if (!raw) throw new Error('FIREBASE_SERVICE_ACCOUNT não configurada.');
        initializeApp({ credential: cert(JSON.parse(raw)) });
    }
    return getFirestore();
}

async function sendPush(db, userId, subscription, payload) {
    try {
        await webpush.sendNotification(subscription, JSON.stringify(payload));
    } catch (err) {
        if (err.statusCode === 404 || err.statusCode === 410) {
            // Assinatura expirada/inválida: limpa pra não tentar de novo.
            await db.collection('users').doc(userId).update({ pushSubscription: null }).catch(() => {});
        } else {
            console.error('Erro enviando push para', userId, err.message);
        }
    }
}

export default async () => {
    const vapidPublic = Netlify.env.get('VAPID_PUBLIC_KEY');
    const vapidPrivate = Netlify.env.get('VAPID_PRIVATE_KEY');
    if (!vapidPublic || !vapidPrivate) {
        console.error('VAPID_PUBLIC_KEY/VAPID_PRIVATE_KEY não configuradas, pulando este ciclo.');
        return;
    }
    webpush.setVapidDetails('mailto:contato@corpobem.app', vapidPublic, vapidPrivate);

    let db;
    try {
        db = getDb();
    } catch (e) {
        console.error('Erro inicializando o Firebase Admin:', e.message);
        return;
    }

    const now = new Date();
    const spHour = Number(new Intl.DateTimeFormat('en-US', { hour: 'numeric', hour12: false, timeZone: 'America/Sao_Paulo' }).format(now));

    const snap = await db.collection('users').get();
    const sends = [];

    snap.forEach(docSnap => {
        const user = docSnap.data();
        const sub = user.pushSubscription;
        if (!sub) return;
        const reminders = user.reminders || {};

        // Água: a cada 2 horas, só em horário acordado (8h-22h) em São Paulo.
        // Antes o filtro usava a hora em UTC direto, o que mandava lembrete
        // de água de madrugada (1h, 3h, 5h...) no horário de Brasília.
        if (reminders.water && spHour >= 8 && spHour <= 22 && spHour % 2 === 0) {
            sends.push(sendPush(db, docSnap.id, sub, { title: '💧 Hora de beber água!', body: 'Não esqueça de se manter hidratado(a).' }));
        }
        // Meta diária: uma vez por dia, às 20h no horário de São Paulo.
        if (reminders.goal && spHour === 20) {
            sends.push(sendPush(db, docSnap.id, sub, { title: '🎯 Suas metas te esperam!', body: 'Ainda dá tempo de cumprir suas metas de hoje!' }));
        }
    });

    await Promise.allSettled(sends);
    console.log(`Ciclo de lembretes concluído: ${sends.length} notificação(ões) processada(s).`);
};

export const config = {
    schedule: '0 * * * *'
};
