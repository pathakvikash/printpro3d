import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, readdirSync, writeFileSync, mkdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { dataRoot, del, getBytes, getJson, list, putBytes, putJson } from './store.ts';

const clean = () => {
  delete process.env.DATA_DIR;
  delete process.env.VERCEL;
  delete process.env.BLOB_READ_WRITE_TOKEN;
};

test('json and bytes round trip under DATA_DIR, list and delete work', async () => {
  const dir = mkdtempSync(path.join(tmpdir(), 'store-'));
  process.env.DATA_DIR = dir;
  try {
    await putJson('orders', 'a.json', { id: 'a', n: 1 });
    await putBytes('uploads', 'x.stl', new Uint8Array([1, 2, 3]));
    await putJson('orders', 'a.json', { id: 'a', n: 2 }); // overwrite
    assert.deepEqual(await getJson('orders', 'a.json'), { id: 'a', n: 2 });
    assert.deepEqual([...(await getBytes('uploads', 'x.stl'))!], [1, 2, 3]);
    assert.deepEqual(await list('orders'), ['a.json']);
    assert.deepEqual(readdirSync(path.join(dir, 'orders')), ['a.json']); // same folder layout as before, no temp files left
    assert.deepEqual(await list('nothing'), []);
    assert.equal(await getJson('orders', 'missing.json'), null);
    await del('orders', 'a.json');
    await del('orders', 'a.json'); // deleting twice is fine
    assert.deepEqual(await list('orders'), []);
  } finally {
    clean();
  }
});

test('existing files on disk are readable; corrupt JSON reads as null', async () => {
  const dir = mkdtempSync(path.join(tmpdir(), 'store-'));
  process.env.DATA_DIR = dir;
  try {
    mkdirSync(path.join(dir, 'requests'));
    writeFileSync(path.join(dir, 'requests', 'r.json'), '{"status":"new"}');
    writeFileSync(path.join(dir, 'requests', 'bad.json'), '{oops');
    assert.deepEqual(await getJson('requests', 'r.json'), { status: 'new' });
    assert.equal(await getJson('requests', 'bad.json'), null);
  } finally {
    clean();
  }
});

test('path traversal and odd names are rejected', async () => {
  const dir = mkdtempSync(path.join(tmpdir(), 'store-'));
  process.env.DATA_DIR = dir;
  try {
    for (const key of ['../x.json', 'a/b.json', 'a\\b.json', '..', '.hidden', '', 'a b.json', 'a\0.json', 'x..json']) {
      await assert.rejects(putBytes('orders', key, 'x'), /invalid storage name/, JSON.stringify(key));
      assert.equal(await getBytes('orders', key), null);
    }
    await assert.rejects(putBytes('../etc', 'a.json', 'x'), /invalid storage name/);
    await assert.rejects(putBytes('Orders', 'a.json', 'x'), /invalid storage name/);
    assert.deepEqual(readdirSync(dir), []);
  } finally {
    clean();
  }
});

test('on Vercel without a blob token the disk backend uses the temp dir', () => {
  process.env.VERCEL = '1';
  try {
    assert.equal(dataRoot(), path.join(tmpdir(), 'printpro3d'));
    process.env.DATA_DIR = '/somewhere';
    assert.equal(dataRoot(), '/somewhere'); // an explicit DATA_DIR still wins
  } finally {
    clean();
  }
  assert.equal(dataRoot(), process.cwd());
});
