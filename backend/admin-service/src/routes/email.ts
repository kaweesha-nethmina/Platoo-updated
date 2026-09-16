// src/routes/email.ts
import express, { Request, Response } from 'express';
import nodemailer from 'nodemailer';

interface AdminInviteRequest {
  email: string;
  name: string;
  password: string;
}

const router = express.Router();

router.post('/send-admin-invite', async (req: Request<{}, {}, AdminInviteRequest>, res: Response) => {
  const { email, name, password } = req.body;

  // Configure transporter with environment variables
  const transporter = nodemailer.createTransport({
    service: process.env.EMAIL_SERVICE || 'Gmail',
    auth: {
      user: process.env.EMAIL_USER,
      pass: process.env.EMAIL_PASSWORD,
    },
  });

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
    await transporter.sendMail(mailOptions);
    res.json({ message: 'Email sent successfully' });
  } catch (err: unknown) {
    const error = err instanceof Error ? err : new Error('Unknown error occurred');
    res.status(500).json({ 
      error: 'Failed to send email',
      details: error.message
    });
  }
});

export default router;
