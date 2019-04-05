import * as os from 'os';
import * as path from 'path';
import * as fs from 'fs-extra';
import getStream from 'get-stream';
import intoStream from 'into-stream';
import expect = require('expect.js');

import DiskCache from '../src';

it('测试基础功能', async function () {
    const cachePath = path.join(os.tmpdir(), `NodeDiskCache_Test_${Math.trunc(Math.random() * 10000)}`);

    //创建缓存
    const cache = new DiskCache({ cacheDir: cachePath });

    //设置缓存
    await cache.set('a', Buffer.from('a'));
    let cacheFiles = await fs.promises.readdir(cachePath);
    expect(cacheFiles).length(1);
    expect((await fs.readFile(path.join(cachePath, cacheFiles[0]))).toString()).to.be('a');

    //通过流的方式设置缓存
    await cache.set('a', intoStream('a2'));
    expect((await fs.readFile(path.join(cachePath, cacheFiles[0]))).toString()).to.be('a2');

    //重复设置缓存
    await cache.set('a', Buffer.from('a3'));
    expect((await fs.readFile(path.join(cachePath, cacheFiles[0]))).toString()).to.be('a3');

    //已追加的方式设置缓存
    await cache.set('a', Buffer.from(' append'), true);
    await cache.set('a', intoStream(' append2'), true);
    expect((await fs.readFile(path.join(cachePath, cacheFiles[0]))).toString()).to.be('a3 append append2');

    //对不存在的文件进行追加
    await cache.set('b', Buffer.from('b'), true);
    await cache.set('c', intoStream('c'), true);

    //获取缓存
    expect((await cache.get('a') as Buffer).toString()).to.be('a3 append append2');
    expect(await getStream(cache.getStream('a') as NodeJS.ReadableStream)).to.be('a3 append append2');
    expect((await cache.get('b') as Buffer).toString()).to.be('b');
    expect((await cache.get('c') as Buffer).toString()).to.be('c');
    expect(await cache.get('d')).to.be(undefined);
    expect(cache.getStream('d')).to.be(undefined);

    //判断是否存在
    expect(cache.has('a')).to.be(true);
    expect(cache.has('b')).to.be(true);
    expect(cache.has('c')).to.be(true);
    expect(cache.has('d')).to.be(false);

    //测试删除缓存
    await cache.delete('a');
    cacheFiles = await fs.promises.readdir(cachePath);
    expect(cacheFiles).length(2);

    //测试清空缓存
    await cache.empty();
    cacheFiles = await fs.promises.readdir(cachePath);
    expect(cacheFiles).length(0);
});

describe('测试超时清理', function () {

    it('测试超时', async function () {
        this.timeout(10000);

        const cachePath = path.join(os.tmpdir(), `NodeDiskCache_Test_${Math.trunc(Math.random() * 10000)}`);

        //创建缓存
        const cache = new DiskCache({ cacheDir: cachePath, timeout: 1000 });

        //测试超时
        await cache.set('a', Buffer.from('a'));
        expect(cache.has('a')).to.be(true);
        await new Promise(resolve => setTimeout(resolve, 1200));
        expect(cache.has('a')).to.be(false);
        expect(await fs.readdir(cachePath)).length(0);

        //测试set覆盖之前缓存后重置超时
        await cache.set('b', Buffer.from('b'));
        await new Promise(resolve => setTimeout(resolve, 500));
        await cache.set('b', Buffer.from('b2'));
        await new Promise(resolve => setTimeout(resolve, 600));
        expect(cache.has('b')).to.be(true);
        expect((await cache.get('b') as Buffer).toString()).to.be('b2');
        await new Promise(resolve => setTimeout(resolve, 600));
        expect(cache.has('b')).to.be(false);
        expect(await fs.readdir(cachePath)).length(0);
    });

    it('测试重置超时', async function () {
        this.timeout(10000);

        const cachePath = path.join(os.tmpdir(), `NodeDiskCache_Test_${Math.trunc(Math.random() * 10000)}`);

        //创建缓存
        const cache = new DiskCache({ cacheDir: cachePath, timeout: 1000, refreshTimeoutWhenGet: true });

        await cache.set('a', Buffer.from('a'));
        expect(cache.has('a')).to.be(true);

        await new Promise(resolve => setTimeout(resolve, 500));
        expect((await cache.get('a') as Buffer).toString()).to.be('a');

        await new Promise(resolve => setTimeout(resolve, 600));
        expect((await cache.get('a') as Buffer).toString()).to.be('a');

        await new Promise(resolve => setTimeout(resolve, 1200));
        expect(cache.has('a')).to.be(false);
        expect(await fs.readdir(cachePath)).length(0);
    });
});

it('测试超过容量限制', async function () {
    this.timeout(10000);

    const cachePath = path.join(os.tmpdir(), `NodeDiskCache_Test_${Math.trunc(Math.random() * 10000)}`);

    //创建缓存
    const cache = new DiskCache({ cacheDir: cachePath, volumeUpLimit: 1024 * 1024 * 2 });

    await cache.set('a', Buffer.alloc(1024 * 1024, 'a'));
    await cache.set('b', Buffer.alloc(1024 * 1024, 'b'));
    await cache.set('c', Buffer.alloc(1024 * 1024, 'c'));

    await new Promise(resolve => setTimeout(resolve, 5100));

    expect(cache.has('a')).to.be(false);
    expect(cache.has('b')).to.be(false);
    expect(cache.has('c')).to.be(true);

    let cacheFiles = await fs.promises.readdir(cachePath);
    expect(cacheFiles).length(1);
    expect((await fs.readFile(path.join(cachePath, cacheFiles[0]))).toString()[0]).to.be('c');

    await cache.empty();
});