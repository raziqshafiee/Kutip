import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { sendViaCloudApi } from '../whatsapp/cloudApi'

function mockFetch(ok: boolean, body: unknown) {
  return vi.fn().mockResolvedValue({
    ok,
    status: ok ? 200 : 400,
    text: async () => JSON.stringify(body),
    json: async () => body,
  }) as unknown as typeof fetch
}

describe('sendViaCloudApi', () => {
  const business = {
    cloudApiPhoneNumberId: '1234567890',
    cloudApiAccessToken: 'EAAToken123',
  }

  beforeEach(() => {
    vi.stubGlobal('fetch', mockFetch(true, { messages: [{ id: 'wamid_1' }] }))
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('returns success with the provider message id', async () => {
    const result = await sendViaCloudApi(business, '+60123456789', 'Hello')
    expect(result.success).toBe(true)
    expect(result.messageId).toBe('wamid_1')
  })

  it('posts to the correct Graph API endpoint with auth header', async () => {
    await sendViaCloudApi(business, '+60123456789', 'Hello')
    const fetchMock = fetch as unknown as ReturnType<typeof vi.fn>
    const [url, opts] = fetchMock.mock.calls[0]
    expect(url).toContain('/1234567890/messages')
    expect((opts.headers as Record<string, string>).Authorization).toBe('Bearer EAAToken123')
    const parsed = JSON.parse(opts.body as string)
    expect(parsed.to).toBe('60123456789') // '+' stripped
    expect(parsed.text.body).toBe('Hello')
  })

  it('returns failure when credentials are missing', async () => {
    const result = await sendViaCloudApi({ cloudApiPhoneNumberId: null, cloudApiAccessToken: null }, '+60123456789', 'Hi')
    expect(result.success).toBe(false)
  })

  it('returns failure when the API returns an error', async () => {
    vi.stubGlobal('fetch', mockFetch(false, { error: 'boom' }))
    const result = await sendViaCloudApi(business, '+60123456789', 'Hi')
    expect(result.success).toBe(false)
    expect(result.error).toContain('Cloud API error 400')
  })
})