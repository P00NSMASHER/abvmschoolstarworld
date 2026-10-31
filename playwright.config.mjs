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
    command:"node scripts/serve-pages.mjs",
    url:"http://127.0.0.1:4173",
    reuseExistingServer:true,
    timeout:20_000
  },
  projects:[
    {name:"mobile",use:{viewport:{width:390,height:844},isMobile:true,hasTouch:true}},
    {name:"desktop",use:{viewport:{width:1440,height:900}}},
    {name:"iphone-webkit",testMatch:["study-notes-library.spec.mjs","lunch-trays.spec.mjs","today-assessments.spec.mjs","calendar-search.spec.mjs","iphone-polish.spec.mjs","study-empty-subjects.spec.mjs","daily-practice.spec.mjs","study-hub.spec.mjs","visual-redesign.spec.mjs","study-experience.spec.mjs","study-badges-ui.spec.mjs","study-ranks-enlarged-text.spec.mjs","study-stars-ledger.spec.mjs","study-streak-bonuses.spec.mjs","today-premium.spec.mjs","calendar-premium.spec.mjs","calendar-reimagined.spec.mjs","calendar-bottom-premium.spec.mjs","calendar-summary-navigation.spec.mjs","study-premium.spec.mjs","study-player-premium.spec.mjs","study-tools-premium.spec.mjs","progress-premium.spec.mjs","integrated-premium.spec.mjs","public-learner-privacy.spec.mjs","teacher-source-fallback.spec.mjs"],use:{browserName:"webkit",viewport:{width:393,height:852},isMobile:true,hasTouch:true}}
  ]
});
