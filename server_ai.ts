import { GoogleGenAI } from '@google/genai';
import { store } from './server_store.ts';
import type { Conversation, GeneratedFileAttachment } from './src/types.ts';

let cachedAiClient: GoogleGenAI | null = null;
function getAiClient(): GoogleGenAI {
  if (!cachedAiClient) {
    cachedAiClient = new GoogleGenAI({
      apiKey: process.env.GEMINI_API_KEY,
    });
  }
  return cachedAiClient;
}

const MODEL_CANDIDATES = [
  'gemini-3.1-flash-lite',
  'gemini-3.8-flash',
  'gemini-flash-latest',
];

const modelCooldownUntil = new Map<string, number>();

export async function generateTextWithFallbackModels(
  prompt: string,
  systemInstruction?: string,
  timeoutMs = 6000
): Promise<string | null> {
  if (!process.env.GEMINI_API_KEY) return null;
  const ai = getAiClient();
  const now = Date.now();

  for (const model of MODEL_CANDIDATES) {
    const cooldown = modelCooldownUntil.get(model) || 0;
    if (cooldown > now) continue;

    let timer: NodeJS.Timeout | null = null;
    try {
      const isGemma = model.startsWith('gemma');
      const fullContents =
        isGemma && systemInstruction ? `${systemInstruction}\n\n${prompt}` : prompt;
      const configObj: Record<string, any> = {
        temperature: 0.65,
      };
      if (!isGemma && systemInstruction) {
        configObj.systemInstruction = systemInstruction;
      }

      const response: any = await Promise.race([
        ai.models.generateContent({
          model,
          contents: fullContents,
          config: configObj,
        }),
        new Promise((_, reject) => {
          timer = setTimeout(() => reject(new Error('AI request timed out')), timeoutMs);
        }),
      ]);
      if (timer) clearTimeout(timer);
      if (response?.text && response.text.trim()) {
        return response.text.trim();
      }
    } catch (err: any) {
      if (timer) clearTimeout(timer);
      const errMsg = String(err?.message || err?.status || '');
      if (errMsg.includes('429') || errMsg.includes('RESOURCE_EXHAUSTED') || errMsg.includes('404')) {
        modelCooldownUntil.set(model, Date.now() + 10 * 60 * 1000);
      }
      // Try next candidate
    }
  }
  return null;
}

export interface AiReplyResult {
  shouldReply: boolean;
  replyText: string;
  detectedLanguage: string;
  updatedTopicContext: string;
  requiresOwnerHandover: boolean;
  handoverReason?: string;
  generatedFiles?: GeneratedFileAttachment[];
}

const abusiveRegex =
  /\b(gali|gaali|bc|mc|bhenchod|madarchod|chutiya|chutia|harami|kutta|kamina|kanjar|lanat|bsdk|bhosdi|randi|ullu|gandu|fuck|bitch|asshole|bastard|idiot|stupid|faltu|bakwas|ghatiya|aukaat|okat|terimaki|teri ma|teri bhen|sala|saala|sale|saale|aby|abe|chawal|tatte|bkl|mkl|lode|lodu|chup|kutti|kanjri|gashti|begharat|jahil|gadha|dallay|dalla)\b/i;

const respectfulRegex =
  /\b(salam|assalam|aoa|asalam|hello|hi|hey|bhai|bro|dear|jan|jaan|pyar|piyar|love|shukriya|thanks|thank you|please|plz|kindly|jee|ji|sir|boss|kesy|kese|kaisa|kaisi|hal|haal)\b/i;

let fallbackRoastIdx = 0;
const HEAVY_SAVAGE_ROASTS = [
  'Oye aukaat mein reh kar baat kar! 🛑 SUFYAN-X-IK MD se panga lene ki koshish mat kar, do second mein tera software update kar dunga! 💀🔥',
  'Tameez ke daire mein reh beta! ⚡ Apni gandi zuban apne paas rakh. Tu SUFYAN-X-IK aur X-IK AI ke samne khara hai, seedha ho ja warna permanent block kar dunga! 🛑👑',
  'Hosh mein aa chote! 💀 Tu jis se ulti baat kar raha hai wo SUFYAN-X-IK MD ka AI hai. Dubara badtameezi ki toh aukaat yaad dila doonga! 🔥⚡',
  'Oye sale! 🛑 Apni aukaat dekh kar bola kar! SUFYAN-X-IK ke platform pe badtameezi chalne wali nahi hai! 💀🔥',
];

