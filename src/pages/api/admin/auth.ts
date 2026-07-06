const DEFAULT_PASSWORD = 'admin123';

function handleCORS(request: Request) {
  const origin = request.headers.get('Origin') || '';
  const allowedOrigins = [
    'http://localhost:8788',
    'http://localhost:4321',
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
    'Access-Control-Allow-Methods': 'POST, GET, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Cookie',
    'Access-Control-Allow-Credentials': 'true',
    'Access-Control-Max-Age': '86400',
  };
}

function parseCookies(cookieHeader: string): Record<string, string> {
  if (!cookieHeader) return {};
  return Object.fromEntries(
    cookieHeader.split('; ').map(c => {
      const idx = c.indexOf('=');
      return [c.substring(0, idx), c.substring(idx + 1)];
    })
  );
}

export const POST: APIRoute = async ({ request, locals }) => {
  const env = (locals as any).runtime?.env || {};
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
        headers: { 'Content-Type': 'application/json', ...handleCORS(request) },
      });

      response.headers.set('Set-Cookie', `admin_auth=${password}; Path=/; HttpOnly; SameSite=Lax; Max-Age=86400`);
      return response;
    } else {
      return new Response(JSON.stringify({
        success: false,
        error: 'Invalid password'
      }), {
        status: 401,
        headers: { 'Content-Type': 'application/json', ...handleCORS(request) },
      });
    }
  } catch (error) {
    return new Response(JSON.stringify({
      success: false,
      error: error.message
    }), {
      status: 400,
      headers: { 'Content-Type': 'application/json', ...handleCORS(request) },
    });
  }
};

export const GET: APIRoute = async ({ request, locals }) => {
  const env = (locals as any).runtime?.env || {};
  const adminPassword = env.ADMIN_PASSWORD || DEFAULT_PASSWORD;

  const cookieHeader = request.headers.get('Cookie') || '';
  const cookies = parseCookies(cookieHeader);
  const isAuthed = cookies.admin_auth === adminPassword;

  return new Response(JSON.stringify({
    authenticated: isAuthed
  }), {
    status: 200,
    headers: { 'Content-Type': 'application/json', ...handleCORS(request) },
  });
};

export const OPTIONS: APIRoute = async ({ request }) => {
  return new Response(null, {
    status: 204,
    headers: handleCORS(request),
  });
};
