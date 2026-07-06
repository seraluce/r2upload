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
    'Access-Control-Allow-Headers': 'Content-Type, Cookie',
    'Access-Control-Allow-Credentials': 'true',
    'Access-Control-Max-Age': '86400',
  };
}

function checkAuth(request, env) {
  const cookieHeader = request.headers.get('Cookie') || '';
  const cookies = Object.fromEntries(
    cookieHeader.split('; ').map(c => c.split('='))
  );
  const adminPassword = env.ADMIN_PASSWORD || 'admin123';
  return cookies.admin_auth === adminPassword;
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

  if (!checkAuth(request, env)) {
    return new Response(JSON.stringify({
      error: 'Unauthorized'
    }), {
      status: 401,
      headers: {
        'Content-Type': 'application/json',
        ...handleCORS(request),
      },
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
      const maxKeys = parseInt(url.searchParams.get('maxKeys')) || 200;

      let allFiles = [];
      let continuationToken = null;

      do {
        const params = {
          Bucket: bucketName,
          Prefix: prefix,
          MaxKeys: Math.min(maxKeys - allFiles.length, 1000),
        };

        if (continuationToken) {
          params.ContinuationToken = continuationToken;
        }

        const command = new ListObjectsV2Command(params);
        const response = await s3Client.send(command);

        const files = (response.Contents || []).map(item => ({
          key: item.Key,
          name: item.Key.split('/').pop(),
          size: item.Size,
          lastModified: item.LastModified?.toISOString(),
          etag: item.ETag?.replace(/"/g, ''),
        }));

        allFiles = [...allFiles, ...files];
        continuationToken = response.IsTruncated ? response.NextContinuationToken : null;
      } while (continuationToken && allFiles.length < maxKeys);

      allFiles.sort((a, b) => new Date(b.lastModified) - new Date(a.lastModified));

      return new Response(JSON.stringify({
        files: allFiles,
        count: allFiles.length,
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
    console.error('R2 admin operation error:', error);

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
