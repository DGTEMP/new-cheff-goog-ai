/**
 * ia-service.js
 * Módulo de Inteligência Artificial para Restaurantes (Google Gemini)
 * Fornece inteligência de vendas, criação de promoções e consultoria estratégica.
 */

'use strict';

const https = require('https');

const DEFAULT_MODEL = 'gemini-2.5-flash';

/**
 * Faz requisição HTTP POST para a API do Gemini
 */
function callGeminiApi(apiKey, model, systemInstruction, prompt, isJson = false) {
  return new Promise((resolve, reject) => {
    if (!apiKey || typeof apiKey !== 'string' || !apiKey.trim()) {
      return reject(new Error('Chave de API do Gemini não configurada para este restaurante.'));
    }

    const cleanModel = (model || DEFAULT_MODEL).trim();
    const cleanKey = apiKey.trim();

    const requestBody = {
      contents: [
        {
          role: 'user',
          parts: [{ text: prompt }]
        }
      ],
      generationConfig: {
        temperature: 0.7,
        maxOutputTokens: 2048,
        topP: 0.95
      }
    };

    if (systemInstruction) {
      requestBody.systemInstruction = {
        parts: [{ text: systemInstruction }]
      };
    }

    if (isJson) {
      requestBody.generationConfig.responseMimeType = 'application/json';
    }

    const postData = JSON.stringify(requestBody);

    const options = {
      hostname: 'generativelanguage.googleapis.com',
      port: 443,
      path: `/v1beta/models/${encodeURIComponent(cleanModel)}:generateContent?key=${encodeURIComponent(cleanKey)}`,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(postData)
      },
      timeout: 30000
    };

    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => {
        try {
          const parsed = JSON.parse(data);
          if (res.statusCode >= 400 || parsed.error) {
            const msg = (parsed.error && parsed.error.message) || `Erro HTTP ${res.statusCode} na API Gemini.`;
            return reject(new Error(msg));
          }

          const candidate = parsed.candidates && parsed.candidates[0];
          const text = candidate?.content?.parts?.[0]?.text || '';
          resolve({ text, raw: parsed });
        } catch (err) {
          reject(new Error('Resposta inválida da API do Gemini: ' + err.message));
        }
      });
    });

    req.on('error', (err) => reject(new Error('Falha de conexão com a API do Gemini: ' + err.message)));
    req.on('timeout', () => {
      req.destroy();
      reject(new Error('Tempo limite de conexão excedido ao consultar o Gemini (30s).'));
    });

    req.write(postData);
    req.end();
  });
}

/**
 * Testa se uma chave API do Gemini é válida
 */
async function testarApiKey(apiKey, model = DEFAULT_MODEL) {
  try {
    const res = await callGeminiApi(apiKey, model, 'Você é um validador de chave de IA.', 'Responda apenas: OK', false);
    return { ok: true, modelo: model, resposta: res.text.trim() };
  } catch (err) {
    return { ok: false, erro: err.message };
  }
}

/**
 * Gera sugestões inteligentes de promoções e combos com base no cardápio real e vendas
 */
async function gerarPromocoesIA({ apiKey, model, contextoRestaurante, cardapio, historicoVendas, objetivo }) {
  const systemInstruction = `Você é o Diretor Comercial e Estrategista de Vendas com IA de elite do sistema Chef Cozinha.
Seu objetivo é criar promoções e combos inteligentes para o restaurante lucrar mais, aumentar o ticket médio e fidelizar clientes.
Você deve responder EXCLUSIVAMENTE em formato JSON compatível com o schema solicitado, sem markdown ao redor do json.`;

  const resumoCardapio = (cardapio || []).map(p => ({
    id: p.id,
    nome: p.nome,
    categoria: p.categoria,
    preco: p.preco,
    categoria_fiscal: p.categoria_fiscal || 'Alimentacao'
  }));

  const prompt = `Analise o cardápio e os dados deste restaurante e crie 3 a 5 sugestões de PROMOÇÕES / COMBOS DE ALTO IMPACTO.

DADOS DO RESTAURANTE:
- Identidade / Contexto: ${contextoRestaurante || 'Restaurante / Bar / Lanchonete padrão'}
- Foco atual: ${objetivo || 'Aumentar faturamento e ticket médio'}
- Total de produtos no cardápio: ${resumoCardapio.length}
- Produtos cadastrados: ${JSON.stringify(resumoCardapio.slice(0, 50))}

HISTÓRICO RECENTE DE VENDAS (se houver):
${JSON.stringify(historicoVendas || {})}

Retorne um JSON com a seguinte estrutura:
{
  "analise_estrategica": "Breve diagnóstico do cardápio e potencial de vendas (máx 2 parágrafos)",
  "promocoes": [
    {
      "titulo": "Nome criativo e chamativo da promoção / combo",
      "tipo": "combo" | "desconto_dia" | "compre_ganhe" | "fidelidade",
      "emoji": "🍔",
      "descricao": "Descrição irresistível para o cliente final",
      "produtos_envolvidos": ["Nome do Produto 1", "Nome do Produto 2"],
      "preco_original": 50.00,
      "preco_promocional": 42.90,
      "desconto_percentual": 14,
      "motivo_estrategico": "Por que esta promoção aumenta o lucro e giro deste restaurante?",
      "dias_recomendados": ["Terça", "Quarta", "Domingo"],
      "copy_whatsapp": "Texto curto pronto para disparar no WhatsApp com emojis chamando para pedir",
      "copy_instagram": "Legenda com hashtags para post no feed ou stories do Instagram"
    }
  ]
}`;

  const res = await callGeminiApi(apiKey, model, systemInstruction, prompt, true);
  try {
    let cleanText = res.text.trim();
    if (cleanText.startsWith('```json')) cleanText = cleanText.replace(/^```json\s*/, '').replace(/\s*```$/, '');
    else if (cleanText.startsWith('```')) cleanText = cleanText.replace(/^```\s*/, '').replace(/\s*```$/, '');
    return JSON.parse(cleanText);
  } catch (err) {
    throw new Error('Falha ao interpretar resposta estruturada da IA: ' + err.message);
  }
}

