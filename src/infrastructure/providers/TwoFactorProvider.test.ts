import speakeasy from 'speakeasy';
import { SpeakeasyTwoFactorProvider, MockSMSProvider, generateSMSCode } from './TwoFactorProvider';

describe('SpeakeasyTwoFactorProvider', () => {
  let twoFactorProvider: SpeakeasyTwoFactorProvider;

  beforeEach(() => {
    twoFactorProvider = new SpeakeasyTwoFactorProvider();
  });

  describe('generateSecret', () => {
    it('should generate a secret with otpauth URL', () => {
      const result = twoFactorProvider.generateSecret('test@example.com');

      expect(result.secret).toBeTruthy();
      expect(result.secret.length).toBeGreaterThan(20);
      expect(result.otpauthUrl).toContain('otpauth://totp/');
      // URL encoding: : becomes %3A, @ becomes %40
      expect(decodeURIComponent(result.otpauthUrl)).toContain('AskTrim:test@example.com');
    });
  });

  describe('verifyTOTP', () => {
    it('should verify valid TOTP code', () => {
      const result = twoFactorProvider.generateSecret('test@example.com');

      // Generate a valid token using the secret
      const validToken = speakeasy.totp({
        secret: result.secret,
        encoding: 'base32'
      });

      const isValid = twoFactorProvider.verifyTOTP(result.secret, validToken);
      expect(isValid).toBe(true);
    });

    it('should reject invalid TOTP code', () => {
      const result = twoFactorProvider.generateSecret('test@example.com');

      const isValid = twoFactorProvider.verifyTOTP(result.secret, '000000');
      expect(isValid).toBe(false);
    });

    it('should reject empty TOTP code', () => {
      const result = twoFactorProvider.generateSecret('test@example.com');

      const isValid = twoFactorProvider.verifyTOTP(result.secret, '');
      expect(isValid).toBe(false);
    });
  });

  describe('generateBackupCodes', () => {
    it('should generate 10 backup codes by default', () => {
      const codes = twoFactorProvider.generateBackupCodes();

      expect(codes).toHaveLength(10);
      codes.forEach(code => {
        expect(code.length).toBe(8);
        expect(/^[A-Z0-9]+$/.test(code)).toBe(true);
      });
    });

    it('should generate specified number of codes', () => {
      const codes = twoFactorProvider.generateBackupCodes(5);
      expect(codes).toHaveLength(5);
    });

    it('should generate unique codes', () => {
      const codes = twoFactorProvider.generateBackupCodes(10);
      const uniqueCodes = new Set(codes);
      expect(uniqueCodes.size).toBe(10);
    });
  });
});

describe('MockSMSProvider', () => {
  let smsProvider: MockSMSProvider;

  beforeEach(() => {
    smsProvider = new MockSMSProvider();
  });

  describe('sendCode', () => {
    it('should store sent code', async () => {
      const result = await smsProvider.sendCode('+1234567890', '123456');

      expect(result).toBe(true);
      expect(smsProvider.getLastCode('+1234567890')).toBe('123456');
    });

    it('should overwrite previous code for same number', async () => {
      await smsProvider.sendCode('+1234567890', '111111');
      await smsProvider.sendCode('+1234567890', '222222');

      expect(smsProvider.getLastCode('+1234567890')).toBe('222222');
    });
  });

  describe('clear', () => {
    it('should clear all sent codes', async () => {
      await smsProvider.sendCode('+1234567890', '123456');
      smsProvider.clear();

      expect(smsProvider.getLastCode('+1234567890')).toBeUndefined();
    });
  });
});

describe('generateSMSCode', () => {
  it('should generate 6-digit code', () => {
    const code = generateSMSCode();

    expect(code.length).toBe(6);
    expect(/^\d{6}$/.test(code)).toBe(true);
  });

  it('should generate different codes', () => {
    const codes = new Set<string>();
    for (let i = 0; i < 100; i++) {
      codes.add(generateSMSCode());
    }
    // Should have at least 90 unique codes out of 100
    expect(codes.size).toBeGreaterThan(90);
  });
});
