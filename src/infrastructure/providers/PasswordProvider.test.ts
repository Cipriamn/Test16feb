import { BcryptPasswordProvider } from './PasswordProvider';

describe('BcryptPasswordProvider', () => {
  let passwordProvider: BcryptPasswordProvider;

  beforeEach(() => {
    passwordProvider = new BcryptPasswordProvider();
  });

  describe('hash', () => {
    it('should hash password', async () => {
      const hash = await passwordProvider.hash('MyPassword123!');

      expect(hash).toBeTruthy();
      expect(hash).not.toBe('MyPassword123!');
      expect(hash.length).toBeGreaterThan(50); // bcrypt hashes are ~60 chars
    });

    it('should produce different hashes for same password', async () => {
      const hash1 = await passwordProvider.hash('MyPassword123!');
      const hash2 = await passwordProvider.hash('MyPassword123!');

      expect(hash1).not.toBe(hash2); // bcrypt uses random salt
    });
  });

  describe('compare', () => {
    it('should return true for matching password', async () => {
      const hash = await passwordProvider.hash('MyPassword123!');
      const result = await passwordProvider.compare('MyPassword123!', hash);

      expect(result).toBe(true);
    });

    it('should return false for non-matching password', async () => {
      const hash = await passwordProvider.hash('MyPassword123!');
      const result = await passwordProvider.compare('WrongPassword!', hash);

      expect(result).toBe(false);
    });
  });

  describe('validateStrength', () => {
    it('should accept strong password', () => {
      const result = passwordProvider.validateStrength('StrongPass123!');

      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should reject short password', () => {
      const result = passwordProvider.validateStrength('Ab1!');

      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Password must be at least 8 characters');
    });

    it('should reject password without uppercase', () => {
      const result = passwordProvider.validateStrength('lowercase123!');

      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Password must contain at least one uppercase letter');
    });

    it('should reject password without lowercase', () => {
      const result = passwordProvider.validateStrength('UPPERCASE123!');

      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Password must contain at least one lowercase letter');
    });

    it('should reject password without number', () => {
      const result = passwordProvider.validateStrength('NoNumbers!@#');

      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Password must contain at least one number');
    });

    it('should reject password without special character', () => {
      const result = passwordProvider.validateStrength('NoSpecial123');

      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Password must contain at least one special character');
    });

    it('should return multiple errors for weak password', () => {
      const result = passwordProvider.validateStrength('weak');

      expect(result.valid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(1);
    });
  });
});
