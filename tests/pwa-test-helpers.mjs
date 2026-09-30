export async function readPwaVersions(request){
  const [index,sw,app]=await Promise.all([
    request.get("/index.html").then(response=>response.text()),
    request.get("/sw.js").then(response=>response.text()),
    request.get("/app.js").then(response=>response.text()),
  ]);
  const required=(value,label)=>{
    if(!value)throw new Error("Missing PWA version marker: "+label);
    return value;
  };
  return{
    index,
    sw,
    app,
    cacheName:required(sw.match(/const CACHE = "([^"]+)"/)?.[1],"cache name"),
    styleUrl:required(index.match(/href="(\.\/styles\.css\?v=[^"]+)"/)?.[1],"stylesheet URL"),
    richStyleUrl:required(index.match(/href="(\.\/study-games-rich\.css\?v=[^"]+)"/)?.[1],"Study Games rich stylesheet URL"),
    appUrl:required(index.match(/src="(\.\/app\.js\?v=[^"]+)"/)?.[1],"app URL"),
    reloadKey:required(index.match(/const reloadKey = "([^"]+)"/)?.[1],"service-worker reload key"),
    gamesUrl:required(app.match(/["\'](\.\/study-games\.js\?v=[^"\']+)["\']/)?.[1],"Study Games URL"),
    gamesViewUrl:required(app.match(/["\'](\.\/study-games-view\.js\?v=[^"\']+)["\']/)?.[1],"Study Games view URL"),
  };
}
