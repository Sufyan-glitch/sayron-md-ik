import fs from 'fs';
import path from 'path';

/**
 * Synchronously patches @whiskeysockets/baileys on disk BEFORE Node.js ESM loader
 * imports @whiskeysockets/baileys. This guarantees that even after `npm install`,
 * `npm run build`, or container cold-boots, Baileys never buffers messages, never
 * duplicates participant JIDs from userDevicesCache (which causes "Waiting for this message"
 * on message #2+), resolves @lid via USyncLIDProtocol, sets type="media" on media stanzas,
 * and always handles @lid Self-Chat and retry receipts accurately.
 */
export function applyBaileysPatchesSync() {
  try {
    const baileysRoot = path.resolve(
      process.cwd(),
      'node_modules',
      '@whiskeysockets',
      'baileys',
      'lib'
    );
    if (!fs.existsSync(baileysRoot)) return;

    // 00. Patch libsignal/src/session_cipher.js: Suppress noisy console.error when decryption fails or retries
    const sessionCipherPath = path.resolve(
      process.cwd(),
      'node_modules',
      'libsignal',
      'src',
      'session_cipher.js'
    );
    if (fs.existsSync(sessionCipherPath)) {
      let scSrc = fs.readFileSync(sessionCipherPath, 'utf-8');
      if (scSrc.includes('console.error("Failed to decrypt message with any known session...");')) {
        scSrc = scSrc.replace(
          'console.error("Failed to decrypt message with any known session...");',
          '// suppressed noisy libsignal console.error on session mismatch'
        );
        scSrc = scSrc.replace(
          /for\s*\(const e of errs\)\s*\{\s*console\.error\("Session error:" \+ e, e\.stack\);\s*\}/,
          '// suppressed noisy libsignal console.error on session mismatch'
        );
        fs.writeFileSync(sessionCipherPath, scSrc, 'utf-8');
      }
    }

    // 0. Patch WABinary/jid-utils.js: Fix areJidsSameUser(undefined, undefined) returning true
    const jidUtilsPath = path.join(baileysRoot, 'WABinary', 'jid-utils.js');
    if (fs.existsSync(jidUtilsPath)) {
      let src = fs.readFileSync(jidUtilsPath, 'utf-8');
      if (!src.includes('isJidBroadcast') || src.includes('jidDecode(jid1)?.user === jidDecode(jid2)?.user;')) {
        const fullJidUtils = `export const S_WHATSAPP_NET = '@s.whatsapp.net';
export const OFFICIAL_BIZ_JID = '16505361212@c.us';
export const SERVER_JID = 'server@c.us';
export const PSA_WID = '0@c.us';
export const STORIES_JID = 'status@broadcast';
export const META_AI_JID = '13135550002@c.us';
export const jidEncode = (user, server, device, agent) => {
    return \`\${user || ''}\${!!agent ? \`_\${agent}\` : ''}\${!!device ? \`:\${device}\` : ''}@\${server}\`;
};
export const jidDecode = (jid) => {
    const sepIdx = typeof jid === 'string' ? jid.indexOf('@') : -1;
    if (sepIdx < 0) {
        return undefined;
    }
    const server = jid.slice(sepIdx + 1);
    const userCombined = jid.slice(0, sepIdx);
    const [userAgent, device] = userCombined.split(':');
    const user = userAgent.split('_')[0];
    return {
        server: server,
        user,
        domainType: server === 'lid' ? 1 : 0,
        device: device ? +device : undefined
    };
};
/** is the jid a user */
export const areJidsSameUser = (jid1, jid2) => {
    const u1 = jidDecode(jid1)?.user;
    const u2 = jidDecode(jid2)?.user;
    return Boolean(u1 && u2 && u1 === u2);
};
/** is the jid Meta IA */
export const isJidMetaIa = (jid) => jid?.endsWith('@c.us');
/** is the jid a user */
export const isJidUser = (jid) => jid?.endsWith('@s.whatsapp.net');
/** is the jid a lid */
export const isLidUser = (jid) => jid?.endsWith('@lid');
/** is the jid a broadcast */
export const isJidBroadcast = (jid) => jid?.endsWith('@broadcast');
/** is the jid a group */
export const isJidGroup = (jid) => jid?.endsWith('@g.us');
/** is the jid the status broadcast */
export const isJidStatusBroadcast = (jid) => jid === 'status@broadcast';
/** is the jid a newsletter */
export const isJidNewsletter = (jid) => jid?.endsWith('@newsletter');
export const isJidBot = (jid) => jid && !isNaN(jid.split('@')[0]) && jid.endsWith('@bot');
export const jidNormalizedUser = (jid) => {
    const result = jidDecode(jid);
    if (!result) {
        return '';
    }
    const { user, server } = result;
    return jidEncode(user, server === 'c.us' ? 's.whatsapp.net' : server);
};
//# sourceMappingURL=jid-utils.js.map
`;
        fs.writeFileSync(jidUtilsPath, fullJidUtils, 'utf-8');
      }
    }

    // 0b. Patch Signal/libsignal.js: Ensure clean standard Signal session per JID (never merge @lid and @s.whatsapp.net ratchets)
    const libsignalPath = path.join(baileysRoot, 'Signal', 'libsignal.js');
    if (fs.existsSync(libsignalPath)) {
      const cleanLibsignal = `/* @ts-ignore */
import * as libsignal from 'libsignal';
import { generateSignalPubKey } from '../Utils/index.js';
import { jidDecode } from '../WABinary/index.js';
import { SenderKeyName } from './Group/sender-key-name.js';
import { SenderKeyRecord } from './Group/sender-key-record.js';
import { GroupCipher, GroupSessionBuilder, SenderKeyDistributionMessage } from './Group/index.js';

if (!globalThis.__waLidToPnUser) globalThis.__waLidToPnUser = new Map();
if (!globalThis.__waPnToLidUser) globalThis.__waPnToLidUser = new Map();
globalThis.__waRegisterLidPn = (lidVal, pnVal) => {
    const lidU = typeof lidVal === 'string' ? lidVal.split(':')[0].split('@')[0].replace(/[^0-9]/g, '') : '';
    const pnU = typeof pnVal === 'string' ? pnVal.split(':')[0].split('@')[0].replace(/[^0-9]/g, '') : '';
    if (lidU && pnU && lidU !== pnU) {
        const prevPn = globalThis.__waLidToPnUser.get(lidU);
        globalThis.__waLidToPnUser.set(lidU, pnU);
        globalThis.__waPnToLidUser.set(pnU, lidU);
        if (prevPn !== pnU) {
            try { globalThis.__waOnLidPnRegistered?.(lidU, pnU); } catch {}
        }
    }
};

export function makeLibSignalRepository(auth) {
    if (auth?.creds?.me?.lid && auth?.creds?.me?.id) {
        globalThis.__waRegisterLidPn(auth.creds.me.lid, auth.creds.me.id);
    }
    const storage = signalStorage(auth);
    return {
        decryptGroupMessage({ group, authorJid, msg }) {
            const senderName = jidToSignalSenderKeyName(group, authorJid);
            const cipher = new GroupCipher(storage, senderName);
            return cipher.decrypt(msg);
        },
        async processSenderKeyDistributionMessage({ item, authorJid }) {
            const builder = new GroupSessionBuilder(storage);
            if (!item.groupId) {
                throw new Error('Group ID is required for sender key distribution message');
            }
            const senderName = jidToSignalSenderKeyName(item.groupId, authorJid);
            const senderMsg = new SenderKeyDistributionMessage(null, null, null, null, item.axolotlSenderKeyDistributionMessage);
            const senderNameStr = senderName.toString();
            const { [senderNameStr]: senderKey } = await auth.keys.get('sender-key', [senderNameStr]);
            if (!senderKey) {
                await storage.storeSenderKey(senderName, new SenderKeyRecord());
            }
            await builder.process(senderName, senderMsg);
        },
        async decryptMessage({ jid, type, ciphertext }) {
            const addrsToTry = [jidToSignalProtocolAddress(jid)];
            const { user, device } = jidDecode(jid) || {};
            if (user) {
                const altUser = globalThis.__waLidToPnUser?.get(user) || globalThis.__waPnToLidUser?.get(user);
                if (altUser && altUser !== user) {
                    addrsToTry.push(new libsignal.ProtocolAddress(altUser, device || 0));
                }
            }

            let lastErr;
            const failedMacAddrs = [];
            for (const addr of addrsToTry) {
                try {
                    const session = new libsignal.SessionCipher(storage, addr);
                    if (type === 'pkmsg') {
                        return await session.decryptPreKeyWhisperMessage(ciphertext);
                    } else if (type === 'msg') {
                        return await session.decryptWhisperMessage(ciphertext);
                    } else {
                        throw new Error(\`Unknown message type: \${type}\`);
                    }
                } catch (err) {
                    lastErr = err;
                    const s = String(err?.message || err);
                    if (s.includes('Bad MAC') || s.includes('SessionError')) {
                        failedMacAddrs.push(addr);
                    }
                }
            }
            if (failedMacAddrs.length > 0) {
                for (const addr of failedMacAddrs) {
                    try {
                        await auth.keys.set({ session: { [addr.toString()]: null } });
                    } catch {}
                }
            }
            throw lastErr;
        },
        async encryptMessage({ jid, data }) {
            const addr = jidToSignalProtocolAddress(jid);
            const cipher = new libsignal.SessionCipher(storage, addr);
            const { type: sigType, body } = await cipher.encrypt(data);
            const type = sigType === 3 ? 'pkmsg' : 'msg';
            return { type, ciphertext: Buffer.from(body, 'binary') };
        },
        async encryptGroupMessage({ group, meId, data }) {
            const senderName = jidToSignalSenderKeyName(group, meId);
            const builder = new GroupSessionBuilder(storage);
            const senderNameStr = senderName.toString();
            const { [senderNameStr]: senderKey } = await auth.keys.get('sender-key', [senderNameStr]);
            if (!senderKey) {
                await storage.storeSenderKey(senderName, new SenderKeyRecord());
            }
            const senderKeyDistributionMessage = await builder.create(senderName);
            const session = new GroupCipher(storage, senderName);
            const ciphertext = await session.encrypt(data);
            return {
                ciphertext,
                senderKeyDistributionMessage: senderKeyDistributionMessage.serialize()
            };
        },
        async injectE2ESession({ jid, session }) {
            const cipher = new libsignal.SessionBuilder(storage, jidToSignalProtocolAddress(jid));
            await cipher.initOutgoing(session);
        },
        jidToSignalProtocolAddress(jid) {
            return jidToSignalProtocolAddress(jid).toString();
        }
    };
}
const jidToSignalProtocolAddress = (jid) => {
    const { user, device } = jidDecode(jid);
    return new libsignal.ProtocolAddress(user, device || 0);
};
const jidToSignalSenderKeyName = (group, user) => {
    return new SenderKeyName(group, jidToSignalProtocolAddress(user));
};
function signalStorage({ creds, keys }) {
    return {
        loadSession: async (id) => {
            const { [id]: sess } = await keys.get('session', [id]);
            if (sess) {
                return libsignal.SessionRecord.deserialize(sess);
            }
        },
        storeSession: async (id, session) => {
            await keys.set({ session: { [id]: session.serialize() } });
        },
        isTrustedIdentity: () => {
            return true;
        },
        loadPreKey: async (id) => {
            const keyId = id.toString();
            const { [keyId]: key } = await keys.get('pre-key', [keyId]);
            if (key) {
                return {
                    privKey: Buffer.from(key.private),
                    pubKey: Buffer.from(key.public)
                };
            }
        },
        removePreKey: (id) => keys.set({ 'pre-key': { [id]: null } }),
        loadSignedPreKey: () => {
            const key = creds.signedPreKey;
            return {
                privKey: Buffer.from(key.keyPair.private),
                pubKey: Buffer.from(key.keyPair.public)
            };
        },
        loadSenderKey: async (senderKeyName) => {
            const keyId = senderKeyName.toString();
            const { [keyId]: key } = await keys.get('sender-key', [keyId]);
            if (key) {
                return SenderKeyRecord.deserialize(key);
            }
            return new SenderKeyRecord();
        },
        storeSenderKey: async (senderKeyName, key) => {
            const keyId = senderKeyName.toString();
            const serialized = JSON.stringify(key.serialize());
            await keys.set({ 'sender-key': { [keyId]: Buffer.from(serialized, 'utf-8') } });
        },
        getOurRegistrationId: () => creds.registrationId,
        getOurIdentity: () => {
            const { signedIdentityKey } = creds;
            return {
                privKey: Buffer.from(signedIdentityKey.private),
                pubKey: generateSignalPubKey(signedIdentityKey.public)
            };
        }
    };
}
`;
      fs.writeFileSync(libsignalPath, cleanLibsignal, 'utf-8');
    }

    // 0c. Patch Utils/auth-utils.js: Make addTransactionCapability pass through directly to
    // makeCacheableSignalKeyStore so concurrent upsertMessage / relayMessage transactions never
    // delay, swallow, or roll back Signal session mutations!
    const authUtilsPath = path.join(baileysRoot, 'Utils', 'auth-utils.js');
    if (fs.existsSync(authUtilsPath)) {
      let src = fs.readFileSync(authUtilsPath, 'utf-8');
      let authUtilsChanged = false;
      const txRegex = /export const addTransactionCapability = [\s\S]*?function isInTransaction\(\) \{[\s\S]*?\}\n\};/;
      const safeTx = `export const addTransactionCapability = (state) => {
    return {
        get: async (type, ids) => state.get(type, ids),
        set: async (data) => state.set(data),
        isInTransaction: () => false,
        async transaction(work) {
            return await work();
        }
    };
};`;
      if (txRegex.test(src)) {
        src = src.replace(txRegex, safeTx);
        authUtilsChanged = true;
      }
      // Never cache null/undefined deletions in NodeCache — delete key so fresh sessions reload cleanly
      const nestedCacheRegex = /if\s*\(data\[type\]\[id\] === null \|\| data\[type\]\[id\] === undefined\)\s*\{\s*cache\.del\(getUniqueId\(type, id\)\);\s*\}\s*else\s*\{[\s\S]*?cache\.set\(getUniqueId\(type, id\), data\[type\]\[id\]\);(?:\s*\})+/;
      const cleanCacheBlock = `if (data[type][id] === null || data[type][id] === undefined) {
                        cache.del(getUniqueId(type, id));
                    } else {
                        cache.set(getUniqueId(type, id), data[type][id]);
                    }`;
      if (src.includes('if (data[type][id] === null || data[type][id] === undefined)') && (src.match(/cache\.del\(getUniqueId\(type, id\)\)/g) || []).length > 1) {
        src = src.replace(nestedCacheRegex, cleanCacheBlock);
        authUtilsChanged = true;
      } else {
        const oldCacheSet = `                    cache.set(getUniqueId(type, id), data[type][id]);`;
        const newCacheSet = `                    ${cleanCacheBlock}`;
        if (src.includes(oldCacheSet) && !src.includes('cache.del(getUniqueId(type, id))')) {
          src = src.replace(oldCacheSet, newCacheSet);
          authUtilsChanged = true;
        }
      }
      if (authUtilsChanged) {
        fs.writeFileSync(authUtilsPath, src, 'utf-8');
      }
    }

    // 0c-2. Patch Utils/make-mutex.js: Enforce 20s timeout per mutex task so a single hung IQ/decrypt/sync NEVER permanently freezes processingMutex
    const mutexPath = path.join(baileysRoot, 'Utils', 'make-mutex.js');
    if (fs.existsSync(mutexPath)) {
      const mSrc = fs.readFileSync(mutexPath, 'utf-8');
      if (!mSrc.includes('Mutex task timeout')) {
        const safeMutex = `export const makeMutex = () => {
    let task = Promise.resolve();
    return {
        mutex(code) {
            const prevTask = task;
            const current = (async () => {
                try {
                    await prevTask;
                }
                catch { }
                let taskTimeout;
                try {
                    return await Promise.race([
                        Promise.resolve().then(() => code()),
                        new Promise((_, reject) => {
                            taskTimeout = setTimeout(() => reject(new Error('Mutex task timeout')), 20000);
                        })
                    ]);
                }
                finally {
                    clearTimeout(taskTimeout);
                }
            })();
            task = current.catch(() => { });
            return current;
        }
    };
};
export const makeKeyedMutex = () => {
    const map = {};
    return {
        mutex(key, task) {
            if (!map[key]) {
                map[key] = makeMutex();
            }
            return map[key].mutex(task);
        }
    };
};
//# sourceMappingURL=make-mutex.js.map
`;
        fs.writeFileSync(mutexPath, safeMutex, 'utf-8');
      }
    }

    // 0c-3. Patch Socket/Client/websocket.js: Safely force-terminate hung TCP sockets & expose terminate()
    const wsClientPath = path.join(baileysRoot, 'Socket', 'Client', 'websocket.js');
    if (fs.existsSync(wsClientPath)) {
      let wsSrc = fs.readFileSync(wsClientPath, 'utf-8');
      const oldWsClose = `    async close() {
        if (!this.socket) {
            return;
        }
        this.socket.close();
        this.socket = null;
    }`;
      const newWsClose = `    async close() {
        if (!this.socket) {
            return;
        }
        const sock = this.socket;
        this.socket = null;
        try {
            sock.close();
        }
        catch { }
        try {
            if (sock.readyState !== WebSocket.CLOSED) {
                setTimeout(() => {
                    try {
                        if (sock.readyState !== WebSocket.CLOSED) {
                            sock.terminate?.();
                        }
                    }
                    catch { }
                }, 300).unref?.();
            }
        }
        catch { }
    }
    terminate() {
        if (!this.socket) {
            return;
        }
        const sock = this.socket;
        this.socket = null;
        try {
            sock.terminate?.();
        }
        catch {
            try {
                sock.close();
            }
            catch { }
        }
    }`;
      if (wsSrc.includes(oldWsClose)) {
        wsSrc = wsSrc.replace(oldWsClose, newWsClose);
        fs.writeFileSync(wsClientPath, wsSrc, 'utf-8');
      }
    }

    // 0d. Patch Utils/validate-connection.js: Capture deviceNode.attrs.lid on initial pairing
    const valConnPath = path.join(baileysRoot, 'Utils', 'validate-connection.js');
    if (fs.existsSync(valConnPath)) {
      let src = fs.readFileSync(valConnPath, 'utf-8');
      if (src.includes('me: { id: jid, name: bizName },')) {
        src = src.replace(
          'me: { id: jid, name: bizName },',
          'me: { id: jid, name: bizName, ...(deviceNode.attrs.lid ? { lid: deviceNode.attrs.lid } : {}) },'
        );
        fs.writeFileSync(valConnPath, src, 'utf-8');
      }
    }

    // 0e. Patch Utils/signal.js: Exclude this bot's own device for both PN and LID in extractDeviceJids
    const utilSignalPath = path.join(baileysRoot, 'Utils', 'signal.js');
    if (fs.existsSync(utilSignalPath)) {
      let src = fs.readFileSync(utilSignalPath, 'utf-8');
      let sigChanged = false;
      if (src.includes('(!areJidsSameUser(id, myJid) || myDevice !== device)')) {
        src = src.replace(
          '(!areJidsSameUser(id, myJid) || myDevice !== device)',
          '(myUser !== user || myDevice !== device)'
        );
        sigChanged = true;
      }
      const oldExtract = `export const extractDeviceJids = (result, myJid, excludeZeroDevices) => {
    const { user: myUser, device: myDevice } = jidDecode(myJid);
    const extracted = [];
    for (const userResult of result) {
        const { devices, id } = userResult;
        const { user } = jidDecode(id);
        const deviceList = devices?.deviceList;
        if (Array.isArray(deviceList)) {
            for (const { id: device, keyIndex } of deviceList) {
                if ((!excludeZeroDevices || device !== 0) && // if zero devices are not-excluded, or device is non zero
                    (myUser !== user || myDevice !== device) && // either different user or if me user, not this device
                    (device === 0 || !!keyIndex) // ensure that "key-index" is specified for "non-zero" devices, produces a bad req otherwise
                ) {
                    extracted.push({ user, device });
                }
            }
        }
    }
    return extracted;
};`;
      const newExtract = `export const extractDeviceJids = (result, myJid, excludeZeroDevices) => {
    const { user: myUser, device: myDevice } = jidDecode(myJid);
    const myLidUser = globalThis.__waPnToLidUser?.get(myUser) || globalThis.__waLidToPnUser?.get(myUser);
    const extracted = [];
    for (const userResult of result) {
        const { devices, id } = userResult;
        const { user, server } = jidDecode(id) || {};
        if (!user) continue;
        const isMeUser = user === myUser || Boolean(myLidUser && user === myLidUser);
        const deviceList = devices?.deviceList;
        if (Array.isArray(deviceList)) {
            for (const { id: device, keyIndex } of deviceList) {
                if ((!excludeZeroDevices || device !== 0) && // if zero devices are not-excluded, or device is non zero
                    (!isMeUser || myDevice !== device) && // exclude this bot's own device for both PN and LID
                    (device === 0 || !!keyIndex) // ensure that "key-index" is specified for "non-zero" devices, produces a bad req otherwise
                ) {
                    extracted.push({ user, device, server });
                }
            }
        }
    }
    return extracted;
};`;
      const extractRegex = /export const extractDeviceJids = [\s\S]*?return extracted;\n\};/;
      if (extractRegex.test(src) && !src.includes('extracted.push({ user, device, server })')) {
        src = src.replace(extractRegex, newExtract);
        sigChanged = true;
      }
      // Do not fail entire E2E prekey batch in IB DM if one companion/meLid device returns an <error> node
      const oldAssertLoop = `    const nodes = getBinaryNodeChildren(getBinaryNodeChild(node, 'list'), 'user');
    for (const node of nodes) {
        assertNodeErrorFree(node);
    }`;
      const newAssertLoop = `    const rawNodes = getBinaryNodeChildren(getBinaryNodeChild(node, 'list'), 'user');
    const nodes = rawNodes.filter(uNode => {
        try {
            assertNodeErrorFree(uNode);
            return Boolean(getBinaryNodeChild(uNode, 'skey') && getBinaryNodeChildBuffer(uNode, 'identity'));
        } catch {
            return false;
        }
    });`;
      if (src.includes(oldAssertLoop)) {
        src = src.replace(oldAssertLoop, newAssertLoop);
        sigChanged = true;
      }
      if (sigChanged) {
        fs.writeFileSync(utilSignalPath, src, 'utf-8');
      }
    }

    // 0e-2. Patch WAUSync/Protocols/USyncDeviceProtocol.js: Gracefully return empty device list on <devices><error/></devices>
    const usyncDevPath = path.join(baileysRoot, 'WAUSync', 'Protocols', 'USyncDeviceProtocol.js');
    if (fs.existsSync(usyncDevPath)) {
      let src = fs.readFileSync(usyncDevPath, 'utf-8');
      if (src.includes('        if (node.tag === \'devices\') {\n            assertNodeErrorFree(node);')) {
        src = src.replace(
          '        if (node.tag === \'devices\') {\n            assertNodeErrorFree(node);',
          '        if (node.tag === \'devices\') {\n            try { assertNodeErrorFree(node); } catch { return { deviceList: [], keyIndex: undefined }; }'
        );
        fs.writeFileSync(usyncDevPath, src, 'utf-8');
      }
    }

    // 0f. Patch Socket/socket.js: Prevent CB:success from wiping me.lid when node.attrs.lid is undefined
    // and clear qrTimer when requestPairingCode is called so QR refs timeout never kills 8-digit pairing!
    const sockPath = path.join(baileysRoot, 'Socket', 'socket.js');
    if (fs.existsSync(sockPath)) {
      let src = fs.readFileSync(sockPath, 'utf-8');
      let sockChanged = false;
      const oldReqPair = `    const requestPairingCode = async (phoneNumber, customPairingCode) => {`;
      const newReqPair = `    const requestPairingCode = async (phoneNumber, customPairingCode) => {
        clearTimeout(qrTimer);`;
      if (src.includes(oldReqPair) && !src.includes('const requestPairingCode = async (phoneNumber, customPairingCode) => {\n        clearTimeout(qrTimer);')) {
        src = src.replace(oldReqPair, newReqPair);
        sockChanged = true;
      }
      const oldSendPairingIq = `        await sendNode({
            tag: 'iq',
            attrs: {
                to: S_WHATSAPP_NET,
                type: 'set',
                id: generateMessageTag(),
                xmlns: 'md'
            },
            content: [
                {
                    tag: 'link_code_companion_reg',`;
      const newQueryPairingIq = `        await query({
            tag: 'iq',
            attrs: {
                to: S_WHATSAPP_NET,
                type: 'set',
                id: generateMessageTag(),
                xmlns: 'md'
            },
            content: [
                {
                    tag: 'link_code_companion_reg',`;
      if (src.includes(oldSendPairingIq)) {
        src = src.replace(oldSendPairingIq, newQueryPairingIq);
        sockChanged = true;
      }
      const oldGenPairQr = `        const genPairQR = () => {
            if (!ws.isOpen) {
                return;
            }`;
      const newGenPairQr = `        const genPairQR = () => {
            if (!ws.isOpen || authState.creds.pairingCode) {
                return;
            }`;
      if (src.includes(oldGenPairQr)) {
        src = src.replace(oldGenPairQr, newGenPairQr);
        sockChanged = true;
      }
      const oldPairSuccess = `            const { reply, creds: updatedCreds } = configureSuccessfulPairing(stanza, creds);`;
      const newPairSuccess = `            const { reply, creds: updatedCreds } = configureSuccessfulPairing(stanza, creds);
            authState.creds.registered = true;
            updatedCreds.registered = true;`;
      if (src.includes(oldPairSuccess) && !src.includes('updatedCreds.registered = true;')) {
        src = src.replace(oldPairSuccess, newPairSuccess);
        sockChanged = true;
      }
      const oldCbSuccess = `    ws.on('CB:success', async (node) => {
        await uploadPreKeysToServerIfRequired();
        await sendPassiveIq('active');
        logger.info('opened connection to WA');
        clearTimeout(qrTimer); // will never happen in all likelyhood -- but just in case WA sends success on first try
        ev.emit('creds.update', { me: { ...authState.creds.me, lid: node.attrs.lid } });
        ev.emit('connection.update', { connection: 'open' });
    });`;
      const newCbSuccess = `    ws.on('CB:success', async (node) => {
        await uploadPreKeysToServerIfRequired().catch(err => logger.warn({ err }, 'failed prekey check on open'));
        await sendPassiveIq('active').catch(err => logger.warn({ err }, 'failed passive iq on open'));
        logger.info('opened connection to WA');
        clearTimeout(qrTimer);
        const nextMe = { ...authState.creds.me, ...(node?.attrs?.lid ? { lid: node.attrs.lid } : {}) };
        if (nextMe.id && nextMe.lid) {
            globalThis.__waRegisterLidPn?.(nextMe.lid, nextMe.id);
        }
        ev.emit('creds.update', { me: nextMe });
        ev.emit('connection.update', { connection: 'open' });
    });`;
      if (src.includes(oldCbSuccess)) {
        src = src.replace(oldCbSuccess, newCbSuccess);
        sockChanged = true;
      }
      if (src.includes('if (creds.me?.name !== name) {')) {
        src = src.replace(
          'if (creds.me?.name !== name) {',
          'if (name && name !== "~" && creds.me?.name !== name) {'
        );
        sockChanged = true;
      }
      // Fix Baileys bug: waitForMessage had ws.off('error', onErr) instead of ws.on('error', onErr)
      const oldWaitErr = `                ws.on('close', onErr); // if the socket closes, you'll never receive the message
                ws.off('error', onErr);`;
      const newWaitErr = `                ws.on('close', onErr); // if the socket closes, you'll never receive the message
                ws.on('error', onErr);`;
      if (src.includes(oldWaitErr)) {
        src = src.replace(oldWaitErr, newWaitErr);
        sockChanged = true;
      }
      // Harden keepalive: initialize lastDateRecv immediately, use 10s ping timeout, and end() dead sockets cleanly
      const oldKeepAlive = `    const startKeepAliveRequest = () => (keepAliveReq = setInterval(() => {
        if (!lastDateRecv) {
            lastDateRecv = new Date();
        }
        const diff = Date.now() - lastDateRecv.getTime();
        /*
            check if it's been a suspicious amount of time since the server responded with our last seen
            it could be that the network is down
        */
        if (diff > keepAliveIntervalMs + 5000) {
            end(new Boom('Connection was lost', { statusCode: DisconnectReason.connectionLost }));
        }
        else if (ws.isOpen) {
            // if its all good, send a keep alive request
            query({
                tag: 'iq',
                attrs: {
                    id: generateMessageTag(),
                    to: S_WHATSAPP_NET,
                    type: 'get',
                    xmlns: 'w:p'
                },
                content: [{ tag: 'ping', attrs: {} }]
            }).catch(err => {
                logger.error({ trace: err.stack }, 'error in sending keep alive');
            });
        }
        else {
            logger.warn('keep alive called when WS not open');
        }
    }, keepAliveIntervalMs));`;
      const newKeepAlive = `    const startKeepAliveRequest = () => {
        lastDateRecv = new Date();
        keepAliveReq = setInterval(() => {
            if (!lastDateRecv) {
                lastDateRecv = new Date();
            }
            const diff = Date.now() - lastDateRecv.getTime();
            if (diff > keepAliveIntervalMs + 5000) {
                end(new Boom('Connection was lost', { statusCode: DisconnectReason.connectionLost }));
            }
            else if (ws.isOpen) {
                query({
                    tag: 'iq',
                    attrs: {
                        id: generateMessageTag(),
                        to: S_WHATSAPP_NET,
                        type: 'get',
                        xmlns: 'w:p'
                    },
                    content: [{ tag: 'ping', attrs: {} }]
                }, 10000).catch(err => {
                    logger.error({ trace: err?.stack }, 'error in sending keep alive');
                    const staleDiff = Date.now() - (lastDateRecv?.getTime?.() || 0);
                    if (!closed && (!ws.isOpen || staleDiff > keepAliveIntervalMs)) {
                        end(new Boom('Keep alive failed', { statusCode: DisconnectReason.connectionLost }));
                    }
                });
            }
            else {
                logger.warn('keep alive called when WS not open');
                if (!closed) {
                    end(new Boom('WS not open during keep alive', { statusCode: DisconnectReason.connectionLost }));
                }
            }
        }, keepAliveIntervalMs);
    };`;
      if (src.includes(oldKeepAlive)) {
        src = src.replace(oldKeepAlive, newKeepAlive);
        sockChanged = true;
      }
      const oldPairingQueryReturn = `        return authState.creds.pairingCode;
    };`;
      const newPairingQueryReturn = `        globalThis.__waOnPairingEvent?.({ phase: 'companion_hello_ok', jid: authState.creds.me.id, len: String(authState.creds.pairingCode || '').length });
        return authState.creds.pairingCode;
    };`;
      if (src.includes(oldPairingQueryReturn) && !src.includes('companion_hello_ok')) {
        src = src.replace(oldPairingQueryReturn, newPairingQueryReturn);
        sockChanged = true;
      }
      if (sockChanged) {
        fs.writeFileSync(sockPath, src, 'utf-8');
      }
    }

    // 1. Patch Utils/event-buffer.js: Disable 20-120s initial sync buffering delay
    const evBufPath = path.join(baileysRoot, 'Utils', 'event-buffer.js');
    if (fs.existsSync(evBufPath)) {
      let src = fs.readFileSync(evBufPath, 'utf-8');
      if (src.includes('isBuffering = true;')) {
        src = src.replace(/isBuffering\s*=\s*true;/g, 'isBuffering = false;');
        fs.writeFileSync(evBufPath, src, 'utf-8');
      }
    }

    // 2. Patch Utils/decode-wa-message.js:
    const decodePath = path.join(baileysRoot, 'Utils', 'decode-wa-message.js');
    if (fs.existsSync(decodePath)) {
      let src = fs.readFileSync(decodePath, 'utf-8');
      let changed = false;

      if (src.includes("throw new Boom('receipient present, but msg not from me'")) {
        src = src.replace(
          /if\s*\(!isMe\(from\)\s*&&\s*!isMeLid\(from\)\)\s*\{\s*throw new Boom\('receipient present, but msg not from me',\s*\{\s*data:\s*stanza\s*\}\);\s*\}/g,
          ''
        );
        changed = true;
      }

      if (src.includes('const fromMe = isMe(senderJid) || isMeLid(senderJid);')) {
        src = src.replace(
          'const fromMe = isMe(senderJid) || isMeLid(senderJid);',
          'const senderPnAttr = stanza?.attrs?.sender_pn || stanza?.attrs?.participant_pn;\n    const senderLidAttr = stanza?.attrs?.sender_lid || stanza?.attrs?.participant_lid;\n    const fromMe = isMe(senderJid) || isMeLid(senderJid) || Boolean(senderPnAttr && isMe(senderPnAttr)) || Boolean(senderLidAttr && isMeLid(senderLidAttr)) || Boolean(recipient && !isJidMetaIa(recipient));'
        );
        changed = true;
      }

      if (
        src.includes('const pushname = stanza?.attrs?.notify;') &&
        !src.includes('globalThis.__waRegisterLidPn?.(meLid, meId)')
      ) {
        src = src.replace(
          'const pushname = stanza?.attrs?.notify;',
          `if (meId && meLid) {
        globalThis.__waRegisterLidPn?.(meLid, meId);
    }
    if (isLidUser(from) && isJidUser(stanza?.attrs?.sender_pn)) {
        globalThis.__waRegisterLidPn?.(from, stanza.attrs.sender_pn);
    } else if (isJidUser(from) && isLidUser(stanza?.attrs?.sender_lid)) {
        globalThis.__waRegisterLidPn?.(stanza.attrs.sender_lid, from);
    }
    if (isLidUser(participant) && isJidUser(stanza?.attrs?.participant_pn)) {
        globalThis.__waRegisterLidPn?.(participant, stanza.attrs.participant_pn);
    } else if (isJidUser(participant) && isLidUser(stanza?.attrs?.participant_lid)) {
        globalThis.__waRegisterLidPn?.(stanza.attrs.participant_lid, participant);
    }
    if (isLidUser(recipient) && isJidUser(stanza?.attrs?.recipient_pn)) {
        globalThis.__waRegisterLidPn?.(recipient, stanza.attrs.recipient_pn);
    } else if (isJidUser(recipient) && isLidUser(stanza?.attrs?.recipient_lid)) {
        globalThis.__waRegisterLidPn?.(stanza.attrs.recipient_lid, recipient);
    }
    if (fromMe && isLidUser(senderJid) && meId) {
        globalThis.__waRegisterLidPn?.(senderJid, meId);
    }
    const pushname = stanza?.attrs?.notify;`
        );
        changed = true;
      }

      if (
        src.includes('senderLid: stanza?.attrs?.sender_lid,') &&
        !src.includes('recipientPn: stanza?.attrs?.recipient_pn,')
      ) {
        src = src.replace(
          'senderLid: stanza?.attrs?.sender_lid,\n        senderPn: stanza?.attrs?.sender_pn,',
          'senderLid: stanza?.attrs?.sender_lid || (fromMe && isLidUser(senderJid) ? senderJid : undefined),\n        senderPn: stanza?.attrs?.sender_pn,\n        recipientLid: stanza?.attrs?.recipient_lid,\n        recipientPn: stanza?.attrs?.recipient_pn,'
        );
        changed = true;
      }

      if (src.includes('const user = isJidUser(sender) ? sender : author;')) {
        src = src.replace(
          'const user = isJidUser(sender) ? sender : author;',
          'const user = isJidUser(sender) || isLidUser(sender) ? sender : author;'
        );
        changed = true;
      }

      const deviceSentRegex =
        /if\s*\(msg\.deviceSentMessage\)\s*\{[\s\S]*?msg\s*=\s*msg\.deviceSentMessage\.message\s*\|\|\s*msg;\s*\}|msg\s*=\s*msg\.deviceSentMessage\?\.message\s*\|\|\s*msg;/;
      const newDeviceSentBlock = `if (msg.deviceSentMessage) {
                            if (msg.deviceSentMessage.destinationJid) {
                                fullMessage.key.destinationJid = msg.deviceSentMessage.destinationJid;
                            }
                            fullMessage.key.fromMe = true;
                            if (!fullMessage.key.senderLid && isLidUser(author)) {
                                fullMessage.key.senderLid = author;
                                if (meId) globalThis.__waRegisterLidPn?.(author, meId);
                            }
                            if (!fullMessage.key.senderPn && isJidUser(author)) {
                                fullMessage.key.senderPn = author;
                            }
                            msg = msg.deviceSentMessage.message || msg;
                        }`;
      if (
        deviceSentRegex.test(src) &&
        (!src.includes('if (meId) globalThis.__waRegisterLidPn?.(author, meId);') ||
          src.includes('fullMessage.key.senderLid || msg.deviceSentMessage.destinationJid'))
      ) {
        src = src.replace(deviceSentRegex, newDeviceSentBlock);
        changed = true;
      }

      if (changed) {
        fs.writeFileSync(decodePath, src, 'utf-8');
      }
    }

    // 2b. Patch Utils/messages.js: Automatically set isAnimated: true on animated WebP stickers
    const utilMessagesPath = path.join(baileysRoot, 'Utils', 'messages.js');
    if (fs.existsSync(utilMessagesPath)) {
      let src = fs.readFileSync(utilMessagesPath, 'utf-8');
      const oldStickerObj = `        const obj = WAProto.Message.fromObject({
            [\`\${mediaType}Message\`]: MessageTypeProto[mediaType].fromObject({
                url: mediaUrl,
                directPath,
                mediaKey,
                fileEncSha256,
                fileSha256,
                fileLength,
                mediaKeyTimestamp: unixTimestampSeconds(),
                ...uploadData,
                media: undefined
            })
        });`;
      const newStickerObj = `        if (mediaType === 'sticker' && uploadData.isAnimated === undefined && Buffer.isBuffer(media)) {
            const headerSlice = media.subarray(0, Math.min(media.length, 4096)).toString('ascii');
            if (headerSlice.includes('ANIM') || headerSlice.includes('ANMF')) {
                uploadData.isAnimated = true;
            }
        }
        const obj = WAProto.Message.fromObject({
            [\`\${mediaType}Message\`]: MessageTypeProto[mediaType].fromObject({
                url: mediaUrl,
                directPath,
                mediaKey,
                fileEncSha256,
                fileSha256,
                fileLength,
                mediaKeyTimestamp: unixTimestampSeconds(),
                ...uploadData,
                media: undefined
            })
        });`;
      let msgJsChanged = false;
      if (src.includes(oldStickerObj) && !src.includes("headerSlice.includes('ANMF')")) {
        src = src.replace(oldStickerObj, newStickerObj);
        msgJsChanged = true;
      }
      const oldFutureProof = `        return (message?.ephemeralMessage ||
            message?.viewOnceMessage ||
            message?.documentWithCaptionMessage ||
            message?.viewOnceMessageV2 ||
            message?.viewOnceMessageV2Extension ||
            message?.editedMessage);`;
      const newFutureProof = `        return (message?.ephemeralMessage ||
            message?.viewOnceMessage ||
            message?.documentWithCaptionMessage ||
            message?.viewOnceMessageV2 ||
            message?.viewOnceMessageV2Extension ||
            message?.editedMessage ||
            message?.associatedChildMessage ||
            message?.groupStatusMessage ||
            message?.groupStatusMessageV2);`;
      if (src.includes(oldFutureProof)) {
        src = src.replace(oldFutureProof, newFutureProof);
        msgJsChanged = true;
      }
      if (msgJsChanged) {
        fs.writeFileSync(utilMessagesPath, src, 'utf-8');
      }
    }

    // 2c. Patch WAProto (index.js, index.d.ts, WAProto.proto) to support groupStatusMessageV2 (field 103) & ContextInfo.isGroupStatus (field 66)
    const waProtoDir = path.resolve(baileysRoot, '..', 'WAProto');
    const waProtoJsPath = path.join(waProtoDir, 'index.js');
    if (fs.existsSync(waProtoJsPath)) {
      let protoJs = fs.readFileSync(waProtoJsPath, 'utf-8');
      let protoChanged = false;

      if (!protoJs.includes('Message.prototype.groupStatusMessageV2')) {
        const pProto = '        Message.prototype.messageHistoryNotice = null;';
        if (protoJs.includes(pProto)) {
          protoJs = protoJs.replace(
            pProto,
            `${pProto}\n\n        /**\n         * Message groupStatusMessageV2.\n         * @member {proto.Message.IFutureProofMessage|null|undefined} groupStatusMessageV2\n         * @memberof proto.Message\n         * @instance\n         */\n        Message.prototype.groupStatusMessageV2 = null;`
          );
          protoChanged = true;
        }

        const pOneOf = `        Object.defineProperty(Message.prototype, "_messageHistoryNotice", {
            get: $util.oneOfGetter($oneOfFields = ["messageHistoryNotice"]),
            set: $util.oneOfSetter($oneOfFields)
        });`;
        if (protoJs.includes(pOneOf)) {
          protoJs = protoJs.replace(
            pOneOf,
            `${pOneOf}\n\n        // Virtual OneOf for proto3 optional field\n        Object.defineProperty(Message.prototype, "_groupStatusMessageV2", {\n            get: $util.oneOfGetter($oneOfFields = ["groupStatusMessageV2"]),\n            set: $util.oneOfSetter($oneOfFields)\n        });`
          );
          protoChanged = true;
        }

        const pEncode = `            if (message.messageHistoryNotice != null && Object.hasOwnProperty.call(message, "messageHistoryNotice"))
                $root.proto.Message.MessageHistoryNotice.encode(message.messageHistoryNotice, writer.uint32(/* id 102, wireType 2 =*/818).fork()).ldelim();`;
        if (protoJs.includes(pEncode)) {
          protoJs = protoJs.replace(
            pEncode,
            `${pEncode}\n            if (message.groupStatusMessageV2 != null && Object.hasOwnProperty.call(message, "groupStatusMessageV2"))\n                $root.proto.Message.FutureProofMessage.encode(message.groupStatusMessageV2, writer.uint32(/* id 103, wireType 2 =*/826).fork()).ldelim();`
          );
          protoChanged = true;
        }

        const pDecode = `                case 102: {
                        message.messageHistoryNotice = $root.proto.Message.MessageHistoryNotice.decode(reader, reader.uint32());
                        break;
                    }`;
        if (protoJs.includes(pDecode)) {
          protoJs = protoJs.replace(
            pDecode,
            `${pDecode}\n                case 103: {\n                        message.groupStatusMessageV2 = $root.proto.Message.FutureProofMessage.decode(reader, reader.uint32());\n                        break;\n                    }`
          );
          protoChanged = true;
        }

        const pVerify = `            if (message.messageHistoryNotice != null && message.hasOwnProperty("messageHistoryNotice")) {
                properties._messageHistoryNotice = 1;
                {
                    let error = $root.proto.Message.MessageHistoryNotice.verify(message.messageHistoryNotice);
                    if (error)
                        return "messageHistoryNotice." + error;
                }
            }`;
        if (protoJs.includes(pVerify)) {
          protoJs = protoJs.replace(
            pVerify,
            `${pVerify}\n            if (message.groupStatusMessageV2 != null && message.hasOwnProperty("groupStatusMessageV2")) {\n                properties._groupStatusMessageV2 = 1;\n                {\n                    let error = $root.proto.Message.FutureProofMessage.verify(message.groupStatusMessageV2);\n                    if (error)\n                        return "groupStatusMessageV2." + error;\n                }\n            }`
          );
          protoChanged = true;
        }

        const pFrom = `            if (object.messageHistoryNotice != null) {
                if (typeof object.messageHistoryNotice !== "object")
                    throw TypeError(".proto.Message.messageHistoryNotice: object expected");
                message.messageHistoryNotice = $root.proto.Message.MessageHistoryNotice.fromObject(object.messageHistoryNotice);
            }`;
        if (protoJs.includes(pFrom)) {
          protoJs = protoJs.replace(
            pFrom,
            `${pFrom}\n            if (object.groupStatusMessageV2 != null) {\n                if (typeof object.groupStatusMessageV2 !== "object")\n                    throw TypeError(".proto.Message.groupStatusMessageV2: object expected");\n                message.groupStatusMessageV2 = $root.proto.Message.FutureProofMessage.fromObject(object.groupStatusMessageV2);\n            }`
          );
          protoChanged = true;
        }

        const pTo = `            if (message.messageHistoryNotice != null && message.hasOwnProperty("messageHistoryNotice")) {
                object.messageHistoryNotice = $root.proto.Message.MessageHistoryNotice.toObject(message.messageHistoryNotice, options);
                if (options.oneofs)
                    object._messageHistoryNotice = "messageHistoryNotice";
            }`;
        if (protoJs.includes(pTo)) {
          protoJs = protoJs.replace(
            pTo,
            `${pTo}\n            if (message.groupStatusMessageV2 != null && message.hasOwnProperty("groupStatusMessageV2")) {\n                object.groupStatusMessageV2 = $root.proto.Message.FutureProofMessage.toObject(message.groupStatusMessageV2, options);\n                if (options.oneofs)\n                    object._groupStatusMessageV2 = "groupStatusMessageV2";\n            }`
          );
          protoChanged = true;
        }
      }

      if (!protoJs.includes('ContextInfo.prototype.isGroupStatus')) {
        const cProto = '        ContextInfo.prototype.statusSourceType = null;';
        if (protoJs.includes(cProto)) {
          protoJs = protoJs.replace(
            cProto,
            `${cProto}\n\n        /**\n         * ContextInfo isGroupStatus.\n         * @member {boolean|null|undefined} isGroupStatus\n         * @memberof proto.ContextInfo\n         * @instance\n         */\n        ContextInfo.prototype.isGroupStatus = null;`
          );
          protoChanged = true;
        }

        const cOneOf = `        Object.defineProperty(ContextInfo.prototype, "_statusSourceType", {
            get: $util.oneOfGetter($oneOfFields = ["statusSourceType"]),
            set: $util.oneOfSetter($oneOfFields)
        });`;
        if (protoJs.includes(cOneOf)) {
          protoJs = protoJs.replace(
            cOneOf,
            `${cOneOf}\n\n        // Virtual OneOf for proto3 optional field\n        Object.defineProperty(ContextInfo.prototype, "_isGroupStatus", {\n            get: $util.oneOfGetter($oneOfFields = ["isGroupStatus"]),\n            set: $util.oneOfSetter($oneOfFields)\n        });`
          );
          protoChanged = true;
        }

        const cEncode = `            if (message.statusSourceType != null && Object.hasOwnProperty.call(message, "statusSourceType"))
                writer.uint32(/* id 64, wireType 0 =*/512).int32(message.statusSourceType);`;
        if (protoJs.includes(cEncode)) {
          protoJs = protoJs.replace(
            cEncode,
            `${cEncode}\n            if (message.isGroupStatus != null && Object.hasOwnProperty.call(message, "isGroupStatus"))\n                writer.uint32(/* id 66, wireType 0 =*/528).bool(message.isGroupStatus);`
          );
          protoChanged = true;
        }

        const cDecode = `                case 64: {
                        message.statusSourceType = reader.int32();
                        break;
                    }`;
        if (protoJs.includes(cDecode)) {
          protoJs = protoJs.replace(
            cDecode,
            `${cDecode}\n                case 66: {\n                        message.isGroupStatus = reader.bool();\n                        break;\n                    }`
          );
          protoChanged = true;
        }

        const cVerify = `            if (message.statusSourceType != null && message.hasOwnProperty("statusSourceType")) {
                properties._statusSourceType = 1;
                switch (message.statusSourceType) {
                default:
                    return "statusSourceType: enum value expected";
                case 0:
                case 1:
                case 2:
                case 3:
                case 4:
                case 5:
                    break;
                }
            }`;
        if (protoJs.includes(cVerify)) {
          protoJs = protoJs.replace(
            cVerify,
            `${cVerify}\n            if (message.isGroupStatus != null && message.hasOwnProperty("isGroupStatus")) {\n                properties._isGroupStatus = 1;\n                if (typeof message.isGroupStatus !== "boolean")\n                    return "isGroupStatus: boolean expected";\n            }`
          );
          protoChanged = true;
        }

        const cFrom = `            case "MUSIC_STANDALONE":
            case 5:
                message.statusSourceType = 5;
                break;
            }`;
        if (protoJs.includes(cFrom)) {
          protoJs = protoJs.replace(
            cFrom,
            `${cFrom}\n            if (object.isGroupStatus != null)\n                message.isGroupStatus = Boolean(object.isGroupStatus);`
          );
          protoChanged = true;
        }

        const cTo = `                if (options.oneofs)
                    object._statusSourceType = "statusSourceType";
            }`;
        if (protoJs.includes(cTo)) {
          protoJs = protoJs.replace(
            cTo,
            `${cTo}\n            if (message.isGroupStatus != null && message.hasOwnProperty("isGroupStatus")) {\n                object.isGroupStatus = message.isGroupStatus;\n                if (options.oneofs)\n                    object._isGroupStatus = "isGroupStatus";\n            }`
          );
          protoChanged = true;
        }
      }

      if (protoChanged) {
        fs.writeFileSync(waProtoJsPath, protoJs, 'utf-8');
      }
    }

    const waProtoDtsPath = path.join(waProtoDir, 'index.d.ts');
    if (fs.existsSync(waProtoDtsPath)) {
      let dts = fs.readFileSync(waProtoDtsPath, 'utf-8');
      let dtsChanged = false;
      if (!dts.includes('groupStatusMessageV2?:')) {
        dts = dts
          .replace(
            '        messageHistoryNotice?: (proto.Message.IMessageHistoryNotice|null);',
            '        messageHistoryNotice?: (proto.Message.IMessageHistoryNotice|null);\n        groupStatusMessageV2?: (proto.Message.IFutureProofMessage|null);'
          )
          .replace(
            '        public messageHistoryNotice?: (proto.Message.IMessageHistoryNotice|null);',
            '        public messageHistoryNotice?: (proto.Message.IMessageHistoryNotice|null);\n        public groupStatusMessageV2?: (proto.Message.IFutureProofMessage|null);'
          );
        dtsChanged = true;
      }
      if (!dts.includes('isGroupStatus?:')) {
        dts = dts
          .replace(
            '        isQuestion?: (boolean|null);',
            '        isQuestion?: (boolean|null);\n        isGroupStatus?: (boolean|null);'
          )
          .replace(
            '        public isQuestion?: (boolean|null);',
            '        public isQuestion?: (boolean|null);\n        public isGroupStatus?: (boolean|null);'
          );
        dtsChanged = true;
      }
      if (dtsChanged) {
        fs.writeFileSync(waProtoDtsPath, dts, 'utf-8');
      }
    }

    // 3. Patch Socket/messages-send.js:
    const msgSendPath = path.join(baileysRoot, 'Socket', 'messages-send.js');
    if (fs.existsSync(msgSendPath)) {
      let src = fs.readFileSync(msgSendPath, 'utf-8');
      let changed = false;

      const oldWabSendImport = `isJidGroup, isJidUser, jidDecode, jidEncode, jidNormalizedUser, S_WHATSAPP_NET } from '../WABinary/index.js';`;
      const newWabSendImport = `isJidGroup, isJidUser, isLidUser, jidDecode, jidEncode, jidNormalizedUser, S_WHATSAPP_NET } from '../WABinary/index.js';`;
      if (src.includes(oldWabSendImport)) {
        src = src.replace(oldWabSendImport, newWabSendImport);
        changed = true;
      }

      const usyncBlockRegex = /const getUSyncDevices = async \(jids, useCache, ignoreZeroDevices\) => \{[\s\S]*?\n    \};(?=\n    const assertSessions)/;
      const cleanGetUSyncDevices = `const getUSyncDevices = async (jids, useCache, ignoreZeroDevices) => {
        const deviceResults = [];
        if (!useCache) {
            logger.debug('not using cache for devices');
        }
        const myPnUser = jidDecode(authState.creds.me?.id)?.user;
        const myLidUser = (authState.creds.me?.lid ? jidDecode(authState.creds.me.lid)?.user : undefined) || globalThis.__waPnToLidUser?.get(myPnUser);
        const toFetch = [];
        const seenUsers = new Set();
        jids = Array.from(new Set(jids));
        for (let jid of jids) {
            const user = jidDecode(jid)?.user;
            if (!user || seenUsers.has(user)) {
                continue;
            }
            seenUsers.add(user);
            jid = jidNormalizedUser(jid);
            if (useCache) {
                const devices = userDevicesCache.get(user);
                const isSelfUser = user === myPnUser || Boolean(myLidUser && user === myLidUser);
                if (Array.isArray(devices) && (!isSelfUser || devices.some(d => d.device === 0))) {
                    deviceResults.push(...devices);
                    logger.trace({ user }, 'using cache for devices');
                }
                else {
                    toFetch.push(jid);
                }
            }
            else {
                toFetch.push(jid);
            }
        }
        if (!toFetch.length) {
            return ignoreZeroDevices ? deviceResults.filter(d => d.device !== 0) : deviceResults;
        }
        const pnToFetch = toFetch.filter(j => !j.endsWith('@lid'));
        const lidToFetch = toFetch.filter(j => j.endsWith('@lid'));
        const runUsyncBatch = async (batchJids, includeLidProto) => {
            if (!batchJids.length) return { list: [], failed: false };
            const q = new USyncQuery().withContext('message').withDeviceProtocol();
            if (includeLidProto) q.withLIDProtocol();
            for (const jid of batchJids) {
                q.withUser(new USyncUser().withId(jid));
            }
            try {
                const res = await sock.executeUSyncQuery(q);
                return { list: res?.list || [], failed: !res };
            } catch (usyncErr) {
                logger?.warn?.({ usyncErr: usyncErr?.message || usyncErr, batchJids }, 'USync query failed; continuing with known primary devices');
                return { list: [], failed: true };
            }
        };
        const [pnRes, lidRes] = await Promise.all([
            runUsyncBatch(pnToFetch, true),
            runUsyncBatch(lidToFetch, false)
        ]);
        const combinedList = [...pnRes.list, ...lidRes.list];
        for (const item of combinedList) {
            if (item?.lid && item?.id) {
                globalThis.__waRegisterLidPn?.(item.lid, item.id);
                if (areJidsSameUser(item.id, authState.creds.me?.id)) {
                    if (authState.creds.me && !authState.creds.me.lid) {
                        authState.creds.me.lid = item.lid;
                        ev.emit('creds.update', { me: authState.creds.me });
                    }
                }
            }
        }
        // Always cache full devices including :0 so ignoreZeroDevices=true DM calls never poison subsequent group lookups with []
        const extracted = extractDeviceJids(combinedList, authState.creds.me.id, false);
        const deviceMap = {};
        if (!pnRes.failed) {
            for (const fJid of pnToFetch) {
                const u = jidDecode(fJid)?.user;
                if (u) deviceMap[u] = [];
            }
        }
        if (!lidRes.failed) {
            for (const fJid of lidToFetch) {
                const u = jidDecode(fJid)?.user;
                if (u) deviceMap[u] = [];
            }
        }
        for (const item of extracted) {
            deviceMap[item.user] = deviceMap[item.user] || [];
            deviceMap[item.user].push(item);
            deviceResults.push(item);
        }
        for (const key in deviceMap) {
            userDevicesCache.set(key, deviceMap[key]);
        }
        return ignoreZeroDevices ? deviceResults.filter(d => d.device !== 0) : deviceResults;
    };`;
      if (usyncBlockRegex.test(src) && (!src.includes('runUsyncBatch') || !src.includes('extractDeviceJids(combinedList, authState.creds.me.id, false)'))) {
        src = src.replace(usyncBlockRegex, cleanGetUSyncDevices);
        changed = true;
      }

      // Serialize createParticipantNodes encryption so duplicate/concurrent SessionCipher calls never race
      const oldCreateNodes = `        let shouldIncludeDeviceIdentity = false;
        const nodes = await Promise.all(patched.map(async (patchedMessageWithJid) => {
            const { recipientJid: jid, ...patchedMessage } = patchedMessageWithJid;
            if (!jid) {
                return {};
            }
            const bytes = encodeWAMessage(patchedMessage);
            const { type, ciphertext } = await signalRepository.encryptMessage({ jid, data: bytes });
            if (type === 'pkmsg') {
                shouldIncludeDeviceIdentity = true;
            }
            const node = {
                tag: 'to',
                attrs: { jid },
                content: [
                    {
                        tag: 'enc',
                        attrs: {
                            v: '2',
                            type,
                            ...(extraAttrs || {})
                        },
                        content: ciphertext
                    }
                ]
            };
            return node;
        }));
        return { nodes, shouldIncludeDeviceIdentity };`;

      const newCreateNodes = `        let shouldIncludeDeviceIdentity = false;
        const nodes = [];
        const encryptedJids = new Set();
        let lastEncryptErr = null;
        for (const patchedMessageWithJid of patched) {
            const { recipientJid: jid, ...patchedMessage } = patchedMessageWithJid;
            if (!jid || encryptedJids.has(jid)) {
                continue;
            }
            encryptedJids.add(jid);
            try {
                const bytes = encodeWAMessage(patchedMessage);
                const { type, ciphertext } = await signalRepository.encryptMessage({ jid, data: bytes });
                if (type === 'pkmsg') {
                    shouldIncludeDeviceIdentity = true;
                }
                const node = {
                    tag: 'to',
                    attrs: { jid },
                    content: [
                        {
                            tag: 'enc',
                            attrs: {
                                v: '2',
                                type,
                                ...(extraAttrs || {})
                            },
                            content: ciphertext
                        }
                    ]
                };
                nodes.push(node);
            } catch (encErr) {
                lastEncryptErr = encErr;
                logger?.warn?.({ jid, err: encErr?.message || encErr }, 'skipping unencryptable device in createParticipantNodes');
            }
        }
        if (nodes.length === 0 && patched.some(p => Boolean(p?.recipientJid)) && lastEncryptErr) {
            throw lastEncryptErr;
        }
        return { nodes, shouldIncludeDeviceIdentity };`;

      const existingCreateNodesRegex = /        let shouldIncludeDeviceIdentity = false;\n        const nodes = \[\];\n        const encryptedJids = new Set\(\);\n        for \(const patchedMessageWithJid of patched\) \{[\s\S]*?return \{ nodes, shouldIncludeDeviceIdentity \};/;
      if (src.includes(oldCreateNodes)) {
        src = src.replace(oldCreateNodes, newCreateNodes);
        changed = true;
      } else if (existingCreateNodesRegex.test(src) && !src.includes('skipping unencryptable device in createParticipantNodes')) {
        src = src.replace(existingCreateNodesRegex, newCreateNodes);
        changed = true;
      }

      // Replace the participant device loop in relayMessage to strictly deduplicate JIDs and safely handle me.lid & retries
      const deviceLoopRegex =
        /const \{ user: meUser(?:, device: meDevice)? \} = jidDecode\(meId\);[\s\S]*?(?=\n\s*const \[\{ nodes: meNodes)/;
      const patchedDeviceLoop = `const { user: meUser, device: meDevice } = jidDecode(meId);
                let meLidUser = authState.creds?.me?.lid ? jidDecode(authState.creds.me.lid)?.user : globalThis.__waPnToLidUser?.get(meUser);
                if (meLidUser && meUser) {
                    globalThis.__waRegisterLidPn?.(meLidUser, meUser);
                }
                const targetIsLid = Boolean(participant?.jid ? isLidUser(participant.jid) : isLid);
                if (!participant) {
                    devices.push({ user, server });
                    if (user !== meUser && (!meLidUser || user !== meLidUser)) {
                        devices.push({ user: meUser, server: 's.whatsapp.net' });
                    }
                    if (additionalAttributes?.['category'] !== 'peer') {
                        const additionalDevices = await getUSyncDevices([meId, jid], !!useUserDevicesCache, true);
                        devices.push(...additionalDevices);
                        if (!meLidUser) {
                            meLidUser = (authState.creds?.me?.lid ? jidDecode(authState.creds.me.lid)?.user : undefined) || globalThis.__waPnToLidUser?.get(meUser);
                        }
                    }
                }
                const allJids = [];
                const meJids = [];
                const otherJids = [];
                const seenCanonicalDeviceKeys = new Set();
                const participantIsLid = participant?.jid ? Boolean(isLidUser(participant.jid)) : isLid;
                const domainMatchedLid = true;
                for (const { user: devUser, device, server: devServer } of devices) {
                    const isMe = devUser === meUser || Boolean(meLidUser && devUser === meLidUser);
                    if (isMe && device !== undefined && meDevice !== undefined && device === meDevice) {
                        continue;
                    }
                    const canonicalKey = \`\${isMe ? 'ME' : (globalThis.__waLidToPnUser?.get(devUser) || devUser)}:\${device || 0}\`;
                    if (seenCanonicalDeviceKeys.has(canonicalKey)) {
                        continue;
                    }
                    seenCanonicalDeviceKeys.add(canonicalKey);
                    const useLidForTarget = Boolean(participant?.jid ? participantIsLid : isLid);
                    const targetUser = isMe ? (useLidForTarget && meLidUser ? meLidUser : meUser) : devUser;
                    const targetServer = isMe
                        ? (useLidForTarget && meLidUser ? 'lid' : 's.whatsapp.net')
                        : (useLidForTarget ? 'lid' : (devServer || 's.whatsapp.net'));
                    const participantJid = jidEncode(targetUser, targetServer, device);
                    if (isMe) {
                        meJids.push(participantJid);
                    }
                    else {
                        otherJids.push(participantJid);
                    }
                    allJids.push(participantJid);
                }
                await assertSessions(allJids, false);
                globalThis.__waOnRelayPlan?.({ msgId, destinationJid, meJids, otherJids, targetIsLid, domainMatchedLid });`;

      if (deviceLoopRegex.test(src) && (!src.includes('__waOnRelayPlan') || src.includes('isSelfChat') || !src.includes('participantIsLid') || !src.includes('devServer') || src.includes('isMeUsesPn') || !src.includes('domainMatchedLid'))) {
        src = src.replace(deviceLoopRegex, patchedDeviceLoop);
        changed = true;
      }

      // Ensure meLid is declared inside relayMessage (fixes ReferenceError: meLid is not defined on DM retries!)
      if (src.includes('const meId = authState.creds.me.id;\n        let shouldIncludeDeviceIdentity = false;')) {
        src = src.replace(
          'const meId = authState.creds.me.id;\n        let shouldIncludeDeviceIdentity = false;',
          'const meId = authState.creds.me.id;\n        const meLid = authState.creds.me?.lid;\n        let shouldIncludeDeviceIdentity = false;'
        );
        changed = true;
      }

      const oldParticipantStanzaCheck = `                else if (areJidsSameUser(participant.jid, meId)) {`;
      const newParticipantStanzaCheck = `                else if (areJidsSameUser(participant.jid, meId) || (meLid && areJidsSameUser(participant.jid, meLid))) {`;
      if (src.includes(oldParticipantStanzaCheck)) {
        src = src.replace(oldParticipantStanzaCheck, newParticipantStanzaCheck);
        changed = true;
      }

      // Ensure standard stanza type is 'text' (or 'poll') so WhatsApp servers never drop media messages
      if (src.includes("if (getMediaType(message)) {\n            return 'media';\n        }")) {
        src = src.replace("if (getMediaType(message)) {\n            return 'media';\n        }\n", '');
        changed = true;
      }

      // Ensure relayMessage executes concurrently with zero sequential queue bottleneck
      if (src.includes('let relayQueue = Promise.resolve();')) {
        src = src.replace(/let relayQueue = Promise\.resolve\(\);[\s\S]*?const _relayMessageImpl = async/, 'const relayMessage = async');
        changed = true;
      }

      // Cache every outgoing message & relay options (additionalNodes/additionalAttributes) in globalThis BEFORE sendNode so retry receipts always preserve <biz> & attrs
      const oldMsgIdAssign = `        msgId = msgId || generateMessageIDV2(sock.user?.id);`;
      const prevMsgIdAssign = `        msgId = msgId || generateMessageIDV2(sock.user?.id);
        if (!globalThis.__waSentMessagesCache) globalThis.__waSentMessagesCache = new Map();
        if (msgId && message) {
            globalThis.__waSentMessagesCache.set(msgId, message);
            if (globalThis.__waSentMessagesCache.size > 500) {
                const oldest = globalThis.__waSentMessagesCache.keys().next().value;
                if (oldest) globalThis.__waSentMessagesCache.delete(oldest);
            }
        }`;
      const newMsgIdAssign = `        msgId = msgId || generateMessageIDV2(sock.user?.id);
        if (!globalThis.__waSentMessagesCache) globalThis.__waSentMessagesCache = new Map();
        if (msgId && message) {
            globalThis.__waSentMessagesCache.set(msgId, message);
            if (globalThis.__waSentMessagesCache.size > 500) {
                const oldest = globalThis.__waSentMessagesCache.keys().next().value;
                if (oldest) globalThis.__waSentMessagesCache.delete(oldest);
            }
        }
        if (!globalThis.__waSentRelayOptsCache) globalThis.__waSentRelayOptsCache = new Map();
        if (msgId && (additionalNodes || additionalAttributes)) {
            globalThis.__waSentRelayOptsCache.set(msgId, { additionalNodes, additionalAttributes });
            if (globalThis.__waSentRelayOptsCache.size > 500) {
                const oldestOpt = globalThis.__waSentRelayOptsCache.keys().next().value;
                if (oldestOpt) globalThis.__waSentRelayOptsCache.delete(oldestOpt);
            }
        }`;
      if (src.includes(prevMsgIdAssign) && !src.includes('__waSentRelayOptsCache')) {
        src = src.replace(prevMsgIdAssign, newMsgIdAssign);
        changed = true;
      } else if (src.includes(oldMsgIdAssign) && !src.includes('__waSentMessagesCache.set')) {
        src = src.replace(oldMsgIdAssign, newMsgIdAssign);
        changed = true;
      }

      // Skip slow/conflicting getUrlInfo scraping when content.contextInfo is already provided (.menu, .alive, .owner)
      const oldGetUrlInfo = `                    getUrlInfo: text => getUrlInfo(text, {`;
      const newGetUrlInfo = `                    getUrlInfo: (content && typeof content === 'object' && 'contextInfo' in content && content.contextInfo) ? undefined : (text => getUrlInfo(text, {`;
      const oldGetUrlInfoEnd = `                        uploadImage: generateHighQualityLinkPreview ? waUploadToServer : undefined
                    }),`;
      const newGetUrlInfoEnd = `                        uploadImage: generateHighQualityLinkPreview ? waUploadToServer : undefined
                    })),`;
      if (src.includes(oldGetUrlInfo) && src.includes(oldGetUrlInfoEnd)) {
        src = src.replace(oldGetUrlInfo, newGetUrlInfo).replace(oldGetUrlInfoEnd, newGetUrlInfoEnd);
        changed = true;
      }

      // Revert forced device-identity on non-pkmsg stanzas (protocol requires <device-identity> only with pkmsg)
      if (src.includes('shouldIncludeDeviceIdentity = shouldIncludeDeviceIdentity || s1 || s2 || (meNodes.length > 0 && !!authState.creds.account);')) {
        src = src.replace(
          'shouldIncludeDeviceIdentity = shouldIncludeDeviceIdentity || s1 || s2 || (meNodes.length > 0 && !!authState.creds.account);',
          'shouldIncludeDeviceIdentity = shouldIncludeDeviceIdentity || s1 || s2;'
        );
        changed = true;
      }

      // Preserve existing sender-key-memory in groups when participant retry comes in
      const oldSenderKeyMemoryGet = `                    (async () => {
                        if (!participant && !isStatus) {
                            const result = await authState.keys.get('sender-key-memory', [jid]);
                            return result[jid] || {};
                        }
                        return {};
                    })()`;
      const newSenderKeyMemoryGet = `                    (async () => {
                        if (!isStatus) {
                            const result = await authState.keys.get('sender-key-memory', [jid]);
                            return result[jid] || {};
                        }
                        return {};
                    })()`;
      if (src.includes(oldSenderKeyMemoryGet)) {
        src = src.replace(oldSenderKeyMemoryGet, newSenderKeyMemoryGet);
        changed = true;
      }

      // Preserve participant server + retry count, and guarantee owner :0 device + LID senderKey work in groups
      const oldGroupParticipantDecode = `            const { user, device } = jidDecode(participant.jid);
            devices.push({ user, device });`;
      const prevGroupParticipantDecode = `            const { user, device, server } = jidDecode(participant.jid);
            devices.push({ user, device, server });`;
      const newGroupParticipantDecode = `            if (participant.count) {
                extraAttrs['count'] = String(participant.count);
            }
            const { user, device, server } = jidDecode(participant.jid);
            devices.push({ user, device, server });`;
      if (src.includes(oldGroupParticipantDecode)) {
        src = src.replace(oldGroupParticipantDecode, newGroupParticipantDecode);
        changed = true;
      } else if (src.includes(prevGroupParticipantDecode) && !src.includes("extraAttrs['count']")) {
        src = src.replace(prevGroupParticipantDecode, newGroupParticipantDecode);
        changed = true;
      }

      const oldSkmsgEnc = `                binaryNodeContent.push({
                    tag: 'enc',
                    attrs: { v: '2', type: 'skmsg' },
                    content: ciphertext
                });`;
      const newSkmsgEnc = `                binaryNodeContent.push({
                    tag: 'enc',
                    attrs: {
                        v: '2',
                        type: 'skmsg',
                        ...(participant?.count ? { count: String(participant.count) } : {})
                    },
                    content: ciphertext
                });`;
      if (src.includes(oldSkmsgEnc)) {
        src = src.replace(oldSkmsgEnc, newSkmsgEnc);
        changed = true;
      }

      if (src.includes("if (type === 'sender' && isJidUser(jid)) {")) {
        src = src.replace(
          "if (type === 'sender' && isJidUser(jid)) {",
          "if (type === 'sender' && (isJidUser(jid) || jid?.endsWith('@lid'))) {"
        );
        changed = true;
      }

      const groupBlockRegex = /                if \(!participant\) \{\n                    const participantsList[\s\S]*?(?=\n                \/\/ if there are some participants)|                if \(!isStatus\) \{\n                    additionalAttributes = \{[\s\S]*?seenGroupDeviceJids[\s\S]*?(?=\n                \/\/ if there are some participants)/;
      const newGroupBlock = `                if (!isStatus) {
                    additionalAttributes = {
                        ...additionalAttributes,
                        addressing_mode: groupData?.addressingMode || 'pn'
                    };
                }
                if (!participant) {
                    const participantsList = groupData && !isStatus ? groupData.participants.map(p => p.id) : [];
                    if (isStatus && statusJidList) {
                        participantsList.push(...statusJidList);
                    }
                    const additionalDevices = await getUSyncDevices(participantsList, !!useUserDevicesCache, false);
                    devices.push(...additionalDevices);
                }
                const patched = await patchMessageBeforeSending(message);
                if (Array.isArray(patched)) {
                    throw new Boom('Per-jid patching is not supported in groups');
                }
                const bytes = encodeWAMessage(patched);
                const isLidGroup = groupData?.addressingMode === 'lid';
                const groupAuthorMeId = isLidGroup && authState.creds?.me?.lid ? authState.creds.me.lid : meId;
                const { ciphertext, senderKeyDistributionMessage } = await signalRepository.encryptGroupMessage({
                    group: destinationJid,
                    data: bytes,
                    meId: groupAuthorMeId
                });
                const { user: selfPnUser, device: selfDevice } = jidDecode(meId) || {};
                const selfLidUser = authState.creds?.me?.lid ? jidDecode(authState.creds.me.lid)?.user : globalThis.__waPnToLidUser?.get(selfPnUser);
                if (!isStatus && !participant) {
                    const hasOwnerZero = devices.some(d => (d.device || 0) === 0 && (d.user === selfPnUser || (selfLidUser && d.user === selfLidUser)));
                    if (!hasOwnerZero && (selfPnUser || selfLidUser)) {
                        devices.push({
                            user: isLidGroup && selfLidUser ? selfLidUser : selfPnUser,
                            device: 0,
                            server: isLidGroup && selfLidUser ? 'lid' : 's.whatsapp.net'
                        });
                    }
                }
                const senderKeyJids = [];
                const seenGroupDeviceJids = new Set();
                // ensure a connection is established with every device (never our own sending device)
                for (const { user, device, server } of devices) {
                    const isSelfDevice = (user === selfPnUser || (selfLidUser && user === selfLidUser)) && (device || 0) === (selfDevice || 0);
                    if (isSelfDevice) {
                        continue;
                    }
                    const targetServer = server || (isLidGroup ? 'lid' : 's.whatsapp.net');
                    const jid = jidEncode(user, targetServer, device);
                    if (seenGroupDeviceJids.has(jid)) {
                        continue;
                    }
                    seenGroupDeviceJids.add(jid);
                    if (!senderKeyMap[jid] || !!participant) {
                        senderKeyJids.push(jid);
                        // store that this person has had the sender keys sent to them
                        senderKeyMap[jid] = true;
                    }
                }
                if (!isStatus) {
                    globalThis.__waOnGroupPlan?.({
                        msgId,
                        jid,
                        isRetry: Boolean(participant),
                        retryCount: participant?.count || 0,
                        addressingMode: groupData?.addressingMode || 'pn',
                        devicesCount: devices.length,
                        senderKeyJidsCount: senderKeyJids.length,
                        hasOwnerZero: (selfLidUser ? seenGroupDeviceJids.has(\`\${selfLidUser}@lid\`) : false) || (selfPnUser ? seenGroupDeviceJids.has(\`\${selfPnUser}@s.whatsapp.net\`) : false)
                    });
                }`;
      if (groupBlockRegex.test(src) && (!src.includes('groupAuthorMeId') || !src.includes('__waOnGroupPlan'))) {
        src = src.replace(groupBlockRegex, newGroupBlock);
        changed = true;
      }

      const oldGroupInviteMediaType = `        else if (message.groupInviteMessage) {
            return 'url';
        }`;
      const newGroupInviteMediaType = `        else if (message.groupInviteMessage) {
            return 'url';
        }
        else if (message.groupStatusMessageV2 || message.groupStatusMessage) {
            const innerMsg = (message.groupStatusMessageV2 || message.groupStatusMessage)?.message || {};
            if (innerMsg.imageMessage) return 'image';
            if (innerMsg.videoMessage) return innerMsg.videoMessage.gifPlayback ? 'gif' : 'video';
            if (innerMsg.audioMessage) return innerMsg.audioMessage.ptt ? 'ptt' : 'audio';
            if (innerMsg.stickerMessage) return 'sticker';
        }`;
      if (src.includes(oldGroupInviteMediaType) && !src.includes('message.groupStatusMessageV2 || message.groupStatusMessage')) {
        src = src.replace(oldGroupInviteMediaType, newGroupInviteMediaType);
        changed = true;
      }

      // Self-heal rejected cached mediaConn promise & bound media_conn query timeout to 15s
      if (src.includes('const media = await mediaConn;')) {
        src = src.replace(
          'const media = await mediaConn;',
          'const media = await mediaConn?.catch?.(() => undefined);'
        );
        changed = true;
      }
      const oldMediaConnQuery = `                    content: [{ tag: 'media_conn', attrs: {} }]
                });`;
      const newMediaConnQuery = `                    content: [{ tag: 'media_conn', attrs: {} }]
                }, 15000);`;
      if (src.includes(oldMediaConnQuery)) {
        src = src.replace(oldMediaConnQuery, newMediaConnQuery);
        changed = true;
      }

      // Attach stored trusted-contact privacy token (<tctoken>) on 1:1 DM stanzas to prevent server ack 463 errors
      const oldSendNodeCall = `            logger.debug({ msgId }, \`sending message to \${participants.length} devices\`);
            await sendNode(stanza);`;
      const newSendNodeCall = `            if (!isGroup && !isStatus && !isNewsletter && !participant && additionalAttributes?.['category'] !== 'peer') {
                try {
                    const normDest = jidNormalizedUser(destinationJid);
                    const dDec = jidDecode(normDest);
                    const altUser = dDec?.user ? (globalThis.__waLidToPnUser?.get(dDec.user) || globalThis.__waPnToLidUser?.get(dDec.user)) : undefined;
                    const altDest = altUser ? \`\${altUser}@\${normDest.endsWith('@lid') ? 's.whatsapp.net' : 'lid'}\` : undefined;
                    const lookupKeys = Array.from(new Set([normDest, jidNormalizedUser(jid), altDest].filter(Boolean)));
                    let tcEntry = lookupKeys.map(k => globalThis.__waTcTokens?.get(k)).find(v => v?.token);
                    if (!tcEntry) {
                        const storedTokens = await authState.keys.get('tctoken', lookupKeys);
                        tcEntry = lookupKeys.map(k => storedTokens?.[k]).find(v => v?.token);
                        if (tcEntry) {
                            if (!globalThis.__waTcTokens) globalThis.__waTcTokens = new Map();
                            for (const k of lookupKeys) globalThis.__waTcTokens.set(k, tcEntry);
                        }
                    }
                    if (tcEntry?.token && !stanza.content.some(n => n?.tag === 'tctoken')) {
                        const buf = Buffer.isBuffer(tcEntry.token)
                            ? tcEntry.token
                            : tcEntry.token?.data
                            ? Buffer.from(tcEntry.token.data)
                            : Buffer.from(tcEntry.token);
                        if (buf.length > 0) {
                            stanza.content.push({
                                tag: 'tctoken',
                                attrs: tcEntry.timestamp ? { t: String(tcEntry.timestamp) } : {},
                                content: buf
                            });
                        }
                    }
                } catch {}
            }
            logger.debug({ msgId }, \`sending message to \${participants.length} devices\`);
            await sendNode(stanza);`;
      if (src.includes(oldSendNodeCall) && !src.includes("n?.tag === 'tctoken'")) {
        src = src.replace(oldSendNodeCall, newSendNodeCall);
        changed = true;
      }

      const oldGetPrivacyReturn = `        return result;
    };
    const waUploadToServer`;
      const newGetPrivacyReturn = `        try {
            const tokensNode = getBinaryNodeChild(result, 'tokens');
            const tokenNodes = getBinaryNodeChildren(tokensNode || result, 'token');
            const writes = {};
            for (const tn of tokenNodes) {
                if (tn?.attrs?.jid && tn?.content) {
                    const nj = jidNormalizedUser(tn.attrs.jid);
                    const entry = { token: Buffer.from(tn.content), timestamp: tn.attrs.t || t };
                    writes[nj] = entry;
                    if (!globalThis.__waTcTokens) globalThis.__waTcTokens = new Map();
                    globalThis.__waTcTokens.set(nj, entry);
                }
            }
            if (Object.keys(writes).length > 0) {
                await authState.keys.set({ tctoken: writes }).catch(() => {});
            }
        } catch {}
        return result;
    };
    const waUploadToServer`;
      if (src.includes(oldGetPrivacyReturn) && !src.includes('authState.keys.set({ tctoken: writes })')) {
        src = src.replace(oldGetPrivacyReturn, newGetPrivacyReturn);
        changed = true;
      }

      if (changed) {
        fs.writeFileSync(msgSendPath, src, 'utf-8');
      }
    }

    // 4. Patch Socket/messages-recv.js:
    const msgRecvPath = path.join(baileysRoot, 'Socket', 'messages-recv.js');
    if (fs.existsSync(msgRecvPath)) {
      let src = fs.readFileSync(msgRecvPath, 'utf-8');
      let changed = false;

      // CRITICAL: Ensure isJidBroadcast and isJidNewsletter are imported (used in sendMessagesAgain retryTargets)
      const oldWabImport = `isJidGroup, isJidStatusBroadcast, isJidUser, isLidUser,`;
      const newWabImport = `isJidBroadcast, isJidGroup, isJidNewsletter, isJidStatusBroadcast, isJidUser, isLidUser,`;
      if (src.includes(oldWabImport)) {
        src = src.replace(oldWabImport, newWabImport);
        changed = true;
      }

      // Bound resyncAppState inside processNotification so a stalled server_sync never wedges processingMutex
      const oldServerSync = `                    await resyncAppState([name], false);`;
      const newServerSync = `                    await Promise.race([
                        resyncAppState([name], false).catch(err => logger?.warn?.({ err, name }, 'resyncAppState failed')),
                        delay(12000)
                    ]);`;
      if (src.includes(oldServerSync)) {
        src = src.replace(oldServerSync, newServerSync);
        changed = true;
      }

      // Bound sendMessagesAgain inside handleReceipt so a hung retry relay never wedges processingMutex
      const oldSendAgainAwait = `                                    await sendMessagesAgain(key, ids, retryNode);`;
      const newSendAgainAwait = `                                    await Promise.race([sendMessagesAgain(key, ids, retryNode), delay(12000)]);`;
      if (src.includes(oldSendAgainAwait)) {
        src = src.replace(oldSendAgainAwait, newSendAgainAwait);
        changed = true;
      }

      // Persist incoming privacy_token updates in authState.keys + memory so 1:1 DM sends include <tctoken>
      const oldPrivacyTokenCase = `            case 'privacy_token':
                const tokenList = getBinaryNodeChildren(child, 'token');
                for (const { attrs, content } of tokenList) {
                    const jid = attrs.jid;
                    ev.emit('chats.update', [
                        {
                            id: jid,
                            tcToken: content
                        }
                    ]);
                    logger.debug({ jid }, 'got privacy token update');
                }
                break;`;
      const newPrivacyTokenCase = `            case 'privacy_token':
                const tokenList = getBinaryNodeChildren(child, 'token');
                for (const { attrs, content } of tokenList) {
                    const jid = attrs.jid;
                    if (jid && content) {
                        try {
                            const normJid = jidNormalizedUser(jid);
                            const tokenData = { token: Buffer.from(content), timestamp: attrs.t || String(Math.floor(Date.now() / 1000)) };
                            const tokenWrites = { [normJid]: tokenData };
                            const uDec = jidDecode(normJid);
                            if (uDec?.user) {
                                const altU = globalThis.__waLidToPnUser?.get(uDec.user) || globalThis.__waPnToLidUser?.get(uDec.user);
                                if (altU && altU !== uDec.user) {
                                    const altJid = \`\${altU}@\${normJid.endsWith('@lid') ? 's.whatsapp.net' : 'lid'}\`;
                                    tokenWrites[altJid] = tokenData;
                                }
                            }
                            await authState.keys.set({ tctoken: tokenWrites }).catch(() => {});
                            if (!globalThis.__waTcTokens) globalThis.__waTcTokens = new Map();
                            for (const [k, v] of Object.entries(tokenWrites)) {
                                globalThis.__waTcTokens.set(k, v);
                            }
                        } catch {}
                    }
                    ev.emit('chats.update', [
                        {
                            id: jid,
                            tcToken: content,
                            tcTokenTimestamp: attrs.t ? Number(attrs.t) : undefined
                        }
                    ]);
                    logger.debug({ jid }, 'got privacy token update');
                }
                break;`;
      if (src.includes(oldPrivacyTokenCase)) {
        src = src.replace(oldPrivacyTokenCase, newPrivacyTokenCase);
        changed = true;
      }

      if (src.includes('if (isJidUser(msg.key.remoteJid)) {')) {
        src = src.replace(
          'if (isJidUser(msg.key.remoteJid)) {',
          'if (isJidUser(msg.key.remoteJid) || isLidUser(msg.key.remoteJid)) {'
        );
        changed = true;
      }

      if (src.includes('if (retryCount > 1 || forceIncludeKeys) {')) {
        src = src.replace(
          'if (retryCount > 1 || forceIncludeKeys) {',
          'if (retryCount >= 1 || forceIncludeKeys) {'
        );
        changed = true;
      }

      if (src.includes('response = await requestPlaceholderResend(key);')) {
        src = src.replace(
          'response = await requestPlaceholderResend(key);',
          'void requestPlaceholderResend(key).catch(() => {}); response = undefined;'
        );
        changed = true;
      }
      // Never block sendRetryRequest for 5s awaiting requestPlaceholderResend — send retry receipt immediately!
      const oldSendRetryPlaceholder = `        if (retryCount === 1) {
            //request a resend via phone
            const msgId = await requestPlaceholderResend(msgKey);
            logger.debug(\`sendRetryRequest: requested placeholder resend for message \${msgId}\`);
        }`;
      const newSendRetryPlaceholder = `        if (retryCount === 1 && forceIncludeKeys) {
            // Fire non-blocking placeholder resend only when <enc> was missing, so Signal retry receipts never stall 5s
            void requestPlaceholderResend(msgKey).catch(() => {});
        }`;
      if (src.includes(oldSendRetryPlaceholder)) {
        src = src.replace(oldSendRetryPlaceholder, newSendRetryPlaceholder);
        changed = true;
      }

      // Ensure sendMessagesAgain falls back to globalThis.__waSentMessagesCache and preserves additionalNodes/additionalAttributes on retries
      const oldGetMsgs = `        const msgs = await Promise.all(ids.map(id => getMessage({ ...key, id })));`;
      const newGetMsgs = `        const msgs = await Promise.all(ids.map(async id => (await getMessage({ ...key, id })) || globalThis.__waSentMessagesCache?.get(id)));`;
      if (src.includes(oldGetMsgs)) {
        src = src.replace(oldGetMsgs, newGetMsgs);
        changed = true;
      }

      const oldRetryOptsDecl = `                const msgRelayOpts = { messageId: ids[i] };`;
      const newRetryOptsDecl = `                const cachedRelayOpts = globalThis.__waSentRelayOptsCache?.get(ids[i]);
                const msgRelayOpts = {
                    messageId: ids[i],
                    ...(cachedRelayOpts?.additionalNodes ? { additionalNodes: cachedRelayOpts.additionalNodes } : {}),
                    ...(cachedRelayOpts?.additionalAttributes ? { additionalAttributes: cachedRelayOpts.additionalAttributes } : {}),
                };`;
      if (src.includes(oldRetryOptsDecl) && !src.includes('__waSentRelayOptsCache')) {
        src = src.replace(oldRetryOptsDecl, newRetryOptsDecl);
        changed = true;
      }

      // Never sendToAll in groups or when our own device asks for a retry — avoid clobbering friend sessions
      const oldSendToAll = `        const sendToAll = !jidDecode(participant)?.device;`;
      const prevPatchedSendToAll = `        const isGroup = isJidGroup(remoteJid);
        const sendToAll = !isGroup && !jidDecode(participant)?.device;`;
      const newSendToAll = `        const isGroup = isJidGroup(remoteJid);
        const isMeRetry = areJidsSameUser(participant, authState.creds.me?.id) || (authState.creds.me?.lid ? areJidsSameUser(participant, authState.creds.me.lid) : false);
        const sendToAll = !isGroup && !isMeRetry && !jidDecode(participant)?.device;`;
      if (src.includes(oldSendToAll) && !src.includes('isMeRetry')) {
        src = src.replace(oldSendToAll, newSendToAll);
        changed = true;
      } else if (src.includes(prevPatchedSendToAll) && !src.includes('isMeRetry')) {
        src = src.replace(prevPatchedSendToAll, newSendToAll);
        changed = true;
      }

      // Do not wipe entire group sender-key-memory on participant retry
      const oldGroupReset = `        if (isJidGroup(remoteJid)) {
            await authState.keys.set({ 'sender-key-memory': { [remoteJid]: null } });
        }`;
      const newGroupReset = `        if (isJidGroup(remoteJid)) {
            // Keep group sender keys intact for existing participants
        }`;
      if (src.includes(oldGroupReset)) {
        src = src.replace(oldGroupReset, newGroupReset);
        changed = true;
      }

      const prevCleanRetryTargets = `        const retryTargets = isGroup
            ? [participant].filter(j => j && !isJidGroup(j) && !isJidBroadcast(j) && !isJidNewsletter(j))
            : Array.from(new Set([
                participant,
                remoteJid,
                key?.participant,
                key?.remoteJid
            ].filter(j => j && !isJidGroup(j) && !isJidBroadcast(j) && !isJidNewsletter(j))));
        if (retryTargets.length > 0) {
            await assertSessions(retryTargets, true);
        }`;

      const prevPatchedWithForceTrue = `        if (retryTargets.length > 0) {
            await assertSessions(retryTargets, true);
        }
        globalThis.__waOnRetryReceipt?.({ phase: 'retry_send', remoteJid, participant, isMeRetry, sendToAll, ids, foundCount: msgs.filter(Boolean).length });`;

      const retryAssertLogic = `        const retryCount = +(retryNode?.attrs?.count || 1);
        if (retryTargets.length > 0) {
            // Preserve healthy existing 1:1 sessions on first retry (count=1); only force fresh prekey fetch on count>=2
            await assertSessions(retryTargets, retryCount >= 2);
        }
        if (isGroup && retryCount >= 2 && participant) {
            try {
                const memRes = await authState.keys.get('sender-key-memory', [remoteJid]);
                const curMem = memRes?.[remoteJid];
                if (curMem && curMem[participant]) {
                    const updatedMem = { ...curMem };
                    delete updatedMem[participant];
                    await authState.keys.set({ 'sender-key-memory': { [remoteJid]: updatedMem } });
                }
            } catch {}
        }
        globalThis.__waOnRetryReceipt?.({ phase: 'retry_send', remoteJid, participant, isMeRetry, sendToAll, retryCount, ids, foundCount: msgs.filter(Boolean).length });`;

      const cleanRetryTargets = `        const retryTargets = (isGroup || isMeRetry)
            ? [participant].filter(j => j && !isJidGroup(j) && !isJidBroadcast(j) && !isJidNewsletter(j))
            : Array.from(new Set([
                participant,
                remoteJid,
                key?.participant,
                key?.remoteJid
            ].filter(j => j && !isJidGroup(j) && !isJidBroadcast(j) && !isJidNewsletter(j))));
${retryAssertLogic}`;

      if (src.includes('await assertSessions([participant], true);')) {
        src = src.replace('        await assertSessions([participant], true);', cleanRetryTargets);
        changed = true;
      } else if (src.includes(prevPatchedWithForceTrue)) {
        src = src.replace(prevPatchedWithForceTrue, retryAssertLogic);
        changed = true;
      } else if (src.includes(prevCleanRetryTargets) && !src.includes("phase: 'retry_send'")) {
        src = src.replace(prevCleanRetryTargets, cleanRetryTargets);
        changed = true;
      } else if (src.includes(`        const retryTargets = Array.from(new Set([participant, remoteJid, authState.creds.me?.id ? jidNormalizedUser(authState.creds.me.id) : undefined, authState.creds.me?.lid ? jidNormalizedUser(authState.creds.me.lid) : undefined].filter(Boolean)));
        await assertSessions(retryTargets, true);`)) {
        src = src.replace(
          `        const retryTargets = Array.from(new Set([participant, remoteJid, authState.creds.me?.id ? jidNormalizedUser(authState.creds.me.id) : undefined, authState.creds.me?.lid ? jidNormalizedUser(authState.creds.me.lid) : undefined].filter(Boolean)));
        await assertSessions(retryTargets, true);`,
          cleanRetryTargets
        );
        changed = true;
      }

      if (src.includes('count: +retryNode.attrs.count')) {
        src = src.replace('count: +retryNode.attrs.count', 'count: +(retryNode?.attrs?.count || 1)');
        changed = true;
      }

      const enhancedRetryCheck = `                        globalThis.__waOnRetryReceipt?.({ phase: 'retry_recv', from: attrs.from, recipient: attrs.recipient, participant: key.participant, ids, count: retryNode?.attrs?.count });
                        if (willSendMessageAgain(ids[0], key.participant)) {
                            key.fromMe = true;
                            const storedTarget = globalThis.__waSentMsgDestinationMap?.get(ids[0]);
                            if (storedTarget) {
                                key.remoteJid = storedTarget;
                            } else if (!key.remoteJid) {
                                key.remoteJid = attrs.recipient || attrs.from;
                            }
                            if (key.fromMe) {`;

      const prevEnhancedRetryCheck = `                        if (willSendMessageAgain(ids[0], key.participant)) {
                            key.fromMe = true;
                            const storedTarget = globalThis.__waSentMsgDestinationMap?.get(ids[0]);
                            if (storedTarget) {
                                key.remoteJid = storedTarget;
                            } else if (!key.remoteJid) {
                                key.remoteJid = attrs.recipient || attrs.from;
                            }
                            if (key.fromMe) {`;

      if (src.includes(prevEnhancedRetryCheck) && !src.includes("phase: 'retry_recv'")) {
        src = src.replace(prevEnhancedRetryCheck, enhancedRetryCheck);
        changed = true;
      } else if (src.includes(`                        if (willSendMessageAgain(ids[0], key.participant)) {
                            key.fromMe = true;
                            if (!key.remoteJid) {
                                key.remoteJid = attrs.recipient || attrs.from;
                            }
                            if (key.fromMe) {`)) {
        src = src.replace(
          `                        if (willSendMessageAgain(ids[0], key.participant)) {
                            key.fromMe = true;
                            if (!key.remoteJid) {
                                key.remoteJid = attrs.recipient || attrs.from;
                            }
                            if (key.fromMe) {`,
          enhancedRetryCheck
        );
        changed = true;
      } else if (src.includes(`                        if (willSendMessageAgain(ids[0], key.participant)) {
                            if (key.fromMe) {`)) {
        src = src.replace(
          `                        if (willSendMessageAgain(ids[0], key.participant)) {
                            if (key.fromMe) {`,
          enhancedRetryCheck
        );
        changed = true;
      }

      const oldBadAckWarn = `        if (attrs.error) {\n            logger.warn({ attrs }, 'received error in ack');`;
      const newBadAckWarn = `        if (attrs.error) {\n            globalThis.__waOnAckError?.(attrs);\n            logger.warn({ attrs }, 'received error in ack');`;
      if (src.includes(oldBadAckWarn) && !src.includes('__waOnAckError')) {
        src = src.replace(oldBadAckWarn, newBadAckWarn);
        changed = true;
      }

      const oldDmRcptAnchor = `                        else {\n                            ev.emit('messages.update', ids.map(id => ({`;
      const newDmRcptAnchor = `                        else {\n                            globalThis.__waOnRetryReceipt?.({ phase: 'dm_rcpt', type: attrs.type || 'delivery', from: attrs.from, recipient: attrs.recipient, ids });\n                            ev.emit('messages.update', ids.map(id => ({`;
      if (src.includes(oldDmRcptAnchor) && !src.includes("phase: 'dm_rcpt'")) {
        src = src.replace(oldDmRcptAnchor, newDmRcptAnchor);
        changed = true;
      }

      const oldLinkRegCase = `            case 'link_code_companion_reg':
                const linkCodeCompanionReg = getBinaryNodeChild(node, 'link_code_companion_reg');`;
      const newLinkRegCase = `            case 'link_code_companion_reg':
                globalThis.__waOnPairingEvent?.({ phase: 'companion_reg_recv', jid: authState.creds?.me?.id });
                const linkCodeCompanionReg = getBinaryNodeChild(node, 'link_code_companion_reg');`;
      if (src.includes(oldLinkRegCase) && !src.includes('companion_reg_recv')) {
        src = src.replace(oldLinkRegCase, newLinkRegCase);
        changed = true;
      }

      const oldLinkFinishDone = `                authState.creds.registered = true;
                ev.emit('creds.update', authState.creds);`;
      const newLinkFinishDone = `                globalThis.__waOnPairingEvent?.({ phase: 'companion_finish_ok', jid: authState.creds?.me?.id });
                authState.creds.registered = true;
                ev.emit('creds.update', authState.creds);`;
      if (src.includes(oldLinkFinishDone) && !src.includes('companion_finish_ok')) {
        src = src.replace(oldLinkFinishDone, newLinkFinishDone);
        changed = true;
      }

      if (changed) {
        fs.writeFileSync(msgRecvPath, src, 'utf-8');
      }
    }
  } catch (err) {
    console.error('[X-IK AI] Failed to apply Baileys patches:', err);
  }
}

applyBaileysPatchesSync();
