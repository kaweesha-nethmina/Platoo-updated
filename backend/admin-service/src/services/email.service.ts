// src/services/email.service.ts
import { transporter } from "../config/email";

export async function sendAdminInviteEmail(
  to: string,
  name: string,
  password: string
) {
  const mailOptions = {
    from: `"Your App" <${process.env.EMAIL_USER}>`,
    to,
    subject: "Your Admin Account Login Instructions",
    text: `Hello ${name},

Your admin account has been created.

Login Email: ${to}
Password: ${password}

Please log in and change your password after first login.

Best regards,
Your App Team
`,
  };

  await transporter.sendMail(mailOptions);
}
