const express = require('express');
const multer = require('multer');
const pdfParse = require('pdf-parse');
const slugify = require('slugify');
const { pool } = require('../db');
const { requireAdmin, requireCsrf } = require('../middleware/admin');

const router = express.Router();
const categories = ['Computer Science', 'Electronics', 'Mechanical'];
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 4 * 1024 * 1024, files: 1 },
  fileFilter(_req, file, callback) {
    if (file.mimetype !== 'application/pdf' || !file.originalname.toLowerCase().endsWith('.pdf')) {
      return callback(Object.assign(new Error('Please choose a PDF file.'), { status: 400 }));
    }
    callback(null, true);
  },
});
const imageUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 4 * 1024 * 1024, files: 1 },
  fileFilter(_req, file, callback) {
    const supported = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
    if (!supported.includes(file.mimetype)) {
      return callback(Object.assign(new Error('Choose a JPG, PNG, WebP, or GIF image.'), { status: 400 }));
    }
    callback(null, true);
  },
});

function imageContentType(buffer) {
  if (buffer.length >= 8 && buffer.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))) return 'image/png';
  if (buffer.length >= 3 && buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) return 'image/jpeg';
  const signature = buffer.subarray(0, 6).toString('ascii');
  if (signature === 'GIF87a' || signature === 'GIF89a') return 'image/gif';
  if (buffer.length >= 12 && buffer.subarray(0, 4).toString('ascii') === 'RIFF' && buffer.subarray(8, 12).toString('ascii') === 'WEBP') return 'image/webp';
  return null;
}

function pdfTextToMarkdown(text) {
  const normalized = text
    .normalize('NFKC')
    .replace(/(?<=\w)-\s*\n\s*(?=\w)/g, '')
    .replace(/\r/g, '')
    .replace(/[ \t]+\n/g, '\n');
  const blocks = normalized.split(/\n\s*\n/).map((raw) => raw
    .split('\n').map((line) => line.replace(/\s+/g, ' ').trim()).filter(Boolean).join(' '))
    .filter(Boolean)
    .map((block) => {
      if (block.length < 100 && (block === block.toLocaleUpperCase() || /^(chapter|section|part)\s+\d+\b/i.test(block))) {
        return `## ${block.toLocaleLowerCase().replace(/\b\p{L}/gu, (letter) => letter.toLocaleUpperCase())}`;
      }
      return block;
    });
  return blocks.join('\n\n').trim();
}

function makeExcerpt(markdown) {
  return markdown.replace(/^#{1,6}\s+/gm, '').replace(/[*_`>#\[\]]/g, '').replace(/\s+/g, ' ').trim().slice(0, 220);
}

function publicPost(row) {
  return {
    id: String(row.id),
    slug: row.slug,
    title: row.title,
    category: row.category,
    author: row.author,
    excerpt: row.excerpt,
    markdown: row.markdown,
    createdAt: row.created_at,
    published: row.published,
    featured: Boolean(row.featured),
  };
}

router.get('/', async (_req, res, next) => {
  try {
    const { rows } = await pool.query('SELECT * FROM posts WHERE published = TRUE ORDER BY created_at DESC');
    res.json(rows.map(publicPost));
  } catch (error) { next(error); }
});

router.get('/:slug', async (req, res, next) => {
  try {
    const { rows } = await pool.query('SELECT * FROM posts WHERE slug = $1 AND published = TRUE LIMIT 1', [req.params.slug]);
    if (!rows[0]) return res.status(404).json({ error: 'Article not found.' });
    res.json(publicPost(rows[0]));
  } catch (error) { next(error); }
});

router.get('/admin/all', requireAdmin, async (_req, res, next) => {
  try {
    const { rows } = await pool.query('SELECT * FROM posts ORDER BY created_at DESC');
    res.set('Cache-Control', 'no-store').json(rows.map(publicPost));
  } catch (error) { next(error); }
});

router.post('/admin/:id/images', requireAdmin, requireCsrf, imageUpload.single('image'), async (req, res, next) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'Choose an image to upload.' });
    const contentType = imageContentType(req.file.buffer);
    if (!contentType || contentType !== req.file.mimetype) {
      return res.status(400).json({ error: 'The image file contents do not match its image type.' });
    }
    const post = await pool.query('SELECT id FROM posts WHERE id = $1 LIMIT 1', [req.params.id]);
    if (!post.rows[0]) return res.status(404).json({ error: 'Article not found.' });
    const { rows } = await pool.query(
      'INSERT INTO post_images (post_id, content_type, image_data) VALUES ($1, $2, $3) RETURNING id',
      [req.params.id, contentType, req.file.buffer],
    );
    res.status(201).json({ url: `/api/media/${rows[0].id}` });
  } catch (error) { next(error); }
});

