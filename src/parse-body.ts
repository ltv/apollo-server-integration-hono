const parseFormURL = async (req: Request) => {
  const text = await req.text();
  const searchParams = new URLSearchParams(text);
  const res: { [params: string]: string } = {};
  searchParams.forEach((v, k) => (res[k] = v));
  return res;
};

type SupportedContentType =
  | 'application/graphql'
  | 'application/json'
  | 'application/x-www-form-urlencoded';

const contentTypeHandler: Record<
  SupportedContentType,
  (req: Request) => Promise<Record<string, unknown>>
> = {
  'application/graphql': async (req: Request) => ({ query: await req.text() }),
  'application/json': async (req: Request) => {
    try {
      return await req.json();
    } catch (e) {
      if (e instanceof Error) {
        console.error(`${e.stack ?? e.message}`);
      }
      throw Error(`POST body sent invalid JSON: ${e}`);
    }
  },
  'application/x-www-form-urlencoded': (req: Request) => parseFormURL(req),
};

export async function parseBody(
  req: Request,
): Promise<Record<string, unknown>> {
  const contentType = req.headers.get('content-type');
  if (!contentType) {
    return {};
  }

  const handler = contentTypeHandler[contentType as SupportedContentType];
  if (!handler) {
    return {};
  }

  return handler(req);
}
