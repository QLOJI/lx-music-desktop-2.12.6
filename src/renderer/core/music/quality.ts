/**
 * 音质从高到低的降级顺序。
 * master / atmos 是客户端虚拟出来的音质，不在 meta._qualitys 里，只用于向音源索取。
 */
export const QUALITY_LADDER: LX.Quality[] = ['master', 'atmos', 'flac24bit', 'flac', 'wav', 'ape', '320k', '192k', '128k']
/** 设置项「优先播放的音质」的显示顺序 */
export const PLAY_QUALITYS: LX.Quality[] = ['128k', '320k', 'flac', 'flac24bit', 'atmos', 'master']
export const QUALITY_LABELS: Partial<Record<LX.Quality, string>> = {
  '128k': '128K',
  '320k': '320K',
  flac: 'Flac',
  flac24bit: 'Flac24bit',
  atmos: 'Atmos',
  master: 'Master',
}
/** 支持虚拟 Master 音质的源 */
export const MASTER_SOURCES: LX.Source[] = ['tx', 'kg', 'wy']
/** SQ 及以上的音质 */
export const SQ_QUALITYS: LX.Quality[] = ['master', 'atmos', 'flac24bit', 'flac', 'ape', 'wav']

export const isMasterQuality = (quality: LX.Quality): boolean => quality == 'master' || quality == 'atmos'

/**
 * meta._qualitys 里的条目不一定真有这个音质。
 * 各源解析器用的是 `size !== 0` / `size !== '0'` 这类判断（tx/musicSearch.js、kg/musicInfo.js、
 * kg/leaderboard.js…），接口没返回这个字段时拿到的是 undefined，`undefined !== 0` 和
 * `undefined !== '0'` 都成立，于是白白多出一条音质条目 —— sizeFormate 会把它写成 '0 B'，
 * 接口给字符串 '0' 时更会写成 'NaN undefined'。这种假音质不能算 SQ，否则一首只有 HQ 甚至 128K
 * 的歌小标会显示成 Master，播放时还会真去要 Master。
 *
 * 判据只否掉铁证是假的，其它一律当真，免得误伤真音质（kw 系列的真条目 size 就是 null，
 * 还有直接从接口拿的 '12.34MB' 这种字符串）。
 */
export const hasQuality = (
  qualitys: Partial<Record<LX.Quality, { size?: string | null, hash?: string }>> | undefined,
  quality: LX.Quality,
): boolean => {
  const info = qualitys?.[quality]
  if (info == null) return false
  // kg 系的条目带 hash，取播放地址靠的就是它，有 hash 字段就以它为准
  if (typeof info.hash == 'string') return info.hash.length > 0
  const size = info.size
  if (typeof size != 'string') return true
  return size != '0 B' && !size.startsWith('NaN')
}

/**
 * 这首歌能不能按 Master / Atmos 索取。
 * 小标和播放必须共用这一个判据 —— 小标写了 Master 播放就得真去要 Master，
 * 不然就是"标着一个音质、播着另一个音质"。
 * 两种情况算能：
 * 1. 音源脚本在歌曲里自带了 master / atmos（lx 音源脚本规范里这两个是正式音质，任何源都认）
 * 2. TX / KG / WY 的 SQ 及以上（脚本没声明也先试一把）
 */
export const canUseMaster = (musicInfo: LX.Music.MusicInfoOnline): boolean => {
  const qualitys = musicInfo.meta._qualitys
  if (hasQuality(qualitys, 'master') || hasQuality(qualitys, 'atmos')) return true
  return qualitys != null && MASTER_SOURCES.includes(musicInfo.source) && SQ_QUALITYS.some(q => hasQuality(qualitys, q))
}

/**
 * 按设置的音质取降级阶梯，设置值异常时兜底成 128k
 */
export const getQualityLadder = (quality: LX.Quality): LX.Quality[] => {
  // 设置选 Atmos 时与 Master 完全等同，都从 master 开始试
  const index = QUALITY_LADDER.indexOf(quality == 'atmos' ? 'master' : quality)
  return index < 0 ? ['128k'] : QUALITY_LADDER.slice(index)
}

/**
 * 歌曲实际可用的音质降级列表（不含缓存判断，缓存由取 URL 时逐档探测）
 *
 * 过筛只看歌曲自己的 meta._qualitys —— 小标就是这么算的，播放就必须照着小标来。
 * 别再拿 qualityList.value[源]（音源脚本声明的音质列表）当门槛：脚本声明的和歌曲里实际带的
 * 经常对不上，脚本没声明 flac24bit 而歌里有，就会出现"标着 24bit 播着 flac"。
 * 万一真取不到，下面的降级遍历自然会退到下一档。
 */
