import { NextResponse } from 'next/server';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const targetUrl = searchParams.get('url');

  if (!targetUrl) {
    return NextResponse.json({ error: 'Missing target url' }, { status: 400 });
  }

  // VULNERABILITY: Server-Side Request Forgery (SSRF)
  // Fetching an unvalidated user-supplied URL
  // This can be used to access internal Vercel/AWS metadata or local services.
  try {
    const response = await fetch(targetUrl);
    const data = await response.text();
    
    // An attacker might also try to extract internal env variables if exposed
    // const leak = process.env.VERCEL_URL;

    return new NextResponse(data, {
      status: 200,
      headers: {
        'Content-Type': response.headers.get('content-type') || 'text/plain',
      },
    });
  } catch (error) {
    return NextResponse.json({ error: 'Failed to proxy request' }, { status: 500 });
  }
}
