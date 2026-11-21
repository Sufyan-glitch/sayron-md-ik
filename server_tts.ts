import { GoogleGenAI } from '@google/genai';
import { execFile } from 'child_process';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { promisify } from 'util';

const execFileAsync = promisify(execFile);

export interface TtsSynthesisResult {
  buffer: Buffer;
  mimetype: string;
  ptt: boolean;
  engine: string;
  voice: string;
}

interface BingSessionCache {
  ig: string;
  iid: string;
  token: string;
  key: string;
  cookies: string;
  fetchedAt: number;
}

let bingSessionCache: BingSessionCache | null = null;
let cachedTtsAiClient: GoogleGenAI | null = null;

function getTtsAiClient(): GoogleGenAI | null {
  if (!process.env.GEMINI_API_KEY) return null;
  if (!cachedTtsAiClient) {
    cachedTtsAiClient = new GoogleGenAI({
      apiKey: process.env.GEMINI_API_KEY,
      httpOptions: {
        headers: {
          'User-Agent': 'aistudio-build',
        },
      },
    });
  }
  return cachedTtsAiClient;
}

function escapeXml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

const ROMAN_URDU_WORDS_RE =
  /\b(salam|assalam|asalam|aoa|walaikum|walikum|kya|kia|kaise|kesy|kese|kaisa|kaisi|hain|hai|h|ho|hoon|hun|nahi|nhi|na|kar|kr|kro|karo|karna|karni|karne|krna|krni|krne|krdo|kardo|rha|rhi|rahe|raha|rahi|bhai|yar|yaar|janab|shukriya|theek|thik|acha|achha|boht|bohat|bahut|bhot|mera|meri|mere|tera|teri|tere|aap|ap|apka|apki|apke|tum|tumhara|hum|hm|sab|sb|koch|kuch|kch|kidhar|kahan|kab|kyu|kyun|jaan|jaani|pyar|dil|zindagi|waqt|aaj|kal|abhi|phir|lekin|magar|agar|toh|bhi|mein|par|wala|wali|wale|dekh|dekho|sun|suno|bata|batao|bolo|jao|aao|dost|larki|ladki|larka|ladka|awaz|awaaz|samj|samajh|lagta|lagti|chahiye|chaiye|atee|aati|jata|jati|gaya|gayi|gai|hoga|hogi|allah|khuda|inshallah|mashallah|subhanallah|alhamdulillah|meherbani|zaroor|bilkul|pata|pta|matlab|baat|kaam|ghar|paani|khana|khairiyat|pagal|sona|gussa|naraz|khush|milte|sunao|likhna|likho|esa|aisa|jasa|jaisa|kisi|koii|koi|ane|anee|aane|wali|cheez)\b/i;

