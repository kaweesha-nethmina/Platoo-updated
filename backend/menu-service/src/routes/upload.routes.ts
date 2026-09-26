import express from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';

const router = express.Router();

const uploadDir = path.join(process.cwd(), 'uploads');
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, uploadDir),
  filename: (_req, file, cb) => {
    const unique = Date.now() + '-' + Math.round(Math.random() * 1e9);
    const ext = path.extname(file.originalname).toLowerCase();
    cb(null, unique + ext);
  },
});

const allowedExts = ['.png', '.jpg', '.jpeg', '.gif', '.webp'];
const allowedMimes = ['image/png', 'image/jpeg', 'image/gif', 'image/webp']; // [FIX VULN-06]

// [FIX VULN-06] content-based filter: extension AND declared MIME must match.
// WAS: extension-only -> HTML renamed to .png was accepted (EV-M5, TC-BB-052).
const fileFilter = (_req: any, file: Express.Multer.File, cb: multer.FileFilterCallback) => {
  const ext = path.extname(file.originalname).toLowerCase();
  if (allowedExts.includes(ext) && allowedMimes.includes(file.mimetype)) {
    cb(null, true);
  } else {
    const err = new Error('Only image files are allowed (png, jpg, jpeg, gif, webp)');
    (err as any).status = 400; // [FIX VULN-07] client input error -> central handler returns 400
    cb(err);
  }
};

const upload = multer({
  storage,
  fileFilter,
  limits: { fileSize: 2 * 1024 * 1024 },
});

// [FIX VULN-06] lightweight magic-byte sniffing (defence in depth — a client
// can still spoof the MIME header). Signatures for PNG/JPEG/GIF/WEBP only.
const MAGIC_BYTES: { sig: number[]; mime: string }[] = [
  { sig: [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a], mime: 'image/png' },
  { sig: [0xff, 0xd8, 0xff], mime: 'image/jpeg' },
  { sig: [0x47, 0x49, 0x46, 0x38], mime: 'image/gif' }, // GIF87a/GIF89a
  { sig: [0x52, 0x49, 0x46, 0x46], mime: 'image/webp' }, // RIFF....WEBP
];

const sniffFile = (filePath: string): boolean => {
  try {
    const head = fs.readFileSync(filePath);
    return MAGIC_BYTES.some(({ sig }) => sig.every((b, i) => head[i] === b));
  } catch {
    return false;
  }
};

router.post('/', upload.single('file'), (req: express.Request, res: express.Response) => {
  if (!req.file) {
    res.status(400).json({ error: 'No file uploaded' });
    return;
  }

  // [FIX VULN-06] reject image-extension files whose content is NOT actually a
  // recognised image (blocks the TC-BB-052 HTML-in-.png smoke).
  if (!sniffFile(req.file.path)) {
    fs.unlink(req.file.path, () => undefined);
    res.status(400).json({ error: 'File content is not a valid image' });
    return;
  }

  // [FIX VULN-10] build the URL from a configured base — WAS: req.protocol +
  // req.get('host') which reflected an attacker-controlled Host header (TC-BB-054).
  const base = process.env.PUBLIC_BASE_URL || 'http://localhost:3001';
  const url = `${base}/uploads/${req.file.filename}`;
  res.status(201).json({ url, filename: req.file.filename });
});

export default router;