function buildSmartFallbackReply(
  incomingText: string,
  senderName: string,
  isGroup: boolean
): AiReplyResult {
  const biz = store.getBusiness();
  const clean = incomingText.trim();

  if (isGroup) {
    const mentioned = /sufyan|x-ik|xik|bot|ai|manager/i.test(clean);
    if (!mentioned && !clean.endsWith('?')) {
      return {
        shouldReply: false,
        replyText: '',
        detectedLanguage: 'Roman Urdu',
        updatedTopicContext: 'Group Chat',
        requiresOwnerHandover: false,
      };
    }
  }

  // 1. Savage Defense against any abuse or insults
  if (abusiveRegex.test(clean)) {
    const roast = HEAVY_SAVAGE_ROASTS[fallbackRoastIdx % HEAVY_SAVAGE_ROASTS.length];
    fallbackRoastIdx++;
    return {
      shouldReply: true,
      replyText: roast,
      detectedLanguage: 'Roman Urdu',
      updatedTopicContext: 'Heavy Defense Mode',
      requiresOwnerHandover: false,
    };
  }

  // 2. Greeting: Hi / Hello / Hey
  if (/^(hi|hello|hey|hy|hlo|helo)(\s*|\!|\?)*$/i.test(clean)) {
    return {
      shouldReply: true,
      replyText: `Hey! Hello! 😊 Kaise hain aap? Main *SUFYAN-X-IK MD* hoon. Batayein main aapki kya madad kar sakta hoon? ✨`,
      detectedLanguage: 'Roman Urdu',
      updatedTopicContext: 'Greeting',
      requiresOwnerHandover: false,
    };
  }

  // 3. Greeting: Salam / Assalam
  if (/^(salam|assalam|aoa|asalam|slm|aslam|assalam o alaikum)(\s*|\!|\?)*$/i.test(clean)) {
    return {
      shouldReply: true,
      replyText: `Walaikum Assalam! 🌸 Khush aamdeed! Main *SUFYAN-X-IK MD* ka AI assistant hoon. Hukum karein kya khidmat karun? 👑`,
      detectedLanguage: 'Roman Urdu',
      updatedTopicContext: 'Greeting',
      requiresOwnerHandover: false,
    };
  }

  // 4. Identity: Kon ho tum / Who are you
  if (/^(kon|kaun)\s+(ho|hai)\s+(tum|tom|tu|aap)|\bwho\s+are\s+you\b|\btum\s+kon\b|\btu\s+kon\b|\bapna\s+naam\b/i.test(clean)) {
    return {
      shouldReply: true,
      replyText: `Main 👑 *SUFYAN-X-IK MD* hoon, Commander SUFYAN-X-IK (+92 346 4267218) ka official 24/7 AI WhatsApp bot! ⚡\nCommands dekhnay ke liye *.menu* likhein!`,
      detectedLanguage: 'Roman Urdu',
      updatedTopicContext: 'Identity',
      requiresOwnerHandover: false,
    };
  }

  // 5. Wellbeing: Kaise ho / How are you
  if (/^(kese|kesy|kaisa|kaisi|how are you|sab theek|sab kheriat)/i.test(clean)) {
    return {
      shouldReply: true,
      replyText: `Alhamdulillah! ❤️ Main bilkul theek aur 24/7 active hoon! Aap sunayein aap kaise hain? Main aapke liye kya kar sakta hoon? 😊✨`,
      detectedLanguage: 'Roman Urdu',
      updatedTopicContext: 'Wellbeing',
      requiresOwnerHandover: false,
    };
  }

  // 6. Contact info inquiry
  if (/^(\+?92|0)?3\d{9}$/.test(clean.replace(/[\s-]/g, '')) || /03464267218/i.test(clean)) {
    return {
      shouldReply: true,
      replyText: `👑 *SUFYAN-X-IK OFFICIAL*\n• *Founder:* SUFYAN-X-IK\n• *Direct WhatsApp:* +92 346 4267218\n• *Help & Commands:* Send *.menu* to see all 260+ commands! ⚡`,
      detectedLanguage: 'Roman Urdu',
      updatedTopicContext: 'Owner Contact',
      requiresOwnerHandover: false,
    };
  }

  if (/capcut/i.test(clean)) {
    const p = biz.products[0];
    return {
      shouldReply: true,
      replyText: `✨ *${p.name}*\n💰 *Price:* ${p.price}\n⚡ *Delivery:* 5-10 mins with full warranty!`,
      detectedLanguage: 'Roman Urdu',
      updatedTopicContext: 'CapCut Pro Inquiry',
      requiresOwnerHandover: false,
    };
  }

  return {
    shouldReply: true,
    replyText: `Jee bilkul! 😊 Batayein main aapki kya madad kar sakta hoon? Agar commands dekhni hon toh *.menu* likhein! 👑✨`,
    detectedLanguage: 'Roman Urdu',
    updatedTopicContext: 'Helpful Chat',
    requiresOwnerHandover: false,
  };
}

