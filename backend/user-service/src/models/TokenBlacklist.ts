// models/TokenBlacklist.ts
// Server-side revocation store (V-14 residual fix): a revoked JWT's SHA-256
// hash is recorded here for the lifetime of the token (1 day). The `expires`
// index lets MongoDB auto-purge entries after `expiresAt`, so the collection
// never grows unbounded.
import { Schema, model, Document } from "mongoose";

export interface ITokenBlacklist extends Document {
  tokenHash: string;
  expiresAt: Date;
}

const tokenBlacklistSchema = new Schema<ITokenBlacklist>({
  tokenHash: { type: String, required: true, unique: true, index: true },
  expiresAt: { type: Date, required: true, expires: 0 },
});

export default model<ITokenBlacklist>("TokenBlacklist", tokenBlacklistSchema);