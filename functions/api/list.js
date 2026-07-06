export async function onRequestGet(context) {
  const { request, env } = context;
  const url = new URL(request.url);

  try {
    const bucket = env.BUCKET;
    if (!bucket) {
      return new Response(JSON.stringify({ error: 'R2 bucket not bound' }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const prefix = url.searchParams.get('prefix') || 'uploads/';
    const maxKeys = parseInt(url.searchParams.get('maxKeys') || '50');

    let files = [];
    let cursor = undefined;

    do {
      const result = await bucket.list({
        prefix: prefix,
        cursor: cursor,
        limit: Math.min(maxKeys - files.length, 1000),
      });

      for (const item of result.objects) {
        files.push({
          key: item.key,
          name: item.key.split('/').pop() || '',
          size: item.size,
          lastModified: item.uploaded?.toISOString() || item.lastModified?.toISOString(),
        });
      }

      cursor = result.truncated ? result.cursor : undefined;
    } while (cursor && files.length < maxKeys);

    files.sort((a, b) => new Date(b.lastModified) - new Date(a.lastModified));

    return new Response(JSON.stringify({
      files: files,
      count: files.length,
      isTruncated: cursor !== undefined,
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
  const { request, env } = context;
  const url = new URL(request.url);
  const key = url.searchParams.get('key');

  if (!key) {
    return new Response(JSON.stringify({ error: 'Missing key parameter' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  try {
    const bucket = env.BUCKET;
    if (!bucket) {
      return new Response(JSON.stringify({ error: 'R2 bucket not bound' }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    await bucket.delete(key);

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
      'Access-Control-Allow-Headers': 'Content-Type',
      'Access-Control-Max-Age': '86400',
    },
  });
}
