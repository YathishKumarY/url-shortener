import nodemailer, { type Transporter } from "nodemailer";
import { getAppOrigin } from "@/lib/app-url";
import { config } from "@/lib/config";

type Env = Record<string, string | undefined>;

export type EmailTransport = "resend" | "smtp" | "console";

/**
 * How emails leave the server.
 *
 * - Resend, when RESEND_API_KEY is set. Needs a domain you own to email
 *   anyone other than the Resend account holder.
 * - SMTP, when SMTP_HOST is set. Works with any mailbox provider, including a
 *   Gmail account with an app password, so no domain is needed.
 * - Otherwise the message is printed to the server log, which is enough for
 *   local development (copy the link from the terminal).
 */
export function emailTransport(env: Env = process.env): EmailTransport {
  if (env.RESEND_API_KEY?.trim()) return "resend";
  if (env.SMTP_HOST?.trim()) return "smtp";
  return "console";
}

interface SmtpSettings {
  host: string;
  port: number;
  secure: boolean;
  user?: string;
  pass?: string;
}

export function smtpSettings(env: Env = process.env): SmtpSettings {
  const host = env.SMTP_HOST?.trim() ?? "";
  const port = Number(env.SMTP_PORT?.trim() || 465);
  const user = env.SMTP_USER?.trim() || undefined;
  let pass = env.SMTP_PASSWORD?.trim() || undefined;
  // Google shows app passwords in groups of four ("abcd efgh ijkl mnop");
  // they contain no real spaces, so accept them pasted either way.
  if (pass && /(^|\.)gmail\.com$|(^|\.)googlemail\.com$/i.test(host))
    pass = pass.replace(/\s+/g, "");
  // Port 465 speaks TLS from the first byte; 587 and 25 upgrade with STARTTLS.
  const secure = env.SMTP_SECURE?.trim() ? env.SMTP_SECURE.trim() === "true" : port === 465;
  return { host, port, secure, user, pass };
}

/** Sender address: EMAIL_FROM, else the SMTP mailbox, else a placeholder. */
export function fromAddress(env: Env = process.env): string {
  const configured = env.EMAIL_FROM?.trim();
  if (configured) return configured;
  const smtpUser = env.SMTP_USER?.trim();
  if (emailTransport(env) === "smtp" && smtpUser?.includes("@")) {
    return `${config.siteName} <${smtpUser}>`;
  }
  return "noreply@linkly.app";
}

let smtp: Transporter | undefined;

function smtpTransporter(): Transporter {
  if (!smtp) {
    const { host, port, secure, user, pass } = smtpSettings();
    smtp = nodemailer.createTransport({
      host,
      port,
      secure,
      auth: user ? { user, pass } : undefined,
      // Serverless functions are short-lived: fail rather than hang.
      connectionTimeout: 10_000,
      greetingTimeout: 10_000,
      socketTimeout: 15_000,
    });
  }
  return smtp;
}

interface SendEmailParams {
  to: string;
  subject: string;
  html: string;
  text: string;
}

async function sendEmail({ to, subject, html, text }: SendEmailParams) {
  const transport = emailTransport();
  const from = fromAddress();

  if (transport === "console") {
    if (process.env.NODE_ENV === "production") {
      console.error(
        "[email] No email provider configured (set SMTP_HOST or RESEND_API_KEY); not delivered:",
        subject,
      );
    }
    console.log(`[email] (dev mode) To: ${to}`);
    console.log(`[email] Subject: ${subject}`);
    console.log(`[email] Body:\n${text}`);
    return;
  }

  if (transport === "smtp") {
    await smtpTransporter().sendMail({ from, to, subject, html, text });
    return;
  }

  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ from, to, subject, html, text }),
  });

  if (!res.ok) {
    const body = await res.text();
    console.error("[email] Failed to send:", body);
    throw new Error("Failed to send email");
  }
}

export async function sendVerificationEmail(email: string, token: string) {
  const url = `${getAppOrigin()}/auth/verify-email?token=${token}`;
  const site = config.siteName;
  await sendEmail({
    to: email,
    subject: `Verify your ${site} email`,
    html: `
      <h2>Welcome to ${site}!</h2>
      <p>Confirm this is your email address to finish creating your account:</p>
      <p><a href="${url}">Verify my email</a></p>
      <p>Or paste this link into your browser:<br>${url}</p>
      <p>The link expires in 24 hours. If you didn't sign up for ${site}, ignore this email.</p>
    `,
    text: [
      `Welcome to ${site}!`,
      "",
      "Confirm this is your email address to finish creating your account:",
      url,
      "",
      `The link expires in 24 hours. If you didn't sign up for ${site}, ignore this email.`,
    ].join("\n"),
  });
}

export async function sendPasswordResetEmail(email: string, token: string) {
  const url = `${getAppOrigin()}/auth/reset-password?token=${token}`;
  const site = config.siteName;
  await sendEmail({
    to: email,
    subject: `Reset your ${site} password`,
    html: `
      <h2>Password reset</h2>
      <p>Click the link below to choose a new password:</p>
      <p><a href="${url}">Reset my password</a></p>
      <p>Or paste this link into your browser:<br>${url}</p>
      <p>The link expires in 1 hour. If you didn't ask for this, ignore this email.</p>
    `,
    text: [
      "Password reset",
      "",
      "Open this link to choose a new password:",
      url,
      "",
      "The link expires in 1 hour. If you didn't ask for this, ignore this email.",
    ].join("\n"),
  });
}
