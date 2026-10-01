const MAX_FILE_SIZE = 25 * 1024 * 1024;

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    if (url.pathname === "/admin-upload") {
      return new Response(UPLOAD_HTML, {
        headers: { "content-type": "text/html; charset=UTF-8" }
      });
    }

    if (url.pathname === "/__r2-upload" && request.method === "POST") {
      const token = request.headers.get("X-Upload-Token");

      if (!env.UPLOAD_TOKEN || token !== env.UPLOAD_TOKEN) {
        return new Response("Unauthorized", { status: 401 });
      }

      const form = await request.formData();
      const folder = cleanPathPart(form.get("folder"));
      const files = form.getAll("files");

      if (!files.length) {
        return new Response("No images selected", { status: 400 });
      }

      const results = [];

      for (const file of files) {
        if (!(file instanceof File)) continue;

        const filename = cleanFilename(file.name);

        if (!filename) {
          results.push({ ok: false, filename: file.name, error: "Invalid filename" });
          continue;
        }

        if (file.size > MAX_FILE_SIZE) {
          results.push({ ok: false, filename, error: "File is larger than 25 MB" });
          continue;
        }

        if (!file.type || !file.type.startsWith("image/")) {
          results.push({ ok: false, filename, error: "Only image files are allowed" });
          continue;
        }

        const key = folder ? folder + "/" + filename : filename;

        try {
          await env.BUCKET.put(key, file.stream(), {
            httpMetadata: {
              contentType: file.type,
              contentDisposition: "inline",
              cacheControl: "public, max-age=31536000, immutable"
            }
          });

          results.push({
            ok: true,
            filename,
            key,
            bytes: file.size,
            contentType: file.type,
            url: "https://images.haircutvibe.com/" + key
          });
        } catch (error) {
          results.push({
            ok: false,
            filename,
            error: error.message || "Upload failed"
          });
        }
      }

      return Response.json({
        ok: results.length > 0 && results.every(item => item.ok),
        count: results.length,
        results
      });
    }

    return env.ASSETS.fetch(request);
  }
};

function cleanPathPart(value) {
  return String(value || "")
    .trim()
    .replace(/^\/+|\/+$/g, "")
    .split("/")
    .filter(part => part && part !== "." && part !== "..")
    .join("/");
}

function cleanFilename(value) {
  const name = String(value || "").trim().split("/").pop();
  if (!/^[a-zA-Z0-9._-]+$/.test(name)) return "";
  return name;
}

const UPLOAD_HTML = `<!doctype html>
<html lang="en">
<head>
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="robots" content="noindex,nofollow">
<title>HaircutVibe R2 Upload</title>
<style>
body{font-family:-apple-system,BlinkMacSystemFont,sans-serif;background:#111;color:#eee;padding:24px;max-width:620px;margin:auto}
h1{color:#d8b46a}.box{background:#1b1b1b;border:1px solid #333;border-radius:14px;padding:20px;margin-top:18px}
label{display:block;margin-top:12px}input,button{width:100%;box-sizing:border-box;padding:14px;margin:8px 0;border-radius:10px;border:1px solid #444;background:#222;color:#fff}
button{background:#d8b46a;color:#111;font-weight:700;border:0}
#status{white-space:pre-wrap;margin-top:15px;word-break:break-word;max-height:400px;overflow:auto}
small{color:#aaa}
</style>
</head>
<body>
<h1>HaircutVibe R2 Upload</h1>
<div class="box">
<label>Folder</label>
<input id="folder" value="festival-hairstyles-2026">
<label>Upload token</label>
<input id="token" type="password" autocomplete="off" placeholder="Enter upload token">
<label>Images</label>
<input id="file" type="file" accept="image/*" multiple>
<button id="go">Upload all images</button>
<small>You can select multiple images at once. Maximum 25 MB per image.</small>
<div id="status"></div>
</div>
<script>
document.getElementById("go").onclick=async()=>{
  const input=document.getElementById("file"), s=document.getElementById("status");
  const files=input.files;
  if(!files.length){s.textContent="Choose one or more images.";return}
  const fd=new FormData();
  for(const f of files) fd.append("files",f,f.name);
  fd.append("folder",document.getElementById("folder").value);
  s.textContent="Uploading "+files.length+" images...";
  try{
    const r=await fetch("/__r2-upload",{
      method:"POST",
      headers:{"X-Upload-Token":document.getElementById("token").value},
      body:fd
    });
    const t=await r.text();
    s.textContent=r.ok?"Upload complete:\\n"+t:"Upload failed: "+t;
  }catch(e){
    s.textContent="Upload failed: "+e.message;
  }
};
</script>
</body>
</html>`;
