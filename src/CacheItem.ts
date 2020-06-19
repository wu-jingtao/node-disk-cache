/**
 * 缓存
 */
export interface CacheItem {
    /**
     * 缓存文件名称
     */
    fileName: number;

    /**
     * 缓存文件大小
     */
    fileSize: number;

    /**
     * 缓存超时计时器
     */
    timeout?: NodeJS.Timer;

    /**
     * 获取缓存时是否重置timeout
     */
    refreshTimeoutWhenGet?: boolean;

    /**
     * 与该缓存存在依赖关系的其他缓存
     */
    related?: string[];
}