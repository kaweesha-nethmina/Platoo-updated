// src/config/email.ts
import nodemailer from "nodemailer";

export const transporter = nodemailer.createTransport({
  service: "Gmail",
  auth: {
    user: process.env.EMAIL_USER,      // set in .env
    pass: process.env.EMAIL_PASSWORD,  // set in .env
  },
});