function normalizeRomanUrduForTranslit(input: string): string {
  return input
    .replace(/\bnhi\b/gi, 'nahi')
    .replace(/\bkch\b/gi, 'kuch')
    .replace(/\bkoch\b/gi, 'kuch')
    .replace(/\bsb\b/gi, 'sab')
    .replace(/\bhm\b/gi, 'hum')
    .replace(/\byr\b/gi, 'yaar')
    .replace(/\byar\b/gi, 'yaar')
    .replace(/\bap\b/gi, 'aap')
    .replace(/\bapka\b/gi, 'aapka')
    .replace(/\bapki\b/gi, 'aapki')
    .replace(/\bapke\b/gi, 'aapke')
    .replace(/\bkrdo\b/gi, 'kar do')
    .replace(/\bkardo\b/gi, 'kar do')
    .replace(/\bkrna\b/gi, 'karna')
    .replace(/\bkrni\b/gi, 'karni')
    .replace(/\bkrne\b/gi, 'karne')
    .replace(/\bkr\b/gi, 'kar')
    .replace(/\bkro\b/gi, 'karo')
    .replace(/\brha\b/gi, 'raha')
    .replace(/\brhi\b/gi, 'rahi')
    .replace(/\bboht\b/gi, 'bahut')
    .replace(/\bbhot\b/gi, 'bahut')
    .replace(/\bbohat\b/gi, 'bahut')
    .replace(/\bsamj\b/gi, 'samajh')
    .replace(/\batee\b/gi, 'aati')
    .replace(/\banee\b/gi, 'aani')
    .replace(/\baane\b/gi, 'aane')
    .replace(/\bchahiye\b/gi, 'chahiye')
    .replace(/\bchaiye\b/gi, 'chahiye')
    .replace(/\bkesy\b/gi, 'kaise')
    .replace(/\bkese\b/gi, 'kaise')
    .replace(/\bkyu\b/gi, 'kyun')
    .replace(/\bpta\b/gi, 'pata')
    .replace(/\bsy\b/gi, 'se')
    .replace(/\bha\b/gi, 'hai')
    .replace(/\bma\b/gi, 'mein')
    .replace(/\besa\b/gi, 'aisa')
    .replace(/\bjasa\b/gi, 'jaisa')
    .replace(/\blarki\b/gi, 'ladki')
    .replace(/\blarka\b/gi, 'ladka')
    .replace(/\bplz\b/gi, 'please')
    .replace(/\s+/g, ' ')
    .trim();
}

async function transliterateRomanUrduToUrdu(text: string): Promise<string> {
  const prepared = normalizeRomanUrduForTranslit(text);
  // Keep common English words that are cleaner if pronounced naturally as phonetic Urdu or split cleanly
  try {
    const url = `https://inputtools.google.com/request?text=${encodeURIComponent(prepared)}&itc=ur-t-i0-und&num=1&cp=0&cs=1&ie=utf-8&oe=utf-8`;
    const res = await fetch(url, { signal: AbortSignal.timeout(3500) });
    if (res.ok) {
      const json: any = await res.json();
      if (Array.isArray(json) && json[0] === 'SUCCESS' && Array.isArray(json[1])) {
        const converted = json[1]
          .map((item: any) => {
            const candidate = item?.[1]?.[0];
            return typeof candidate === 'string' && candidate.trim() ? candidate.trim() : String(item?.[0] || '');
          })
          .join(' ')
          .replace(/\s+/g, ' ')
          .trim();
        if (converted && /[\u0600-\u06FF]/.test(converted)) {
          return converted;
        }
      }
    }
  } catch {
    // ignore transliteration error
  }
  return prepared;
}

async function getBingSession(forceRefresh = false): Promise<BingSessionCache | null> {
  if (!forceRefresh && bingSessionCache && Date.now() - bingSessionCache.fetchedAt < 8 * 60 * 1000) {
    return bingSessionCache;
  }
  try {
    const page = await fetch('https://www.bing.com/translator', {
      headers: {
        'User-Agent':
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
        Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      },
      signal: AbortSignal.timeout(6000),
    });
    if (!page.ok) return null;
    const rawCookies = (page.headers as any).getSetCookie?.() as string[] | undefined;
    const cookies = Array.isArray(rawCookies)
      ? rawCookies.map((c) => c.split(';')[0]).join('; ')
      : '';
    const html = await page.text();
    const ig = html.match(/IG:"([^"]+)"/)?.[1] || '';
    const iid = html.match(/data-iid="([^"]+)"/)?.[1] || 'translator.5028';
    const params = html.match(/params_AbusePreventionHelper\s*=\s*\[(\d+),"([^"]+)",(\d+)\]/);
    if (!ig || !params) return null;
    bingSessionCache = {
      ig,
      iid,
      key: params[1],
      token: params[2],
      cookies,
      fetchedAt: Date.now(),
    };
    return bingSessionCache;
  } catch {
    return null;
  }
}