export const getPlayQualityList = (quality: LX.Quality, musicInfo: LX.Music.MusicInfoOnline): LX.Quality[] => {
  const isMaster = canUseMaster(musicInfo)
  const qualitys = getQualityLadder(quality).filter(q => {
    if (isMasterQuality(q)) return isMaster
    return hasQuality(musicInfo.meta._qualitys, q)
  })
  // 128k 是万能兜底，无论歌曲元数据里有没有它都要留着
  if (!qualitys.includes('128k')) qualitys.push('128k')
  return qualitys
}

export interface QualityBadge {
  label: string
  theme: 'primary' | 'secondary'
}

/**
 * 歌曲音质小标，返回 null 表示没有可显示的标签。
 * 标签直接写死不走 i18n：这些值在所有语言包里都是同一串（Master / SQ / 24bit / 192K …），
 * 而且语言包漏同步时 t() 会把键名原样吐出来。
 * @param detail 是否显示 192K / 128K 这类低音质标签（「我的列表」需要，搜索列表不需要）
 */
export const getQualityBadge = (musicInfo: LX.Music.MusicInfo, detail = false): QualityBadge | null => {
  // 本地文件没有音质概念，不显示音质小标（只显示源名）
  if (musicInfo.source == 'local') return null
  const qualitys = musicInfo.meta._qualitys

  // 音源脚本真的声明了 master / atmos 时以实际音质为准
  if (hasQuality(qualitys, 'master')) return { label: 'Master', theme: 'primary' }
  if (hasQuality(qualitys, 'atmos')) return { label: 'Atmos', theme: 'primary' }
  // TX / KG / WY 的 SQ 及以上统一显示 Master
  if (canUseMaster(musicInfo)) return { label: 'Master', theme: 'primary' }
  if (hasQuality(qualitys, 'flac24bit')) return { label: '24bit', theme: 'primary' }
  if (hasQuality(qualitys, 'ape') || hasQuality(qualitys, 'flac') || hasQuality(qualitys, 'wav')) return { label: 'SQ', theme: 'primary' }
  if (hasQuality(qualitys, '320k')) return { label: 'HQ', theme: 'secondary' }
  if (!detail) return null
  if (hasQuality(qualitys, '192k')) return { label: '192K', theme: 'secondary' }
  // 什么音质都没有的，补齐 128K
  return { label: '128K', theme: 'secondary' }
}

/**
 * 会话级的「这个源压根取不到这个音质」记忆。
 * 只挡 master / atmos 这种客户端自己加的虚音质：脚本不认识这个 type 时可能一声不吭，
 * 要等满 20 秒超时（'Cancel request'），一首歌白等还不说，还可能整首播不出来。
 * 撞够次数就先跳过这个源；但只要取成功一次立刻清零，撞出来的记录超过一段时间也自动失效，
 * 免得一次网络抽风就把 Master 永久关掉 —— 小标写着 Master 就必须一直有真去要 Master 的机会。
 * 真实音质失败不记：那多半是这一首（某个专辑）转码的问题，下一首还得试。
 */
const MAX_QUALITY_FAIL = 2
const QUALITY_FAIL_EXPIRE = 5 * 60_000
const qualityFailCounts = new Map<string, { count: number, time: number }>()

// master / atmos 共用一个桶：脚本连一个都不认的话，基本也不可能认另一个
const getQualityKey = (source: LX.Source, quality: LX.Quality) =>
  `${source}_${isMasterQuality(quality) ? 'master' : quality}`

export const markQualityFail = (source: LX.Source, quality: LX.Quality) => {
  const key = getQualityKey(source, quality)
  qualityFailCounts.set(key, { count: (qualityFailCounts.get(key)?.count ?? 0) + 1, time: Date.now() })
}

export const markQualitySuccess = (source: LX.Source, quality: LX.Quality) => {
  qualityFailCounts.delete(getQualityKey(source, quality))
}

/** 连续失败达到上限（且没过期）就当这个源取不到，跳过不再试 */
export const isQualitySupported = (source: LX.Source, quality: LX.Quality): boolean => {
  const key = getQualityKey(source, quality)
  const item = qualityFailCounts.get(key)
  if (item == null) return true
  if (Date.now() - item.time > QUALITY_FAIL_EXPIRE) {
    qualityFailCounts.delete(key)
    return true
  }
  return item.count < MAX_QUALITY_FAIL
}

export const resetQualityFailures = () => {
  qualityFailCounts.clear()
}
