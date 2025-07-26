import { net } from 'electron'

const REGEX = /\["(\bhttps?:\/\/[^"]+)",(\d+),(\d+)\],null/g

const unicodeToString = (content: string): string =>
  content.replace(/\\u[\dA-F]{4}/gi, (match) =>
    String.fromCharCode(parseInt(match.replace(/\\u/g, ''), 16))
  )

export interface Result {
  url: string
  height: number
  width: number
  color?: [number, number, number]
}

export interface Options {
  query?: Record<string, string>
  userAgent?: string
}

export async function gis(searchTerm: string, options: Options = {}): Promise<Result[]> {
  if (!searchTerm || typeof searchTerm !== 'string')
    throw new TypeError('searchTerm must be a string.')

  if (typeof options !== 'object') throw new TypeError('options parameter must be an object.')

  const {
    query = {},
    userAgent = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/134.0.0.0 Safari/537.36'
  } = options

  const response = await net.fetch(
    `http://www.google.com/search?${new URLSearchParams({
      ...query,
      udm: '2',
      tbm: 'isch',
      q: searchTerm
    }).toString()}`,
    {
      headers: {
        'User-Agent': userAgent
      }
    }
  )

  const body = await response.text()
  const content = body // will fix

  const results: Result[] = []
  let match: RegExpExecArray | null

  while ((match = REGEX.exec(content)) !== null) {
    results.push({
      url: unicodeToString(match[1]),
      height: +match[2],
      width: +match[3]
    })
  }

  return results
}