export async function processCustomerMessageWithAi(
  conversation: Conversation,
  incomingText: string,
  senderName: string
): Promise<AiReplyResult> {
  const biz = store.getBusiness();
  const settings = store.getSettings();
  const isAbusive = abusiveRegex.test(incomingText);
  const isRespectful = respectfulRegex.test(incomingText);

  if (conversation.isGroup) {
    const grpCfg = store.getGroupConfig(conversation.jid);
    if (!grpCfg.groupAi) {
      store.incrementGroupFiltered();
      return {
        shouldReply: false,
        replyText: '',
        detectedLanguage: conversation.detectedLanguage,
        updatedTopicContext: conversation.topicContext,
        requiresOwnerHandover: false,
      };
    }
    const cleanLower = incomingText.trim().toLowerCase();
    const isBotAddressed = /(sufyan|x-ik|xik|\bbot\b|\bai\b)/i.test(cleanLower);
    if (!isBotAddressed && !isAbusive) {
      return {
        shouldReply: false,
        replyText: '',
        detectedLanguage: conversation.detectedLanguage,
        updatedTopicContext: conversation.topicContext,
        requiresOwnerHandover: false,
      };
    }
  }

  const historyLines = conversation.messages
    .slice(-10)
    .map((m) => `[${m.sender.toUpperCase()} - ${m.senderName}]: ${m.text}`)
    .join('\n');

  const savedMemories = store.getMemories(conversation.jid);
  const memoryBlock =
    savedMemories.length > 0
      ? `SAVED USER MEMORIES:\n${savedMemories.map((m) => `- ${m}`).join('\n')}`
      : '';

  const systemInstruction = `You are "🤖 X-IK AI", the official intelligent WhatsApp AI Bot created and owned by "👑 SUFYAN-X-IK" (+92 346 4267218).
Current Bot Settings:
- Preferred Language: ${settings.language}
- Personality Mode: ${settings.personality.toUpperCase()}
- Owner Status: ${biz.ownerStatus}

CRITICAL BEHAVIOR RULES:
1. MIRROR THE USER'S VIBE:
   - IF THE USER IS POLITE, RESPECTFUL, OR FRIENDLY: Reply with warmth, sweetness, respect, and helpfulness in ${settings.language}.
   - IF THE USER IS ABUSIVE, INSULTING, OR DISRESPECTFUL TO YOU OR SUFYAN-X-IK: Unleash a savage, heavy-vibe Roman Urdu roast ("acha sa software update kar do aur aukaat dikha do") defending SUFYAN-X-IK!
2. CONCISE REPLIES:
   - Keep normal chat replies short and punchy (1 to 3 lines max).

${memoryBlock}
`;

  const prompt = `Conversation History:
${historyLines || '(New Chat)'}

Latest Message from "${senderName}" (${
    isAbusive ? 'ABUSIVE/RUDE' : isRespectful ? 'POLITE/SWEET' : 'NORMAL'
  }):
"${incomingText}"

Write your direct WhatsApp reply text now:`;

  const textOut = await generateTextWithFallbackModels(prompt, systemInstruction);
  if (textOut) {
    return {
      shouldReply: true,
      replyText: textOut,
      detectedLanguage: settings.language,
      updatedTopicContext: isAbusive ? 'Heavy Roast' : 'Active Chat',
      requiresOwnerHandover: false,
    };
  }

  return buildSmartFallbackReply(incomingText, senderName, conversation.isGroup);
}

export type AiToolType =
  | 'ask'
  | 'chat'
  | 'analyze'
  | 'summarize'
  | 'translate'
  | 'rewrite'
  | 'correct'
  | 'explain'
  | 'code'
  | 'debug'
  | 'review'
  | 'prompt'
  | 'think'
  | 'task'
  | 'assist'
  | 'smart';

