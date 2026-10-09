# Modelo e limites das regras locais

O UID proprietário está no caminho. Não adicionamos papéis administrativos. O perfil público já existente permanece separado do perfil privado. As consultas usadas continuam sendo leitura do documento próprio, subcoleções próprias e leitura individual de recursos explicitamente compartilhados.

As regras revisadas são um protótipo local, não publicado. Alvos, saldos e exercícios são validados na criação e na atualização; resgates usam recibo e verificação getAfter. Testes do emulador devem verificar isolamento, tipos, ausência de campos, valores negativos, repetição e concorrência. Datas de rotina são datas de calendário do aparelho; as regras limitam seu formato/tamanho e o cliente valida a data real.

Limite desta revisão: dados legados inválidos não são apagados. Corrija-os em cópia após exportação, antes de aplicar regras mais restritas. Campos antigos do perfil fora dos itens deste pedido mantêm compatibilidade; não houve auditoria integral dos documentos de perfil ou da infraestrutura remota.

Treinos e sessões aceitam até 8 exercícios. O emulador confirmou que a primeira proposta, com 20 exercícios aninhados, excedia o limite de 1000 expressões das regras. O cliente e o servidor usam agora o limite de 8, testado também na fronteira.
