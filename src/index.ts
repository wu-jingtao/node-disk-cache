import * as os from 'os';
import * as path from 'path';
import * as fs from 'fs-extra';
import * as diskusage from 'diskusage';

export interface NodeDiskCacheOptions {
    /**
     * 缓存目录地址，默认'/tmp/NodeDiskCache_{random}'
     */
    cacheDir?: string;

    /**
     * 缓存容量上限(byte)，默认为0，没有上限
     */
    volumeUpLimit?: number;

    /**
     * 动态监测缓存目录剩余容量，当已用容量占总容量超过指定比例后执行清理操作。范围0-1，默认0，没有上限。如果设置了volumeUpLimit则会使该属性失效
     */
    volumeUpLimitRate?: number;

    /**
     * 设置缓存过期时间(ms)，0为永不过期。默认0
     */
    timeout?: number;

    /**
     * 当获取缓存时是否重置timeout，默认false
     */
    refreshTimeoutWhenGet?: boolean;
}

export default class NodeDiskCache {

    //缓存数据索引列表。name:文件名,size:文件大小,timer:过期计时器
    private readonly _cacheTable = new Map<string, { name: string, size: number, timer: NodeJS.Timer | undefined }>();

    //缓存数据存放目录
    private readonly _cacheDir: string;

    //缓存目录列表，防止某一缓存目录被重复使用
    private static readonly _cacheDirList = new Set<string>();

    //缓存超时
    private readonly _timeout: number;

    //是否获取缓存时重置timeout
    private readonly _refreshTimeoutWhenGet: boolean;

    //清理缓存计时器
    private readonly _cleanerTimer: NodeJS.Timer;

    //当前容量
    private _currentVolume = 0;

    //文件名称自增索引
    private _fileNameIndex = 0;

    constructor(options: NodeDiskCacheOptions = {}) {
        //缓存目录
        this._cacheDir = options.cacheDir || path.join(os.tmpdir(), `NodeDiskCache_${Math.trunc(Math.random() * 10000)}`);
        if (NodeDiskCache._cacheDirList.has(this._cacheDir))
            throw new Error(`缓存目录已被占用：${this._cacheDir}`);
        fs.emptyDirSync(this._cacheDir);
        NodeDiskCache._cacheDirList.add(this._cacheDir);

        //清理缓存
        if (options.volumeUpLimit as number > 0) {
            const upLimit = options.volumeUpLimit as number;
            this._cleanerTimer = setInterval(() => {
                if (this._currentVolume > upLimit)
                    this._cleanCache(upLimit * 0.9);
            }, 5000);
        } else if (options.volumeUpLimitRate as number > 0) {
            const downLimitRate = 1 - Math.min(options.volumeUpLimitRate as number, 1);
            this._cleanerTimer = setInterval(async () => {
                try {
                    const usage = await diskusage.check(this._cacheDir);
                    if (usage.available / usage.total < downLimitRate)
                        this._cleanCache(this._currentVolume - usage.total * 0.1);
                } catch (err) {
                    console.error('获取缓存目录容量信息异常：', err);
                }
            }, 5000);
        }

        //缓存超时
        this._timeout = options.timeout as number > 0 ? options.timeout as number : 0;
        this._refreshTimeoutWhenGet = !!options.refreshTimeoutWhenGet;
    }

    /**
     * 清理缓存
     * @param downTo 将缓存大小下降到指定数值之下
     */
    private _cleanCache(downTo: number): void {
        (async () => {
            for (const [key, value] of this._cacheTable) {
                if (this._currentVolume > downTo) {
                    this._cacheTable.delete(key);
                    clearTimeout(value.timer as any);
                    await fs.remove(value.name);
                    this._currentVolume -= value.size;
                } else
                    break;
            }
        })().catch(err => console.error('清除缓存异常：', err));
    }

    /**
     * 设置或更新缓存
     */
    async set(key: string, value: Buffer | NodeJS.ReadableStream): Promise<void> {
        const cache = this._cacheTable.get(key) || { name: path.join(this._cacheDir, (this._fileNameIndex++).toString()), size: 0, timer: undefined };

        if (this._timeout > 0 && cache.timer !== undefined)
            clearTimeout(cache.timer);

        //保存缓存
        if (Buffer.isBuffer(value)) {
            await fs.promises.writeFile(cache.name, value);
            this._currentVolume += value.length - cache.size;
            cache.size = value.length;
        } else {
            await new Promise((resolve, reject) => {
                value.pipe(fs.createWriteStream(cache.name))
                    .on('error', reject)
                    .on('close', resolve);
            });

            const status = await fs.promises.stat(cache.name);
            this._currentVolume += status.size - cache.size;
            cache.size = status.size;
        }

        if (this._timeout > 0) {
            cache.timer = setTimeout(() => {
                this._cacheTable.delete(key);
                fs.remove(cache.name, err => {
                    if (err)
                        console.error('清除缓存异常：', err);
                    else
                        this._currentVolume -= cache.size;
                });
            }, this._timeout);
        }

        this._cacheTable.delete(key);   //刷新缓存在列表中的排位
        this._cacheTable.set(key, cache);
    }

    /**
     * 获取缓存
     */
    async get(key: string): Promise<Buffer | undefined> {
        const cache = this._cacheTable.get(key);

        if (cache) {
            if (this._refreshTimeoutWhenGet && this._timeout > 0) {
                clearTimeout(cache.timer as any);
                cache.timer = setTimeout(() => {
                    this._cacheTable.delete(key);
                    fs.remove(cache.name, err => {
                        if (err)
                            console.error('清除缓存异常：', err);
                        else
                            this._currentVolume -= cache.size;
                    });
                }, this._timeout);
            }

            return await fs.readFile(cache.name);
        } else
            return cache;
    }

    /**
     * 以流的方式获取缓存
     */
    getStream(key: string): NodeJS.ReadableStream | undefined {
        const cache = this._cacheTable.get(key);

        if (cache) {
            if (this._refreshTimeoutWhenGet && this._timeout > 0) {
                clearTimeout(cache.timer as any);
                cache.timer = setTimeout(() => {
                    this._cacheTable.delete(key);
                    fs.remove(cache.name, err => {
                        if (err)
                            console.error('清除缓存异常：', err);
                        else
                            this._currentVolume -= cache.size;
                    });
                }, this._timeout);
            }

            return fs.createReadStream(cache.name);
        }
        else
            return cache;
    }

    /**
     * 判断缓存是否存在 
     */
    has(key: string): boolean {
        return this._cacheTable.has(key);
    }

    /**
     * 删除缓存
     */
    async delete(key: string): Promise<void> {
        const cache = this._cacheTable.get(key);

        if (cache) {
            await fs.remove(cache.name);
            this._cacheTable.delete(key);
            clearTimeout(cache.timer as any);
            this._currentVolume -= cache.size;
        }
    }

    /**
     * 清空缓存
     */
    async empty(): Promise<void> {
        for (const [key, value] of this._cacheTable) {
            await fs.remove(value.name);
            this._cacheTable.delete(key);
            clearTimeout(value.timer as any);
            this._currentVolume -= value.size;
        }
    }

    /**
     * 销毁缓存
     */
    async destroy(): Promise<void> {
        await this.empty();
        clearInterval(this._cleanerTimer);
    }
}