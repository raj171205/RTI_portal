import jwt from "jsonwebtoken";

export function verifyToken(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return res.status(401).json({ error: "Login zaroori hai (Token missing)." });
  }

  const token = authHeader.split(" ")[1];
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = decoded; // { id, name, email, role, department }
    next();
  } catch (err) {
    return res.status(401).json({ error: "Invalid ya expired token." });
  }
}

export function requireOfficer(req, res, next) {
  if (req.user?.role !== "OFFICER") {
    return res.status(403).json({ error: "Sirf Public Information Officer hi jawab de sakte hain." });
  }
  next();
}
