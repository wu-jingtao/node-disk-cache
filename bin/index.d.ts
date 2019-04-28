/// <reference types="node" />
import { CacheItem } from './CacheItem';
import { NodeDiskCacheOptions } from './NodeDiskCacheOptions';
export default class NodeDiskCache {
    private static readonly _cacheDirList;
    private readonly _cacheDir;
    private readonly _cacheItems;
    private readonly _defaultTimeout;
    private readonly _defaultRefreshTimeoutWhenGet;
    private readonly _cleanerTimer;
    private _currentSize;
    private _fileNameIndex;
    /**
     * 获取当前的缓存大小
     */
    readonly size: number;
    constructor(options?: NodeDiskCacheOptions);
    /**
     * 在执行set之前做的一些准备工作
     * @param writer 执行文件写入操作的方法
     */
    private _prepareWrite;
    /**
     * 设置或更新缓存
     * @param isAppend 是否以追加到文件末尾的方式写入数据，默认false
     * @param __related 相关缓存(内部使用)
     */
    set(key: string, value: string | Buffer | NodeJS.ReadableStream, isAppend?: boolean, timeout?: number, refreshTimeoutWhenGet?: boolean, __related?: string[]): Promise<void>;
    /**
     * 通过移动现存文件的方式设置或更新缓存
     * @param from 要移动文件的路径
     * @param __related 相关缓存(内部使用)
     */
    move(key: string, from: string, timeout?: number, refreshTimeoutWhenGet?: boolean, __related?: string[]): Promise<void>;
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
    setGroup(items: {
        key: string;
        value?: string | Buffer | NodeJS.ReadableStream;
        isAppend?: boolean;
        from?: string;
        timeout?: number;
        refreshTimeoutWhenGet?: boolean;
    }[]): Promise<void>;
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
     *
     * @param __cache 要被删除的缓存(内部使用)
     */
    delete(key: string, __cache?: CacheItem | undefined): Promise<void>;
    /**
     * 清空缓存
     */
    empty(): Promise<void>;
    /**
     * 销毁缓存
     */
    destroy(): Promise<void>;
}
