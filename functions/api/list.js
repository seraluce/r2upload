import { S3Client, ListObjectsV2Command, DeleteObjectCommand } from '@aws-sdk/client-s3';

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
    'Access-Control-Allow-Methods': 'GET, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Max-Age': '86400',
  };
}

function getS3Client(env) {
  const accountId = env.CF_ACCOUNT_ID;
  const accessKeyId = env.R2_ACCESS_KEY_ID;
  const secretAccessKey = env.R2_SECRET_ACCESS_KEY;

  if (!accountId || !accessKeyId || !secretAccessKey) {
    throw new Error('Missing R2 credentials');
  }

  return new S3Client({
    region: 'auto',
    endpoint: `https://${accountId}.r2.cloudflarestorage.com`,
    credentials: {
      accessKeyId: accessKeyId,
      secretAccessKey: secretAccessKey,
    },
  });
}

export async function onRequest(context) {
  const { request, env } = context;
  const bucketName = env.R2_BUCKET_NAME || 'arguable';
  const url = new URL(request.url);
  const key = url.searchParams.get('key');

  if (request.method === 'OPTIONS') {
    return new Response(null, {
      status: 204,
      headers: handleCORS(request),
    });
  }

  try {
    const s3Client = getS3Client(env);

    if (request.method === 'DELETE' && key) {
      const command = new DeleteObjectCommand({
        Bucket: bucketName,
        Key: key,
      });

      await s3Client.send(command);

      return new Response(JSON.stringify({
        success: true,
        key: key,
      }), {
        status: 200,
        headers: {
          'Content-Type': 'application/json',
          ...handleCORS(request),
        },
      });
    }

    if (request.method === 'GET') {
      const prefix = url.searchParams.get('prefix') || 'uploads/';
      const maxKeys = parseInt(url.searchParams.get('maxKeys')) || 50;

      const command = new ListObjectsV2Command({
        Bucket: bucketName,
        Prefix: prefix,
        MaxKeys: maxKeys,
      });

      const response = await s3Client.send(command);

      const files = (response.Contents || []).map(item => ({
        key: item.Key,
        name: item.Key.split('/').pop(),
        size: item.Size,
        lastModified: item.LastModified?.toISOString(),
        etag: item.ETag?.replace(/"/g, ''),
      })).sort((a, b) => new Date(b.lastModified) - new Date(a.lastModified));

      return new Response(JSON.stringify({
        files: files,
        count: files.length,
        isTruncated: response.IsTruncated,
      }), {
        status: 200,
        headers: {
          'Content-Type': 'application/json',
          ...handleCORS(request),
        },
      });
    }

    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405,
      headers: {
        'Content-Type': 'application/json',
        ...handleCORS(request),
      },
    });

  } catch (error) {
    console.error('R2 operation error:', error);

    return new Response(JSON.stringify({
      error: error.message || 'Server internal error',
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
