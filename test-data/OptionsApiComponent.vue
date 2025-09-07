<template>
  <div>
    <p>{{ message }}</p>
    <p>{{ reversedMessage }}</p>
    <button @click="reverseMessage">Reverse</button>
  </div>
</template>

<script>
export default {
  data() {
    return {
      message: 'Hello, World!'
    };
  },
  computed: {
    reversedMessage() {
      return this.message.split('').reverse().join('');
    }
  },
  methods: {
    reverseMessage() {
      this.message = this.reversedMessage;
    }
  }
};
</script>
