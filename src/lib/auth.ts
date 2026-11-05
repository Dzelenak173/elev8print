import jwt from "jsonwebtoken";

export type AdminTokenPayload = {
  role: string;
};

export function verifyAdminToken(
  authHeader: string | null
): AdminTokenPayload | null {
  if (!authHeader) {
    return null;
  }

  const token = authHeader.split(" ")[1];
  if (!token) {
    return null;
  }

  try {
    const decoded = jwt.verify(
      token,
      process.env.JWT_SECRET!
    ) as AdminTokenPayload;
    return decoded.role === "admin" ? decoded : null;
  } catch {
    return null;
  }
}
