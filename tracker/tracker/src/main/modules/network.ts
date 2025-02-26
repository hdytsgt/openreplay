import type App from '../app/index.js'
import { NetworkRequest } from '../app/messages.gen.js'
import { getTimeOrigin } from '../utils.js'

type WindowFetch = typeof window.fetch
type XHRRequestBody = Parameters<XMLHttpRequest['send']>[0]
type FetchRequestBody = RequestInit['body']

// Request:
// declare const enum BodyType {
//   Blob = "Blob",
//   ArrayBuffer = "ArrayBuffer",
//   TypedArray = "TypedArray",
//   DataView = "DataView",
//   FormData = "FormData",
//   URLSearchParams = "URLSearchParams",
//   Document = "Document", // XHR only
//   ReadableStream = "ReadableStream", // Fetch only
//   Literal = "literal",
//   Unknown = "unk",
// }
// XHRResponse body: ArrayBuffer, a Blob, a Document, a JavaScript Object, or a string

// TODO: extract maximum of useful information from any type of Request/Responce bodies
// function objectifyBody(body: any): RequestBody {
//   if (body instanceof Blob) {
//     return {
//       body: `<Blob type: ${body.type}>; size: ${body.size}`,
//       bodyType: BodyType.Blob,
//     }
//   }
//   return {
//     body,
//     bodyType: BodyType.Literal,
//   }
// }

function checkCacheByPerformanceTimings(requestUrl: string) {
  if (performance) {
    const timings = performance.getEntriesByName(requestUrl)[0]
    if (timings) {
      // @ts-ignore - weird ts typings, please refer to https://developer.mozilla.org/en-US/docs/Web/API/PerformanceNavigationTiming
      return timings.transferSize === 0 || timings.responseStart - timings.requestStart < 10
    }
  }
  return false
}

interface RequestData {
  body: XHRRequestBody | FetchRequestBody
  headers: Record<string, string>
}
interface ResponseData {
  body: any
  headers: Record<string, string>
}

interface RequestResponseData {
  readonly status: number
  readonly method: string
  url: string
  request: RequestData
  response: ResponseData
}

interface XHRRequestData {
  body: XHRRequestBody
  headers: Record<string, string>
}

function getXHRRequestDataObject(xhr: XMLHttpRequest): XHRRequestData {
  // @ts-ignore  this is 3x faster than using Map<XHR, XHRRequestData>
  if (!xhr.__or_req_data__) {
    // @ts-ignore
    xhr.__or_req_data__ = { body: undefined, headers: {} }
  }
  // @ts-ignore
  return xhr.__or_req_data__
}

function strMethod(method?: string) {
  return typeof method === 'string' ? method.toUpperCase() : 'GET'
}

type Sanitizer = (data: RequestResponseData) => RequestResponseData | null

export interface Options {
  sessionTokenHeader: string | boolean
  failuresOnly: boolean
  ignoreHeaders: Array<string> | boolean
  capturePayload: boolean
  sanitizer?: Sanitizer
}