/**
 * Gera copies de marketing e mensagens de vendas para o restaurante
 */
async function gerarCopyMarketing({ apiKey, model, contextoRestaurante, produtos, promocao, canal = 'whatsapp' }) {
  const systemInstruction = `Você é um Copywriter especialista em gastronomia e delivery para o Chef Cozinha. Crie copies persuasivas, apetitosas e com gatilhos mentais para vendas imediatas.`;

  const prompt = `Crie 3 opções de mensagens de vendas para o canal: ${canal.toUpperCase()}

INFORMAÇÕES:
- Restaurante: ${contextoRestaurante || 'Nosso Restaurante'}
- Promoção / Prato: ${promocao || 'Nossos pratos especiais'}
- Produtos em destaque: ${JSON.stringify(produtos || [])}

Retorne um JSON com:
{
  "opcoes": [
    {
      "estilo": "Urgência e Fome" | "Casual e Amigável" | "Exclusivo / VIP",
      "titulo": "Título ou Linha de Assunto",
      "texto": "Texto completo formatado com quebras de linha e emojis pronto para copiar"
    }
  ]
}`;

  const res = await callGeminiApi(apiKey, model, systemInstruction, prompt, true);
  try {
    let cleanText = res.text.trim();
    if (cleanText.startsWith('```json')) cleanText = cleanText.replace(/^```json\s*/, '').replace(/\s*```$/, '');
    else if (cleanText.startsWith('```')) cleanText = cleanText.replace(/^```\s*/, '').replace(/\s*```$/, '');
    return JSON.parse(cleanText);
  } catch (err) {
    throw new Error('Falha ao formatar copies de vendas: ' + err.message);
  }
}

/**
 * Chat consultivo com o Assistente de Vendas IA
 */
async function consultarAssistenteVendas({ apiKey, model, contextoRestaurante, cardapio, historicoVendas, historicoMensagens, pergunta }) {
  const systemInstruction = `Você é o Consultor de Vendas IA do restaurante no sistema Chef Cozinha.
Você tem acesso aos produtos cadastrados e vendas do restaurante.
Seja prático, motivador, estratégico e focado em aumentar vendas, margem de lucro e fidelização.
Responda em português com formatação limpa (Markdown, listas, emojis).`;

  const produtosSimplificados = (cardapio || []).slice(0, 40).map(p => `${p.categoria}: ${p.nome} (R$ ${Number(p.preco || 0).toFixed(2)})`).join('\n');

  let prompt = `CONTEXTO DO RESTAURANTE:
${contextoRestaurante || 'Restaurante / Estabelecimento Comercial'}

CARDÁPIO ATUAL DO RESTAURANTE:
${produtosSimplificados || 'Nenhum produto cadastrado ainda.'}

HISTÓRICO RECENTE:
${JSON.stringify(historicoVendas || {})}
`;

  if (historicoMensagens && Array.isArray(historicoMensagens) && historicoMensagens.length > 0) {
    prompt += `\nCONVERSA ANTERIOR:\n` + historicoMensagens.map(m => `${m.role === 'user' ? 'Dono' : 'Consultor IA'}: ${m.text}`).join('\n');
  }

  prompt += `\n\nPERGUNTA DO DONO DO RESTAURANTE:\n${pergunta}`;

  const res = await callGeminiApi(apiKey, model, systemInstruction, prompt, false);
  return { resposta: res.text };
}

module.exports = {
  DEFAULT_MODEL,
  callGeminiApi,
  testarApiKey,
  gerarPromocoesIA,
  gerarCopyMarketing,
  consultarAssistenteVendas
};
