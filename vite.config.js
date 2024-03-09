import {defineConfig} from 'vite'
import vue from '@vitejs/plugin-vue'
import dsv from '@rollup/plugin-dsv'
import legacy from '@vitejs/plugin-legacy'



export default {
  build: {
    sourcemap: true,
  },
  plugins: [
    vue(),
    dsv(), 
    legacy({
      targets: ['defaults', 'not IE 11'],
    }),
  ]
}
