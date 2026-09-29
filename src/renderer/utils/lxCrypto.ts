import CryptoJS from 'crypto-js';
import { JSEncrypt } from 'jsencrypt';

export const md5 = (str: string): string => {
  return CryptoJS.MD5(str).toString();
};

const u8ToWordArray = (u8: Uint8Array): CryptoJS.lib.WordArray => {
  const words: number[] = [];
  for (let i = 0; i < u8.length; i += 4) {
    words.push(
      ((u8[i] || 0) << 24) | ((u8[i + 1] || 0) << 16) | ((u8[i + 2] || 0) << 8) | (u8[i + 3] || 0)
    );
  }
  return CryptoJS.lib.WordArray.create(words, u8.length);
};

const toKeyWordArray = (
  input: string | Uint8Array | CryptoJS.lib.WordArray | null | undefined
): CryptoJS.lib.WordArray | undefined => {
  if (input == null) return undefined;
  if (typeof input === 'string') return CryptoJS.enc.Utf8.parse(input);
  if (input instanceof Uint8Array) return u8ToWordArray(input);
  return input;
};

export const randomBytes = (size: number): string => {
  const array = new Uint8Array(size);
  crypto.getRandomValues(array);
  return Array.from(array)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
};

export const aesEncrypt = (
  buffer: string | Uint8Array,
  mode: string,
  key: string | Uint8Array | CryptoJS.lib.WordArray,
  iv?: string | Uint8Array | CryptoJS.lib.WordArray | null
): Uint8Array => {
  try {
    let wordArray: CryptoJS.lib.WordArray;
    if (typeof buffer === 'string') {
      wordArray = CryptoJS.enc.Utf8.parse(buffer);
    } else {
      const words: number[] = [];
      for (let i = 0; i < buffer.length; i += 4) {
        words.push(
          ((buffer[i] || 0) << 24) |
            ((buffer[i + 1] || 0) << 16) |
            ((buffer[i + 2] || 0) << 8) |
            (buffer[i + 3] || 0)
        );
      }
      wordArray = CryptoJS.lib.WordArray.create(words, buffer.length);
    }

    const keyWordArray = toKeyWordArray(key)!;
    const ivWordArray = toKeyWordArray(iv);

    const modeObj = getModeFromString(mode);

    const encrypted = CryptoJS.AES.encrypt(wordArray, keyWordArray, {
      iv: ivWordArray,
      mode: modeObj,
      padding: CryptoJS.pad.Pkcs7
    });

    const ciphertext = encrypted.ciphertext;
    const result = new Uint8Array(ciphertext.words.length * 4);
    for (let i = 0; i < ciphertext.words.length; i++) {
      const word = ciphertext.words[i];
      result[i * 4] = (word >>> 24) & 0xff;
      result[i * 4 + 1] = (word >>> 16) & 0xff;
      result[i * 4 + 2] = (word >>> 8) & 0xff;
      result[i * 4 + 3] = word & 0xff;
    }

    return result.slice(0, ciphertext.sigBytes);
  } catch (error) {
    console.error('[lxCrypto] AES Encryption failed:', error);
    throw error;
  }
};

