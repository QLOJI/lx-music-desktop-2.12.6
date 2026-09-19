<template lang="pug">
span(v-if="badge" class="no-select badge" :class="badgeClass" :style="mergedStyle")
  span(v-if="isMerged" :class="$style.sourceInline") {{ musicInfo.source }}
  span(:class="{ [$style.mergedLabel]: isMerged }") {{ badge.label }}
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
    // 全局 .badge 的左右内边距是 .4em，列表行里左边还要再叠上 .list-item-cell .badge 的 margin-left: 3px，
    // 合并时左边只留 1px，加起来差不多正好一个空格的宽度（`歌名 kg Master` 两侧间隔一致），右边照旧
    const mergedStyle = computed(() => (isMerged.value ? { paddingLeft: '1px' } : null))

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

// 合并标签里 `kg` 和 `Master` 之间的间隔。
// 必须用 margin 撑：pug 编译相邻 span 不会插换行空白，两边本来就是紧贴的，
// 想靠容器的 `gap` 就得先让 display 变成 flex，而全局 .badge 是 inline-block，
// 同级别单类名谁后加载谁赢 —— 一输就是 `kgMaster` 粘一起。
// margin 在 inline / flex 两种布局下都算数，一个空格的宽度，跟字体大小走
.mergedLabel {
  margin-left: .3em;
}

// 合并标签里的源名，比音质标签淡一点
.sourceInline {
  opacity: .75;
}
</style>