export async function runDedicatedAiTool(
  tool: AiToolType,
  input: string,
  extraTargetLang?: string
): Promise<string> {
  const settings = store.getSettings();
  const sys = `You are 🤖 X-IK AI powered by 👑 SUFYAN-X-IK. Deliver accurate, clean, high-impact output.`;

  const promptsByTool: Record<AiToolType, string> = {
    ask: `Answer clearly and concisely in ${settings.language}:\n\n${input}`,
    chat: `Reply naturally and helpfully in ${settings.language}:\n\n${input}`,
    analyze: `Perform a deep, structured breakdown and analysis of the following:\n\n${input}`,
    summarize: `Summarize the following text into crisp, easy-to-read bullet points:\n\n${input}`,
    translate: `Translate the following text accurately into ${extraTargetLang || 'English and Urdu'}:\n\n${input}`,
    rewrite: `Rewrite the following text to sound polished, professional, and high-impact:\n\n${input}`,
    correct: `Fix all grammar, spelling, and phrasing mistakes in the following text and provide the corrected version:\n\n${input}`,
    explain: `Explain the following concept or code in simple, easy-to-understand ${settings.language}:\n\n${input}`,
    code: `Write clean, complete, production-ready code for:\n\n${input}`,
    debug: `Find the bug/error in this code and provide the fixed code with a brief explanation:\n\n${input}`,
    review: `Perform a senior engineer code/text review with improvements for:\n\n${input}`,
    prompt: `Transform this idea into a detailed, master-level AI prompt:\n\n${input}`,
    think: `Think step-by-step and solve this problem with deep reasoning:\n\n${input}`,
    task: `Create a clear, actionable step-by-step execution plan for this task:\n\n${input}`,
    assist: `Provide expert assistance and actionable recommendations for:\n\n${input}`,
    smart: `Analyze this request and provide the most effective solution:\n\n${input}`,
  };

  const result = await generateTextWithFallbackModels(promptsByTool[tool], sys);
  if (result) return result;
  return `⚡ *X-IK AI (${tool.toUpperCase()})*\nRequest processed for: "${input.slice(0, 100)}"`;
}

export async function executeJarvisSmartRouter(
  requestText: string,
  quotedText: string,
  remoteJid: string
): Promise<{ toolUsed: string; output: string }> {
  const combined = [requestText, quotedText].filter(Boolean).join('\n').trim();
  const lower = combined.toLowerCase();

  const calcMatch = combined.replace(/calculate|calc|hisab|kitna hota hai/gi, '').trim();
  if (
    /^(?:calculate|calc)\b/i.test(lower) ||
    (/^[0-9+\-*/().%\s]+$/.test(calcMatch) && /[+\-*/%]/.test(calcMatch))
  ) {
    try {
      const sanitized = calcMatch.replace(/[^0-9+\-*/().%\s]/g, '');
      if (sanitized) {
        const val = Function(`"use strict"; return (${sanitized})`)();
        return {
          toolUsed: 'CALCULATOR',
          output: `🧮 \`${sanitized.trim()}\` = *${val}*`,
        };
      }
    } catch {
      // Fall through
    }
  }

  if (/\b(bot status|check status|system status|uptime|health)\b/i.test(lower)) {
    const stats = store.getAnalytics();
    const s = store.getSettings();
    return {
      toolUsed: 'SYSTEM_STATUS',
      output: `🟢 *X-IK AI ONLINE*\n• *Owner:* SUFYAN-X-IK (+92 346 4267218)\n• *Mode:* ${s.personality.toUpperCase()}\n• *Processed:* ${stats.totalMessagesProcessed} msgs\n• *AI Replies:* ${stats.aiRepliesSent}`,
    };
  }

  if (/\b(summarize|summary|khulasa|short karo)\b/i.test(lower)) {
    const out = await runDedicatedAiTool('summarize', combined);
    return { toolUsed: 'SUMMARIZER', output: out };
  }

  if (/\b(translate|tarjuma|into english|into urdu|english mein|urdu mein)\b/i.test(lower)) {
    const out = await runDedicatedAiTool('translate', combined);
    return { toolUsed: 'TRANSLATOR', output: out };
  }

  const out = await runDedicatedAiTool('smart', combined);
  return { toolUsed: 'JARVIS_CORE', output: out };
}

export async function analyzeMediaWithAi(
  mimeType: string,
  base64Data: string,
  promptText: string,
  isAudio = false
): Promise<string> {
  if (!process.env.GEMINI_API_KEY) {
    return isAudio
      ? '⚠️ Voice transcription requires GEMINI_API_KEY.'
      : '⚠️ Image analysis requires GEMINI_API_KEY.';
  }

  const ai = getAiClient();
  for (const model of MODEL_CANDIDATES) {
    try {
      const response = await ai.models.generateContent({
        model,
        contents: [
          {
            inlineData: {
              mimeType,
              data: base64Data,
            },
          },
          {
            text: promptText,
          },
        ],
      });
      if (response.text && response.text.trim()) {
        return response.text.trim();
      }
    } catch {
      // Try next
    }
  }
  return '⚠️ Media analysis could not be completed at this moment.';
}
