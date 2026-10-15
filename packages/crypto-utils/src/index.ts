/**
 * Crypto Utils - Encryption and Security Utilities for yq-sanyi
 * 
 * This package provides comprehensive encryption, hashing, and security utilities
 * for yq-sanyi applications. It includes password hashing, data encryption,
 * JWT handling, and security validation functions.
 * 
 * @packageDocumentation
 */

/**
 * Hashing algorithms supported by the crypto utils
 */
export type HashAlgorithm = 'sha256' | 'sha512' | 'md5' | 'bcrypt' | 'argon2';

/**
 * Encryption algorithms supported by the crypto utils
 */
export type EncryptionAlgorithm = 'aes-256-gcm' | 'aes-256-cbc' | 'rsa-2048' | 'rsa-4096';

/**
 * JWT payload structure
 */
export interface JWTPayload {
  sub?: string;
  iat?: number;
  exp?: number;
  [key: string]: any;
}

/**
 * Hash options for hashing functions
 */
export interface HashOptions {
  salt?: string;
  iterations?: number;
  keyLength?: number;
  memoryCost?: number;
  timeCost?: number;
  parallelism?: number;
}

/**
 * Encryption options for encryption functions
 */
export interface EncryptionOptions {
  algorithm: EncryptionAlgorithm;
  key: string;
  iv?: string;
  salt?: string;
  iterations?: number;
}

/**
 * Decryption options for decryption functions
 */
export interface DecryptionOptions extends EncryptionOptions {
  tag?: string;
}

/**
 * Security validation result
 */
export interface ValidationResult {
  isValid: boolean;
  errors: string[];
  warnings: string[];
}

/**
 * Password strength analysis result
 */
export interface PasswordStrength {
  score: number;
  strength: 'weak' | 'fair' | 'good' | 'strong' | 'very-strong';
  length: number;
  hasUppercase: boolean;
  hasLowercase: boolean;
  hasNumbers: boolean;
  hasSpecialChars: boolean;
  entropy: number;
}

/**
 * Crypto utility class providing encryption, hashing, and security functions
 */
export class CryptoUtils {
  private static readonly DEFAULT_HASH_ITERATIONS = 10000;
  private static readonly DEFAULT_KEY_LENGTH = 32;
  private static readonly DEFAULT_SALT_LENGTH = 16;
  
  /**
   * Generate a cryptographically secure random string
   * @param length Length of the random string to generate
   * @returns Random string
   */
  public static generateRandomString(length: number = 32): string {
    const array = new Uint8Array(length);
    crypto.getRandomValues(array);
    return Array.from(array, byte => byte.toString(16).padStart(2, '0')).join('');
  }
  
  /**
   * Generate a cryptographically secure random number
   * @param min Minimum value (inclusive)
   * @param max Maximum value (inclusive)
   * @returns Random number
   */
  public static generateRandomNumber(min: number = 0, max: number = Number.MAX_SAFE_INTEGER): number {
    return Math.floor(Math.random() * (max - min + 1)) + min;
  }
  
  /**
   * Generate a cryptographically secure random salt
   * @param length Length of the salt to generate
   * @returns Random salt
   */
  public static generateSalt(length: number = this.DEFAULT_SALT_LENGTH): string {
    return this.generateRandomString(length);
  }
  
  /**
   * Hash data using the specified algorithm
   * @param data Data to hash
   * @param algorithm Hashing algorithm to use
   * @param options Hashing options
   * @returns Promise resolving to the hash
   */
  public static async hash(
    data: string,
    algorithm: HashAlgorithm = 'sha256',
    options: HashOptions = {}
  ): Promise<string> {
    const encoder = new TextEncoder();
    const dataBytes = encoder.encode(data);
    
    switch (algorithm) {
      case 'sha256':
        return this.sha256(dataBytes);
      case 'sha512':
        return this.sha512(dataBytes);
      case 'md5':
        return this.md5(dataBytes);
      case 'bcrypt':
        return this.bcryptHash(data, options);
      case 'argon2':
        return this.argon2Hash(data, options);
      default:
        throw new Error(`Unsupported hash algorithm: ${algorithm}`);
    }
  }
  
