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
  labelKey: string
  theme: 'primary' | 'secondary'
}

/**
 * 歌曲音质小标，返回 null 表示没有可显示的标签
 * @param detail 是否显示 192K / 128K 这类低音质标签（「我的列表」需要，搜索列表不需要）
 */
export const getQualityBadge = (musicInfo: LX.Music.MusicInfo, detail = false): QualityBadge | null => {
  // 本地文件没有音质概念，不显示音质小标（只显示源名）
  if (musicInfo.source == 'local') return null
  const qualitys = musicInfo.meta._qualitys
  if (qualitys == null) return detail ? { labelKey: 'tag__128k', theme: 'secondary' } : null

  // 音源脚本真的声明了 master / atmos 时以实际音质为准
  if (qualitys.master) return { labelKey: 'tag__master', theme: 'primary' }
  if (qualitys.atmos) return { labelKey: 'tag__atmos', theme: 'primary' }
  // TX / KG / WY 的 SQ 及以上统一显示 Master
  if (canUseMaster(musicInfo)) return { labelKey: 'tag__master', theme: 'primary' }
  if (qualitys.flac24bit) return { labelKey: 'tag__lossless_24bit', theme: 'primary' }
  if (qualitys.ape || qualitys.flac || qualitys.wav) return { labelKey: 'tag__lossless', theme: 'primary' }
  if (qualitys['320k']) return { labelKey: 'tag__high_quality', theme: 'secondary' }
  if (!detail) return null
  if (qualitys['192k']) return { labelKey: 'tag__192k', theme: 'secondary' }
  return { labelKey: 'tag__128k', theme: 'secondary' }
}

/**
 * 会话级的「该源取不到该音质」记忆。
 * 只记 master / atmos 这种试探性的虚音质，避免每首歌都白试一轮。
 */
const unsupportedQualitys = new Map<LX.Source, Set<LX.Quality>>()

export const markQualityUnsupported = (source: LX.Source, quality: LX.Quality) => {
  let list = unsupportedQualitys.get(source)
  if (!list) {
    list = new Set()
    unsupportedQualitys.set(source, list)
  }
  list.add(quality)
}

export const isQualityUnsupported = (source: LX.Source, quality: LX.Quality): boolean =>
  unsupportedQualitys.get(source)?.has(quality) ?? false

export const clearQualityUnsupported = () => {
  unsupportedQualitys.clear()
}
