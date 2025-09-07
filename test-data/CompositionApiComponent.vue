<template>
  <div>
    <p>{{ message }}</p>
    <p>{{ reversedMessage }}</p>
    <button @click="reverseMessage">Reverse</button>
  </div>
</template>

<script setup>
import { ref, computed } from 'vue';

const message = ref('Hello, Vue!');

const reversedMessage = computed(() => {
  return message.value.split('').reverse().join('');
});

function reverseMessage() {
  message.value = reversedMessage.value;
}
</script>
