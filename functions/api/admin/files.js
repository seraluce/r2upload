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

export async function onRequestGet(context) {
  const { request, env } = context;
  const url = new URL(request.url);

  if (!checkAuth(request, env)) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401,
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

    const prefix = url.searchParams.get('prefix') || '';
    const maxKeys = parseInt(url.searchParams.get('maxKeys') || '1000');

    let allFiles = [];
    let cursor = undefined;

    do {
      const result = await bucket.list({
        prefix: prefix,
        cursor: cursor,
        limit: Math.min(maxKeys - allFiles.length, 1000),
      });

      for (const item of result.objects) {
        allFiles.push({
          key: item.key,
          name: item.key.split('/').pop() || '',
          size: item.size,
          lastModified: item.uploaded?.toISOString() || item.lastModified?.toISOString(),
        });
      }

      cursor = result.truncated ? result.cursor : undefined;
    } while (cursor && allFiles.length < maxKeys);

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
  const { request, env } = context;
  const url = new URL(request.url);

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
      'Access-Control-Allow-Headers': 'Content-Type, Cookie',
      'Access-Control-Allow-Credentials': 'true',
      'Access-Control-Max-Age': '86400',
    },
  });
}
