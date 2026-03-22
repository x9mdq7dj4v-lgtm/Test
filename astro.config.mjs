import { defineConfig } from 'astro/config';


export default defineConfig({

 // Astro v6 以降の安定版設定
  security: {
    csp: true,
  },

});
