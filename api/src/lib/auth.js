
import crypto from "node:crypto";

const COOKIE_NAME = "cineverse.sid";
const SESSION_DURATION = 7 * 24 * 60 * 60;
const MAX_TOKEN_AGE = SESSION_DURATION * 1000;

function getSessionSecret() {
  const secret = process.env.SESSION_SECRET;

  if (!secret || secret.length < 32) {
    throw new Error("SESSION_SECRET no está configurada correctamente.");
  }

  return secret;
}

function sign(value) {
  return crypto
    .createHmac("sha256", getSessionSecret())
    .update(value)
    .digest("base64url");
}

export function createSession(userId) {
  const id = Number(userId);

  if (!Number.isSafeInteger(id) || id <= 0) {
    throw new Error("ID de usuario inválido.");
  }

  const payload = Buffer.from(
    JSON.stringify({
      sub: id,
      iat: Date.now(),
      exp: Date.now() + MAX_TOKEN_AGE
    })
  ).toString("base64url");

  return `${payload}.${sign(payload)}`;
}

export function verifySession(token) {
  try {
    if (typeof token !== "string" || token.length > 4096) {
      return null;
    }

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

    if (
      !Number.isSafeInteger(data.sub) ||
      data.sub <= 0 ||
      !Number.isSafeInteger(data.iat) ||
      !Number.isSafeInteger(data.exp) ||
      data.iat > Date.now() ||
      data.exp <= Date.now() ||
      data.exp - data.iat > MAX_TOKEN_AGE
    ) {
      return null;
    }

    return data.sub;
  } catch {
    return null;
  }
}

export function readSession(request) {
  const cookieHeader = request.headers.get("cookie") || "";

  const cookie = cookieHeader
    .split(";")
    .map(part => part.trim())
    .find(part => part.startsWith(`${COOKIE_NAME}=`));

  if (!cookie) return null;

  const token = cookie.slice(COOKIE_NAME.length + 1);

  return verifySession(token);
}

export function sessionCookie(userId) {
  const token = createSession(userId);

  return `${COOKIE_NAME}=${token}; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=${SESSION_DURATION}`;
}

export function clearSessionCookie() {
  return `${COOKIE_NAME}=; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=0`;
}

export function makePassword(password) {
  const salt = crypto.randomBytes(16).toString("hex");

  const hash = crypto
    .scryptSync(password, salt, 64)
    .toString("hex");

  return { salt, hash };
}

export function passwordMatches(password, salt, hash) {
  if (
    typeof password !== "string" ||
    typeof salt !== "string" ||
    typeof hash !== "string" ||
    !/^[a-f0-9]{128}$/i.test(hash)
  ) {
    return false;
  }

  const derived = crypto.scryptSync(password, salt, 64);
  const expected = Buffer.from(hash, "hex");

  return (
    expected.length === derived.length &&
    crypto.timingSafeEqual(expected, derived)
  );
}
