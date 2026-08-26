<script setup lang="ts">
import { RouterLink, RouterView } from 'vue-router'
// import HelloWorld from './components/HelloWorld.vue'
import FileRefTags from './components/FileRefTags.vue'
import NewFileRefTags from './components/NewFileRefTags.vue'
import { ref } from 'vue';

import { useVsCodeApiStore } from '@/stores/vscode'


const showNew = ref(false)
function changeView(){
  showNew.value = !showNew.value
}

// function getVSCodeApi(): VSCodeApi | null {
function getVSCodeApi(): any {
  if (typeof useVsCodeApiStore === 'function') {
    const vscode = useVsCodeApiStore().vscode
    return vscode
  }
  return null
}

const vscode = getVSCodeApi()

interface VSCodeMessage {
  command: string
  [key: string]: unknown
}

function postMessage(msg: VSCodeMessage) {
  if (vscode) {
    vscode.postMessage(msg)
  } else {
    console.log('[FileRefTags] postMessage:', msg)
  }
}


function getAllItem() {
  console.log('(00)===>vue-getAllItem')
  postMessage({ command: 'getAllItem',id:'1231231',groupId:'sadfasdfas'})
}
</script>

<template>
  <div style="height: 100%;width: 100%;">
    <button @click="changeView" style="height: 30px;width: 100%;background-color: black; color: aliceblue;">切换</button>
    <button @click="getAllItem" style="height: 30px;width: 100%;background-color: black; color: aliceblue;">获取全部元素</button>
    <FileRefTags v-if="!showNew"/>
    <NewFileRefTags v-else />
  </div>
<!-- <header>
    <img alt="Vue logo" class="logo" src="@/assets/logo.svg" width="125" height="125" />

    <div class="wrapper">
      <HelloWorld msg="You did it!" />

      <nav>
        <RouterLink to="/">Home</RouterLink>
        <RouterLink to="/about">About</RouterLink>
      </nav>
    </div>
  </header>

  <RouterView /> -->
</template>

<style>
  /* 重置根容器 */
  html, body, #app {
    margin: 0;
    padding: 0;
    width: 100%;
    height: 100%;
    overflow: hidden;
  }
</style>

<style scoped>
/* 重置根容器 */
html, body, #app {
  margin: 0;
  padding: 0;
  width: 100%;
  height: 100%;
  overflow: hidden;
}
header {
  line-height: 1.5;
  max-height: 100vh;
}

.logo {
  display: block;
  margin: 0 auto 2rem;
}

nav {
  width: 100%;
  font-size: 12px;
  text-align: center;
  margin-top: 2rem;
}

nav a.router-link-exact-active {
  color: var(--color-text);
}

nav a.router-link-exact-active:hover {
  background-color: transparent;
}

nav a {
  display: inline-block;
  padding: 0 1rem;
  border-left: 1px solid var(--color-border);
}

nav a:first-of-type {
  border: 0;
}

@media (min-width: 1024px) {
  header {
    display: flex;
    place-items: center;
    padding-right: calc(var(--section-gap) / 2);
  }

  .logo {
    margin: 0 2rem 0 0;
  }

  header .wrapper {
    display: flex;
    place-items: flex-start;
    flex-wrap: wrap;
  }

  nav {
    text-align: left;
    margin-left: -1rem;
    font-size: 1rem;

    padding: 1rem 0;
    margin-top: 1rem;
  }
}
</style>
