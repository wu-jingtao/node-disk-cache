/// <reference types="node" />
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
    private readonly _cacheTable;
    private readonly _cacheDir;
    private static readonly _cacheDirList;
    private readonly _timeout;
    private readonly _refreshTimeoutWhenGet;
    private readonly _cleanerTimer;
    private _currentVolume;
    private _fileNameIndex;
    constructor(options?: NodeDiskCacheOptions);
    /**
     * 清理缓存
     * @param downTo 将缓存大小下降到指定数值之下
     */
    private _cleanCache;
    /**
     * 设置或更新缓存
     */
    set(key: string, value: Buffer | NodeJS.ReadableStream): Promise<void>;
    /**
     * 获取缓存
     */
    get(key: string): Promise<Buffer | undefined>;
    /**
     * 以流的方式获取缓存
     */
    getStream(key: string): NodeJS.ReadableStream | undefined;
    /**
     * 判断缓存是否存在
     */
    has(key: string): boolean;
    /**
     * 删除缓存
     */
    delete(key: string): Promise<void>;
    /**
     * 清空缓存
     */
    empty(): Promise<void>;
    /**
     * 销毁缓存
     */
    destroy(): Promise<void>;
}
