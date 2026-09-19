import { qualityList } from '@renderer/store'

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
 * 是否是「TX/KG/WY 的 SQ 及以上」的歌曲，这类歌曲小标显示 Master，播放时优先按 Master 索取
 */
export const canUseMaster = (musicInfo: LX.Music.MusicInfoOnline): boolean => {
  const qualitys = musicInfo.meta._qualitys
  return qualitys != null && MASTER_SOURCES.includes(musicInfo.source) && SQ_QUALITYS.some(q => qualitys[q] != null)
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
 */
export const getPlayQualityList = (quality: LX.Quality, musicInfo: LX.Music.MusicInfoOnline): LX.Quality[] => {
  const isMaster = canUseMaster(musicInfo)
  const list = qualityList.value[musicInfo.source]
  const qualitys = getQualityLadder(quality).filter(q => {
    if (isMasterQuality(q)) return isMaster
    return musicInfo.meta._qualitys[q] != null && list?.includes(q)
  })
  // 128k 是万能兜底，无论音源脚本怎么声明都要留着
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
  if (qualitys == null) return detail ? { label: '128K', theme: 'secondary' } : null

  // 音源脚本真的声明了 master / atmos 时以实际音质为准
  if (qualitys.master) return { label: 'Master', theme: 'primary' }
  if (qualitys.atmos) return { label: 'Atmos', theme: 'primary' }
  // TX / KG / WY 的 SQ 及以上统一显示 Master
  if (canUseMaster(musicInfo)) return { label: 'Master', theme: 'primary' }
  if (qualitys.flac24bit) return { label: '24bit', theme: 'primary' }
  if (qualitys.ape || qualitys.flac || qualitys.wav) return { label: 'SQ', theme: 'primary' }
  if (qualitys['320k']) return { label: 'HQ', theme: 'secondary' }
  if (!detail) return null
  if (qualitys['192k']) return { label: '192K', theme: 'secondary' }
  return { label: '128K', theme: 'secondary' }
}

/**
 * 会话级的「该源取不到该音质」失败计数。
 * 只记 master / atmos 这种试探性的虚音质：脚本压根不支持时别每首歌都白试一轮（尤其脚本不
 * 认识这个 type 时会把 20 秒超时拖满），但也不能因为某首歌没有母带版就把整个源的 Master 关掉
 * —— 有没有母带版是逐首的，所以连续失败够次数才放弃，取成功一次就清零。
 */
const MAX_QUALITY_FAIL = 3
const qualityFailCounts = new Map<string, number>()

const getQualityKey = (source: LX.Source, quality: LX.Quality) => `${source}_${quality}`

export const markQualityFail = (source: LX.Source, quality: LX.Quality) => {
  const key = getQualityKey(source, quality)
  qualityFailCounts.set(key, (qualityFailCounts.get(key) ?? 0) + 1)
}

export const markQualitySuccess = (source: LX.Source, quality: LX.Quality) => {
  qualityFailCounts.delete(getQualityKey(source, quality))
}

/** 连续失败达到上限就当这个源取不到，跳过不再试 */
export const isQualitySupported = (source: LX.Source, quality: LX.Quality): boolean =>
  (qualityFailCounts.get(getQualityKey(source, quality)) ?? 0) < MAX_QUALITY_FAIL

export const resetQualityFailures = () => {
  qualityFailCounts.clear()
}
