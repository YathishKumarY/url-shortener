import { afterEach, describe, expect, it } from "vitest";
import { emailTransport, fromAddress, smtpSettings } from "@/lib/email";

describe("emailTransport", () => {
  it("prefers Resend, then SMTP, then the console", () => {
    expect(emailTransport({ RESEND_API_KEY: "re_x", SMTP_HOST: "smtp.gmail.com" })).toBe("resend");
    expect(emailTransport({ SMTP_HOST: "smtp.gmail.com" })).toBe("smtp");
    expect(emailTransport({ RESEND_API_KEY: "  ", SMTP_HOST: "" })).toBe("console");
    expect(emailTransport({})).toBe("console");
  });
});

describe("smtpSettings", () => {
  it("uses implicit TLS on 465 and STARTTLS on other ports", () => {
    expect(smtpSettings({ SMTP_HOST: "smtp.example.com" })).toMatchObject({
      port: 465,
      secure: true,
    });
    expect(smtpSettings({ SMTP_HOST: "smtp.example.com", SMTP_PORT: "587" })).toMatchObject({
      port: 587,
      secure: false,
    });
    expect(
      smtpSettings({ SMTP_HOST: "smtp.example.com", SMTP_PORT: "2525", SMTP_SECURE: "true" }),
    ).toMatchObject({ secure: true });
  });

  it("accepts a Gmail app password pasted with Google's spaces", () => {
    const settings = smtpSettings({
      SMTP_HOST: "smtp.gmail.com",
      SMTP_USER: "me@gmail.com",
      SMTP_PASSWORD: "abcd efgh ijkl mnop",
    });
    expect(settings.pass).toBe("abcdefghijklmnop");
  });

  it("leaves other providers' passwords untouched", () => {
    const settings = smtpSettings({ SMTP_HOST: "smtp.example.com", SMTP_PASSWORD: "a b" });
    expect(settings.pass).toBe("a b");
  });
});

describe("fromAddress", () => {
  afterEach(() => {
    delete process.env.NEXT_PUBLIC_SITE_NAME;
  });

  it("uses EMAIL_FROM when set", () => {
    expect(fromAddress({ EMAIL_FROM: "Links <links@example.com>", SMTP_HOST: "x" })).toBe(
      "Links <links@example.com>",
    );
  });

  it("defaults to the SMTP mailbox, named after the site", () => {
    expect(fromAddress({ SMTP_HOST: "smtp.gmail.com", SMTP_USER: "me@gmail.com" })).toBe(
      "Linkly <me@gmail.com>",
    );
  });

  it("falls back to a placeholder without SMTP", () => {
    expect(fromAddress({})).toBe("noreply@linkly.app");
  });
});
