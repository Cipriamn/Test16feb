import speakeasy from 'speakeasy';

export interface ITwoFactorProvider {
  generateSecret(email: string): { secret: string; otpauthUrl: string };
  verifyTOTP(secret: string, token: string): boolean;
  generateBackupCodes(count?: number): string[];
}

export class SpeakeasyTwoFactorProvider implements ITwoFactorProvider {
  generateSecret(email: string): { secret: string; otpauthUrl: string } {
    const secret = speakeasy.generateSecret({
      name: `AskTrim:${email}`,
      length: 20
    });

    return {
      secret: secret.base32,
      otpauthUrl: secret.otpauth_url || ''
    };
  }

  verifyTOTP(secret: string, token: string): boolean {
    return speakeasy.totp.verify({
      secret,
      encoding: 'base32',
      token,
      window: 1 // Allow 1 step tolerance (30 seconds before/after)
    });
  }

  generateBackupCodes(count = 10): string[] {
    const codes: string[] = [];
    for (let i = 0; i < count; i++) {
      const code = Math.random().toString(36).substring(2, 10).toUpperCase();
      codes.push(code);
    }
    return codes;
  }
}

// Mock SMS provider for MVP
export interface ISMSProvider {
  sendCode(phoneNumber: string, code: string): Promise<boolean>;
}

export class MockSMSProvider implements ISMSProvider {
  private sentCodes: Map<string, string> = new Map();

  async sendCode(phoneNumber: string, code: string): Promise<boolean> {
    console.log(`[SMS Mock] Sending code ${code} to ${phoneNumber}`);
    this.sentCodes.set(phoneNumber, code);
    return true;
  }

  // Test helper
  getLastCode(phoneNumber: string): string | undefined {
    return this.sentCodes.get(phoneNumber);
  }

  clear(): void {
    this.sentCodes.clear();
  }
}

export function generateSMSCode(): string {
  return Math.floor(100000 + Math.random() * 900000).toString();
}
