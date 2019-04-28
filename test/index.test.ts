import * as os from 'os';
import * as path from 'path';
import * as fs from 'fs-extra';
import getStream from 'get-stream';
import intoStream from 'into-stream';
import expect = require('expect.js');

import DiskCache from '../src';

describe('测试基础功能', function () {
    const cachePath = path.join(os.tmpdir(), `NodeDiskCache_Test_${Math.trunc(Math.random() * 10000)}`);
    const cache = new DiskCache({ cacheDir: cachePath }); //创建缓存

    afterEach(function () {
        return cache.empty();
    });

    describe('测试set', async function () {
        it('缓存string', async function () {
            await cache.set('a', 'a');
            const cacheFiles = await fs.promises.readdir(cachePath);
            expect(cacheFiles).length(1);
            expect(await fs.readFile(path.join(cachePath, cacheFiles[0]), 'utf-8')).to.be('a');
        });

        it('缓存Buffer', async function () {
            await cache.set('b', Buffer.from('b'));
            const cacheFiles = await fs.promises.readdir(cachePath);
            expect(cacheFiles).length(1);
            expect(await fs.readFile(path.join(cachePath, cacheFiles[0]), 'utf-8')).to.be('b');
        });

        it('缓存Stream', async function () {
            await cache.set('c', intoStream('c'));
            const cacheFiles = await fs.promises.readdir(cachePath);
            expect(cacheFiles).length(1);
            expect(await fs.readFile(path.join(cachePath, cacheFiles[0]), 'utf-8')).to.be('c');
        });

        it('重复设置缓存', async function () {
            await cache.set('d', 'd');
            const cacheFiles = await fs.promises.readdir(cachePath);
            expect(cacheFiles).length(1);
            expect(await fs.readFile(path.join(cachePath, cacheFiles[0]), 'utf-8')).to.be('d');

            await cache.set('d', Buffer.from('d2'));
            expect(await fs.readFile(path.join(cachePath, cacheFiles[0]), 'utf-8')).to.be('d2');

            await cache.set('d', intoStream('d3'));
            expect(await fs.readFile(path.join(cachePath, cacheFiles[0]), 'utf-8')).to.be('d3');
        });

        it('追加的方式设置缓存', async function () {
            await cache.set('e', 'e', true);
            await cache.set('e', Buffer.from(' e2'), true);
            await cache.set('e', intoStream(' e3'), true);
            const cacheFiles = await fs.promises.readdir(cachePath);
            expect(cacheFiles).length(1);
            expect(await fs.readFile(path.join(cachePath, cacheFiles[0]), 'utf-8')).to.be('e e2 e3');
        });
    });

    it('测试move', async function () {
        const testFile = path.join(os.tmpdir(), Math.random().toString());
        await fs.writeFile(testFile, 'move test');
        await cache.move('a', testFile);

        const cacheFiles = await fs.promises.readdir(cachePath);
        expect(cacheFiles).length(1);
        expect(await fs.readFile(path.join(cachePath, cacheFiles[0]), 'utf-8')).to.be('move test');
    });

    it('测试setGroup', async function () {
        const testFile = path.join(os.tmpdir(), Math.random().toString());
        await fs.writeFile(testFile, 'test1');

        await cache.setGroup([
            {
                key: 'test1',
                from: testFile
            },
            {
                key: 'test2',
                value: 'test2'
            }
        ]);

        const cacheFiles = (await fs.promises.readdir(cachePath)).sort();
        expect(cacheFiles).length(2);
        expect(await fs.readFile(path.join(cachePath, cacheFiles[0]), 'utf-8')).to.be('test1');
        expect(await fs.readFile(path.join(cachePath, cacheFiles[1]), 'utf-8')).to.be('test2');
    });

    it('测试get和getStream', async function () {
        await cache.set('a', 'a');
        expect((await cache.get('a') as any).toString()).to.be(await getStream(cache.getStream('a') as any));
        expect(await cache.get('no')).to.be(undefined);
        expect(cache.getStream('no')).to.be(undefined);
    });

    it('测试has', async function () {
        await cache.set('a', 'a');
        expect(cache.has('a')).to.be.ok();
        expect(cache.has('b')).to.not.be.ok();
    });

    describe('测试delete', function () {
        it('删除单个缓存', async function () {
            await cache.set('a', 'a');
            await cache.delete('a');
            expect(cache.has('a')).to.be(false);
            const cacheFiles = await fs.promises.readdir(cachePath);
            expect(cacheFiles).length(0);
        });

        it('删除一组缓存', async function () {
            await cache.setGroup([
                { key: 'a', value: 'a' },
                { key: 'b', value: 'b' },
            ]);

            await cache.delete('a');
            await new Promise(resolve => setTimeout(resolve, 100));

            expect(cache.has('a')).to.be(false);
            expect(cache.has('b')).to.be(false);
            const cacheFiles = await fs.promises.readdir(cachePath);
            expect(cacheFiles).length(0);
        });
    });

    describe('测试超时', function () {
        it('单个缓存超时', async function () {
            await cache.set('a', 'a', undefined, 100);
            await new Promise(resolve => setTimeout(resolve, 110));
            expect(cache.has('a')).to.be(false);
            const cacheFiles = await fs.promises.readdir(cachePath);
            expect(cacheFiles).length(0);
        });

        it('缓存组超时', async function () {
            await cache.setGroup([
                { key: 'a', value: 'a', timeout: 100 },
                { key: 'b', value: 'b' },
            ]);

            await new Promise(resolve => setTimeout(resolve, 110));

            expect(cache.has('a')).to.be(false);
            expect(cache.has('b')).to.be(false);
            const cacheFiles = await fs.promises.readdir(cachePath);
            expect(cacheFiles).length(0);
        });

        it('重置超时', async function () {
            await cache.set('a', 'a', undefined, 100, true);
            await new Promise(resolve => setTimeout(resolve, 50));
            expect((await cache.get('a') as any).toString()).to.be('a');
            await new Promise(resolve => setTimeout(resolve, 60));
            expect((await cache.get('a') as any).toString()).to.be('a');
            await new Promise(resolve => setTimeout(resolve, 110));
            expect(cache.has('a')).to.be(false);
            const cacheFiles = await fs.promises.readdir(cachePath);
            expect(cacheFiles).length(0);
        });
    });
});


it('测试容量限制', async function () {
    const cachePath = path.join(os.tmpdir(), `NodeDiskCache_Test_${Math.trunc(Math.random() * 10000)}`);
    const cache = new DiskCache({ cacheDir: cachePath, volumeUpLimit: 1024 * 1024 * 2, cleanInterval: 100, cleanAmount: 0.1 });

    await cache.set('a', Buffer.alloc(1024 * 1024, 'a'));
    await cache.set('b', Buffer.alloc(1024 * 1024, 'b'));
    await cache.set('c', Buffer.alloc(1024 * 1024, 'c'));

    await new Promise(resolve => setTimeout(resolve, 110));

    expect(cache.has('a')).to.be(false);
    expect(cache.has('b')).to.be(false);
    expect(cache.has('c')).to.be(true);

    const cacheFiles = await fs.promises.readdir(cachePath);
    expect(cacheFiles).length(1);
    expect((await fs.readFile(path.join(cachePath, cacheFiles[0]))).toString()[0]).to.be('c');
});