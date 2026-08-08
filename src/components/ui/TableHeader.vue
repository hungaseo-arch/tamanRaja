<script setup lang="ts">
interface Props { class?: string }
const props = defineProps<Props>();
</script>
<template>
  <thead :class="props.class"><slot /></thead>
</template>