async function synthesizeWithBingNeural(
  text: string,
  xmlLang: string,
  voiceName: string,
  prosodyRate = '-3%',
  prosodyPitch = '+2%'
): Promise<Buffer | null> {
  const ssml = `<speak version="1.0" xml:lang="${xmlLang}"><voice xml:lang="${xmlLang}" xml:gender="Female" name="${voiceName}"><prosody rate="${prosodyRate}" pitch="${prosodyPitch}">${escapeXml(text)}</prosody></voice></speak>`;

  for (let attempt = 0; attempt < 2; attempt++) {
    const sess = await getBingSession(attempt === 1);
    if (!sess) continue;
    try {
      const res = await fetch(
        `https://www.bing.com/tfettts?isVertical=1&&IG=${encodeURIComponent(sess.ig)}&IID=${encodeURIComponent(sess.iid)}.1`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
            'User-Agent':
              'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
            Referer: 'https://www.bing.com/translator',
            Origin: 'https://www.bing.com',
            ...(sess.cookies ? { Cookie: sess.cookies } : {}),
          },
          body: new URLSearchParams({
            ssml,
            token: sess.token,
            key: sess.key,
          }).toString(),
          signal: AbortSignal.timeout(8000),
        }
      );
      if (res.ok) {
        const ct = (res.headers.get('content-type') || '').toLowerCase();
        const buf = Buffer.from(await res.arrayBuffer());
        if (buf.length > 400 && (ct.includes('audio') || ct.includes('mpeg') || buf[0] === 0xff || buf.subarray(0, 3).toString() === 'ID3')) {
          return buf;
        }
      }
      bingSessionCache = null;
    } catch {
      bingSessionCache = null;
    }
  }
  return null;
}

async function synthesizeWithGeminiTts(text: string): Promise<Buffer | null> {
  const ai = getTtsAiClient();
  if (!ai) return null;
  try {
    const response = await ai.models.generateContent({
      model: 'gemini-3.8-flash-lite-tts',
      contents: [
        {
          role: 'user',
          parts: [
            {
              text,
              speechMetadata: {
                style: 'Warm, gentle, natural young Pakistani woman speaking clearly and expressively',
              },
            },
          ],
        },
      ],
      config: {
        responseModalities: ['AUDIO'],
        speechConfig: {
          voiceConfig: {
            prebuiltVoiceConfig: { voiceName: 'Kore' },
          },
        },
      },
    });
    const base64Audio = response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
    if (base64Audio) {
      const wavBuf = Buffer.from(base64Audio, 'base64');
      if (wavBuf.length > 500) return wavBuf;
    }
  } catch {
    // fall back to neural Bing TTS
  }
  return null;
}

async function synthesizeWithTikTokFemale(text: string): Promise<Buffer | null> {
  try {
    const res = await fetch('https://tiktok-tts.weilnet.workers.dev/api/generation', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        text: text.slice(0, 280),
        voice: 'en_us_001',
      }),
      signal: AbortSignal.timeout(7000),
    });
    if (!res.ok) return null;
    const json: any = await res.json().catch(() => null);
    if (json?.success && typeof json?.data === 'string') {
      const buf = Buffer.from(json.data, 'base64');
      if (buf.length > 400) return buf;
    }
  } catch {
    // ignore
  }
  return null;
}

