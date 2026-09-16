import nodemailer from 'nodemailer';

const transporter = nodemailer.createTransport({
  service: 'gmail',  // This specifies Gmail as the SMTP service.
  auth: {
    user: process.env.EMAIL_USER,   // Your Gmail address (set in .env)
    pass: process.env.EMAIL_PASS,   // Your App Password (set in .env)
  },
});

export const sendEmail = async (to: string, subject: string, text: string) => {
  const mailOptions = {
    from: process.env.EMAIL_USER,  // Sender's email address
    to ,  // Recipient's email address
    subject,  // Subject of the email
    text,  // Body content of the email
  };

  try {
    const info = await transporter.sendMail(mailOptions);
    console.log('Email sent:', info.response);
  } catch (error) {
    console.error('Error sending email:', error);
    throw error;  // Rethrow the error for further handling
  }
};
