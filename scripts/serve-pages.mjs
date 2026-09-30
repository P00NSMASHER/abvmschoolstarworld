import {createServer} from "node:http";
import {createReadStream,statSync} from "node:fs";
import {extname,join,normalize} from "node:path";

const root=normalize(new URL("../pages/",import.meta.url).pathname.replace(/^\/(?:[A-Za-z]:)/,match=>match.slice(1)));
const port=4173;
const mime={
  ".html":"text/html; charset=utf-8",
  ".js":"text/javascript; charset=utf-8",
  ".css":"text/css; charset=utf-8",
  ".json":"application/json; charset=utf-8",
  ".webmanifest":"application/manifest+json; charset=utf-8",
  ".png":"image/png",
  ".svg":"image/svg+xml",
  ".webp":"image/webp"
};
const server=createServer((req,res)=>{
  const raw=decodeURIComponent((req.url||"/").split("?")[0]);
  const relative=raw==="/"?"index.html":raw.replace(/^\/+/, "");
  const file=normalize(join(root,relative));
  if(!file.startsWith(root)){res.writeHead(403);res.end("Forbidden");return;}
  try{
    if(!statSync(file).isFile())throw new Error("not-file");
    res.writeHead(200,{"Content-Type":mime[extname(file).toLowerCase()]||"application/octet-stream","Cache-Control":"no-store"});
    createReadStream(file).pipe(res);
  }catch{
    res.writeHead(404,{"Content-Type":"text/plain; charset=utf-8"});
    res.end("Not found");
  }
});
server.listen(port,"127.0.0.1",()=>console.log(`ABVM test server listening on http://127.0.0.1:${port}`));
