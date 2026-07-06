const DEFAULT_PASSWORD = 'admin123';

function parseCookies(cookieHeader) {
  if (!cookieHeader) return {};
  return Object.fromEntries(
    cookieHeader.split('; ').map(c => {
      const idx = c.indexOf('=');
      return [c.substring(0, idx), c.substring(idx + 1)];
    })
  );
}

export async function onRequestPost(context) {
  const { request, env } = context;
  const adminPassword = env.ADMIN_PASSWORD || DEFAULT_PASSWORD;

  try {
    const body = await request.json();
    const { password } = body;

    if (password === adminPassword) {
      const response = new Response(JSON.stringify({
        success: true,
        message: 'Login successful'
      }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });

      response.headers.set('Set-Cookie', `admin_auth=${password}; Path=/; HttpOnly; SameSite=Lax; Max-Age=86400`);
      return response;
    } else {
      return new Response(JSON.stringify({
        success: false,
        error: 'Invalid password'
      }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' },
      });
    }
  } catch (error) {
    return new Response(JSON.stringify({
      success: false,
      error: error.message
    }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}

export async function onRequestGet(context) {
  const { request, env } = context;
  const adminPassword = env.ADMIN_PASSWORD || DEFAULT_PASSWORD;

  const cookieHeader = request.headers.get('Cookie') || '';
  const cookies = parseCookies(cookieHeader);
  const isAuthed = cookies.admin_auth === adminPassword;

  return new Response(JSON.stringify({
    authenticated: isAuthed
  }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });
}

export async function onRequestOptions() {
  return new Response(null, {
    status: 204,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'POST, GET, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Cookie',
      'Access-Control-Allow-Credentials': 'true',
      'Access-Control-Max-Age': '86400',
    },
  });
}