export default function (app: App, opts: Partial<Options> = {}, customEnv?: Record<string, any>) {
  const options: Options = Object.assign(
    {
      failuresOnly: false,
      ignoreHeaders: ['Cookie', 'Set-Cookie', 'Authorization'],
      capturePayload: false,
      sessionTokenHeader: false,
    },
    opts,
  )

  const ignoreHeaders = options.ignoreHeaders
  const isHIgnored = Array.isArray(ignoreHeaders)
    ? (name: string) => ignoreHeaders.includes(name)
    : () => ignoreHeaders

  const stHeader =
    options.sessionTokenHeader === true ? 'X-OpenReplay-SessionToken' : options.sessionTokenHeader
  function setSessionTokenHeader(setRequestHeader: (name: string, value: string) => void) {
    if (stHeader) {
      const sessionToken = app.getSessionToken()
      if (sessionToken) {
        app.safe(setRequestHeader)(stHeader, sessionToken)
      }
    }
  }

  function sanitize(reqResInfo: RequestResponseData) {
    if (!options.capturePayload) {
      delete reqResInfo.request.body
      delete reqResInfo.response.body
    }
    if (options.sanitizer) {
      const resBody = reqResInfo.response.body
      if (typeof resBody === 'string') {
        // Parse response in order to have handy view in sanitisation function
        try {
          reqResInfo.response.body = JSON.parse(resBody)
        } catch {}
      }
      return options.sanitizer(reqResInfo)
    }
    return reqResInfo
  }

  function stringify(r: RequestData | ResponseData): string {
    if (r && typeof r.body !== 'string') {
      try {
        r.body = JSON.stringify(r.body)
      } catch {
        r.body = '<unable to stringify>'
        app.notify.warn("Openreplay fetch couldn't stringify body:", r.body)
      }
    }
    return JSON.stringify(r)
  }

  /* ====== Fetch ====== */
  const origFetch = customEnv
    ? (customEnv.fetch.bind(customEnv) as WindowFetch)
    : (window.fetch.bind(window) as WindowFetch)

  const trackFetch = (input: RequestInfo | URL, init: RequestInit = {}) => {
    if (!(typeof input === 'string' || input instanceof URL) || app.isServiceURL(String(input))) {
      return origFetch(input, init)
    }

    setSessionTokenHeader(function (name, value) {
      if (init.headers === undefined) {
        init.headers = {}
      }
      if (init.headers instanceof Headers) {
        init.headers.append(name, value)
      } else if (Array.isArray(init.headers)) {
        init.headers.push([name, value])
      } else {
        init.headers[name] = value
      }
    })

    const startTime = performance.now()
    return origFetch(input, init).then((response) => {
      const duration = performance.now() - startTime
      if (options.failuresOnly && response.status < 400) {
        return response
      }

      const r = response.clone()
      r.text()
        .then((text) => {
          const reqHs: Record<string, string> = {}
          const resHs: Record<string, string> = {}
          if (ignoreHeaders !== true) {
            // request headers
            const writeReqHeader = ([n, v]: [string, string]) => {
              if (!isHIgnored(n)) {
                reqHs[n] = v
              }
            }
            if (init.headers instanceof Headers) {
              init.headers.forEach((v, n) => writeReqHeader([n, v]))
            } else if (Array.isArray(init.headers)) {
              init.headers.forEach(writeReqHeader)
            } else if (typeof init.headers === 'object') {
              Object.entries(init.headers).forEach(writeReqHeader)
            }
            // response headers
            r.headers.forEach((v, n) => {
              if (!isHIgnored(n)) resHs[n] = v
            })
          }
          const method = strMethod(init.method)

          const reqResInfo = sanitize({
            url: String(input),
            method,
            status: r.status,
            request: {
              headers: reqHs,
              body: init.body,
            },
            response: {
              headers: resHs,
              body: text,
            },
          })
          if (!reqResInfo) {
            return
          }

          app.send(
            NetworkRequest(
              'fetch',
              method,
              String(reqResInfo.url),
              stringify(reqResInfo.request),
              stringify(reqResInfo.response),
              r.status,
              startTime + getTimeOrigin(),
              duration,
            ),
          )
        })
        .catch((e) => app.debug.error('Could not process Fetch response:', e))

      return response
    })
  }

  if (customEnv) {
    customEnv.fetch = trackFetch
  } else {
    window.fetch = trackFetch
  }
  /* ====== <> ====== */

  /* ====== XHR ====== */

  const nativeOpen = customEnv
    ? customEnv.XMLHttpRequest.prototype.open
    : XMLHttpRequest.prototype.open

  function trackXMLHttpReqOpen(initMethod: string, url: string | URL) {
    // @ts-ignore ??? this -> XMLHttpRequest
    const xhr = this as XMLHttpRequest
    setSessionTokenHeader((name, value) => xhr.setRequestHeader(name, value))

    let startTime = 0
    xhr.addEventListener('loadstart', (e) => {
      startTime = e.timeStamp
    })
    xhr.addEventListener(
      'load',
      app.safe((e) => {
        const { headers: reqHs, body: reqBody } = getXHRRequestDataObject(xhr)
        const duration = startTime > 0 ? e.timeStamp - startTime : 0

        const hString: string | null = ignoreHeaders ? '' : xhr.getAllResponseHeaders() // might be null (though only if no response received though)
        const resHs = hString
          ? hString
              .split('\r\n')
              .map((h) => h.split(':'))
              .filter((entry) => !isHIgnored(entry[0]))
              .reduce(
                (hds, [name, value]) => ({ ...hds, [name]: value }),
                {} as Record<string, string>,
              )
          : {}

        const method = strMethod(initMethod)
        const reqResInfo = sanitize({
          url: String(url),
          method,
          status: xhr.status,
          request: {
            headers: reqHs,
            body: reqBody,
          },
          response: {
            headers: resHs,
            body: xhr.response,
          },
        })
        if (!reqResInfo) {
          return
        }

        app.send(
          NetworkRequest(
            'xhr',
            method,
            String(reqResInfo.url),
            stringify(reqResInfo.request),
            stringify(reqResInfo.response),
            xhr.status,
            startTime + getTimeOrigin(),
            duration,
          ),
        )
      }),
    )

    //TODO: handle error (though it has no Error API nor any useful information)
    //xhr.addEventListener('error', (e) => {})
    // @ts-ignore ??? this -> XMLHttpRequest
    return nativeOpen.apply(this as XMLHttpRequest, arguments)
  }
  if (customEnv) {
    customEnv.XMLHttpRequest.prototype.open = trackXMLHttpReqOpen.bind(customEnv)
  } else {
    XMLHttpRequest.prototype.open = trackXMLHttpReqOpen
  }

  const nativeSend = XMLHttpRequest.prototype.send
  function trackXHRSend(body: Document | XMLHttpRequestBodyInit | null | undefined) {
    // @ts-ignore ??? this -> XMLHttpRequest
    const rdo = getXHRRequestDataObject(this as XMLHttpRequest)
    rdo.body = body

    // @ts-ignore ??? this -> XMLHttpRequest
    return nativeSend.apply(this as XMLHttpRequest, arguments)
  }

  if (customEnv) {
    customEnv.XMLHttpRequest.prototype.send = trackXHRSend.bind(customEnv)
  } else {
    XMLHttpRequest.prototype.send = trackXHRSend
  }

  const nativeSetRequestHeader = XMLHttpRequest.prototype.setRequestHeader

  function trackSetReqHeader(name: string, value: string) {
    if (!isHIgnored(name)) {
      // @ts-ignore ??? this -> XMLHttpRequest
      const rdo = getXHRRequestDataObject(this as XMLHttpRequest)
      rdo.headers[name] = value
    }
    // @ts-ignore ??? this -> XMLHttpRequest
    return nativeSetRequestHeader.apply(this as XMLHttpRequest, arguments)
  }

  if (customEnv) {
    customEnv.XMLHttpRequest.prototype.setRequestHeader = trackSetReqHeader.bind(customEnv)
  } else {
    XMLHttpRequest.prototype.setRequestHeader = trackSetReqHeader
  }
  /* ====== <> ====== */
}