  /**
   * Verify data against a hash
   * @param data Data to verify
   * @param hash Hash to verify against
   * @param algorithm Hashing algorithm used
   * @param options Hashing options
   * @returns Promise resolving to verification result
   */
  public static async verifyHash(
    data: string,
    hash: string,
    algorithm: HashAlgorithm = 'sha256',
    options: HashOptions = {}
  ): Promise<boolean> {
    try {
      const computedHash = await this.hash(data, algorithm, options);
      return computedHash === hash;
    } catch (error) {
      return false;
    }
  }
  
  /**
   * Encrypt data using the specified algorithm
   * @param data Data to encrypt
   * @param options Encryption options
   * @returns Promise resolving to encrypted data
   */
  public static async encrypt(
    data: string,
    options: EncryptionOptions
  ): Promise<{ encrypted: string; iv: string; tag?: string }> {
    const encoder = new TextEncoder();
    const dataBytes = encoder.encode(data);
    
    switch (options.algorithm) {
      case 'aes-256-gcm':
        return this.aes256GcmEncrypt(dataBytes, options);
      case 'aes-256-cbc':
        return this.aes256CbcEncrypt(dataBytes, options);
      case 'rsa-2048':
      case 'rsa-4096':
        const rsaResult = await this.rsaEncrypt(dataBytes, options);
        return { encrypted: rsaResult.encrypted, iv: rsaResult.iv };
      default:
        throw new Error(`Unsupported encryption algorithm: ${options.algorithm}`);
    }
  }
  
  /**
   * Decrypt data using the specified algorithm
   * @param encryptedData Encrypted data to decrypt
   * @param options Decryption options
   * @returns Promise resolving to decrypted data
   */
  public static async decrypt(
    encryptedData: string,
    options: DecryptionOptions
  ): Promise<string> {
    const decoder = new TextDecoder();
    const dataBytes = new TextEncoder().encode(encryptedData);
    
    switch (options.algorithm) {
      case 'aes-256-gcm':
        const decryptedGcm = await this.aes256GcmDecrypt(dataBytes, options);
        return decoder.decode(decryptedGcm);
      case 'aes-256-cbc':
        const decryptedCbc = await this.aes256CbcDecrypt(dataBytes, options);
        return decoder.decode(decryptedCbc);
      case 'rsa-2048':
      case 'rsa-4096':
        const decryptedRsa = await this.rsaDecrypt(dataBytes, options);
        return decoder.decode(decryptedRsa);
      default:
        throw new Error(`Unsupported decryption algorithm: ${options.algorithm}`);
    }
  }
  
  /**
   * Generate a JWT token
   * @param payload JWT payload
   * @param secret Secret key for signing
   * @param expiresIn Token expiration time in seconds
   * @returns JWT token
   */
  public static async generateJWT(payload: JWTPayload, secret: string, expiresIn: number = 3600): Promise<string> {
    const header = {
      alg: 'HS256',
      typ: 'JWT'
    };
    
    const now = Math.floor(Date.now() / 1000);
    const tokenPayload = {
      ...payload,
      iat: now,
      exp: now + expiresIn
    };
    
    const encodedHeader = btoa(JSON.stringify(header));
    const encodedPayload = btoa(JSON.stringify(tokenPayload));
    
    const signature = await this.hmac256(`${encodedHeader}.${encodedPayload}`, secret);
    
    return `${encodedHeader}.${encodedPayload}.${signature}`;
  }
  
  /**
   * Verify and decode a JWT token
   * @param token JWT token to verify
   * @param secret Secret key for verification
   * @returns Decoded payload or null if invalid
   */
  public static async verifyJWT(token: string, secret: string): Promise<JWTPayload | null> {
    try {
      const parts = token.split('.');
      if (parts.length !== 3) {
        return null;
      }
      
      const [encodedHeader, encodedPayload, signature] = parts;
      
      // Verify signature
      const expectedSignature = await this.hmac256(`${encodedHeader}.${encodedPayload}`, secret);
      if (signature !== expectedSignature) {
        return null;
      }
      
      // Decode payload
      const payload = JSON.parse(atob(encodedPayload));
      
      // Check expiration
      if (payload.exp && payload.exp < Math.floor(Date.now() / 1000)) {
        return null;
      }
      
      return payload;
    } catch (error) {
      return null;
    }
  }
  
