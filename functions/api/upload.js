export async function onRequestPost(context) {
  const { request, env } = context;

  try {
    const bucket = env.BUCKET;
    if (!bucket) {
      return new Response(JSON.stringify({
        error: '服务器配置错误: R2 bucket 未绑定',
      }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const contentType = request.headers.get('Content-Type') || '';
    if (contentType.startsWith('multipart/form-data')) {
      const formData = await request.formData();
      const file = formData.get('file');
      if (!file) {
        return new Response(JSON.stringify({ error: '缺少文件参数' }), {
          status: 400,
          headers: { 'Content-Type': 'application/json' },
        });
      }

      const filename = file.name;
      const size = file.size;

      const MAX_SIZE = 100 * 1024 * 1024;
      if (size > MAX_SIZE) {
        return new Response(JSON.stringify({
          error: `文件大小超过限制 (最大 ${MAX_SIZE / 1024 / 1024}MB)`
        }), {
          status: 413,
          headers: { 'Content-Type': 'application/json' },
        });
      }

      const ext = filename.substring(filename.lastIndexOf('.')).toLowerCase();
      const dangerousExt = ['.php', '.exe', '.sh', '.bat', '.html', '.htm', '.asp', '.jsp', '.py', '.pl'];
      if (dangerousExt.includes(ext)) {
        return new Response(JSON.stringify({
          error: `不允许上传 ${ext} 类型的文件`
        }), {
          status: 403,
          headers: { 'Content-Type': 'application/json' },
        });
      }

      const cleanName = filename.replace(/[^a-zA-Z0-9\u4e00-\u9fa5.\-_\s]/g, '');
      const finalName = cleanName || `file-${Date.now()}${ext}`;

      const timestamp = Date.now();
      const randomId = crypto.randomUUID().substring(0, 8);
      const date = new Date();
      const datePath = `${date.getFullYear()}/${String(date.getMonth() + 1).padStart(2, '0')}`;
      const key = `uploads/${datePath}/${timestamp}-${randomId}-${finalName}`;

      const arrayBuffer = await file.arrayBuffer();

      await bucket.put(key, arrayBuffer, {
        httpMetadata: { contentType: file.type || 'application/octet-stream' },
      });

      return new Response(JSON.stringify({
        success: true,
        key: key,
        filename: finalName,
        size: size,
      }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    } else {
      return new Response(JSON.stringify({ error: '请使用 multipart/form-data 上传文件' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }
  } catch (error) {
    return new Response(JSON.stringify({
      error: error.message || '服务器内部错误',
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}

export async function onRequestOptions() {
  return new Response(null, {
    status: 204,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
      'Access-Control-Max-Age': '86400',
    },
  });
}
