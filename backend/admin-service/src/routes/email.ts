// src/routes/email.ts
import express, { Request, Response } from 'express';
import { requireAdmin } from '../middleware/auth';
import { validateAdminInvite } from '../middleware/validate';
import { rateLimitInvites, isRecipientRateLimited, recordRecipientInvite } from '../middleware/inviteRateLimit';
import mailQueue from '../services/mailQueue';

interface AdminInviteRequest {
  email: string;
  name: string;
  password: string;
}

const router = express.Router();

router.post(
  '/send-admin-invite',
  requireAdmin,
  rateLimitInvites,
  validateAdminInvite,
  async (req: Request<{}, {}, AdminInviteRequest>, res: Response) => {
    const { email, name, password } = req.body;

    if (isRecipientRateLimited(email)) {
      res.status(429).json({ error: 'Too many invites for this recipient, please try again later' });
      return;
    }

    const mailOptions = {
      from: `"${process.env.APP_NAME || 'Your App'}" <${process.env.EMAIL_USER}>`,
      to: email,
      subject: 'Your Admin Account Login Instructions',
      text: `Hello ${name},

Your admin account has been created.

Login Email: ${email}
Password: ${password}

Please log in and change your password after first login.

Best regards,
${process.env.APP_NAME || 'Your App'} Team
`,
    };

    try {
      await mailQueue.enqueue(mailOptions);
      recordRecipientInvite(email);
      res.json({ message: 'Email sent successfully' });
    } catch (err: unknown) {
      const error = err instanceof Error ? err : new Error('Unknown error occurred');
      console.error('send-admin-invite failed:', error);
      res.status(500).json({
        error: 'Failed to send email',
        details: 'The email could not be sent at this time',
      });
    }
  }
);

export default router;