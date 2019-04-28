import * as os from 'os';
import * as path from 'path';
import * as fs from 'fs-extra';
import * as diskusage from 'diskusage';

import { CacheItem } from './CacheItem';
import { NodeDiskCacheOptions } from './NodeDiskCacheOptions';

export default class NodeDiskCache {

    //缓存目录列表，防止某一缓存目录被重复使用
    private static readonly _cacheDirList = new Set<string>();

    //缓存数据存放目录
    private readonly _cacheDir: string;

    //缓存索引列表
    private readonly _cacheItems = new Map<string, CacheItem>();

    //默认缓存超时
    private readonly _defaultTimeout: number;

    //默认是否获取缓存时重置timeout
    private readonly _defaultRefreshTimeoutWhenGet: boolean;

    //清理缓存计时器
    private readonly _cleanerTimer: NodeJS.Timer;

    //当前缓存大小
    private _currentSize = 0;

    //文件名称自增索引
    private _fileNameIndex = 0;

    /**
     * 获取当前的缓存大小
     */
    get size() { return this._currentSize; }

    constructor(options: NodeDiskCacheOptions = {}) {
        //缓存目录
        this._cacheDir = options.cacheDir || path.join(os.tmpdir(), `NodeDiskCache_${Math.trunc(Math.random() * 10000)}`);
        if (NodeDiskCache._cacheDirList.has(this._cacheDir))
            throw new Error(`缓存目录已被占用：'${this._cacheDir}'`);
        fs.emptyDirSync(this._cacheDir);
        NodeDiskCache._cacheDirList.add(this._cacheDir);

        //清理缓存
        if (options.volumeUpLimit as number > 0) {
            const upLimit = options.volumeUpLimit as number;
            const cleanAmount = Math.min(options.cleanAmount || 0.1, 1);
            const downTo = upLimit * (1 - cleanAmount);

            this._cleanerTimer = setInterval(async () => {
                if (this._currentSize > upLimit) {
                    for (const item of this._cacheItems) {
                        if (this._currentSize > downTo)
                            await this.delete(item[0], item[1]);
                        else
                            break;
                    }
                }
            }, options.cleanInterval || 60 * 1000);
        } else if (options.volumeUpLimitRate as number > 0) {
            const upLimitRate = Math.min(options.volumeUpLimitRate as number, 1);
            const downLimitRate = 1 - upLimitRate;
            const cleanAmount = Math.min(options.cleanAmount || 0.1, 1);

            this._cleanerTimer = setInterval(async () => {
                try {
                    const usage = await diskusage.check(this._cacheDir);
                    if (usage.available / usage.total < downLimitRate) {
                        const downTo = this._currentSize - usage.total * upLimitRate * cleanAmount;
                        for (const item of this._cacheItems) {
                            if (this._currentSize > downTo)
                                await this.delete(item[0], item[1]);
                            else
                                break;
                        }
                    }
                } catch (err) {
                    console.error('获取缓存目录容量信息异常：', err);
                }
            }, options.cleanInterval || 60 * 1000);
        }

        //默认缓存超时
        this._defaultTimeout = options.timeout as number > 0 ? options.timeout as number : 0;
        this._defaultRefreshTimeoutWhenGet = !!options.refreshTimeoutWhenGet;
    }

    /**
     * 在执行set之前做的一些准备工作
     * @param writer 执行文件写入操作的方法
     */
    private async _prepareWrite(writer: (path: string) => Promise<void>, key: string, timeout: number, refreshTimeoutWhenGet: boolean, related?: string[]): Promise<void> {
        const cache: any = this._cacheItems.get(key) || {
            filePath: path.join(this._cacheDir, (this._fileNameIndex++).toString()),
            fileSize: 0
        };

        clearTimeout(cache.timeout);

        //执行存储方法
        await writer(cache.filePath);

        //查询文件大小
        const status = await fs.promises.stat(cache.filePath);
        this._currentSize -= cache.fileSize;
        cache.fileSize = status.blksize || status.size;
        this._currentSize += cache.fileSize;

        cache.refreshTimeoutWhenGet = refreshTimeoutWhenGet;
        if (timeout > 0) cache.timeout = setTimeout(() => this.delete(key, cache), timeout);
        if (related) cache.related = related;

        this._cacheItems.delete(key);   //刷新缓存在列表中的排位
        this._cacheItems.set(key, cache);
    }