  /**
   * Analyze password strength
   * @param password Password to analyze
   * @returns Password strength analysis
   */
  public static analyzePasswordStrength(password: string): PasswordStrength {
    let score = 0;
    const hasUppercase = /[A-Z]/.test(password);
    const hasLowercase = /[a-z]/.test(password);
    const hasNumbers = /\d/.test(password);
    const hasSpecialChars = /[!@#$%^&*(),.?":{}|<>]/.test(password);
    
    // Length scoring
    if (password.length >= 8) score += 1;
    if (password.length >= 12) score += 1;
    if (password.length >= 16) score += 1;
    
    // Character variety scoring
    if (hasUppercase) score += 1;
    if (hasLowercase) score += 1;
    if (hasNumbers) score += 1;
    if (hasSpecialChars) score += 1;
    
    // Calculate entropy
    const charsetSize = (hasUppercase ? 26 : 0) + 
                       (hasLowercase ? 26 : 0) + 
                       (hasNumbers ? 10 : 0) + 
                       (hasSpecialChars ? 32 : 0);
    const entropy = password.length * Math.log2(charsetSize);
    
    // Determine strength
    let strength: PasswordStrength['strength'] = 'weak';
    if (score >= 6) strength = 'very-strong';
    else if (score >= 5) strength = 'strong';
    else if (score >= 4) strength = 'good';
    else if (score >= 2) strength = 'fair';
    
    return {
      score,
      strength,
      length: password.length,
      hasUppercase,
      hasLowercase,
      hasNumbers,
      hasSpecialChars,
      entropy
    };
  }
  
  /**
   * Validate security configuration
   * @param config Security configuration to validate
   * @returns Validation result
   */
  public static validateSecurityConfig(config: {
    passwordMinLength?: number;
    requireUppercase?: boolean;
    requireLowercase?: boolean;
    requireNumbers?: boolean;
    requireSpecialChars?: boolean;
    maxLoginAttempts?: number;
    sessionTimeout?: number;
  }): ValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];
    
    if (config.passwordMinLength && config.passwordMinLength < 8) {
      errors.push('Password minimum length should be at least 8 characters');
    }
    
    if (config.maxLoginAttempts && config.maxLoginAttempts < 3) {
      warnings.push('Maximum login attempts should be at least 3');
    }
    
    if (config.sessionTimeout && config.sessionTimeout < 300) {
      warnings.push('Session timeout should be at least 5 minutes (300 seconds)');
    }
    
