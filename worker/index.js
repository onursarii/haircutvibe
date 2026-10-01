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
      const file = form.get("file");
      const folder = cleanPathPart(form.get("folder"));
      const filename = cleanFilename(
        form.get("filename") || (file instanceof File ? file.name : "")
      );

      if (!(file instanceof File) || !filename) {
        return new Response("Missing file or filename", { status: 400 });
      }

      if (file.size > MAX_FILE_SIZE) {
        return new Response("File is larger than 25 MB", { status: 413 });
      }

      if (!file.type || !file.type.startsWith("image/")) {
        return new Response("Only image files are allowed", { status: 415 });
      }

      const key = folder ? folder + "/" + filename : filename;

      await env.BUCKET.put(key, file.stream(), {
        httpMetadata: {
          contentType: file.type,
          contentDisposition: "inline",
          cacheControl: "public, max-age=31536000, immutable"
        }
      });

      return Response.json({
        ok: true,
        key,
        bytes: file.size,
        contentType: file.type,
        url: "https://images.haircutvibe.com/" + key
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
#status{white-space:pre-wrap;margin-top:15px;word-break:break-word}
small{color:#aaa}
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
<input id="token" type="password" autocomplete="off" placeholder="Enter upload token">
<label>Image</label>
<input id="file" type="file" accept="image/*">
<button id="go">Upload to R2</button>
<small>Maximum file size: 25 MB</small>
<div id="status"></div>
</div>
<script>
const fileInput=document.getElementById("file");
const filenameInput=document.getElementById("filename");
fileInput.onchange=()=>{
  if(fileInput.files[0]) filenameInput.value=fileInput.files[0].name;
};
document.getElementById("go").onclick=async()=>{
  const f=fileInput.files[0], s=document.getElementById("status");
  if(!f){s.textContent="Choose an image.";return}
  const fd=new FormData();
  fd.append("file",f);
  fd.append("folder",document.getElementById("folder").value);
  fd.append("filename",filenameInput.value);
  s.textContent="Uploading...";
  try{
    const r=await fetch("/__r2-upload",{
      method:"POST",
      headers:{"X-Upload-Token":document.getElementById("token").value},
      body:fd
    });
    const t=await r.text();
    s.textContent=r.ok?"Uploaded successfully:\\n"+t:"Upload failed: "+t;
  }catch(e){
    s.textContent="Upload failed: "+e.message;
  }
};
</script>
</body>
</html>`;