    /**
     * 设置或更新缓存
     * @param isAppend 是否以追加到文件末尾的方式写入数据，默认false
     * @param __related 相关缓存(内部使用)
     */
    set(key: string, value: string | Buffer | NodeJS.ReadableStream, isAppend = false, timeout = this._defaultTimeout, refreshTimeoutWhenGet = this._defaultRefreshTimeoutWhenGet, __related?: string[]): Promise<void> {
        return this._prepareWrite(path => {
            if ('string' === typeof value || Buffer.isBuffer(value))
                return fs.promises.writeFile(path, value, { flag: isAppend ? 'a' : 'w' });
            else {
                return new Promise((resolve, reject) => {
                    value.pipe(fs.createWriteStream(path, { flags: isAppend ? 'a' : 'w' }))
                        .on('error', reject)
                        .on('close', resolve);
                });
            }
        }, key, timeout, refreshTimeoutWhenGet, __related);
    }

    /**
     * 通过移动现存文件的方式设置或更新缓存
     * @param from 要移动文件的路径
     * @param __related 相关缓存(内部使用)
     */
    move(key: string, from: string, timeout = this._defaultTimeout, refreshTimeoutWhenGet = this._defaultRefreshTimeoutWhenGet, __related?: string[]): Promise<void> {
        return this._prepareWrite(path => fs.move(from, path), key, timeout, refreshTimeoutWhenGet, __related);
    }

    /**
     * 同时设置多个缓存，并且使得这些缓存具有相互依存关系（无论哪一个被删除了，其他的都将同时被删除）
     * 
     * @param items
     * {
     *  key：键,
     *  value：缓存的值,
     *  isAppend：是否以追加到文件末尾的方式写入数据，默认false,
     *  from：文件路径(以移动文件的方式设置缓存),
     *  timeout：缓存超时计时器,
     *  refreshTimeoutWhenGet：获取缓存时是否重置timeout,
     * }
     */
    async setGroup(items: { key: string, value?: string | Buffer | NodeJS.ReadableStream, isAppend?: boolean, from?: string, timeout?: number, refreshTimeoutWhenGet?: boolean }[]): Promise<void> {
        const related = items.map(item => item.key);

        for (const item of items) {
            if (item.from)
                await this.move(item.key, item.from, item.timeout, item.refreshTimeoutWhenGet, related);
            else
                await this.set(item.key, item.value || '', item.isAppend, item.timeout, item.refreshTimeoutWhenGet, related);
        }
    }

    /**
     * 获取缓存
     */
    get(key: string): Promise<Buffer | undefined> {
        const cache = this._cacheItems.get(key);

        if (cache) {
            if (cache.refreshTimeoutWhenGet && cache.timeout) {
                cache.timeout.refresh();
                this._cacheItems.delete(key);   //刷新缓存在列表中的排位
                this._cacheItems.set(key, cache);
            }

            return fs.readFile(cache.filePath);
        } else
            return Promise.resolve(undefined);
    }

    /**
     * 以流的方式获取缓存
     */
    getStream(key: string): NodeJS.ReadableStream | undefined {
        const cache = this._cacheItems.get(key);

        if (cache) {
            if (cache.refreshTimeoutWhenGet && cache.timeout) {
                cache.timeout.refresh();
                this._cacheItems.delete(key);   //刷新缓存在列表中的排位
                this._cacheItems.set(key, cache);
            }

            return fs.createReadStream(cache.filePath);
        } else
            return undefined;
    }

    /**
     * 判断缓存是否存在 
     */
    has(key: string): boolean {
        return this._cacheItems.has(key);
    }

    /**
     * 删除缓存
     * 
     * @param __cache 要被删除的缓存(内部使用)
     */
    async delete(key: string, __cache = this._cacheItems.get(key)): Promise<void> {
        if (__cache) {
            this._cacheItems.delete(key);
            clearTimeout(__cache.timeout as any);

            if (__cache.related) {
                for (const item of __cache.related) {
                    this.delete(item);
                }
            }

            try {
                await fs.remove(__cache.filePath);
                this._currentSize -= __cache.fileSize;
            } catch (error) {
                console.error('删除缓存失败:', error);
            }
        }
    }

    /**
     * 清空缓存
     */
    async empty(): Promise<void> {
        for (const [key, cache] of this._cacheItems) {
            this._cacheItems.delete(key);
            clearTimeout(cache.timeout as any);

            try {
                await fs.remove(cache.filePath);
                this._currentSize -= cache.fileSize;
            } catch (error) {
                console.error('删除缓存失败:', error);
            }
        }
    }

    /**
     * 销毁缓存
     */
    async destroy(): Promise<void> {
        clearInterval(this._cleanerTimer);
        await this.empty();
    }
}