/**
 * 构造函数参数
 */
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
     * 每隔多长时间检查一下缓存是否超过了上限，默认1分钟
     */
    cleanInterval?: number;
    /**
     * 一次性要清理多少的缓存，范围0-1，默认0.1(容量上限的10%)
     */
    cleanAmount?: number;
    /**
     * 默认缓存过期时间(ms)，0为永不过期。默认0
     */
    timeout?: number;
    /**
     * 默认当获取缓存时是否重置timeout，默认false
     */
    refreshTimeoutWhenGet?: boolean;
}
