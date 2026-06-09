# Treine Bem (Corpo Bem)

Aplicativo de treino, metas e hábitos, feito para celular e instalável como PWA. O usuário registra treinos, água, peso e outras metas diárias, acompanha sua sequência de dias consecutivos e ganha pontos trocáveis por recompensas dentro do próprio app.

Site: https://treine-bem.netlify.app

## Tecnologias

O front-end é JavaScript puro em módulos ES, sem framework. As peças principais são:

- Firebase Authentication (e-mail e senha, além de login com Google) e Firestore como banco de dados
- Chart.js para o gráfico de peso e IMC ao longo do tempo
- canvas-confetti para a animação de celebração ao bater uma meta
- html2canvas para exportar o resumo semanal como imagem
- Service Worker e Web Push para notificações e uso offline
- Web App Manifest para instalação como aplicativo no celular

O build de produção usa esbuild para empacotar os módulos em um único arquivo e javascript-obfuscator para ofuscar esse arquivo antes do deploy. O envio periódico de notificações roda como uma função agendada da Netlify, escrita com web-push e firebase-admin.

## Estrutura de pastas

```
web-treino-metas/
├── index.html
├── manifest.json
├── sw.js
├── build.js
├── css/
│   └── style.css
├── js/
│   ├── main.js
│   ├── firebase-config.js
│   ├── state.js
│   ├── ui.js
│   ├── auth.js
│   ├── goals.js
│   ├── profile.js
│   ├── rewards.js
│   ├── notifications.js
│   └── recap.js
├── assets/
│   └── icons/
├── netlify/
│   └── functions/
│       └── send-reminders.js
└── dist/            (gerado pelo build, não versionado)
```

## Build local

```
npm install
npm run build
```

O comando de build gera a pasta `dist/` com o HTML, o CSS, os ícones, o manifesto e o JavaScript já empacotado e ofuscado. É essa pasta que a Netlify publica, conforme configurado em `netlify.toml`.

## Configuração necessária

Duas coisas precisam ser configuradas fora do código para o app funcionar em produção.

A primeira são as regras de segurança do Firestore. Elas ficam em `firestore.rules` neste repositório, mas precisam ser publicadas manualmente em Firebase Console, na seção Firestore Database > Regras. Sem isso, toda leitura e escrita no banco falha depois do login.

A segunda são três variáveis de ambiente no painel da Netlify, usadas pela função de notificações agendadas:

- `VAPID_PUBLIC_KEY` e `VAPID_PRIVATE_KEY`: um par de chaves para o protocolo Web Push, gerado com `npx web-push generate-vapid-keys`
- `FIREBASE_SERVICE_ACCOUNT`: o JSON de uma conta de serviço, gerado em Firebase Console, em Configurações do projeto > Contas de serviço > Gerar nova chave privada

## Licença

Consulte o arquivo LICENSE. As bibliotecas de terceiros usadas neste projeto estão listadas em CREDITS.md.
