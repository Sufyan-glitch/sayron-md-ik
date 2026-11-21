export type LogLevel = 'INFO' | 'ACTION' | 'HANDOVER' | 'ERROR' | 'WHATSAPP' | 'SECURITY';

export interface ProductItem {
  id: string;
  name: string;
  description: string;
  price: string;
  features: string[];
  availability: 'Available' | 'Limited' | 'Out of Stock';
  paymentMethods: string;
  deliveryMethod: string;
  supportInfo: string;
  category: string;
}

export interface FaqItem {
  id: string;
  question: string;
  answer: string;
}

export interface BusinessKnowledge {
  businessName: string;
  ownerName: string;
  ownerRole: string;
  ownerBio: string;
  ownerStatus: 'Available' | 'Busy' | 'Offline';
  contactNumbers: string;
  workingHours: string;
  supportedLanguages: string[];
  toneOfVoice: string;
  customInstructions: string;
  products: ProductItem[];
  faqs: FaqItem[];
}

export interface GeneratedFileAttachment {
  filename: string;
  language: string;
  content: string;
  description?: string;
}

export interface ChatMessage {
  id: string;
  sender: 'customer' | 'ai' | 'owner';
  senderName: string;
  text: string;
  timestamp: string;
  files?: GeneratedFileAttachment[];
}

export interface Conversation {
  id: string;
  jid: string;
  customerName: string;
  phoneNumber: string;
  isGroup: boolean;
  aiPaused: boolean;
  needsOwnerAttention: boolean;
  handoverReason?: string;
  detectedLanguage: string;
  topicContext: string;
  lastUpdated: string;
  messages: ChatMessage[];
}

export interface LogEntry {
  id: string;
  timestamp: string;
  level: LogLevel;
  event: string;
  details: string;
}

export interface WhatsAppConnectionState {
  status: 'disconnected' | 'connecting' | 'qr_ready' | 'pairing_code_ready' | 'connected';
  qrDataUrl: string | null;
  pairingCode: string | null;
  connectedPhone: string | null;
  connectedName: string | null;
  lastUpdated: string;
  autoReconnect: boolean;
  errorMessage: string | null;
  sessionId?: string;
  serverId?: string;
  serverName?: string;
  paused?: boolean;
}

export interface SessionSummary {
  sessionId: string;
  connectedPhone: string;
  connectedName: string;
  status: 'disconnected' | 'connecting' | 'qr_ready' | 'pairing_code_ready' | 'connected';
  paused: boolean;
  serverId: string;
  serverName: string;
  serverRegion: string;
  messagesProcessed: number;
  uptimeSeconds: number;
  lastUpdated: string;
  alwaysOnlineCloud: boolean;
}

export interface ServerNodeSummary {
  id: string;
  index: number;
  name: string;
  region: string;
  status: 'online' | 'busy';
  activeSessionsCount: number;
  pausedSessionsCount: number;
  totalMessagesHandled: number;
  loadPercent: number;
  pingMs: number;
}

export interface AdminSessionInfo extends SessionSummary {
  pairedOwnerNumber: string | null;
  pairedOwnerLid: string | null;
  isSocketOpen: boolean;
  hasRegisteredCreds: boolean;
  linkedClientsCount: number;
  errorMessage: string | null;
}


