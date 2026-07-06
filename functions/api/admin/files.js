import { S3Client, ListObjectsV2Command, DeleteObjectCommand } from '@aws-sdk/client-s3';

function parseCookies(cookieHeader) {
  if (!cookieHeader) return {};
  return Object.fromEntries(
    cookieHeader.split('; ').map(c => {
      const idx = c.indexOf('=');
      return [c.substring(0, idx), c.substring(idx + 1)];
    })
  );
}

function checkAuth(request, env) {
  const cookieHeader = request.headers.get('Cookie') || '';
  const cookies = parseCookies(cookieHeader);
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

export async function onRequestGet(context) {
  const { request, env, url } = context;

  if (!checkAuth(request, env)) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  try {
    const bucketName = env.R2_BUCKET_NAME || 'arguable';
    const s3Client = getS3Client(env);
    const prefix = url.searchParams.get('prefix') || '';
    const maxKeys = parseInt(url.searchParams.get('maxKeys') || '1000');

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
        name: item.Key?.split('/').pop() || '',
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
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error) {
    return new Response(JSON.stringify({
      error: error.message || 'Server internal error',
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}

export async function onRequestDelete(context) {
  const { request, env, url } = context;

  if (!checkAuth(request, env)) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const key = url.searchParams.get('key');

  if (!key) {
    return new Response(JSON.stringify({ error: 'Missing key parameter' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  try {
    const bucketName = env.R2_BUCKET_NAME || 'arguable';
    const s3Client = getS3Client(env);

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
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error) {
    return new Response(JSON.stringify({
      error: error.message || 'Server internal error',
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
      'Access-Control-Allow-Methods': 'GET, DELETE, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Cookie',
      'Access-Control-Allow-Credentials': 'true',
      'Access-Control-Max-Age': '86400',
    },
  });
}
