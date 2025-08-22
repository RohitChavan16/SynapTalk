import crypto from 'crypto';

export const pg = {
  // Generate cryptographically secure random password
  generatePassword: (length = 16, options = {}) => {
    const defaults = {
      includeUppercase: true,
      includeLowercase: true,
      includeNumbers: true,
      includeSymbols: false,
      excludeSimilar: true, // Exclude similar looking characters like 0, O, l, 1, I
      excludeAmbiguous: true // Exclude ambiguous characters
    };
    
    const opts = { ...defaults, ...options };
    
    let charset = '';
    
    if (opts.includeLowercase) {
      charset += opts.excludeSimilar ? 'abcdefghijkmnopqrstuvwxyz' : 'abcdefghijklmnopqrstuvwxyz';
    }
    
    if (opts.includeUppercase) {
      charset += opts.excludeSimilar ? 'ABCDEFGHJKLMNPQRSTUVWXYZ' : 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
    }
    
    if (opts.includeNumbers) {
      charset += opts.excludeSimilar ? '23456789' : '0123456789';
    }
    
    if (opts.includeSymbols) {
      charset += opts.excludeAmbiguous ? '!@#$%^&*+-=' : '!@#$%^&*()_+-=[]{}|;:,.<>?';
    }
    
    if (charset === '') {
      throw new Error('At least one character type must be included');
    }
    
    let password = '';
    const charsetLength = charset.length;
    
    for (let i = 0; i < length; i++) {
      const randomIndex = crypto.randomInt(0, charsetLength);
      password += charset[randomIndex];
    }
    
    return password;
  },

  // Generate passphrase using word list (more memorable)
  generatePassphrase: (wordCount = 4, separator = '-') => {
    // Simple word list for demonstration - in production, use a proper word list
    const words = [
      'apple', 'banana', 'cherry', 'dragon', 'elephant', 'forest', 'guitar', 'horizon',
      'island', 'jungle', 'kitten', 'lemon', 'mountain', 'ocean', 'piano', 'quartz',
      'rainbow', 'sunset', 'tiger', 'umbrella', 'valley', 'whale', 'xylophone', 'yogurt', 'zebra',
      'bridge', 'candle', 'dance', 'eagle', 'flower', 'globe', 'happy', 'igloo', 'jazz',
      'knight', 'light', 'magic', 'night', 'orange', 'peace', 'queen', 'river', 'star',
      'tree', 'unity', 'voice', 'water', 'yellow', 'zephyr'
    ];
    
    let passphrase = [];
    
    for (let i = 0; i < wordCount; i++) {
      const randomIndex = crypto.randomInt(0, words.length);
      passphrase.push(words[randomIndex]);
    }
    
    return passphrase.join(separator);
  },

  // Generate secure random string (for tokens, keys, etc.)
  generateSecureToken: (length = 32, encoding = 'base64') => {
    const buffer = crypto.randomBytes(length);
    
    switch (encoding) {
      case 'hex':
        return buffer.toString('hex');
      case 'base64':
        return buffer.toString('base64').replace(/[+/=]/g, '');
      case 'base64url':
        return buffer.toString('base64url');
      default:
        return buffer.toString('base64');
    }
  },

  // Check password strength
  checkPasswordStrength: (password) => {
    let score = 0;
    const checks = {
      length: password.length >= 8,
      lowercase: /[a-z]/.test(password),
      uppercase: /[A-Z]/.test(password),
      numbers: /\d/.test(password),
      symbols: /[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(password),
      noCommon: !['password', '123456', 'qwerty', 'abc123', 'password123'].includes(password.toLowerCase())
    };
    
    Object.values(checks).forEach(check => {
      if (check) score++;
    });
    
    let strength;
    if (score <= 2) strength = 'weak';
    else if (score <= 4) strength = 'medium';
    else strength = 'strong';
    
    return {
      score,
      strength,
      checks,
      suggestions: pg._getPasswordSuggestions(checks)
    };
  },

  // Private method to get password improvement suggestions
  _getPasswordSuggestions: (checks) => {
    const suggestions = [];
    
    if (!checks.length) suggestions.push('Use at least 8 characters');
    if (!checks.lowercase) suggestions.push('Add lowercase letters');
    if (!checks.uppercase) suggestions.push('Add uppercase letters');
    if (!checks.numbers) suggestions.push('Add numbers');
    if (!checks.symbols) suggestions.push('Add symbols');
    if (!checks.noCommon) suggestions.push('Avoid common passwords');
    
    return suggestions;
  },

  // Generate recovery codes (for 2FA backup)
  generateRecoveryCodes: (count = 10, length = 8) => {
    const codes = [];
    
    for (let i = 0; i < count; i++) {
      const code = pg.generateSecureToken(length, 'hex').toUpperCase();
      // Format as XXXX-XXXX for better readability
      const formatted = code.replace(/(.{4})/g, '$1-').slice(0, -1);
      codes.push(formatted);
    }
    
    return codes;
  }
};