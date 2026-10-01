export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    if (url.pathname === "/") {
      return new Response(UPLOAD_HTML, {
        headers: { "content-type": "text/html; charset=UTF-8" }
      });
    }

    if (url.pathname === "/upload" && request.method === "POST") {
      const token = request.headers.get("X-Upload-Token");
      if (!env.UPLOAD_TOKEN || token !== env.UPLOAD_TOKEN) {
        return new Response("Unauthorized", { status: 401 });
      }

      const form = await request.formData();
      const file = form.get("file");
      const folder = String(form.get("folder") || "").trim().replace(/^\/+|\/+$/g, "");
      const filename = String(form.get("filename") || (file && file.name) || "").trim();

      if (!(file instanceof File) || !filename) {
        return new Response("Missing file or filename", { status: 400 });
      }

      if (!/^[a-zA-Z0-9._-]+$/.test(filename)) {
        return new Response("Invalid filename", { status: 400 });
      }

      const key = folder ? folder + "/" + filename : filename;
      const contentType = file.type || "application/octet-stream";

      await env.BUCKET.put(key, file.stream(), {
        httpMetadata: {
          contentType,
          contentDisposition: "inline",
          cacheControl: "public, max-age=31536000, immutable"
        }
      });

      return Response.json({
        ok: true,
        key,
        bytes: file.size,
        contentType,
        url: "https://images.haircutvibe.com/" + key
      });
    }

    return new Response("Not found", { status: 404 });
  }
};

const UPLOAD_HTML = `<!doctype html>
<html lang="en">
<head>
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>HaircutVibe R2 Upload</title>
<style>
body{font-family:-apple-system,BlinkMacSystemFont,sans-serif;background:#111;color:#eee;padding:24px;max-width:620px;margin:auto}
h1{color:#d8b46a}.box{background:#1b1b1b;border:1px solid #333;border-radius:14px;padding:20px;margin-top:18px}
input,button{width:100%;box-sizing:border-box;padding:14px;margin:8px 0;border-radius:10px;border:1px solid #444;background:#222;color:#fff}
button{background:#d8b46a;color:#111;font-weight:700;border:0}
#status{white-space:pre-wrap;margin-top:15px}
</style>
</head>
<body>
<h1>HaircutVibe R2 Upload</h1>
<div class="box">
<label>Folder</label>
<input id="folder" value="festival-hairstyles-2026">
<label>File name</label>
<input id="filename" placeholder="01.png">
<label>Upload token</label>
<input id="token" type="password" placeholder="Token">
<input id="file" type="file" accept="image/*">
<button id="go">Upload to R2</button>
<div id="status"></div>
</div>
<script>
const fileInput=document.getElementById("file");
fileInput.onchange=()=>{if(fileInput.files[0]&&!document.getElementById("filename").value)document.getElementById("filename").value=fileInput.files[0].name};
document.getElementById("go").onclick=async()=>{
 const f=fileInput.files[0], s=document.getElementById("status");
 if(!f){s.textContent="Choose an image.";return}
 const fd=new FormData();
 fd.append("file",f); fd.append("folder",document.getElementById("folder").value); fd.append("filename",document.getElementById("filename").value);
 s.textContent="Uploading...";
 try{
  const r=await fetch("/upload",{method:"POST",headers:{"X-Upload-Token":document.getElementById("token").value},body:fd});
  const t=await r.text(); s.textContent=r.ok?"Uploaded successfully:\n"+t:"Upload failed: "+t;
 }catch(e){s.textContent="Upload failed: "+e.message}
};
</script>
</body></html>`;