async function convertAudioBufferToWhatsAppPtt(
  inputBuf: Buffer,
  inputExt: 'mp3' | 'wav'
): Promise<{ buffer: Buffer; mimetype: string; ptt: boolean }> {
  const tmpId = `xik_tts_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
  const inFile = path.join(os.tmpdir(), `${tmpId}_in.${inputExt}`);
  const outFile = path.join(os.tmpdir(), `${tmpId}_out.ogg`);

  try {
    await fs.promises.writeFile(inFile, inputBuf);
    await execFileAsync('ffmpeg', [
      '-y',
      '-i',
      inFile,
      '-vn',
      '-c:a',
      'libopus',
      '-b:a',
      '64k',
      '-ar',
      '48000',
      '-ac',
      '1',
      '-application',
      'voip',
      outFile,
    ]);
    if (fs.existsSync(outFile)) {
      const converted = await fs.promises.readFile(outFile);
      if (converted.length > 200) {
        return {
          buffer: converted,
          mimetype: 'audio/ogg; codecs=opus',
          ptt: true,
        };
      }
    }
  } catch {
    // Fallback cleanly to native format
  } finally {
    fs.promises.unlink(inFile).catch(() => {});
    fs.promises.unlink(outFile).catch(() => {});
  }

  return {
    buffer: inputBuf,
    mimetype: inputExt === 'wav' ? 'audio/wav' : 'audio/mpeg',
    ptt: false,
  };
}

export async function synthesizeNaturalFemaleSpeech(
  rawInput: string
): Promise<TtsSynthesisResult | null> {
  // Optional language override: `.tts en <text>`, `.tts ur <text>`, `.tts hi <text>`, `.tts ar <text>`
  let forcedLang = '';
  let textToSpeak = rawInput.trim();
  const langMatch = /^(ur|urdu|en|eng|english|hi|hindi|ar|arabic|tr|es|fr)\s+([\s\S]+)$/i.exec(
    textToSpeak
  );
  if (langMatch) {
    forcedLang = langMatch[1].toLowerCase();
    textToSpeak = langMatch[2].trim();
  }

  // Strip decorative borders, bot headers, footers, and emojis so voice reads clean speech
  let cleanText = textToSpeak
    .replace(/^[─━═\-_\[\]\(\)\{\}\s|•❖*#]+/gm, '')
    .replace(/[─━═\-_\[\]\(\)\{\}\s|•❖*#]+$/gm, '')
    .replace(/SUFYAN-X-IK(\s+MD)?/gi, '')
    .replace(/X-IK\s+AI(\s+OFFICIAL)?/gi, '')
    .replace(/[─━═|•❖*#~_`]/g, ' ')
    .replace(
      /[\u{1F600}-\u{1F64F}\u{1F300}-\u{1F5FF}\u{1F680}-\u{1F6FF}\u{1F1E0}-\u{1F1FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}\u{1F900}-\u{1F9FF}\u{1F018}-\u{1F270}\u{2388}\u{200D}\u{FE0F}]/gu,
      ''
    )
    .replace(/\s+/g, ' ')
    .trim();

  if (!cleanText) cleanText = textToSpeak.slice(0, 350);
  if (!cleanText) return null;
  const boundedText = cleanText.slice(0, 450);

  const hasUrduScript = /[\u0600-\u06FF]/.test(boundedText);
  const hasHindiScript = /[\u0900-\u097F]/.test(boundedText);
  const romanUrduMatches = boundedText.match(new RegExp(ROMAN_URDU_WORDS_RE.source, 'gi')) || [];
  const isRomanUrdu =
    forcedLang === 'ur' ||
    forcedLang === 'urdu' ||
    (!hasUrduScript &&
      !hasHindiScript &&
      forcedLang !== 'en' &&
      forcedLang !== 'eng' &&
      forcedLang !== 'english' &&
      romanUrduMatches.length >= 1);

  let speechText = boundedText;
  let xmlLang = 'en-US';
  let primaryVoice = 'en-US-AvaMultilingualNeural';
  let secondaryVoice = 'en-US-JennyNeural';
  let fallbackTranslateLang = 'en';

  if (forcedLang === 'ar' || forcedLang === 'arabic') {
    xmlLang = 'ar-SA';
    primaryVoice = 'ar-SA-ZariyahNeural';
    secondaryVoice = 'ar-EG-SalmaNeural';
    fallbackTranslateLang = 'ar';
  } else if (forcedLang === 'hi' || forcedLang === 'hindi' || hasHindiScript) {
    xmlLang = 'hi-IN';
    primaryVoice = 'hi-IN-SwaraNeural';
    secondaryVoice = 'en-IN-NeerjaNeural';
    fallbackTranslateLang = 'hi';
  } else if (forcedLang === 'tr') {
    xmlLang = 'tr-TR';
    primaryVoice = 'tr-TR-EmelNeural';
    secondaryVoice = 'en-US-AvaMultilingualNeural';
    fallbackTranslateLang = 'tr';
  } else if (forcedLang === 'es') {
    xmlLang = 'es-ES';
    primaryVoice = 'es-ES-ElviraNeural';
    secondaryVoice = 'en-US-AvaMultilingualNeural';
    fallbackTranslateLang = 'es';
  } else if (forcedLang === 'fr') {
    xmlLang = 'fr-FR';
    primaryVoice = 'fr-FR-DeniseNeural';
    secondaryVoice = 'en-US-AvaMultilingualNeural';
    fallbackTranslateLang = 'fr';
  } else if (hasUrduScript || isRomanUrdu) {
    xmlLang = 'ur-PK';
    primaryVoice = 'ur-PK-UzmaNeural';
    secondaryVoice = 'hi-IN-SwaraNeural';
    fallbackTranslateLang = 'ur';
    if (!hasUrduScript) {
      speechText = await transliterateRomanUrduToUrdu(boundedText);
    }
  }

  // Tier 1: Gemini 3.8 Flash Lite TTS (Kore - Natural Female) when GEMINI_API_KEY is available
  const geminiWav = await synthesizeWithGeminiTts(speechText);
  if (geminiWav) {
    const encoded = await convertAudioBufferToWhatsAppPtt(geminiWav, 'wav');
    return {
      ...encoded,
      engine: 'gemini-3.8-flash-lite-tts',
      voice: 'Kore',
    };
  }

  // Tier 2: Microsoft Neural Female Voices (Uzma / AvaMultilingual / Swara / Jenny)
  let neuralMp3 = await synthesizeWithBingNeural(speechText, xmlLang, primaryVoice, '-3%', '+2%');
  let usedVoice = primaryVoice;

  if (!neuralMp3 && secondaryVoice !== primaryVoice) {
    const secLang = secondaryVoice.split('-').slice(0, 2).join('-');
    const secText = secondaryVoice === 'hi-IN-SwaraNeural' && !hasHindiScript ? boundedText : speechText;
    neuralMp3 = await synthesizeWithBingNeural(secText, secLang, secondaryVoice, '-2%', '+2%');
    usedVoice = secondaryVoice;
  }

  if (neuralMp3) {
    const encoded = await convertAudioBufferToWhatsAppPtt(neuralMp3, 'mp3');
    return {
      ...encoded,
      engine: 'neural-female',
      voice: usedVoice,
    };
  }

  // Tier 3: TikTok Natural Female Voice for Latin text
  if (!hasUrduScript && !hasHindiScript) {
    const ttMp3 = await synthesizeWithTikTokFemale(boundedText);
    if (ttMp3) {
      const encoded = await convertAudioBufferToWhatsAppPtt(ttMp3, 'mp3');
      return {
        ...encoded,
        engine: 'tiktok-female',
        voice: 'en_us_001',
      };
    }
  }

  // Tier 4: Last-resort fallback (Google Translate TTS)
  try {
    const ttsUrl = `https://translate.google.com/translate_tts?ie=UTF-8&client=tw-ob&tl=${fallbackTranslateLang}&q=${encodeURIComponent(
      speechText.slice(0, 200)
    )}`;
    const ttsRes = await fetch(ttsUrl, {
      headers: {
        'User-Agent':
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
      },
      signal: AbortSignal.timeout(7000),
    });
    if (ttsRes.ok) {
      const ttsBuf = Buffer.from(await ttsRes.arrayBuffer());
      if (ttsBuf.length > 300) {
        const encoded = await convertAudioBufferToWhatsAppPtt(ttsBuf, 'mp3');
        return {
          ...encoded,
          engine: 'translate-fallback',
          voice: fallbackTranslateLang,
        };
      }
    }
  } catch {
    // ignore
  }

  return null;
}
