import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';

function handleCORS(request) {
  const origin = request.headers.get('Origin') || '';
  const allowedOrigins = [
    'http://localhost:8788',
    'http://localhost:5173',
    'https://*.pages.dev',
  ];

  const isAllowed = allowedOrigins.some(pattern => {
    if (pattern.includes('*')) {
      const regex = new RegExp(pattern.replace(/\*/g, '.*'));
      return regex.test(origin);
    }
    return origin === pattern;
  });

  return {
    'Access-Control-Allow-Origin': isAllowed ? origin : 'https://*.pages.dev',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Max-Age': '86400',
  };
}

export async function onRequest(context) {
  const { request, env } = context;

  if (request.method === 'OPTIONS') {
    return new Response(null, {
      status: 204,
      headers: handleCORS(request),
    });
  }

  if (request.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405,
      headers: {
        'Content-Type': 'application/json',
        ...handleCORS(request),
      },
    });
  }

  try {
    const body = await request.json();
    const { filename, contentType, size } = body;

    if (!filename) {
      return new Response(JSON.stringify({ error: '缺少文件名参数' }), {
        status: 400,
        headers: {
          'Content-Type': 'application/json',
          ...handleCORS(request),
        },
      });
    }

    const MAX_SIZE = 100 * 1024 * 1024;
    if (size && size > MAX_SIZE) {
      return new Response(JSON.stringify({
        error: `文件大小超过限制 (最大 ${MAX_SIZE / 1024 / 1024}MB)`
      }), {
        status: 413,
        headers: {
          'Content-Type': 'application/json',
          ...handleCORS(request),
        },
      });
    }

    const ext = filename.substring(filename.lastIndexOf('.')).toLowerCase();
    const dangerousExt = ['.php', '.exe', '.sh', '.bat', '.js', '.html', '.htm', '.asp', '.jsp', '.py', '.pl'];
    if (dangerousExt.includes(ext)) {
      return new Response(JSON.stringify({
        error: `不允许上传 ${ext} 类型的文件`
      }), {
        status: 403,
        headers: {
          'Content-Type': 'application/json',
          ...handleCORS(request),
        },
      });
    }

    const cleanName = filename.replace(/[^a-zA-Z0-9\u4e00-\u9fa5.\-_\s]/g, '');
    const finalName = cleanName || `file-${Date.now()}${ext}`;

    const timestamp = Date.now();
    const randomId = crypto.randomUUID ? crypto.randomUUID().substring(0, 8) :
      Math.random().toString(36).substring(2, 10);
    const date = new Date();
    const datePath = `${date.getFullYear()}/${String(date.getMonth() + 1).padStart(2, '0')}`;
    const key = `uploads/${datePath}/${timestamp}-${randomId}-${finalName}`;

    const accountId = env.CF_ACCOUNT_ID;
    const accessKeyId = env.R2_ACCESS_KEY_ID;
    const secretAccessKey = env.R2_SECRET_ACCESS_KEY;
    const bucketName = env.R2_BUCKET_NAME || 'arguable';

    if (!accountId || !accessKeyId || !secretAccessKey) {
      console.error('缺少 R2 凭证配置');
      return new Response(JSON.stringify({
        error: '服务器配置错误: 缺少 R2 凭证',
        debug: {
          hasAccountId: !!accountId,
          hasAccessKeyId: !!accessKeyId,
          hasSecretAccessKey: !!secretAccessKey,
        }
      }), {
        status: 500,
        headers: {
          'Content-Type': 'application/json',
          ...handleCORS(request),
        },
      });
    }

    const s3Client = new S3Client({
      region: 'auto',
      endpoint: `https://${accountId}.r2.cloudflarestorage.com`,
      credentials: {
        accessKeyId: accessKeyId,
        secretAccessKey: secretAccessKey,
      },
    });

    const command = new PutObjectCommand({
      Bucket: bucketName,
      Key: key,
      ContentType: contentType,
    });

    const uploadURL = await getSignedUrl(s3Client, command, {
      expiresIn: 300,
    });

    return new Response(JSON.stringify({
      uploadURL: uploadURL,
      key: key,
      filename: finalName,
      expiresIn: 300,
      bucket: bucketName,
    }), {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        ...handleCORS(request),
      },
    });

  } catch (error) {
    console.error('生成预签名 URL 错误:', error);

    return new Response(JSON.stringify({
      error: error.message || '服务器内部错误',
      timestamp: new Date().toISOString(),
    }), {
      status: 500,
      headers: {
        'Content-Type': 'application/json',
        ...handleCORS(request),
      },
    });
  }
}