export const aesDecrypt = (
  buffer: Uint8Array,
  mode: string,
  key: string | Uint8Array | CryptoJS.lib.WordArray,
  iv?: string | Uint8Array | CryptoJS.lib.WordArray | null
): Uint8Array => {
  try {
    const words: number[] = [];
    for (let i = 0; i < buffer.length; i += 4) {
      words.push(
        ((buffer[i] || 0) << 24) |
          ((buffer[i + 1] || 0) << 16) |
          ((buffer[i + 2] || 0) << 8) |
          (buffer[i + 3] || 0)
      );
    }
    const ciphertext = CryptoJS.lib.WordArray.create(words, buffer.length);

    const keyWordArray = toKeyWordArray(key)!;
    const ivWordArray = toKeyWordArray(iv);

    const modeObj = getModeFromString(mode);

    const cipherParams = CryptoJS.lib.CipherParams.create({
      ciphertext
    });

    const decrypted = CryptoJS.AES.decrypt(cipherParams, keyWordArray, {
      iv: ivWordArray,
      mode: modeObj,
      padding: CryptoJS.pad.Pkcs7
    });

    const result = new Uint8Array(decrypted.words.length * 4);
    for (let i = 0; i < decrypted.words.length; i++) {
      const word = decrypted.words[i];
      result[i * 4] = (word >>> 24) & 0xff;
      result[i * 4 + 1] = (word >>> 16) & 0xff;
      result[i * 4 + 2] = (word >>> 8) & 0xff;
      result[i * 4 + 3] = word & 0xff;
    }

    return result.slice(0, decrypted.sigBytes);
  } catch (error) {
    console.error('[lxCrypto] AES Decryption failed:', error);
    throw error;
  }
};

export const rsaEncrypt = (buffer: string | Uint8Array, publicKey: string): Uint8Array => {
  try {
    const encrypt = new JSEncrypt();
    encrypt.setPublicKey(publicKey);

    let input: string;
    if (typeof buffer === 'string') {
      input = buffer;
    } else {
      input = new TextDecoder().decode(buffer);
    }

    const encrypted = encrypt.encrypt(input);
    if (!encrypted) {
      throw new Error('RSA encryption failed');
    }

    const binaryString = atob(encrypted);
    const result = new Uint8Array(binaryString.length);
    for (let i = 0; i < binaryString.length; i++) {
      result[i] = binaryString.charCodeAt(i);
    }

    return result;
  } catch (error) {
    console.error('[lxCrypto] RSA Encryption failed:', error);
    throw error;
  }
};

export const rsaDecrypt = (buffer: Uint8Array, privateKey: string): Uint8Array => {
  try {
    const decrypt = new JSEncrypt();
    decrypt.setPrivateKey(privateKey);

    let binaryString = '';
    for (let i = 0; i < buffer.length; i++) {
      binaryString += String.fromCharCode(buffer[i]);
    }
    const base64 = btoa(binaryString);

    const decrypted = decrypt.decrypt(base64);
    if (!decrypted) {
      throw new Error('RSA decryption failed');
    }

    return new TextEncoder().encode(decrypted);
  } catch (error) {
    console.error('[lxCrypto] RSA Decryption failed:', error);
    throw error;
  }
};

type CryptoMode = (typeof CryptoJS.mode)[keyof typeof CryptoJS.mode];

const getModeFromString = (mode: string): CryptoMode => {
  const modeStr = mode.toLowerCase().split('-').pop() || mode.toLowerCase();
  switch (modeStr) {
    case 'cbc':
      return CryptoJS.mode.CBC;
    case 'cfb':
      return CryptoJS.mode.CFB;
    case 'ctr':
      return CryptoJS.mode.CTR;
    case 'ofb':
      return CryptoJS.mode.OFB;
    case 'ecb':
      return CryptoJS.mode.ECB;
    default:
      console.warn(`[lxCrypto] Unknown encryption mode: ${mode}, use CBC`);
      return CryptoJS.mode.CBC;
  }
};

export const sha1 = (str: string): string => {
  return CryptoJS.SHA1(str).toString();
};

export const sha256 = (str: string): string => {
  return CryptoJS.SHA256(str).toString();
};

export const base64Encode = (data: string | Uint8Array): string => {
  if (typeof data === 'string') {
    return btoa(data);
  } else {
    let binary = '';
    for (let i = 0; i < data.length; i++) {
      binary += String.fromCharCode(data[i]);
    }
    return btoa(binary);
  }
};

export const base64Decode = (str: string): Uint8Array => {
  const binaryString = atob(str);
  const result = new Uint8Array(binaryString.length);
  for (let i = 0; i < binaryString.length; i++) {
    result[i] = binaryString.charCodeAt(i);
  }
  return result;
};
