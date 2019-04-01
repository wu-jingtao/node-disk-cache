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
     * 缓存容量上限(byte)，默认为缓存目录可用容量 * volumeUpLimitRate
     */
    volumeUpLimit?: number;

    /**
     * 缓存占所在目录可用容量的上限比例，默认为0.9。如果设置了volumeUpLimit则会使该属性失效
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

    //缓存超时
    private readonly _timeout: number;

    //是否获取缓存时重置timeout
    private readonly _refreshTimeoutWhenGet: boolean;

    //缓存容量上限
    private readonly _volumeUpLimit: number;

    //当前容量
    private _currentVolume = 0;

    //文件名称自增索引
    private _fileNameIndex = 0;

    constructor(options: NodeDiskCacheOptions = {}) {
        //缓存目录
        this._cacheDir = options.cacheDir || path.join(os.tmpdir(), `NodeDiskCache_${Math.trunc(Math.random() * 10000)}`);
        fs.emptyDirSync(this._cacheDir);

        //缓存容量
        if (options.volumeUpLimit as number > 0)
            this._volumeUpLimit = options.volumeUpLimit as number;
        else
            this._volumeUpLimit = diskusage.checkSync(this._cacheDir).available * Math.min(Math.max(options.volumeUpLimitRate || 0.9, 0), 1);

        //缓存超时
        this._timeout = options.timeout as number > 0 ? options.timeout as number : 0;
        this._refreshTimeoutWhenGet = !!options.refreshTimeoutWhenGet;
    }

    /**
     * 设置或更新缓存
     */
    async set(key: string, value: Buffer | NodeJS.ReadableStream): Promise<void> {
        const cache = this._cacheTable.get(key) || { name: path.join(this._cacheDir, (this._fileNameIndex++).toString()), size: 0, timer: undefined };

        if (this._timeout > 0)
            clearTimeout(cache.timer as any);

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

        //判断缓存是否已经超过了容量限制
        if (this._currentVolume > this._volumeUpLimit) {
            const downTo = this._volumeUpLimit * 0.9;   //将缓存下降到

            for (const [ckey, value] of this._cacheTable) {
                if (key === ckey)
                    continue;
                else if (this._currentVolume > downTo) {
                    this._cacheTable.delete(ckey);
                    clearTimeout(value.timer as any);
                    await fs.remove(value.name);
                    this._currentVolume -= value.size;
                } else
                    break;
            }
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
        }
        else
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
}