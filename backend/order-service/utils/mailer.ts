import nodemailer from 'nodemailer';

export const sendEmail = async (to: string, subject: string, text: string, html: string) => {
  // Configure the transporter
  const transporter = nodemailer.createTransport({
    service: 'gmail', // You can change this to another email service
    auth: {
      user: process.env.EMAIL_USER, // Set up an environment variable for the email
      pass: process.env.EMAIL_PASS, // Set up an environment variable for the password
    },
  });

  // Email options
  const mailOptions = {
    from: process.env.EMAIL_USER, // Set the sender email
    to,
    subject,
    text,
    html,
  };

  try {
    // Send the email
    await transporter.sendMail(mailOptions);
    console.log(`Email sent to: ${to}`);
  } catch (error) {
    console.error('Error sending email:', error);
    throw new Error('Email sending failed');
  }
};
