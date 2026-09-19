<template lang="pug">
span(v-if="badge" class="no-select badge" :class="[badgeClass, { [$style.merged]: isMerged }]" :style="mergedStyle")
  span(v-if="isMerged" :class="$style.sourceInline") {{ musicInfo.source }}
  span {{ badge.label }}
span(v-else-if="isMerged" class="no-select" :class="$style.source") {{ musicInfo.source }}
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
    // 音质和源合并成一个标签显示，我的列表用：`kg Master`
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
    // 合并显示：`kg Master`
    const isMerged = computed(() => props.merged && props.showSource)
    // 合并标签（`kg Master`）的行内样式，一律写在行内而不是只靠 class：
    // 全局 .badge 是 display:inline-block，跟组件样式谁后加载谁赢，靠 class 说不准 ——
    // 行内样式优先级最高，`kg` 和 `Master` 之间就永远只隔着一个 gap（≈ 一个空格），
    // 不会因为样式表顺序变回 inline 布局、也不会有多出来的空白节点把间隔撑大
    const mergedStyle = computed(() => (isMerged.value
      ? { display: 'inline-flex', alignItems: 'center', gap: '0.3em', paddingLeft: '1px' }
      : null))

    return {
      badge,
      badgeClass,
      isMerged,
      mergedStyle,
    }
  },
}
</script>

<style lang="less" module>
// 单独显示源名（本地歌、或者没有音质标签可显示时）
.source {
  color: var(--color-primary);
  padding: 5px;
  font-size: .8em;
  line-height: 1.2;
  opacity: .75;
  display: inline-block;
}

// 合并标签（`kg Master`）用 inline-flex 排：它不会渲染标签之间的空白文本节点，
// 源名和音质之间就只由 gap 决定，不受字体里空格宽窄的影响。
// gap 跟上面 mergedStyle 里的行内样式保持一致（行内那份优先级更高，这份是兜底）
.merged {
  display: inline-flex;
  align-items: center;
  gap: .3em;
}

// 合并标签里的源名，比音质标签淡一点
.sourceInline {
  opacity: .75;
}
</style>
