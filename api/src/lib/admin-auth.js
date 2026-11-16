
import crypto from "node:crypto";

const COOKIE_NAME = "cineverse.admin.sid";
const SESSION_DURATION = 8 * 60 * 60;
const MAX_AGE = SESSION_DURATION * 1000;

function getSecret() {
  const secret = process.env.ADMIN_SESSION_SECRET;

  if (!secret || secret.length < 32) {
    throw new Error("ADMIN_SESSION_SECRET no configurada.");
  }

  return secret;
}

function sign(payload) {
  return crypto
    .createHmac("sha256", getSecret())
    .update(payload)
    .digest("base64url");
}

export function createAdminSession(adminId) {
  const id = Number(adminId);

  if (!Number.isSafeInteger(id) || id <= 0) {
    throw new Error("ID administrativo inválido.");
  }

  const now = Date.now();

  const payload = Buffer.from(JSON.stringify({
    sub: id,
    role: "admin-session",
    iat: now,
    exp: now + MAX_AGE
  })).toString("base64url");

  return `${payload}.${sign(payload)}`;
}

export function readAdminSession(request) {
  try {
    const cookieHeader = request.headers.get("cookie") || "";

    const cookie = cookieHeader
      .split(";")
      .map(part => part.trim())
      .find(part => part.startsWith(`${COOKIE_NAME}=`));

    if (!cookie) return null;

    const token = cookie.slice(COOKIE_NAME.length + 1);

    if (token.length > 4096) return null;

    const parts = token.split(".");

    if (parts.length !== 2) return null;

    const [payload, signature] = parts;

    const expected = Buffer.from(sign(payload));
    const received = Buffer.from(signature);

    if (
      expected.length !== received.length ||
      !crypto.timingSafeEqual(expected, received)
    ) {
      return null;
    }

    const data = JSON.parse(
      Buffer.from(payload, "base64url").toString("utf8")
    );

    const now = Date.now();

    if (
      data.role !== "admin-session" ||
      !Number.isSafeInteger(data.sub) ||
      data.sub <= 0 ||
      !Number.isSafeInteger(data.iat) ||
      !Number.isSafeInteger(data.exp) ||
      data.iat > now ||
      data.exp <= now ||
      data.exp - data.iat > MAX_AGE
    ) {
      return null;
    }

    return data.sub;

  } catch {
    return null;
  }
}

export function adminSessionCookie(adminId) {
  const token = createAdminSession(adminId);

  return `${COOKIE_NAME}=${token}; HttpOnly; Secure; SameSite=Strict; Path=/api/admin; Max-Age=${SESSION_DURATION}`;
}

export function clearAdminSessionCookie() {
  return `${COOKIE_NAME}=; HttpOnly; Secure; SameSite=Strict; Path=/api/admin; Max-Age=0`;
}
