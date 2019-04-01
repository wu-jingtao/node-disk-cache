"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const os = require("os");
const path = require("path");
const fs = require("fs-extra");
const diskusage = require("diskusage");
class NodeDiskCache {
    constructor(options = {}) {
        //缓存数据索引列表。name:文件名,size:文件大小,timer:过期计时器
        this._cacheTable = new Map();
        //当前容量
        this._currentVolume = 0;
        //文件名称自增索引
        this._fileNameIndex = 0;
        //缓存目录
        this._cacheDir = options.cacheDir || path.join(os.tmpdir(), `NodeDiskCache_${Math.trunc(Math.random() * 10000)}`);
        fs.emptyDirSync(this._cacheDir);
        //缓存容量
        if (options.volumeUpLimit > 0)
            this._volumeUpLimit = options.volumeUpLimit;
        else
            this._volumeUpLimit = diskusage.checkSync(this._cacheDir).available * Math.min(Math.max(options.volumeUpLimitRate || 0.9, 0), 1);
        //缓存超时
        this._timeout = options.timeout > 0 ? options.timeout : 0;
        this._refreshTimeoutWhenGet = !!options.refreshTimeoutWhenGet;
    }
    /**
     * 设置或更新缓存
     */
    async set(key, value) {
        const cache = this._cacheTable.get(key) || { name: path.join(this._cacheDir, (this._fileNameIndex++).toString()), size: 0, timer: undefined };
        if (this._timeout > 0)
            clearTimeout(cache.timer);
        //保存缓存
        if (Buffer.isBuffer(value)) {
            await fs.promises.writeFile(cache.name, value);
            this._currentVolume += value.length - cache.size;
            cache.size = value.length;
        }
        else {
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
            const downTo = this._volumeUpLimit * 0.9; //将缓存下降到
            for (const [ckey, value] of this._cacheTable) {
                if (key === ckey)
                    continue;
                else if (this._currentVolume > downTo) {
                    this._cacheTable.delete(ckey);
                    clearTimeout(value.timer);
                    await fs.remove(value.name);
                    this._currentVolume -= value.size;
                }
                else
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
    async get(key) {
        const cache = this._cacheTable.get(key);
        if (cache) {
            if (this._refreshTimeoutWhenGet && this._timeout > 0) {
                clearTimeout(cache.timer);
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
    getStream(key) {
        const cache = this._cacheTable.get(key);
        if (cache) {
            if (this._refreshTimeoutWhenGet && this._timeout > 0) {
                clearTimeout(cache.timer);
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
    has(key) {
        return this._cacheTable.has(key);
    }
    /**
     * 删除缓存
     */
    async delete(key) {
        const cache = this._cacheTable.get(key);
        if (cache) {
            await fs.remove(cache.name);
            this._cacheTable.delete(key);
            clearTimeout(cache.timer);
            this._currentVolume -= cache.size;
        }
    }
    /**
     * 清空缓存
     */
    async empty() {
        for (const [key, value] of this._cacheTable) {
            await fs.remove(value.name);
            this._cacheTable.delete(key);
            clearTimeout(value.timer);
            this._currentVolume -= value.size;
        }
    }
}
exports.default = NodeDiskCache;

//# sourceMappingURL=data:application/json;charset=utf8;base64,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O1FBRXhDLElBQUksS0FBSyxFQUFFO1lBQ1AsTUFBTSxFQUFFLENBQUMsTUFBTSxDQUFDLEtBQUssQ0FBQyxJQUFJLENBQUMsQ0FBQztZQUM1QixJQUFJLENBQUMsV0FBVyxDQUFDLE1BQU0sQ0FBQyxHQUFHLENBQUMsQ0FBQztZQUM3QixZQUFZLENBQUMsS0FBSyxDQUFDLEtBQVksQ0FBQyxDQUFDO1lBQ2pDLElBQUksQ0FBQyxjQUFjLElBQUksS0FBSyxDQUFDLElBQUksQ0FBQztTQUNyQztJQUNMLENBQUM7SUFFRDs7T0FFRztJQUNILEtBQUssQ0FBQyxLQUFLO1FBQ1AsS0FBSyxNQUFNLENBQUMsR0FBRyxFQUFFLEtBQUssQ0FBQyxJQUFJLElBQUksQ0FBQyxXQUFXLEVBQUU7WUFDekMsTUFBTSxFQUFFLENBQUMsTUFBTSxDQUFDLEtBQUssQ0FBQyxJQUFJLENBQUMsQ0FBQztZQUM1QixJQUFJLENBQUMsV0FBVyxDQUFDLE1BQU0sQ0FBQyxHQUFHLENBQUMsQ0FBQztZQUM3QixZQUFZLENBQUMsS0FBSyxDQUFDLEtBQVksQ0FBQyxDQUFDO1lBQ2pDLElBQUksQ0FBQyxjQUFjLElBQUksS0FBSyxDQUFDLElBQUksQ0FBQztTQUNyQztJQUNMLENBQUM7Q0FDSjtBQXJMRCxnQ0FxTEMiLCJmaWxlIjoiaW5kZXguanMiLCJzb3VyY2VzQ29udGVudCI6WyJpbXBvcnQgKiBhcyBvcyBmcm9tICdvcyc7XHJcbmltcG9ydCAqIGFzIHBhdGggZnJvbSAncGF0aCc7XHJcbmltcG9ydCAqIGFzIGZzIGZyb20gJ2ZzLWV4dHJhJztcclxuaW1wb3J0ICogYXMgZGlza3VzYWdlIGZyb20gJ2Rpc2t1c2FnZSc7XHJcblxyXG5leHBvcnQgaW50ZXJmYWNlIE5vZGVEaXNrQ2FjaGVPcHRpb25zIHtcclxuICAgIC8qKlxyXG4gICAgICog57yT5a2Y55uu5b2V5Zyw5Z2A77yM6buY6K6kJy90bXAvTm9kZURpc2tDYWNoZV97cmFuZG9tfSdcclxuICAgICAqL1xyXG4gICAgY2FjaGVEaXI/OiBzdHJpbmc7XHJcblxyXG4gICAgLyoqXHJcbiAgICAgKiDnvJPlrZjlrrnph4/kuIrpmZAoYnl0ZSnvvIzpu5jorqTkuLrnvJPlrZjnm67lvZXlj6/nlKjlrrnph48gKiB2b2x1bWVVcExpbWl0UmF0ZVxyXG4gICAgICovXHJcbiAgICB2b2x1bWVVcExpbWl0PzogbnVtYmVyO1xyXG5cclxuICAgIC8qKlxyXG4gICAgICog57yT5a2Y5Y2g5omA5Zyo55uu5b2V5Y+v55So5a656YeP55qE5LiK6ZmQ5q+U5L6L77yM6buY6K6k5Li6MC4544CC5aaC5p6c6K6+572u5LqGdm9sdW1lVXBMaW1pdOWImeS8muS9v+ivpeWxnuaAp+WkseaViFxyXG4gICAgICovXHJcbiAgICB2b2x1bWVVcExpbWl0UmF0ZT86IG51bWJlcjtcclxuXHJcbiAgICAvKipcclxuICAgICAqIOiuvue9rue8k+WtmOi/h+acn+aXtumXtChtcynvvIww5Li65rC45LiN6L+H5pyf44CC6buY6K6kMFxyXG4gICAgICovXHJcbiAgICB0aW1lb3V0PzogbnVtYmVyO1xyXG5cclxuICAgIC8qKlxyXG4gICAgICog5b2T6I635Y+W57yT5a2Y5pe25piv5ZCm6YeN572udGltZW91dO+8jOm7mOiupGZhbHNlXHJcbiAgICAgKi9cclxuICAgIHJlZnJlc2hUaW1lb3V0V2hlbkdldD86IGJvb2xlYW47XHJcbn1cclxuXHJcbmV4cG9ydCBkZWZhdWx0IGNsYXNzIE5vZGVEaXNrQ2FjaGUge1xyXG5cclxuICAgIC8v57yT5a2Y5pWw5o2u57Si5byV5YiX6KGo44CCbmFtZTrmlofku7blkI0sc2l6ZTrmlofku7blpKflsI8sdGltZXI66L+H5pyf6K6h5pe25ZmoXHJcbiAgICBwcml2YXRlIHJlYWRvbmx5IF9jYWNoZVRhYmxlID0gbmV3IE1hcDxzdHJpbmcsIHsgbmFtZTogc3RyaW5nLCBzaXplOiBudW1iZXIsIHRpbWVyOiBOb2RlSlMuVGltZXIgfCB1bmRlZmluZWQgfT4oKTtcclxuXHJcbiAgICAvL+e8k+WtmOaVsOaNruWtmOaUvuebruW9lVxyXG4gICAgcHJpdmF0ZSByZWFkb25seSBfY2FjaGVEaXI6IHN0cmluZztcclxuXHJcbiAgICAvL+e8k+WtmOi2heaXtlxyXG4gICAgcHJpdmF0ZSByZWFkb25seSBfdGltZW91dDogbnVtYmVyO1xyXG5cclxuICAgIC8v5piv5ZCm6I635Y+W57yT5a2Y5pe26YeN572udGltZW91dFxyXG4gICAgcHJpdmF0ZSByZWFkb25seSBfcmVmcmVzaFRpbWVvdXRXaGVuR2V0OiBib29sZWFuO1xyXG5cclxuICAgIC8v57yT5a2Y5a656YeP5LiK6ZmQXHJcbiAgICBwcml2YXRlIHJlYWRvbmx5IF92b2x1bWVVcExpbWl0OiBudW1iZXI7XHJcblxyXG4gICAgLy/lvZPliY3lrrnph49cclxuICAgIHByaXZhdGUgX2N1cnJlbnRWb2x1bWUgPSAwO1xyXG5cclxuICAgIC8v5paH5Lu25ZCN56ew6Ieq5aKe57Si5byVXHJcbiAgICBwcml2YXRlIF9maWxlTmFtZUluZGV4ID0gMDtcclxuXHJcbiAgICBjb25zdHJ1Y3RvcihvcHRpb25zOiBOb2RlRGlza0NhY2hlT3B0aW9ucyA9IHt9KSB7XHJcbiAgICAgICAgLy/nvJPlrZjnm67lvZVcclxuICAgICAgICB0aGlzLl9jYWNoZURpciA9IG9wdGlvbnMuY2FjaGVEaXIgfHwgcGF0aC5qb2luKG9zLnRtcGRpcigpLCBgTm9kZURpc2tDYWNoZV8ke01hdGgudHJ1bmMoTWF0aC5yYW5kb20oKSAqIDEwMDAwKX1gKTtcclxuICAgICAgICBmcy5lbXB0eURpclN5bmModGhpcy5fY2FjaGVEaXIpO1xyXG5cclxuICAgICAgICAvL+e8k+WtmOWuuemHj1xyXG4gICAgICAgIGlmIChvcHRpb25zLnZvbHVtZVVwTGltaXQgYXMgbnVtYmVyID4gMClcclxuICAgICAgICAgICAgdGhpcy5fdm9sdW1lVXBMaW1pdCA9IG9wdGlvbnMudm9sdW1lVXBMaW1pdCBhcyBudW1iZXI7XHJcbiAgICAgICAgZWxzZVxyXG4gICAgICAgICAgICB0aGlzLl92b2x1bWVVcExpbWl0ID0gZGlza3VzYWdlLmNoZWNrU3luYyh0aGlzLl9jYWNoZURpcikuYXZhaWxhYmxlICogTWF0aC5taW4oTWF0aC5tYXgob3B0aW9ucy52b2x1bWVVcExpbWl0UmF0ZSB8fCAwLjksIDApLCAxKTtcclxuXHJcbiAgICAgICAgLy/nvJPlrZjotoXml7ZcclxuICAgICAgICB0aGlzLl90aW1lb3V0ID0gb3B0aW9ucy50aW1lb3V0IGFzIG51bWJlciA+IDAgPyBvcHRpb25zLnRpbWVvdXQgYXMgbnVtYmVyIDogMDtcclxuICAgICAgICB0aGlzLl9yZWZyZXNoVGltZW91dFdoZW5HZXQgPSAhIW9wdGlvbnMucmVmcmVzaFRpbWVvdXRXaGVuR2V0O1xyXG4gICAgfVxyXG5cclxuICAgIC8qKlxyXG4gICAgICog6K6+572u5oiW5pu05paw57yT5a2YXHJcbiAgICAgKi9cclxuICAgIGFzeW5jIHNldChrZXk6IHN0cmluZywgdmFsdWU6IEJ1ZmZlciB8IE5vZGVKUy5SZWFkYWJsZVN0cmVhbSk6IFByb21pc2U8dm9pZD4ge1xyXG4gICAgICAgIGNvbnN0IGNhY2hlID0gdGhpcy5fY2FjaGVUYWJsZS5nZXQoa2V5KSB8fCB7IG5hbWU6IHBhdGguam9pbih0aGlzLl9jYWNoZURpciwgKHRoaXMuX2ZpbGVOYW1lSW5kZXgrKykudG9TdHJpbmcoKSksIHNpemU6IDAsIHRpbWVyOiB1bmRlZmluZWQgfTtcclxuXHJcbiAgICAgICAgaWYgKHRoaXMuX3RpbWVvdXQgPiAwKVxyXG4gICAgICAgICAgICBjbGVhclRpbWVvdXQoY2FjaGUudGltZXIgYXMgYW55KTtcclxuXHJcbiAgICAgICAgLy/kv53lrZjnvJPlrZhcclxuICAgICAgICBpZiAoQnVmZmVyLmlzQnVmZmVyKHZhbHVlKSkge1xyXG4gICAgICAgICAgICBhd2FpdCBmcy5wcm9taXNlcy53cml0ZUZpbGUoY2FjaGUubmFtZSwgdmFsdWUpO1xyXG4gICAgICAgICAgICB0aGlzLl9jdXJyZW50Vm9sdW1lICs9IHZhbHVlLmxlbmd0aCAtIGNhY2hlLnNpemU7XHJcbiAgICAgICAgICAgIGNhY2hlLnNpemUgPSB2YWx1ZS5sZW5ndGg7XHJcbiAgICAgICAgfSBlbHNlIHtcclxuICAgICAgICAgICAgYXdhaXQgbmV3IFByb21pc2UoKHJlc29sdmUsIHJlamVjdCkgPT4ge1xyXG4gICAgICAgICAgICAgICAgdmFsdWUucGlwZShmcy5jcmVhdGVXcml0ZVN0cmVhbShjYWNoZS5uYW1lKSlcclxuICAgICAgICAgICAgICAgICAgICAub24oJ2Vycm9yJywgcmVqZWN0KVxyXG4gICAgICAgICAgICAgICAgICAgIC5vbignY2xvc2UnLCByZXNvbHZlKTtcclxuICAgICAgICAgICAgfSk7XHJcblxyXG4gICAgICAgICAgICBjb25zdCBzdGF0dXMgPSBhd2FpdCBmcy5wcm9taXNlcy5zdGF0KGNhY2hlLm5hbWUpO1xyXG4gICAgICAgICAgICB0aGlzLl9jdXJyZW50Vm9sdW1lICs9IHN0YXR1cy5zaXplIC0gY2FjaGUuc2l6ZTtcclxuICAgICAgICAgICAgY2FjaGUuc2l6ZSA9IHN0YXR1cy5zaXplO1xyXG4gICAgICAgIH1cclxuXHJcbiAgICAgICAgLy/liKTmlq3nvJPlrZjmmK/lkKblt7Lnu4/otoXov4fkuoblrrnph4/pmZDliLZcclxuICAgICAgICBpZiAodGhpcy5fY3VycmVudFZvbHVtZSA+IHRoaXMuX3ZvbHVtZVVwTGltaXQpIHtcclxuICAgICAgICAgICAgY29uc3QgZG93blRvID0gdGhpcy5fdm9sdW1lVXBMaW1pdCAqIDAuOTsgICAvL+Wwhue8k+WtmOS4i+mZjeWIsFxyXG5cclxuICAgICAgICAgICAgZm9yIChjb25zdCBbY2tleSwgdmFsdWVdIG9mIHRoaXMuX2NhY2hlVGFibGUpIHtcclxuICAgICAgICAgICAgICAgIGlmIChrZXkgPT09IGNrZXkpXHJcbiAgICAgICAgICAgICAgICAgICAgY29udGludWU7XHJcbiAgICAgICAgICAgICAgICBlbHNlIGlmICh0aGlzLl9jdXJyZW50Vm9sdW1lID4gZG93blRvKSB7XHJcbiAgICAgICAgICAgICAgICAgICAgdGhpcy5fY2FjaGVUYWJsZS5kZWxldGUoY2tleSk7XHJcbiAgICAgICAgICAgICAgICAgICAgY2xlYXJUaW1lb3V0KHZhbHVlLnRpbWVyIGFzIGFueSk7XHJcbiAgICAgICAgICAgICAgICAgICAgYXdhaXQgZnMucmVtb3ZlKHZhbHVlLm5hbWUpO1xyXG4gICAgICAgICAgICAgICAgICAgIHRoaXMuX2N1cnJlbnRWb2x1bWUgLT0gdmFsdWUuc2l6ZTtcclxuICAgICAgICAgICAgICAgIH0gZWxzZVxyXG4gICAgICAgICAgICAgICAgICAgIGJyZWFrO1xyXG4gICAgICAgICAgICB9XHJcbiAgICAgICAgfVxyXG5cclxuICAgICAgICBpZiAodGhpcy5fdGltZW91dCA+IDApIHtcclxuICAgICAgICAgICAgY2FjaGUudGltZXIgPSBzZXRUaW1lb3V0KCgpID0+IHtcclxuICAgICAgICAgICAgICAgIHRoaXMuX2NhY2hlVGFibGUuZGVsZXRlKGtleSk7XHJcbiAgICAgICAgICAgICAgICBmcy5yZW1vdmUoY2FjaGUubmFtZSwgZXJyID0+IHtcclxuICAgICAgICAgICAgICAgICAgICBpZiAoZXJyKVxyXG4gICAgICAgICAgICAgICAgICAgICAgICBjb25zb2xlLmVycm9yKCfmuIXpmaTnvJPlrZjlvILluLjvvJonLCBlcnIpO1xyXG4gICAgICAgICAgICAgICAgICAgIGVsc2VcclxuICAgICAgICAgICAgICAgICAgICAgICAgdGhpcy5fY3VycmVudFZvbHVtZSAtPSBjYWNoZS5zaXplO1xyXG4gICAgICAgICAgICAgICAgfSk7XHJcbiAgICAgICAgICAgIH0sIHRoaXMuX3RpbWVvdXQpO1xyXG4gICAgICAgIH1cclxuXHJcbiAgICAgICAgdGhpcy5fY2FjaGVUYWJsZS5zZXQoa2V5LCBjYWNoZSk7XHJcbiAgICB9XHJcblxyXG4gICAgLyoqXHJcbiAgICAgKiDojrflj5bnvJPlrZhcclxuICAgICAqL1xyXG4gICAgYXN5bmMgZ2V0KGtleTogc3RyaW5nKTogUHJvbWlzZTxCdWZmZXIgfCB1bmRlZmluZWQ+IHtcclxuICAgICAgICBjb25zdCBjYWNoZSA9IHRoaXMuX2NhY2hlVGFibGUuZ2V0KGtleSk7XHJcblxyXG4gICAgICAgIGlmIChjYWNoZSkge1xyXG4gICAgICAgICAgICBpZiAodGhpcy5fcmVmcmVzaFRpbWVvdXRXaGVuR2V0ICYmIHRoaXMuX3RpbWVvdXQgPiAwKSB7XHJcbiAgICAgICAgICAgICAgICBjbGVhclRpbWVvdXQoY2FjaGUudGltZXIgYXMgYW55KTtcclxuICAgICAgICAgICAgICAgIGNhY2hlLnRpbWVyID0gc2V0VGltZW91dCgoKSA9PiB7XHJcbiAgICAgICAgICAgICAgICAgICAgdGhpcy5fY2FjaGVUYWJsZS5kZWxldGUoa2V5KTtcclxuICAgICAgICAgICAgICAgICAgICBmcy5yZW1vdmUoY2FjaGUubmFtZSwgZXJyID0+IHtcclxuICAgICAgICAgICAgICAgICAgICAgICAgaWYgKGVycilcclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGNvbnNvbGUuZXJyb3IoJ+a4hemZpOe8k+WtmOW8guW4uO+8micsIGVycik7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgIGVsc2VcclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIHRoaXMuX2N1cnJlbnRWb2x1bWUgLT0gY2FjaGUuc2l6ZTtcclxuICAgICAgICAgICAgICAgICAgICB9KTtcclxuICAgICAgICAgICAgICAgIH0sIHRoaXMuX3RpbWVvdXQpO1xyXG4gICAgICAgICAgICB9XHJcblxyXG4gICAgICAgICAgICByZXR1cm4gYXdhaXQgZnMucmVhZEZpbGUoY2FjaGUubmFtZSk7XHJcbiAgICAgICAgfVxyXG4gICAgICAgIGVsc2VcclxuICAgICAgICAgICAgcmV0dXJuIGNhY2hlO1xyXG4gICAgfVxyXG5cclxuICAgIC8qKlxyXG4gICAgICog5Lul5rWB55qE5pa55byP6I635Y+W57yT5a2YXHJcbiAgICAgKi9cclxuICAgIGdldFN0cmVhbShrZXk6IHN0cmluZyk6IE5vZGVKUy5SZWFkYWJsZVN0cmVhbSB8IHVuZGVmaW5lZCB7XHJcbiAgICAgICAgY29uc3QgY2FjaGUgPSB0aGlzLl9jYWNoZVRhYmxlLmdldChrZXkpO1xyXG5cclxuICAgICAgICBpZiAoY2FjaGUpIHtcclxuICAgICAgICAgICAgaWYgKHRoaXMuX3JlZnJlc2hUaW1lb3V0V2hlbkdldCAmJiB0aGlzLl90aW1lb3V0ID4gMCkge1xyXG4gICAgICAgICAgICAgICAgY2xlYXJUaW1lb3V0KGNhY2hlLnRpbWVyIGFzIGFueSk7XHJcbiAgICAgICAgICAgICAgICBjYWNoZS50aW1lciA9IHNldFRpbWVvdXQoKCkgPT4ge1xyXG4gICAgICAgICAgICAgICAgICAgIHRoaXMuX2NhY2hlVGFibGUuZGVsZXRlKGtleSk7XHJcbiAgICAgICAgICAgICAgICAgICAgZnMucmVtb3ZlKGNhY2hlLm5hbWUsIGVyciA9PiB7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgIGlmIChlcnIpXHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBjb25zb2xlLmVycm9yKCfmuIXpmaTnvJPlrZjlvILluLjvvJonLCBlcnIpO1xyXG4gICAgICAgICAgICAgICAgICAgICAgICBlbHNlXHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICB0aGlzLl9jdXJyZW50Vm9sdW1lIC09IGNhY2hlLnNpemU7XHJcbiAgICAgICAgICAgICAgICAgICAgfSk7XHJcbiAgICAgICAgICAgICAgICB9LCB0aGlzLl90aW1lb3V0KTtcclxuICAgICAgICAgICAgfVxyXG5cclxuICAgICAgICAgICAgcmV0dXJuIGZzLmNyZWF0ZVJlYWRTdHJlYW0oY2FjaGUubmFtZSk7XHJcbiAgICAgICAgfVxyXG4gICAgICAgIGVsc2VcclxuICAgICAgICAgICAgcmV0dXJuIGNhY2hlO1xyXG4gICAgfVxyXG5cclxuICAgIC8qKlxyXG4gICAgICog5Yik5pat57yT5a2Y5piv5ZCm5a2Y5ZyoIFxyXG4gICAgICovXHJcbiAgICBoYXMoa2V5OiBzdHJpbmcpOiBib29sZWFuIHtcclxuICAgICAgICByZXR1cm4gdGhpcy5fY2FjaGVUYWJsZS5oYXMoa2V5KTtcclxuICAgIH1cclxuXHJcbiAgICAvKipcclxuICAgICAqIOWIoOmZpOe8k+WtmFxyXG4gICAgICovXHJcbiAgICBhc3luYyBkZWxldGUoa2V5OiBzdHJpbmcpOiBQcm9taXNlPHZvaWQ+IHtcclxuICAgICAgICBjb25zdCBjYWNoZSA9IHRoaXMuX2NhY2hlVGFibGUuZ2V0KGtleSk7XHJcblxyXG4gICAgICAgIGlmIChjYWNoZSkge1xyXG4gICAgICAgICAgICBhd2FpdCBmcy5yZW1vdmUoY2FjaGUubmFtZSk7XHJcbiAgICAgICAgICAgIHRoaXMuX2NhY2hlVGFibGUuZGVsZXRlKGtleSk7XHJcbiAgICAgICAgICAgIGNsZWFyVGltZW91dChjYWNoZS50aW1lciBhcyBhbnkpO1xyXG4gICAgICAgICAgICB0aGlzLl9jdXJyZW50Vm9sdW1lIC09IGNhY2hlLnNpemU7XHJcbiAgICAgICAgfVxyXG4gICAgfVxyXG5cclxuICAgIC8qKlxyXG4gICAgICog5riF56m657yT5a2YXHJcbiAgICAgKi9cclxuICAgIGFzeW5jIGVtcHR5KCk6IFByb21pc2U8dm9pZD4ge1xyXG4gICAgICAgIGZvciAoY29uc3QgW2tleSwgdmFsdWVdIG9mIHRoaXMuX2NhY2hlVGFibGUpIHtcclxuICAgICAgICAgICAgYXdhaXQgZnMucmVtb3ZlKHZhbHVlLm5hbWUpO1xyXG4gICAgICAgICAgICB0aGlzLl9jYWNoZVRhYmxlLmRlbGV0ZShrZXkpO1xyXG4gICAgICAgICAgICBjbGVhclRpbWVvdXQodmFsdWUudGltZXIgYXMgYW55KTtcclxuICAgICAgICAgICAgdGhpcy5fY3VycmVudFZvbHVtZSAtPSB2YWx1ZS5zaXplO1xyXG4gICAgICAgIH1cclxuICAgIH1cclxufSJdfQ==
