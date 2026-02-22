export interface IEmailProvider {
  sendPasswordResetEmail(email: string, resetToken: string): Promise<boolean>;
  sendPasswordChangedEmail(email: string): Promise<boolean>;
  sendEmailVerificationEmail(email: string, verificationToken: string): Promise<boolean>;
  sendAccountDeletionEmail(email: string, cancellationLink: string): Promise<boolean>;
  sendAccountRestoredEmail(email: string): Promise<boolean>;
}

// Mock email provider for MVP
export class MockEmailProvider implements IEmailProvider {
  private sentEmails: { to: string; type: string; data: unknown }[] = [];

  async sendPasswordResetEmail(email: string, resetToken: string): Promise<boolean> {
    console.log(`[Email Mock] Sending password reset to ${email} with token ${resetToken}`);
    this.sentEmails.push({ to: email, type: 'password_reset', data: { resetToken } });
    return true;
  }

  async sendPasswordChangedEmail(email: string): Promise<boolean> {
    console.log(`[Email Mock] Sending password changed notification to ${email}`);
    this.sentEmails.push({ to: email, type: 'password_changed', data: {} });
    return true;
  }

  async sendEmailVerificationEmail(email: string, verificationToken: string): Promise<boolean> {
    console.log(`[Email Mock] Sending email verification to ${email} with token ${verificationToken}`);
    this.sentEmails.push({ to: email, type: 'email_verification', data: { verificationToken } });
    return true;
  }

  async sendAccountDeletionEmail(email: string, cancellationLink: string): Promise<boolean> {
    console.log(`[Email Mock] Sending account deletion confirmation to ${email}`);
    this.sentEmails.push({ to: email, type: 'account_deletion', data: { cancellationLink } });
    return true;
  }

  async sendAccountRestoredEmail(email: string): Promise<boolean> {
    console.log(`[Email Mock] Sending account restored notification to ${email}`);
    this.sentEmails.push({ to: email, type: 'account_restored', data: {} });
    return true;
  }

  // Test helpers
  getSentEmails(): { to: string; type: string; data: unknown }[] {
    return this.sentEmails;
  }

  clear(): void {
    this.sentEmails = [];
  }
}
