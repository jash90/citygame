#!/usr/bin/env ts-node
/**
 * Build per-city vector tile MBTiles for offline play, then upload to R2.
 *
 * Usage:
 *   pnpm --filter @citygame/backend ts-node scripts/build-city-tiles.ts \
 *     --city Strzyzow \
 *     --pbf ./poland-latest.osm.pbf \
 *     --bbox 21.74,49.85,21.83,49.89 \
 *     [--upload]
 *
 * Prerequisites on PATH:
 *   - osmium-tool (https://osmcode.org/osmium-tool/)
 *   - tippecanoe (Felt fork: https://github.com/felt/tippecanoe)
 *   - aws-cli configured for R2 (only when --upload)
 *
 * The mobile app's MAP_STYLE_URL must reference a style.json whose sources
 * point at the tile host that serves these MBTiles (tileserver-gl, martin,
 * or a PMTiles + CF Worker setup).
 */

import { execFileSync } from 'child_process';
import { existsSync, mkdirSync } from 'fs';
import { resolve } from 'path';

interface Args {
  city: string;
  pbf: string;
  bbox: [number, number, number, number]; // [west, south, east, north]
  upload: boolean;
  outDir: string;
  minZoom: number;
  maxZoom: number;
}

function parseArgs(argv: string[]): Args {
  const get = (flag: string): string | undefined => {
    const i = argv.indexOf(flag);
    return i >= 0 ? argv[i + 1] : undefined;
  };

  const city = get('--city');
  const pbf = get('--pbf');
  const bboxRaw = get('--bbox');
  if (!city || !pbf || !bboxRaw) {
    throw new Error('Required flags: --city, --pbf, --bbox');
  }
  if (!/^[A-Za-z0-9_-]+$/.test(city)) {
    throw new Error(`--city must be alphanumeric (got "${city}")`);
  }

  const parts = bboxRaw.split(',').map(Number);
  if (parts.length !== 4 || parts.some((n) => !Number.isFinite(n))) {
    throw new Error('--bbox must be "west,south,east,north" (decimal degrees)');
  }

  return {
    city,
    pbf: resolve(pbf),
    bbox: parts as Args['bbox'],
    upload: argv.includes('--upload'),
    outDir: resolve(get('--out') ?? './tiles-out'),
    minZoom: Number(get('--min-zoom') ?? '0'),
    maxZoom: Number(get('--max-zoom') ?? '16'),
  };
}

function run(file: string, args: string[]): void {
  // eslint-disable-next-line no-console
  console.log(`$ ${file} ${args.join(' ')}`);
  // execFileSync (no shell) avoids any chance of argv interpolation issues
  // even when bbox/path values contain unusual characters.
  execFileSync(file, args, { stdio: 'inherit' });
}

function main(): void {
  const args = parseArgs(process.argv.slice(2));
  if (!existsSync(args.outDir)) mkdirSync(args.outDir, { recursive: true });

  const cityPbf = resolve(args.outDir, `${args.city}.osm.pbf`);
  const cityMbtiles = resolve(args.outDir, `${args.city}.mbtiles`);

  // 1. Extract just the city's bounding box from the parent PBF.
  const [w, s, e, n] = args.bbox;
  run('osmium', [
    'extract',
    '--bbox',
    `${w},${s},${e},${n}`,
    '-o',
    cityPbf,
    args.pbf,
    '--overwrite',
  ]);

  // 2. Convert to vector MBTiles via tippecanoe.
  run('tippecanoe', [
    '-o',
    cityMbtiles,
    '-Z',
    String(args.minZoom),
    '-z',
    String(args.maxZoom),
    '--no-tile-compression',
    '--extend-zooms-if-still-dropping',
    '--simplification=4',
    '--force',
    cityPbf,
  ]);

  // 3. Upload to R2 (optional).
  if (args.upload) {
    const bucket = process.env.R2_BUCKET;
    const endpoint = process.env.R2_ENDPOINT;
    if (!bucket || !endpoint) {
      throw new Error('R2_BUCKET and R2_ENDPOINT must be set to --upload');
    }
    run('aws', [
      's3',
      'cp',
      cityMbtiles,
      `s3://${bucket}/tiles/${args.city}.mbtiles`,
      '--endpoint-url',
      endpoint,
    ]);
  }

  // eslint-disable-next-line no-console
  console.log(`\n✔ Tile pack ready: ${cityMbtiles}`);
}

main();
