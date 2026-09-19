<template>
  <material-modal :show="show" :bg-close="bgClose" :teleport="teleport" @close="handleClose">
    <main :class="$style.main">
      <h2>{{ info.name }}<br>{{ info.singer }}</h2>
      <base-btn v-for="quality in qualitys" :key="quality.type" :class="$style.btn" @click="handleClick(quality.type)">
        {{ getTypeName(quality.type) }}{{ quality.size && ` - ${quality.size.toUpperCase()}` }}
      </base-btn>
    </main>
  </material-modal>
</template>

<script>
import { qualityList } from '@renderer/store'
import { createDownloadTasks } from '@renderer/store/download/action'
import { canUseMaster, isMasterQuality } from '@renderer/core/music/quality'

export default {
  props: {
    show: {
      type: Boolean,
      default: false,
    },
    musicInfo: {
      type: [Object, null],
      required: true,
    },
    listId: {
      type: String,
      default: '',
    },
    bgClose: {
      type: Boolean,
      default: true,
    },
    teleport: {
      type: String,
      default: '#root',
    },
  },
  emits: ['update:show'],
  setup() {
    return {
      qualityList,
    }
  },
  computed: {
    info() {
      return this.musicInfo || {}
    },
    sourceQualityList() {
      return this.qualityList[this.musicInfo.source] || []
    },
    qualitys() {
      // 脚本给的老格式音质列表（meta.qualitys）里可能自带 atmos / master 条目，
      // 虚音质统一由下面按同一套判据补，先剔掉免得重复列出来
      const list = (this.info.meta?.qualitys || []).filter(quality => !isMasterQuality(quality.type) && this.checkSource(quality.type))
      // Master / Atmos 是客户端虚拟音质：歌曲能按 Master 要的时候补在列表末尾，Master 在 Atmos 上面。
      // 这两个不带上 size —— 虚音质没有真实文件大小，显示大小是骗人
      if (this.musicInfo == null || !canUseMaster(this.musicInfo)) return list
      return [...list, { type: 'master' }, { type: 'atmos' }]
    },
  },
  methods: {
    handleClick(quality) {
      void createDownloadTasks([this.musicInfo], quality, this.listId)
      this.handleClose()
    },
    handleClose() {
      this.$emit('update:show', false)
    },
    getTypeName(quality) {
      switch (quality) {
        // 虚音质写死标签不走 i18n：语言包漏同步时 t() 会把键名原样吐出来
        case 'master':
          return 'Master'
        case 'atmos':
          return 'Atmos'
        case 'flac24bit':
          return this.$t('download__lossless') + ' FLAC Hires'
        case 'flac':
        case 'ape':
        case 'wav':
          return this.$t('download__lossless') + ' ' + quality.toUpperCase()
        case '320k':
          return this.$t('download__high_quality') + ' ' + quality.toUpperCase()
        case '192k':
        case '128k':
          return this.$t('download__normal') + ' ' + quality.toUpperCase()
      }
    },
    checkSource(quality) {
      return this.sourceQualityList.includes(quality)
    },
  },
}
</script>


<style lang="less" module>
@import '@renderer/assets/styles/layout.less';

.main {
  padding: 15px;
  max-width: 400px;
  min-width: 200px;
  display: flex;
  flex-flow: column nowrap;
  justify-content: center;
  h2 {
    font-size: 13px;
    color: var(--color-font);
    line-height: 1.3;
    text-align: center;
    margin-bottom: 15px;
  }
}

.btn {
  display: block;
  margin-bottom: 15px;
  &:last-child {
    margin-bottom: 0;
  }
}

</style>
