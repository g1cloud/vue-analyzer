<template>
  <button class="base-button">
    <slot>{{ caption }}</slot>
  </button>
</template>

<script setup lang="ts">
defineProps({
  caption: {
    type: String,
    required: true,
  },
  disabled: {
    type: Boolean,
    default: false,
  },
});
</script>

<style scoped>
.base-button {
  padding: 8px 16px;
  border-radius: 4px;
  cursor: pointer;
}
</style>
