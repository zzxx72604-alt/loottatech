/**
 * LoottaTech — product image optimiser
 *
 *   npm run images
 *
 * Reads every photo in  /image
 * Writes three files per photo into  /frontend/public/products :
 *
 *     <name>-480.webp    small  — phones
 *     <name>-800.webp    large  — tablet & desktop
 *     <name>.jpg         fallback if webp ever fails
 *
 * The FILENAME becomes the product image path. So rename your photo to
 * something meaningful first:
 *
 *     image/iphone-13-1.jpg   ->   images: ['/products/iphone-13-1']
 *
 * Use  name-1.jpg, name-2.jpg, name-3.jpg  for multiple angles of one item.
 */
import { mkdir, readdir, stat } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SOURCE = path.join(root, 'image');
const OUTPUT = path.join(root, 'frontend', 'public', 'products');

const WIDTHS = [480, 800];
const ALLOWED = new Set(['.jpg', '.jpeg', '.png', '.webp', '.avif']);

function slugify(filename) {
  return path
    .basename(filename, path.extname(filename))
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

const kb = (bytes) => `${Math.round(bytes / 1024)} kB`;

async function run() {
  await mkdir(OUTPUT, { recursive: true });

  const files = (await readdir(SOURCE)).filter((f) => ALLOWED.has(path.extname(f).toLowerCase()));

  if (files.length === 0) {
    console.log(`No images found in ${SOURCE}`);
    return;
  }

  console.log(`Optimising ${files.length} image(s)\n`);

  let sourceBytes = 0;
  let smallBytes = 0;

  for (const file of files) {
    const source = path.join(SOURCE, file);
    const name = slugify(file);

    sourceBytes += (await stat(source)).size;

    for (const width of WIDTHS) {
      const target = path.join(OUTPUT, `${name}-${width}.webp`);
      await sharp(source)
        .resize(width, width, { fit: 'cover', position: 'centre' })
        .webp({ quality: 80 })
        .toFile(target);

      if (width === 480) smallBytes += (await stat(target)).size;
    }

    // jpg fallback at the larger size
    await sharp(source)
      .resize(800, 800, { fit: 'cover', position: 'centre' })
      .jpeg({ quality: 82 })
      .toFile(path.join(OUTPUT, `${name}.jpg`));

    console.log(`  ${file}  ->  /products/${name}`);
  }

  console.log(`\nDone. ${files.length} image(s) -> ${OUTPUT}`);
  console.log(`Originals ${kb(sourceBytes)}  ->  phone-size webp ${kb(smallBytes)}  ` +
              `(${Math.round(100 - (smallBytes / sourceBytes) * 100)}% smaller)`);
  console.log(`\nUse them in backend/src/data/products.ts like:`);
  console.log(`  images: ['/products/${slugify(files[0])}']`);
}

run().catch((error) => {
  console.error('Image optimisation failed:', error.message);
  process.exit(1);
});
