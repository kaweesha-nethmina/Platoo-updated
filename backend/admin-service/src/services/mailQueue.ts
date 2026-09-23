import nodemailer from "nodemailer";

interface MailJob {
  mailOptions: nodemailer.SendMailOptions;
  resolve: () => void;
  reject: (err: Error) => void;
}

class MailQueue {
  private queue: MailJob[] = [];
  private processing = false;
  private readonly maxRetries = 3;

  private getTransporter(): nodemailer.Transporter {
    return nodemailer.createTransport({
      service: process.env.EMAIL_SERVICE || "Gmail",
      auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASSWORD,
      },
    });
  }

  async enqueue(mailOptions: nodemailer.SendMailOptions): Promise<void> {
    return new Promise<void>((resolve, reject) => {
      this.queue.push({ mailOptions, resolve, reject });
      void this.process();
    });
  }

  private async process(): Promise<void> {
    if (this.processing) return;
    this.processing = true;

    while (this.queue.length > 0) {
      const job = this.queue.shift() as MailJob;
      try {
        await this.sendWithRetry(job);
        job.resolve();
      } catch (error) {
        const err = error instanceof Error ? error : new Error("Email sending failed");
        job.reject(err);
      }
    }

    this.processing = false;
  }

  private async sendWithRetry(job: MailJob): Promise<void> {
    let lastError: Error | undefined;
    for (let attempt = 0; attempt < this.maxRetries; attempt++) {
      try {
        const transporter = this.getTransporter();
        await transporter.sendMail(job.mailOptions);
        return;
      } catch (error) {
        lastError = error instanceof Error ? error : new Error("Email sending failed");
        console.error(
          `sendMail attempt ${attempt + 1} of ${this.maxRetries} failed for recipient "${(job.mailOptions as { to?: string }).to ?? "unknown"}"`,
          lastError
        );
        if (attempt < this.maxRetries - 1) {
          await new Promise((resolve) => setTimeout(resolve, 500 * Math.pow(2, attempt)));
        }
      }
    }
    throw lastError ?? new Error("Email sending failed");
  }
}

export default new MailQueue();