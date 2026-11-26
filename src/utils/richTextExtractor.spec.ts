import { describe, expect, test } from 'vitest'

import { defaultNotificationTransformer, extractTextFromRichText } from './richTextExtractor'

const text = (value: string, format = 0) => ({
  type: 'text',
  detail: 0,
  format,
  mode: 'normal',
  style: '',
  text: value,
  version: 1,
})

const element = (type: string, children: unknown[], extra: Record<string, unknown> = {}) => ({
  type,
  children,
  direction: 'ltr',
  format: '',
  indent: 0,
  version: 1,
  ...extra,
})

/** Serialized editor state as Payload 3's Lexical editor stores it. */
const lexical = (...children: unknown[]) => ({ root: element('root', children) })

describe('extractTextFromRichText with Lexical editor state', () => {
  test('reads the text of a single paragraph', () => {
    expect(extractTextFromRichText(lexical(element('paragraph', [text('See you on Friday.')])))).toBe(
      'See you on Friday.',
    )
  })

  test('joins formatted text runs inside a paragraph without adding spaces', () => {
    const state = lexical(element('paragraph', [text('Book'), text('ing', 1), text(' confirmed.')]))
    expect(extractTextFromRichText(state)).toBe('Booking confirmed.')
  })

  test('separates headings, paragraphs, quotes and list items with a space', () => {
    const state = lexical(
      element('heading', [text('Trip update')], { tag: 'h2' }),
      element('paragraph', [text('Bring the following:')]),
      element(
        'list',
        [
          element('listitem', [text('a towel')], { value: 1 }),
          element('listitem', [text('sunscreen')], { value: 2 }),
        ],
        { listType: 'bullet', start: 1, tag: 'ul' },
      ),
      element('quote', [text('See you there!')]),
    )
    expect(extractTextFromRichText(state)).toBe(
      'Trip update Bring the following: a towel sunscreen See you there!',
    )
  })

  test('keeps link text inline and turns line breaks into spaces', () => {
    const state = lexical(
      element('paragraph', [
        text('Read the '),
        element('link', [text('details')], { fields: { url: 'https://example.com' } }),
        text('.'),
        { type: 'linebreak', version: 1 },
        text('Thanks'),
      ]),
    )
    expect(extractTextFromRichText(state)).toBe('Read the details. Thanks')
  })

  test('skips empty paragraphs and nodes without text', () => {
    const state = lexical(
      element('paragraph', []),
      element('paragraph', [text('Hello')]),
      { type: 'upload', relationTo: 'media', value: 1, version: 3 },
      element('paragraph', [text('world')]),
    )
    expect(extractTextFromRichText(state)).toBe('Hello world')
  })

  test('returns an empty string for an empty editor state', () => {
    expect(extractTextFromRichText(lexical())).toBe('')
    expect(extractTextFromRichText(lexical(element('paragraph', [])))).toBe('')
  })
})

describe('extractTextFromRichText with other inputs', () => {
  test('returns strings unchanged and empty values as an empty string', () => {
    expect(extractTextFromRichText('Plain message')).toBe('Plain message')
    expect(extractTextFromRichText(null)).toBe('')
    expect(extractTextFromRichText(undefined)).toBe('')
    expect(extractTextFromRichText({})).toBe('')
  })

  test('separates Slate blocks with a space and keeps inline links in line', () => {
    const slate = [
      { type: 'h1', children: [{ text: 'Welcome' }] },
      {
        children: [
          { text: 'Visit ' },
          { type: 'link', children: [{ bold: true, text: 'our site' }], url: 'https://example.com' },
          { text: ' today.' },
        ],
      },
    ]
    expect(extractTextFromRichText(slate)).toBe('Welcome Visit our site today.')
  })
})

describe('defaultNotificationTransformer with a Lexical message', () => {
  test('uses the message text as the push body instead of the generic fallback', () => {
    const content = defaultNotificationTransformer({
      id: 1,
      message: lexical(element('paragraph', [text('See you on Friday.')])),
      title: 'Booking confirmed',
    })
    expect(content.body).toBe('See you on Friday.')
  })

  test('falls back to the generic body only when the message has no text', () => {
    const content = defaultNotificationTransformer({ id: 1, message: lexical(), title: 'Empty' })
    expect(content.body).toBe('You have a new notification')
  })
})
