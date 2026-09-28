import {readFileSync} from "node:fs";
import {validateUploadedNoticePolicy} from "./uploaded-notice-policy.mjs";
const path=new URL("../pages/data/uploaded-notices.json",import.meta.url);
const uploaded=JSON.parse(readFileSync(path,"utf8"));
const result=validateUploadedNoticePolicy(uploaded);
console.log("Uploaded notice policy passed",result);