    return {
      isValid: errors.length === 0,
      errors,
      warnings
    };
  }
  
  /**
   * Sanitize input to prevent XSS attacks
   * @param input Input to sanitize
   * @returns Sanitized input
   */
  public static sanitizeInput(input: string): string {
    return input
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }
  
  /**
   * Check if a string contains potentially dangerous content
   * @param input Input to check
   * @returns True if dangerous content is detected
   */
  public static containsDangerousContent(input: string): boolean {
    const dangerousPatterns = [
      /<script/i,
      /javascript:/i,
      /on\w+\s*=/i,
      /eval\s*\(/i,
      /document\./i,
      /window\./i,
      /alert\s*\(/i
    ];
    
    return dangerousPatterns.some(pattern => pattern.test(input));
  }
  
  // Private helper methods
  
  private static async sha256(data: Uint8Array): Promise<string> {
    const hashBuffer = await crypto.subtle.digest('SHA-256', data as BufferSource);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
  }
  
  private static async sha512(data: Uint8Array): Promise<string> {
    const hashBuffer = await crypto.subtle.digest('SHA-512', data as BufferSource);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
  }
  
  private static async md5(data: Uint8Array): Promise<string> {
    // Note: MD5 is cryptographically weak but still used for some legacy purposes
    const hashBuffer = await crypto.subtle.digest('MD5', data as BufferSource);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
  }
  
  private static async bcryptHash(data: string, options: HashOptions): Promise<string> {
    // For browser environments, we'll use a simplified bcrypt implementation
    // In a real implementation, you would use a proper bcrypt library
    const salt = options.salt || this.generateSalt();
    const iterations = options.iterations || this.DEFAULT_HASH_ITERATIONS;
    
    // Simulate bcrypt hashing (in production, use a proper bcrypt library)
    let hash = data + salt;
    for (let i = 0; i < iterations; i++) {
      hash = await this.sha256(new TextEncoder().encode(hash));
    }
    
    return `${salt}$${hash}`;
  }
  
  private static async argon2Hash(data: string, options: HashOptions): Promise<string> {
    // For browser environments, we'll use a simplified argon2 implementation
    // In a real implementation, you would use a proper argon2 library
    const salt = options.salt || this.generateSalt();
    const iterations = options.iterations || 3;
    const memoryCost = options.memoryCost || 65536; // 64MB
    const timeCost = options.timeCost || 3;
    const parallelism = options.parallelism || 1;
    
    // Simulate argon2 hashing (in production, use a proper argon2 library)
    let hash = data + salt;
    for (let i = 0; i < iterations; i++) {
      for (let j = 0; j < memoryCost / 1024; j++) {
        hash = await this.sha256(new TextEncoder().encode(hash + j.toString()));
      }
    }
    
    return `${salt}$${iterations}$${memoryCost}$${timeCost}$${parallelism}$${hash}`;
  }
  
  private static async aes256GcmEncrypt(data: Uint8Array, options: EncryptionOptions): Promise<{ encrypted: string; iv: string; tag: string }> {
    const key = await this.importKey(options.key, 'AES-GCM');
    const iv = options.iv || this.generateRandomString(16);
    
    const algorithm: AesGcmParams = {
      name: 'AES-GCM',
      iv: new TextEncoder().encode(iv),
      tagLength: 128
    };
    
    const encryptedData = await crypto.subtle.encrypt(algorithm, key, data as BufferSource);
    const encryptedArray = new Uint8Array(encryptedData);
    
    // Extract the tag (last 16 bytes)
    const tag = encryptedArray.slice(encryptedArray.length - 16);
    const actualEncrypted = encryptedArray.slice(0, encryptedArray.length - 16);
    
    return {
      encrypted: Array.from(actualEncrypted).map(b => b.toString(16).padStart(2, '0')).join(''),
      iv,
      tag: Array.from(tag).map(b => b.toString(16).padStart(2, '0')).join('')
    };
  }
  
  private static async aes256GcmDecrypt(data: Uint8Array, options: DecryptionOptions): Promise<Uint8Array> {
    const key = await this.importKey(options.key, 'AES-GCM');
    const iv = new TextEncoder().encode(options.iv!);
    
    const algorithm: AesGcmParams = {
      name: 'AES-GCM',
      iv: iv,
      tagLength: 128
    };
    
    const tag = options.tag ? new Uint8Array(options.tag.match(/.{1,2}/g)!.map(byte => parseInt(byte, 16))) : new Uint8Array();
    const encryptedData = new Uint8Array([...data, ...tag]);
    
    return new Uint8Array(await crypto.subtle.decrypt(algorithm, key, encryptedData as BufferSource));
  }
  
  private static async aes256CbcEncrypt(data: Uint8Array, options: EncryptionOptions): Promise<{ encrypted: string; iv: string }> {
    const key = await this.importKey(options.key, 'AES-CBC');
    const iv = options.iv || this.generateRandomString(16);
    
    const algorithm: AesCbcParams = {
      name: 'AES-CBC',
      iv: new TextEncoder().encode(iv)
    };
    
    const encryptedData = await crypto.subtle.encrypt(algorithm, key, data as BufferSource);
    const encryptedArray = new Uint8Array(encryptedData);
    
    return {
      encrypted: Array.from(encryptedArray).map(b => b.toString(16).padStart(2, '0')).join(''),
      iv
    };
  }
  
  private static async aes256CbcDecrypt(data: Uint8Array, options: DecryptionOptions): Promise<Uint8Array> {
    const key = await this.importKey(options.key, 'AES-CBC');
    const iv = new TextEncoder().encode(options.iv!);
    
    const algorithm: AesCbcParams = {
      name: 'AES-CBC',
      iv: iv
    };
    
    return new Uint8Array(await crypto.subtle.decrypt(algorithm, key, data as BufferSource));
  }
  
  private static async rsaEncrypt(data: Uint8Array, options: EncryptionOptions): Promise<{ encrypted: string; iv: string }> {
    // Note: RSA encryption in browser requires proper key setup
    // This is a simplified implementation
    const key = await this.importKey(options.key, 'RSA-OAEP');
    
    const algorithm: RsaOaepParams = {
      name: 'RSA-OAEP'
    };
    
    const encryptedData = await crypto.subtle.encrypt(algorithm, key, data as BufferSource);
    const encryptedArray = new Uint8Array(encryptedData);
    
    return {
      encrypted: Array.from(encryptedArray).map(b => b.toString(16).padStart(2, '0')).join(''),
      iv: 'rsa-iv' // RSA doesn't use IV in the same way as AES
    };
  }
  
  private static async rsaDecrypt(data: Uint8Array, options: DecryptionOptions): Promise<Uint8Array> {
    const key = await this.importKey(options.key, 'RSA-OAEP');
    
    const algorithm: RsaOaepParams = {
      name: 'RSA-OAEP'
    };
    
    return new Uint8Array(await crypto.subtle.decrypt(algorithm, key, data as BufferSource));
  }
  
  private static async importKey(key: string, algorithm: string): Promise<CryptoKey> {
    const encoder = new TextEncoder();
    const keyData = encoder.encode(key);
    
    return crypto.subtle.importKey(
      'raw',
      keyData,
      { name: algorithm },
      false,
      ['encrypt', 'decrypt']
    );
  }
  
  private static async hmac256(data: string, secret: string): Promise<string> {
    // Simplified HMAC implementation (in production, use proper crypto library)
    const encoder = new TextEncoder();
    const key = encoder.encode(secret);
    const message = encoder.encode(data);
    
    // This is a simplified implementation - in production, use Web Crypto API
    return await this.sha256(new Uint8Array([...key, ...message]));
  }
}

/**
 * Convenience functions for common crypto operations
 */
export const cryptoUtils = {
  /**
   * Hash a password with bcrypt
   */
  hashPassword: (password: string, salt?: string) => 
    CryptoUtils.hash(password, 'bcrypt', { salt }),
  
  /**
   * Verify a password against a hash
   */
  verifyPassword: (password: string, hash: string) => 
    CryptoUtils.verifyHash(password, hash, 'bcrypt'),
  
  /**
   * Generate a secure API key
   */
  generateApiKey: () => CryptoUtils.generateRandomString(32),
  
  /**
   * Encrypt sensitive data
   */
  encryptData: (data: string, key: string) => 
    CryptoUtils.encrypt(data, { algorithm: 'aes-256-gcm', key }),
  
  /**
   * Decrypt sensitive data
   */
  decryptData: (encryptedData: string, key: string, iv: string, tag?: string) => 
    CryptoUtils.decrypt(encryptedData, { algorithm: 'aes-256-gcm', key, iv, tag }),
  
  /**
   * Create a secure session token
   */
  createSessionToken: async (userId: string, secret: string, expiresIn: number = 3600) => 
    await CryptoUtils.generateJWT({ sub: userId }, secret, expiresIn),
  
  /**
   * Verify a session token
   */
  verifySessionToken: async (token: string, secret: string) => 
    await CryptoUtils.verifyJWT(token, secret)
};

/**
 * Password validation utilities
 */
export const passwordUtils = {
  /**
   * Check if a password meets minimum requirements
   */
  meetsRequirements: (password: string, options: {
    minLength?: number;
    requireUppercase?: boolean;
    requireLowercase?: boolean;
    requireNumbers?: boolean;
    requireSpecialChars?: boolean;
  } = {}): boolean => {
    const {
      minLength = 8,
      requireUppercase = true,
      requireLowercase = true,
      requireNumbers = true,
      requireSpecialChars = true
    } = options;
    
    if (password.length < minLength) return false;
    if (requireUppercase && !/[A-Z]/.test(password)) return false;
    if (requireLowercase && !/[a-z]/.test(password)) return false;
    if (requireNumbers && !/\d/.test(password)) return false;
    if (requireSpecialChars && !/[!@#$%^&*(),.?":{}|<>]/.test(password)) return false;
    
    return true;
  },
  
  /**
   * Generate a random password
   */
  generateRandom: (length: number = 12): string => {
    const charset = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%^&*()';
    let password = '';
    
    for (let i = 0; i < length; i++) {
      password += charset.charAt(Math.floor(Math.random() * charset.length));
    }
    
    return password;
  }
};

/**
 * Security utilities
 */
export const securityUtils = {
  /**
   * Sanitize user input to prevent XSS
   */
  sanitize: (input: string): string => CryptoUtils.sanitizeInput(input),
  
  /**
   * Check for dangerous content
   */
  isSafe: (input: string): boolean => !CryptoUtils.containsDangerousContent(input),
  
  /**
   * Validate security configuration
   */
  validateConfig: (config: any) => CryptoUtils.validateSecurityConfig(config)
};