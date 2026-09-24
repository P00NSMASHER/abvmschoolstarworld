import {defineConfig} from "@playwright/test";

export default defineConfig({
  testDir:"./tests",
  timeout:30_000,
  expect:{timeout:5_000},
  fullyParallel:false,
  retries:1,
  reporter:[["line"],["html",{outputFolder:"playwright-report",open:"never"}]],
  use:{
    baseURL:"http://127.0.0.1:4173",
    browserName:"chromium",
    trace:"retain-on-failure",
    screenshot:"only-on-failure"
  },
  webServer:{
    command:"python3 -m http.server 4173 --directory pages",
    url:"http://127.0.0.1:4173",
    reuseExistingServer:true,
    timeout:20_000
  },
  projects:[
    {name:"mobile",use:{viewport:{width:390,height:844},isMobile:true,hasTouch:true}},
    {name:"desktop",use:{viewport:{width:1440,height:900}}}
  ]
});
