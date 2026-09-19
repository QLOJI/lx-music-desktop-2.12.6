<template lang="pug">
span(v-if="badge" class="no-select badge" :class="badgeClass") {{ text }}
span(v-else-if="merged && showSource" class="no-select" :class="$style.source") {{ musicInfo.source }}
</template>

<script>
import { computed } from '@common/utils/vueTools'
import { getQualityBadge } from '@renderer/core/music/quality'

export default {
  name: 'MaterialQualityBadge',
  props: {
    // 歌曲信息
    musicInfo: {
      type: Object,
      required: true,
    },
    // 音质和源合并成一个标签显示，我的列表用：`kg 24bit`
    merged: {
      type: Boolean,
      default: false,
    },
    // 合并显示时是否带上源名
    showSource: {
      type: Boolean,
      default: true,
    },
    // 是否显示 192K / 128K 这类低音质标签
    detail: {
      type: Boolean,
      default: false,
    },
  },
  setup(props) {
    const badge = computed(() => getQualityBadge(props.musicInfo, props.detail))
    const badgeClass = computed(() => (badge.value ? `badge-theme-${badge.value.theme}` : ''))
    const text = computed(() => {
      if (!badge.value) return ''
      const label = badge.value.label
      return props.merged && props.showSource ? `${props.musicInfo.source} ${label}` : label
    })

    return {
      badge,
      badgeClass,
      text,
    }
  },
}
</script>

<style lang="less" module>
.source {
  color: var(--color-primary);
  padding: 5px;
  font-size: .8em;
  line-height: 1.2;
  opacity: .75;
  display: inline-block;
}
</style>