async function getMedia(req, res, next) {
  try {
    const { rows } = await pool.query(
      `SELECT i.content_type, i.image_data, p.published
       FROM post_images i JOIN posts p ON p.id = i.post_id
       WHERE i.id = $1 LIMIT 1`,
      [req.params.id],
    );
    const image = rows[0];
    if (!image || (!image.published && !req.session?.adminId)) return res.status(404).end();
    res.set({
      'Content-Type': image.content_type,
      'Content-Length': String(image.image_data.length),
      'Content-Disposition': 'inline',
      'X-Content-Type-Options': 'nosniff',
      'Cache-Control': image.published ? 'public, max-age=3600, immutable' : 'private, no-store',
    }).send(image.image_data);
  } catch (error) { next(error); }
}

router.post('/admin/upload', requireAdmin, requireCsrf, upload.single('pdf'), async (req, res, next) => {
  try {
    const title = String(req.body.title || '').trim();
    const category = String(req.body.category || '').trim();
    const author = String(req.body.author || 'AUV Blog').trim().slice(0, 100) || 'AUV Blog';
    if (!title || title.length > 180 || !categories.includes(category) || !req.file) {
      return res.status(400).json({ error: 'Add a title, choose a section, and select a PDF.' });
    }
    if (!req.file.buffer.subarray(0, 5).equals(Buffer.from('%PDF-'))) {
      return res.status(400).json({ error: 'That file does not look like a valid PDF.' });
    }
    let parsed;
    try {
      parsed = await pdfParse(req.file.buffer);
    } catch {
      return res.status(400).json({ error: 'The PDF could not be read. Please try another file.' });
    }
    const markdown = pdfTextToMarkdown(parsed.text || '');
    if (markdown.length < 40) {
      return res.status(400).json({ error: 'No readable text found. Scanned PDFs need OCR before upload.' });
    }
    const base = slugify(title, { lower: true, strict: true }).slice(0, 100) || 'article';
    let slug = base;
    let suffix = 2;
    while (true) {
      try {
        const { rows } = await pool.query(
          'INSERT INTO posts (slug, title, category, author, excerpt, markdown, published) VALUES ($1, $2, $3, $4, $5, $6, FALSE) RETURNING *',
          [slug, title, category, author, makeExcerpt(markdown), markdown],
        );
        return res.status(201).json(publicPost(rows[0]));
      } catch (error) {
        if (error.code !== '23505') throw error;
        slug = `${base}-${suffix}`;
        suffix += 1;
      }
    }
  } catch (error) { next(error); }
});

router.patch('/admin/:id', requireAdmin, requireCsrf, async (req, res, next) => {
  try {
    const current = await pool.query('SELECT * FROM posts WHERE id = $1 LIMIT 1', [req.params.id]);
    if (!current.rows[0]) return res.status(404).json({ error: 'Article not found.' });
    const post = publicPost(current.rows[0]);
    const { title, category, author, markdown, published, featured } = req.body;
    if (title !== undefined) {
      post.title = String(title).trim();
      if (!post.title || post.title.length > 180) return res.status(400).json({ error: 'Title must be 1 to 180 characters.' });
    }
    if (category !== undefined) {
      if (!categories.includes(category)) return res.status(400).json({ error: 'Choose a valid section.' });
      post.category = category;
    }
    if (author !== undefined) post.author = String(author).trim().slice(0, 100) || 'AUV Blog';
    if (markdown !== undefined) {
      post.markdown = String(markdown).trim();
      if (!post.markdown) return res.status(400).json({ error: 'Article content cannot be empty.' });
      post.excerpt = makeExcerpt(post.markdown);
    }
    if (published !== undefined) {
      if (typeof published !== 'boolean') return res.status(400).json({ error: 'Published status must be true or false.' });
      post.published = published;
    }
    if (featured !== undefined) {
      if (typeof featured !== 'boolean') return res.status(400).json({ error: 'Featured status must be true or false.' });
      post.featured = featured;
    }
    const { rows } = await pool.query(
      `UPDATE posts SET title = $1, category = $2, author = $3, excerpt = $4, markdown = $5,
       published = $6, featured = $7, updated_at = NOW() WHERE id = $8 RETURNING *`,
      [post.title, post.category, post.author, post.excerpt, post.markdown, post.published, post.featured, req.params.id],
    );
    res.json(publicPost(rows[0]));
  } catch (error) { next(error); }
});

router.delete('/admin/:id', requireAdmin, requireCsrf, async (req, res, next) => {
  try {
    const result = await pool.query('DELETE FROM posts WHERE id = $1', [req.params.id]);
    if (result.rowCount === 0) return res.status(404).json({ error: 'Article not found.' });
    res.status(204).end();
  } catch (error) { next(error); }
});

module.exports = router;
module.exports.getMedia = getMedia;
